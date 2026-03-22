---
title: "Kafka Study: Part II, Integration with Spring Boot"
date: 2026-03-22
id: blog0478
tag: streaming, message-broker, kafka, java
toc: true
intro: "Experiment with Kafka API"
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table td:first-child, table th:first-child {
    min-width: 120px;
  }
</style>


![](/assets/img/2026-03-22-18-53-29.png)

### Repository

#### Repo Link
- https://github.com/machingclee/2026-03-22-kafka-study

#### How to use this Repository?

<Center>

![](/assets/img/2026-03-22-20-39-30.png)

</Center>

- `cd` into `kafka-cluster/` and run `docker-compose up`, a kafka-cluster of 3 instances will be launched, with `localhost:9092` as the entrypoint.
- Both `consumer/` and `producer/` are spring applications
-  Launch the spring application in `consumer/`
-  Launch the spring application in `producer/`, this will launch a backend server at port: `8081`
-  Go to `localhost:8081`, a swagger document has been launched to create message:

    ![](/assets/img/2026-03-22-20-38-59.png)

- Send the `POST` request to create a message in `producer/`, and receive the message from `consumer/` application

### Create Topics in Spring Boot via Spring Configuration

```java
package com.machingclee.kafka.common.type;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.context.annotation.Configuration;

@Configuration
class KafkaTopicConfig {
    @Bean
    public NewTopic topic1() {
        return  TopicBuilder.name("my-topic")
                .partitions(3)
                .replicas(3)
                .build();
    }

    @Bean
    public NewTopic topic2() {
        return  TopicBuilder.name("topic-created-by-spring")
                .partitions(3)
                .replicas(3)
                .build();
    }
}
```

### Producer


#### `KafkaController`


We have made a simple controller to create a message into the Kafka topic via swagger document:

```java
@RestController
@RequestMapping("/kafka")
public class KafkaController {
    private final KafkaProducerService kafkaProducerService;

    public KafkaController(KafkaProducerService kafkaProducerService) {
        this.kafkaProducerService = kafkaProducerService;
    }

    @PostMapping("/add-course")
    public ResponseEntity<String> addCourse (@RequestBody Course course) {
        // send course to kafka service

        String response = kafkaProducerService.sendMessage(course);
        return ResponseEntity.ok(response);
    }
}

```

#### `KafkaProducerService`



```java-1{10}
@Service
public class KafkaProducerService {
    private final KafkaTemplate<String, Course> kafkaTemplate;

    public KafkaProducerService(KafkaTemplate<String, Course> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public String sendMessage (Course course) {
        this.kafkaTemplate.send("my-topic", "course", course);
        return "Course message sent to Kafka service";
    }
}
```

In line 10 we have used the following method overloading:

```
(topic, groupId, messageObject) -> SendResult
```


### Consumer

#### The `Course` Record

```java
package com.machingclee.kafka.common.type;

public record Course(
        String courseId,
        String title,
        String trainer,
        double price
) {}
```


#### `KafkaConsumerService`

```java
@Service
public class KafkaConsumerService {
    private final KafkaTemplate<String, Course> kafkaTemplate;
    private String message;
    public KafkaConsumerService(KafkaTemplate<String, Course> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = "my-topic", groupId = "my-group")
    public String getMessage (Course course) {
        System.out.println("Received course: " + course);
        return "Course message received from Kafka service";
    }
}
```

#### Result on Message Received

![](/assets/img/2026-03-22-20-52-17.png)