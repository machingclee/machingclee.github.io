const n=`---
title: "Kafka and Debezium with Everything Hosted Locally Without Confluent"
date: 2024-04-28
id: blog0258
tag: kafka, debezium
intro: "In the past we have studied CDC with the help of confluent [***here***](/blog/article/CDC-in-Confluent-and-Kafka). This time we host everything locally to prepare ourselves to host CDC without the dependency on confluent."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Repository

- https://github.com/machingclee/2024-04-28-debezium-pgsql-monitoring-template


### Docker-Compose File and Registration of Debezium Connector

#### Spin up Instances

The docker-compose file is modified from [***this repository***](https://github.com/irtiza07/postgres_debezium_cdc/blob/master/docker-compose.yaml) with tutorial [***in this video***](https://www.youtube.com/watch?v=YZRHqRznO-o&t=583s)


\`\`\`yml
version: "3.7"
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:5.5.3
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-enterprise-kafka:5.5.3
    depends_on: [ zookeeper ]
    ports:
      - 29092:29092
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_ZOOKEEPER_CONNECT: "zookeeper:2181"
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT     

  debezium:
    image: debezium/connect:1.4
    environment:
      BOOTSTRAP_SERVERS: kafka:9092
      GROUP_ID: 1
      CONFIG_STORAGE_TOPIC: connect_configs
      OFFSET_STORAGE_TOPIC: connect_offsets
      KEY_CONVERTER: org.apache.kafka.connect.storage.StringConverter
      VALUE_CONVERTER: org.apache.kafka.connect.json.JsonConverter
      VALUE_CONVERTER_SCHEMAS_ENABLE: false
      CONNECT_KEY_CONVERTER_SCHEMA_REGISTRY_URL: http://schema-registry:8081
      CONNECT_VALUE_CONVERTER_SCHEMA_REGISTRY_URL: http://schema-registry:8081
    depends_on: [ kafka ]
    ports:
      - 8083:8083

  schema-registry:
    image: confluentinc/cp-schema-registry:5.5.3
    environment:
      - SCHEMA_REGISTRY_KAFKASTORE_CONNECTION_URL=zookeeper:2181
      - SCHEMA_REGISTRY_HOST_NAME=schema-registry
      - SCHEMA_REGISTRY_LISTENERS=http://schema-registry:8081,http://localhost:8081
    ports:
      - 8081:8081
    depends_on: [ zookeeper, kafka ]
\`\`\`

#### Configure a project-root/debezium.json for an Instance of Connector

\`\`\`json
{
    "name": "billie-connector",
    "config": {
        "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
        "plugin.name": "pgoutput",
        "database.hostname": "xxx.rds.amazonaws.com",
        "database.port": "5432",
        "database.user": "xxx",
        "database.password": "yyy",
        "database.dbname": "zzz",
        "database.server.name": "postgres",
        "table.include.list": "public.MessagesSession,public.SummaryFollow,public.LLMSummary,public.UserToProject,public.UserToChannel"
    }
}
\`\`\`

From experience this \`database.server.name\` will determine the topic name in Kafka. 

For example, we will be having
- postgres.public.LLMSummary
- postgres.public.MessagesSession
- postgres.public.SummaryFollow
- postgres.public.UserToChannel
- postgres.public.UserToProject

as our topics to listen. 

#### Create Debezium Source Connector from the Configuration

##### Post Request to Create a Connector

Let's execute the following in a bash shell:
\`\`\`bash
curl -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" 127.0.0.1:8083/connectors/ --data "@debezium.json"
\`\`\`
##### Health-check the connector
Let's health-check the latest connector:
\`\`\`bash
curl -H "Accept:application/json" localhost:8083/connectors/billie-connector/status
\`\`\`
##### List all Topics Created
Note that the name of the running container ***depends on*** your ***working directory name***.
\`\`\`bash
docker exec -it <directory-name>-kafka-1 bash
\`\`\`
and then run
\`\`\`bash
/usr/bin/kafka-topics --bootstrap-server localhost:9092 --list
\`\`\`

In my case I get:
\`\`\`text
__confluent.support.metrics
__consumer_offsets
_schemas
connect-status
connect_configs
connect_offsets
postgres.public.LLMSummary
postgres.public.MessagesSession
postgres.public.SummaryFollow
postgres.public.UserToChannel
postgres.public.UserToProject
\`\`\`


### Adjust the Logical Replication Level

Without full identity we cannot capture the ***state before changes*** (which will be \`null\` in the messages from Kafka), let's adjust it:

\`\`\`sql
ALTER TABLE "LLMSummary" REPLICA IDENTITY FULL;
ALTER TABLE "MessagesSession" REPLICA IDENTITY FULL;
ALTER TABLE "SummaryFollow" REPLICA IDENTITY FULL;
ALTER TABLE "UserToChannel" REPLICA IDENTITY FULL;
ALTER TABLE "UserToProject" REPLICA IDENTITY FULL;
\`\`\`

### Listening to the Topics

#### main.js

Let's try [**kafkajs**](https://www.npmjs.com/package/kafkajs) instead of [**node-rdkafka**](https://www.npmjs.com/package/node-rdkafka):

\`\`\`text
yarn add kafkajs
\`\`\`
with 

\`\`\`js
const { Kafka } = require('kafkajs')

const kafka = new Kafka({
    clientId: 'my-app',
    brokers: ['localhost:29092']
})

const topics = [
    "postgres.public.LLMSummary",
    "postgres.public.MessagesSession",
    "postgres.public.SummaryFollow",
    "postgres.public.UserToChannel",
    "postgres.public.UserToProject"
];
const run = async () => {
    const consumer = kafka.consumer({ groupId: "kafka" });
    consumer.subscribe({ topics, fromBeginning: false })
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const payload = JSON.parse(message.value.toString()).payload;
            console.log("------------------------")
            console.log(topic)
            console.log(payload)
        },
    })
}

run().catch(console.error);

process.on('uncaughtException', function (err) {
    logger.error(err.stack);
    logger.info("Node NOT Exiting...");
});
\`\`\`

#### Results

Suppose that I have done an action in our frontend, then it is very clear what happened in the backend:

[![](/assets/img/2024-04-28-03-57-11.png)](/assets/img/2024-04-28-03-57-11.png)

For example:

- What is ***inserted*** into the database
- What is ***updated*** into the database

It helps understand the business from the tables and understand the tables from the business as well.`;export{n as default};
