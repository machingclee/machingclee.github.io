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

![](/assets/img/2026-03-22-18-53-29.png?border=none)

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

#### Setg GroupID in `application.yml`

Ideally each instance of spring application should have only one group id.

Instead of hardcoding the group ID in `@KafkaListener`, it can be externalised to `application.yml` and referenced via a property placeholder:

```yaml
spring:
  kafka:
    consumer:
      group-id: "course-group"
```

```java
@KafkaListener(topics = "my-topic"")
public void listen(Course course) { ... }
```

Spring uses `spring.kafka.consumer.group-id` as the default when no explicit `groupId` is set on `@KafkaListener`.

#### Concurrency 

##### Parallel Consumption Within One Instance

By default a `@KafkaListener` spawns **one consumer thread**, processing messages from its assigned partition sequentially. Setting `concurrency` spawns multiple consumer threads inside the same JVM — each thread acts as an independent consumer within the group and is assigned its own partition:

```java
@KafkaListener(
    topics = "my-topic", 
    groupId = "my-group", 
    concurrency = "3"
)
public void listen(Course course) { ... }
```

```
Spring starts 3 consumer threads, all in group "my-group"
                ↓
Group coordinator assigns partitions:
  thread-1 → partition 0
  thread-2 → partition 1
  thread-3 → partition 2

thread-1 processes: msg-a, msg-b ...   ─┐
thread-2 processes: msg-d, msg-e ...   ─┼─ in parallel, same machine
thread-3 processes: msg-g, msg-h ...   ─┘
```

From Kafka's perspective these are 3 separate consumers — it doesn't know or care they share a JVM. The partition assignment works exactly the same as running 3 separate application instances.

The partition cap still applies: `concurrency` threads beyond the partition count sit idle. Setting `concurrency=3` for a 1-partition topic gives us 1 active thread and 2 idle ones.

There is **no shared thread pool to configure** — Spring Kafka creates exactly `concurrency` dedicated threads per listener container and keeps them alive for the lifetime of the application. If we have 2 `@KafkaListener` methods each with `concurrency=3`, we get 6 total consumer threads.

##### What if multiple machines also use `concurrency="3"`?

The same partition cap applies across the entire group. With 3 machines × `concurrency=3` = 9 consumer threads total, all competing for 3 partitions:

```
Topic: 3 partitions

Machine A:  thread-1 → partition 0  ✓ active
            thread-2 → partition 1  ✓ active
            thread-3 → partition 2  ✓ active

Machine B:  thread-4 → (nothing)    ✗ idle
            thread-5 → (nothing)    ✗ idle
            thread-6 → (nothing)    ✗ idle

Machine C:  thread-7 → (nothing)    ✗ idle
            thread-8 → (nothing)    ✗ idle
            thread-9 → (nothing)    ✗ idle
```

We get **zero extra throughput** over a single machine with `concurrency=3`. To actually utilise all 9 threads we need 9 partitions:

```
9 partitions, 3 machines × concurrency=3:

Machine A: partition 0, 1, 2
Machine B: partition 3, 4, 5
Machine C: partition 6, 7, 8
```

This is why partition count must be planned ahead — it is the hard ceiling on total parallelism across the entire consumer group, regardless of how many machines or threads we add.

#### Virtual Threads (Spring Boot 3.2+ / Java 21+)

Enabling virtual threads is a one-line change in `application.yml`:

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

Spring Boot automatically wires a `VirtualThreadTaskExecutor` into the Kafka listener container factory. Each consumer thread becomes a virtual thread — extremely lightweight compared to OS threads, so the cost of having many of them is negligible.

The two settings are orthogonal:

| Setting | What it controls |
|---|---|
| `concurrency` | How many consumer threads exist (still capped by partition count) |
| `spring.threads.virtual.enabled` | What kind of thread they are (OS thread vs. virtual thread) |

Virtual threads matter most when the listener does blocking I/O (DB calls, HTTP calls). For fast, CPU-bound processing the difference is minimal.


#### Result on Message Received

![](/assets/img/2026-03-22-20-52-17.png)