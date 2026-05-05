const e=`---
title: "Scheduled Tasks in ECS: Demonstration via Regular Database Backup"
date: 2024-10-27
id: blog0333
tag: ecs, aws, db-backup, sql
toc: true
intro: "We study scheduled tasks by doing a regular backup of databases (pgsql + mongo) on a hourly basis."
---


<style>
  img {
    max-width: 660px;
  }
</style>


### Why ECS For Scheduled Task Instead of Lambda?

<center>
<img src="/assets/img/2024-10-27-17-47-42.png"/>
</center>
<center>
Project Sturcture
</center>


#### Comparison

*From Claude-3.5-Sonnet*: 
- ECS Scheduled Tasks advantages:
  1. No time limits (Lambda has 15-min max)

  2. Better for large database backups
  3. More memory available (up to 30GB vs Lambda's 10GB)
  4. Can use same Docker image as your application
  5. Better for CPU-intensive tasks
  6. No cold starts

- Lambda with SQS advantages:
  1. More cost-effective for short tasks

  2. Serverless, less configuration
  3. Better for small databases
  4. Auto-scaling built in
  5. Pay only for execution time
  6. Easier to implement and maintain

#### My Experience

- To me deploying in ECS has a ***greater flexibility*** of what image to choose, I am not confined to images that are inherited from \`public.ecr.aws/lambda/provided:al2\`;

- For example, if I mainly focuses on installing binaries for running \`pg_dump\` or \`mongodump\`, I don't need to care about finding resources to download \`CentOS\`-specific packages (on which the official docker image for lambda function bases);

- The ecosystem in \`Debian\`/\`Ubuntu\` is much more friendly to developers, resulting in much more repositories and up-to-date-packages.

### Building Docker Images for ECS Tasks

#### The shell scripts
##### backup_pgsql.sh

\`\`\`bash
#!/bin/bash

TMP_BACKUP_DIR="/var/task"
mkdir -p $TMP_BACKUP_DIR

# define the filename by timestamp
TIMESTAMP=$(TZ='UTC+0' date -d '+8 hours' +%Y-%m-%d_%Hh%Mm%Ss)
BACKUP_FILE="$TMP_BACKUP_DIR/backup_\${STAGE}_\${PG_DB_NAME}_\${TIMESTAMP}.dump"

# for psql, pg_dump, pg_restore etc (therefore no password prompt)
export PGPASSWORD=$PG_DB_PASSWORD

CONN_STRING="postgresql://$PG_DB_USER:$PG_DB_PASSWORD@$PG_DB_HOST/$PG_DB_NAME?options=\${NEON_DB_ENDPOINT_OPTION}"
pg_dump $CONN_STRING -F c -f $BACKUP_FILE

# upload to S3
aws s3 cp "\${BACKUP_FILE}" "s3://\${S3_BUCKET}/\${STAGE}/\${TIMESTAMP}_PGSQL/"

echo "Backup completed successfully"
\`\`\`

##### backup_mongo.sh

\`\`\`bash
#!/bin/bash

# define the filename by timestamp
TIMESTAMP=$(TZ='UTC+0' date -d '+8 hours' +%Y-%m-%d_%Hh%Mm%Ss)
BACKUP_ZIP_FILENAME=\${MONGO_DB_NAME}_\${TIMESTAMP}.zip

# clone data from backup
mongodump --uri "$MONGO_CONNECTION_STRING" --out /var/task/mongo_backup

# make sure to zip only the folder mongo_backup/ but not the folders /var/task
cd /var/task
zip -rv $BACKUP_ZIP_FILENAME mongo_backup/

# upload to S3
aws s3 cp "/var/task/\${BACKUP_ZIP_FILENAME}" "s3://\${S3_BUCKET}/\${STAGE}/\${TIMESTAMP}_MONGO/"
\`\`\`

#### The Docker Images
##### The Environment Variables and remark on SNI from neon-tech

Now let's summarize the \`env\`'s we need in order for the scripts to be functioning:

\`\`\`bash{3,4}
MONGO_CONNECTION_STRING="mongodb+srv://username:password@host/db_name?retryWrites=true&w=majority"
MONGO_DB_NAME=db_name
PG_DB_HOST=ep-aged-morning-26453078.ap-southeast-1.aws.neon.tech
NEON_DB_ENDPOINT_OPTION=endpoint%3Dep-aged-morning-26453078
PG_DB_NAME=
PG_DB_USER=
PG_DB_PASSWORD=
S3_BUCKET=
STAGE=
\`\`\`

- Here we highlighted the ***neon-tech specific requirements*** since the service requires the pgsql client library or application to support the ***Server Name Indication*** (SNI) ([more throughout documentation](https://neon.tech/docs/connect/connection-errors)).

- To get around the problem we simply add \`options=$NEON_DB_ENDPOINT_OPTION\` in the connection string, which however needs to be \`URL\`-encoded.

- Therefore you can observe the occurence of \`%3D\`:

  ![](/assets/img/2024-10-27-17-43-26.png)


##### Dockerfile

Finally we need to define a Docker container that installs all the binaries we need. We start from \`postgres:15\` since it have provided all the \`pgsql\`-related utils for us:

\`\`\`dockerfile
FROM postgres:15

RUN apt-get update 
RUN apt-get install -y curl zip unzip wget
RUN wget https://fastdl.mongodb.org/tools/db/mongodb-database-tools-debian11-x86_64-100.9.0.deb
RUN dpkg -i mongodb-database-tools-debian11-x86_64-100.9.0.deb
RUN apt-get clean
RUN rm -rf /var/lib/apt/lists/*

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \\
    unzip awscliv2.zip && \\
    ./aws/install && \\
    rm -rf awscliv2.zip aws

COPY backup_pgsql.sh /var/task
COPY backup_mongo.sh /var/task
RUN chmod +x /var/task/backup_pgsql.sh
RUN chmod +x /var/task/backup_mongo.sh

# if want to run in parallel, we should try:
# ENTRYPOINT ["/bin/bash", "-c", "/var/task/backup_pgsql.sh & /var/task/backup_mongo.sh & wait"]
ENTRYPOINT ["/bin/bash", "-c", "/var/task/backup_pgsql.sh && /var/task/backup_mongo.sh"]
\`\`\`

##### build.sh: Push the Image to the Registry

Let's create a repository to our private container registry named \`billie-db-backup\` (***no need to specify the stage*** because this image will be reused by all stages)


![](/assets/img/2024-10-27-18-15-24.png)

which we just copy and paste for convenience:

\`\`\`bash
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 798404461798.dkr.ecr.ap-southeast-2.amazonaws.com

docker build -t billie-db-backup .
docker tag billie-db-backup:latest 798404461798.dkr.ecr.ap-southeast-2.amazonaws.com/billie-db-backup:latest
docker push 798404461798.dkr.ecr.ap-southeast-2.amazonaws.com/billie-db-backup:latest
\`\`\`


### Create the ECS Scheduled Task

#### Fill in the form


- We create separate clusters (which managed the tasks) for each of the stages \`dev\`, \`uat\`, \`prod\`. 

- For example let's create a cluster \`billie-db-backup-dev\`, then click \`Scheduled Tasks\` and click \`Create\`:

  ![](/assets/img/2024-10-27-18-07-07.png)

- Of the form
  - Scheuduled rule name can be arbitrary, make sure to ***fill in the scheudle***:

    ![](/assets/img/2024-10-27-18-10-11.png)

    For testing purpose I choose **Unit** to be *minutes* and **Value** for the rate to *5*.

  - Choose our task family:

    ![](/assets/img/2024-10-27-18-10-59.png)

  - Note that the trivial details such as ***VPC SubnetIds*** have been filled for us, it is another reason why we start from ECS instead of the EventBridge console.


  - Finally \`Create\` and wait for the result in S3 and Cloudwatch.

    ![](/assets/img/2024-10-27-18-27-14.png)

#### Where to Define the Environment Variables? The Task Definition in ECS!

- We ***intentionally*** leave the environment variables \`undefined\` because the backup for \`dev\`, \`uat\` and \`prod\` stages are all identical, we wish to ***reuse*** the image by injecting the appropriate \`env\` variables.

- In \`ECS > Task Definitions > billie-db-backup-dev\` after we have chosen the docker image which executes the backup job, we can define the environment variables for the scheduled tasks:

  ![](/assets/img/2024-10-27-18-00-09.png)

  Recall that we need to fill in the following:

  \`\`\`bash
  MONGO_CONNECTION_STRING=
  MONGO_DB_NAME=
  PG_DB_HOST=
  NEON_DB_ENDPOINT_OPTION=endpoint%3Dep-aged-morning-26453078
  PG_DB_NAME=
  PG_DB_USER=
  PG_DB_PASSWORD=
  S3_BUCKET=
  STAGE=
  \`\`\`

#### How to Update the task

When we run a new task with the same image tag, ECS will pull the latest version of that image tag from the container registry.

The deafult behaviour:

\`\`\`json
{
  "containerDefinitions": [
    {
      "image": "my-image:latest",
      "imagePullPolicy": "always"  // This is default for ECS
    }
  ]
}
\`\`\`

If you wish to have versioning on the task, it would be better to update your task definition, and create a new scheduled task using that new definition.

### Result

- Our task is now triggered by the schedule:

  ![](/assets/img/2024-10-27-18-29-21.png)

- After it runs successfully, in our S3 Bucket:

  ![](/assets/img/2024-10-27-18-30-10.png)

- For PGSQL:

  ![](/assets/img/2024-10-27-18-33-13.png)

- For MongoDB:

  ![](/assets/img/2024-10-27-18-31-52.png)

- Little detail: in order to have \`UTC+8\` timestamp we set 
  \`\`\`bash
  TIMESTAMP=$(TZ='UTC+0' date -d '+8 hours' +%Y-%m-%d_%Hh%Mm%Ss)
  \`\`\`

### Remarks to Attaching Extra Policies to \`ecsTaskExecutionRole\`

Since we need to 
- access S3 in ECS, and 
- backup RDS database, 
two extra policies need to be added to the task execution role:

![](/assets/img/2024-10-27-18-39-54.png)`;export{e as default};
