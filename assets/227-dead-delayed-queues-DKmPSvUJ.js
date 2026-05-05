const n=`---
title: "Dead-letter and Delayed Queues"
date: 2023-12-24
id: blog0227
tag: rabbitMQ, message-broker, java, springboot
intro: "Record the implementation of various queues and integrate them with springboot."
toc: true
img: spring
---

### Repository

- https://github.com/machingclee/2023-12-24-Dead-and-Delayed-Queues

### RabbitMQUtil

\`\`\`java
package com.machingclee.rabbitmq.util;

import java.io.IOException;
import java.util.concurrent.TimeoutException;

import com.rabbitmq.client.Channel;
import com.rabbitmq.client.ConnectionFactory;

public class RabbitMQUtil {
    public static Channel getChannel() throws IOException, TimeoutException {
        var factory = new ConnectionFactory();
        factory.setHost("localhost");
        factory.setPort(5672);
        factory.setUsername("guest");
        factory.setPassword("guest");

        var connection = factory.newConnection();
        var channel = connection.createChannel();
        return channel;
    }
}
\`\`\`

### Dead Exchange

#### Dead Due to TTL

##### Normal Consumer (TTL)

\`\`\`java
package com.machingclee.rabbitmq.experiment_queues.dead_exchange_ttl;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeoutException;

import com.machingclee.rabbitmq.util.RabbitMQUtil;
import com.rabbitmq.client.BuiltinExchangeType;

public class NormalConsumer {
    public static final String NORMAL_EXCHANGE = "normal_exchange";
    public static final String DEAD_EXCHANGE = "dead_exchange";
    public static final String NORMAL_QUEUE = "normal_queue";
    public static final String DEAD_QUEUE = "dead_queue";

    public static final String NORMAL_ROUTING_KEY = "normal_route";
    public static final String DEAD_ROUTING_KEY = "dead_route";

    public static void main(String[] args) throws IOException, TimeoutException {
        var channel = RabbitMQUtil.getChannel();

        // create exchanges
        try {
            channel.exchangeDeclare(NORMAL_EXCHANGE, BuiltinExchangeType.DIRECT);
            channel.exchangeDeclare(DEAD_EXCHANGE, BuiltinExchangeType.DIRECT);
        } catch (Exception err) {
            System.out.println(err);
        }

        // special config for normal queue to communicate with dead_exchange
        // and dead_queue
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", DEAD_EXCHANGE);
        arguments.put("x-dead-letter-routing-key", DEAD_ROUTING_KEY);

        // create queues
        channel.queueDeclare(NORMAL_QUEUE, false, false, false, arguments);
        channel.queueDeclare(DEAD_QUEUE, false, false, false, null);

        channel.queueBind(NORMAL_QUEUE, NORMAL_EXCHANGE, NORMAL_ROUTING_KEY);
        channel.queueBind(DEAD_QUEUE, DEAD_EXCHANGE, DEAD_ROUTING_KEY);
    }
}
\`\`\`

##### Dead Queue Consumer (TTL)

\`\`\`java
package com.machingclee.rabbitmq.experiment_queues.dead_exchange_ttl;

import java.io.IOException;
import java.util.concurrent.TimeoutException;

import com.machingclee.rabbitmq.util.RabbitMQUtil;
import com.rabbitmq.client.BuiltinExchangeType;
import com.rabbitmq.client.CancelCallback;
import com.rabbitmq.client.DeliverCallback;

public class DeadQueueConsumer {
    public static final String NORMAL_EXCHANGE = "normal_exchange";
    public static final String DEAD_EXCHANGE = "dead_exchange";
    public static final String NORMAL_QUEUE = "normal_queue";
    public static final String DEAD_QUEUE = "dead_queue";

    public static final String NORMAL_ROUTING_KEY = "normal_route";
    public static final String DEAD_ROUTING_KEY = "dead_route";

    public static void main(String[] args) throws IOException, TimeoutException {
        var channel = RabbitMQUtil.getChannel();

        // create exchanges
        try {
            channel.exchangeDeclare(DEAD_EXCHANGE, BuiltinExchangeType.DIRECT);
        } catch (Exception err) {
            System.out.println(err);
        }
        channel.queueDeclare(DEAD_QUEUE, false, false, false, null);
        channel.queueBind(DEAD_QUEUE, DEAD_EXCHANGE, DEAD_ROUTING_KEY);

        DeliverCallback deliverCallback = (consumerTag, message) -> {
            System.out.println("[DeadQueue Consumer Digested]" + new String(message.getBody()));
            channel.basicAck(message.getEnvelope().getDeliveryTag(), false);
        };

        CancelCallback cancelCallback = consumerTag -> {
            System.out.println("[Message Cancelled]");
        };

        channel.basicConsume(DEAD_QUEUE, false, deliverCallback, cancelCallback);
    }
}
\`\`\`

##### Producer (TTL)

\`\`\`java
package com.machingclee.rabbitmq.experiment_queues.dead_exchange_ttl;

import java.io.IOException;
import java.util.concurrent.TimeoutException;

import com.machingclee.rabbitmq.util.RabbitMQUtil;
import com.rabbitmq.client.AMQP.BasicProperties;
import com.rabbitmq.client.BuiltinExchangeType;

public class Producer {
    public static final String NORMAL_EXCHANGE = "normal_exchange";
    public static final String NORMAL_ROUTING_KEY = "normal_route";

    public static void main(String[] args) throws IOException, TimeoutException {
        var channel = RabbitMQUtil.getChannel();
        try {
            channel.exchangeDeclare(NORMAL_EXCHANGE, BuiltinExchangeType.DIRECT);
        } catch (Exception err) {
            System.out.println(err);
        }

        BasicProperties properites = new BasicProperties().builder()
                .expiration("10000")
                .build();

        for (int i = 0; i < 10; i++) {
            var message = "info " + (i + 1);
            channel.basicPublish(NORMAL_EXCHANGE, NORMAL_ROUTING_KEY, properites, message.getBytes());
            System.out.println("info " + (i + 1) + " was sent");
        }
    }
}
\`\`\`

#### Dead Due to Rejection

##### Normal Consumer (Rejection)

\`\`\`java
package com.machingclee.rabbitmq.experiment_queues.dead_exchange_rejected;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeoutException;

import com.machingclee.rabbitmq.util.RabbitMQUtil;
import com.rabbitmq.client.BuiltinExchangeType;
import com.rabbitmq.client.CancelCallback;
import com.rabbitmq.client.DeliverCallback;

public class NormalConsumer {
    public static final String NORMAL_EXCHANGE = "normal_exchange";
    public static final String DEAD_EXCHANGE = "dead_exchange";
    public static final String NORMAL_QUEUE = "normal_queue";
    public static final String DEAD_QUEUE = "dead_queue";

    public static final String NORMAL_ROUTING_KEY = "normal_route";
    public static final String DEAD_ROUTING_KEY = "dead_route";

    public static void main(String[] args) throws IOException, TimeoutException {
        var channel = RabbitMQUtil.getChannel();

        // create exchanges
        try {
            channel.exchangeDeclare(NORMAL_EXCHANGE, BuiltinExchangeType.DIRECT);
            channel.exchangeDeclare(DEAD_EXCHANGE, BuiltinExchangeType.DIRECT);
        } catch (Exception err) {
            System.out.println(err);
        }

        // special config for normal queue to communicate with dead_exchange
        // and dead_queue
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", DEAD_EXCHANGE);
        arguments.put("x-dead-letter-routing-key", DEAD_ROUTING_KEY);

        // create queues
        channel.queueDeclare(NORMAL_QUEUE, false, false, false, arguments);
        channel.queueDeclare(DEAD_QUEUE, false, false, false, null);

        channel.queueBind(NORMAL_QUEUE, NORMAL_EXCHANGE, NORMAL_ROUTING_KEY);
        channel.queueBind(DEAD_QUEUE, DEAD_EXCHANGE, DEAD_ROUTING_KEY);

        DeliverCallback deliverCallback = (consumerTag, message) -> {
            String msg = new String(message.getBody());
            System.out.println("[DeadQueue Consumer Digested]" + msg);
            if (msg.equals("info " + 5)) {
                System.out.println("reject message: " + msg);
                channel.basicReject(message.getEnvelope().getDeliveryTag(), false);
            } else {
                System.out.println("message acked: " + msg);
                channel.basicAck(message.getEnvelope().getDeliveryTag(), false);
            }
        };

        CancelCallback cancelCallback = consumerTag -> {
            System.out.println("[Message Cancelled]");
        };

        channel.basicConsume(NORMAL_QUEUE, false, deliverCallback, cancelCallback);
    }
}
\`\`\`

##### Dead Queue Consumer (Rejection)

\`\`\`java
package com.machingclee.rabbitmq.experiment_queues.dead_exchange_rejected;

import java.io.IOException;
import java.util.concurrent.TimeoutException;

import com.machingclee.rabbitmq.util.RabbitMQUtil;
import com.rabbitmq.client.BuiltinExchangeType;
import com.rabbitmq.client.CancelCallback;
import com.rabbitmq.client.DeliverCallback;

public class DeadQueueConsumer {
    public static final String NORMAL_EXCHANGE = "normal_exchange";
    public static final String DEAD_EXCHANGE = "dead_exchange";
    public static final String NORMAL_QUEUE = "normal_queue";
    public static final String DEAD_QUEUE = "dead_queue";

    public static final String NORMAL_ROUTING_KEY = "normal_route";
    public static final String DEAD_ROUTING_KEY = "dead_route";

    public static void main(String[] args) throws IOException, TimeoutException {
        var channel = RabbitMQUtil.getChannel();

        // create exchanges
        try {
            channel.exchangeDeclare(DEAD_EXCHANGE, BuiltinExchangeType.DIRECT);
        } catch (Exception err) {
            System.out.println(err);
        }
        channel.queueDeclare(DEAD_QUEUE, false, false, false, null);
        channel.queueBind(DEAD_QUEUE, DEAD_EXCHANGE, DEAD_ROUTING_KEY);

        DeliverCallback deliverCallback = (consumerTag, message) -> {
            System.out.println("[DeadQueue Consumer Digested]" + new String(message.getBody()));
            channel.basicAck(message.getEnvelope().getDeliveryTag(), false);
        };

        CancelCallback cancelCallback = consumerTag -> {
            System.out.println("[Message Cancelled]");
        };

        channel.basicConsume(DEAD_QUEUE, false, deliverCallback, cancelCallback);
    }
}
\`\`\`

##### Producer (Rejection)

\`\`\`java
package com.machingclee.rabbitmq.experiment_queues.dead_exchange_rejected;

import java.io.IOException;
import java.util.concurrent.TimeoutException;

import com.machingclee.rabbitmq.util.RabbitMQUtil;
import com.rabbitmq.client.AMQP.BasicProperties;
import com.rabbitmq.client.BuiltinExchangeType;

public class Producer {
    public static final String NORMAL_EXCHANGE = "normal_exchange";
    public static final String NORMAL_ROUTING_KEY = "normal_route";

    public static void main(String[] args) throws IOException, TimeoutException {
        var channel = RabbitMQUtil.getChannel();
        try {
            channel.exchangeDeclare(NORMAL_EXCHANGE, BuiltinExchangeType.DIRECT);
        } catch (Exception err) {
            System.out.println(err);
        }

        BasicProperties properites = new BasicProperties().builder()
                .expiration("10000")
                .build();

        for (int i = 0; i < 10; i++) {
            var message = "info " + (i + 1);
            channel.basicPublish(NORMAL_EXCHANGE, NORMAL_ROUTING_KEY, properites, message.getBytes());
            System.out.println("info " + (i + 1) + " was sent");
        }
    }
}
\`\`\`

#### Dead Due to Max Queue Length

##### Normal Consumer (Max Queue Length)

\`\`\`java
package com.machingclee.rabbitmq.dead_exchange_with_max_queue_length;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeoutException;

import com.machingclee.rabbitmq.util.RabbitMQUtil;
import com.rabbitmq.client.BuiltinExchangeType;

public class NormalConsumer {
    public static final String NORMAL_EXCHANGE = "normal_exchange";
    public static final String DEAD_EXCHANGE = "dead_exchange";
    public static final String NORMAL_QUEUE = "normal_queue";
    public static final String DEAD_QUEUE = "dead_queue";

    public static final String NORMAL_ROUTING_KEY = "normal_route";
    public static final String DEAD_ROUTING_KEY = "dead_route";

    public static final Integer MAX_QUEUE_LENGTH = 6;

    public static void main(String[] args) throws IOException, TimeoutException {
        var channel = RabbitMQUtil.getChannel();

        // create exchanges
        try {
            channel.exchangeDeclare(NORMAL_EXCHANGE, BuiltinExchangeType.DIRECT);
            channel.exchangeDeclare(DEAD_EXCHANGE, BuiltinExchangeType.DIRECT);
        } catch (Exception err) {
            System.out.println(err);
        }

        // special config for normal queue to communicate with dead_exchange
        // and dead_queue
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", DEAD_EXCHANGE);
        arguments.put("x-dead-letter-routing-key", DEAD_ROUTING_KEY);
        arguments.put("x-max-length", MAX_QUEUE_LENGTH);

        // create queues
        channel.queueDeclare(NORMAL_QUEUE, false, false, false, arguments);
        channel.queueDeclare(DEAD_QUEUE, false, false, false, null);

        channel.queueBind(NORMAL_QUEUE, NORMAL_EXCHANGE, NORMAL_ROUTING_KEY);
        channel.queueBind(DEAD_QUEUE, DEAD_EXCHANGE, DEAD_ROUTING_KEY);
    }
}
\`\`\`

##### Dead Queue Consumer (Max Queue Length)

\`\`\`java
package com.machingclee.rabbitmq.dead_exchange_with_max_queue_length;

import java.io.IOException;
import java.util.concurrent.TimeoutException;

import com.machingclee.rabbitmq.util.RabbitMQUtil;
import com.rabbitmq.client.BuiltinExchangeType;
import com.rabbitmq.client.CancelCallback;
import com.rabbitmq.client.DeliverCallback;

public class DeadQueueConsumer {
    public static final String NORMAL_EXCHANGE = "normal_exchange";
    public static final String DEAD_EXCHANGE = "dead_exchange";
    public static final String NORMAL_QUEUE = "normal_queue";
    public static final String DEAD_QUEUE = "dead_queue";

    public static final String NORMAL_ROUTING_KEY = "normal_route";
    public static final String DEAD_ROUTING_KEY = "dead_route";

    public static void main(String[] args) throws IOException, TimeoutException {
        var channel = RabbitMQUtil.getChannel();

        // create exchanges
        try {
            channel.exchangeDeclare(DEAD_EXCHANGE, BuiltinExchangeType.DIRECT);
        } catch (Exception err) {
            System.out.println(err);
        }
        channel.queueDeclare(DEAD_QUEUE, false, false, false, null);
        channel.queueBind(DEAD_QUEUE, DEAD_EXCHANGE, DEAD_ROUTING_KEY);

        DeliverCallback deliverCallback = (consumerTag, message) -> {
            System.out.println("[DeadQueue Consumer Digested]" + new String(message.getBody()));
            channel.basicAck(message.getEnvelope().getDeliveryTag(), false);
        };

        CancelCallback cancelCallback = consumerTag -> {
            System.out.println("[Message Cancelled]");
        };

        channel.basicConsume(DEAD_QUEUE, false, deliverCallback, cancelCallback);
    }
}
\`\`\`

##### Producer (Max Queue Length)

\`\`\`java
package com.machingclee.rabbitmq.dead_exchange_with_max_queue_length;

import java.io.IOException;
import java.util.concurrent.TimeoutException;

import com.machingclee.rabbitmq.util.RabbitMQUtil;
import com.rabbitmq.client.BuiltinExchangeType;

public class Producer {
    public static final String NORMAL_EXCHANGE = "normal_exchange";
    public static final String NORMAL_ROUTING_KEY = "normal_route";

    public static void main(String[] args) throws IOException, TimeoutException {
        var channel = RabbitMQUtil.getChannel();
        try {
            channel.exchangeDeclare(NORMAL_EXCHANGE, BuiltinExchangeType.DIRECT);
        } catch (Exception err) {
            System.out.println(err);
        }

        // BasicProperties properites = new BasicProperties().builder()
        // .expiration("10000")
        // .build();

        for (int i = 0; i < 10; i++) {
            var message = "info " + (i + 1);
            channel.basicPublish(NORMAL_EXCHANGE, NORMAL_ROUTING_KEY, null, message.getBytes());
            System.out.println("info " + (i + 1) + " was sent");
        }
    }
}
\`\`\`

### Integration of Dead and Delayed Queues with Springboot

#### Routing for Experiements (Producer)

\`\`\`java
package com.machingclee.rabbitmq.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.function.RequestPredicates;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.RouterFunctions;
import org.springframework.web.servlet.function.ServerResponse;

import com.machingclee.rabbitmq.controller.MessageController;

@Configuration
public class RoutingConfig {
    @Bean
    public RouterFunction<ServerResponse> studentRouter(MessageController msgController) {
        return RouterFunctions.route()
                .GET("/ttl/msg/{message}", RequestPredicates.accept(MediaType.ALL), msgController::sendMessage)
                .GET("/delayed/msg/{ttl}/{msg}", RequestPredicates.accept(MediaType.ALL), msgController::delayedMessage)
                .POST("/ttl/msg", RequestPredicates.accept(MediaType.ALL), msgController::sendMessageWithTTL)
                .build();
    }
}
\`\`\`

#### TTL (Works Well for Constant TTL)

- In this example we want to provide variable \`ttl\`'s in \`NORMAL_Q_C\` but problem occurs as queues cannot be consumed asynchronously.
- \`Q_A\` and \`Q_B\` work perfectly well as the \`ttl\`'s of these two queues are constant.
- Problem of \`Q_C\` can be solved by using \`delayed-message-plugin\` of \`RabbitMQ\`, details are provided in the next section.
- But the need for variable \`ttl\` should be rare and therefore queues like \`Q_A\` and \`Q_B\` should be totally fine.

##### TTLQueuConfig.java

\`\`\`java
package com.machingclee.rabbitmq.config;

import java.util.HashMap;
import java.util.Map;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TTLQueueConfig {
    public static final String NORMAL_EXCHANGE = "NORMAL_EXCHANGE";
    public static final String DEAD_LETTER_EXCANGE = "DEAD_LETTER_EXCANGE";

    public static final String NORMAL_Q_A = "NORMAL_Q_A";
    public static final String NORMAL_Q_A_ROUTING_KEY = "NORMAL_Q_A_ROUTING_KEY";
    public static final String NORMAL_Q_B = "NORMAL_Q_B";
    public static final String NORMAL_Q_B_ROUTING_KEY = "NORMAL_Q_B_ROUTING_KEY";
    public static final String DEAD_LETTER_Q = "DEAD_LETTER_Q";
    public static final String DEAD_LETTER_Q_ROUTING_KEY = "DEAD_LETTER_Q_ROUTING_KEY";

    public static final String NORMAL_Q_C = "NORMAL_Q_C";
    public static final String NORMAL_Q_C_ROUTING_KEY = "NORMAL_Q_C_ROUTING_KEY";

    @Bean
    public DirectExchange xExchange() {
        return new DirectExchange(NORMAL_EXCHANGE);
    }

    @Bean
    public DirectExchange deadExchange() {
        return new DirectExchange(DEAD_LETTER_EXCANGE);
    }

    @Bean
    public Queue queueA() {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", DEAD_LETTER_EXCANGE);
        arguments.put("x-dead-letter-routing-key", DEAD_LETTER_Q_ROUTING_KEY);
        arguments.put("x-message-ttl", 10000);

        return QueueBuilder.durable(NORMAL_Q_A).withArguments(arguments).build();
    }

    @Bean
    public Queue queueB() {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", DEAD_LETTER_EXCANGE);
        arguments.put("x-dead-letter-routing-key", DEAD_LETTER_Q_ROUTING_KEY);
        arguments.put("x-message-ttl", 40000);

        return QueueBuilder.durable(NORMAL_Q_B).withArguments(arguments).build();
    }

    @Bean
    public Queue queueC() {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", DEAD_LETTER_EXCANGE);
        arguments.put("x-dead-letter-routing-key", DEAD_LETTER_Q_ROUTING_KEY);

        return QueueBuilder.durable(NORMAL_Q_C).withArguments(arguments).build();
    }

    @Bean
    public Queue queueD() {
        return QueueBuilder.durable(DEAD_LETTER_Q).build();
    }

    @Bean
    public Binding bindAToNormalExchange(@Qualifier("queueA") Queue queueA,
            @Qualifier("xExchange") DirectExchange xExchange) {
        return BindingBuilder.bind(queueA).to(xExchange).with(NORMAL_Q_A_ROUTING_KEY);
    }

    @Bean
    public Binding bindBToNormalExchange(
            @Qualifier("queueB") Queue queueB,
            @Qualifier("xExchange") DirectExchange xExchange) {
        return BindingBuilder.bind(queueB).to(xExchange).with(NORMAL_Q_B_ROUTING_KEY);
    }

    @Bean
    public Binding bindCToNormalExchange(
            @Qualifier("queueC") Queue queueC,
            @Qualifier("xExchange") DirectExchange xExchange) {
        return BindingBuilder.bind(queueC).to(xExchange).with(NORMAL_Q_C_ROUTING_KEY);
    }

    @Bean
    public Binding bindDeadQueueToDeadExchange(
            @Qualifier("queueD") Queue queueD,
            @Qualifier("deadExchange") DirectExchange deadExchange) {
        return BindingBuilder.bind(queueD).to(deadExchange).with(DEAD_LETTER_Q_ROUTING_KEY);
    }
}
\`\`\`

##### Dead-Letter Queue Consumer

\`\`\`java
package com.machingclee.rabbitmq.consumer;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import com.rabbitmq.client.Channel;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class DeadLetterQueueConsumer {
    @RabbitListener(queues = "DEAD_LETTER_Q")
    public void receiveDeadMsg(Message message, Channel channel) {

        String msg = new String(message.getBody());
        log.info("Current time: {}, dead queue message: {}",
                new java.util.Date().toString(),
                msg);
    }
}
\`\`\`

##### HTTP Handlers to Publish TTL Messages

\`\`\`java
package com.machingclee.rabbitmq.controller;

import java.io.IOException;
import java.util.Date;
import java.util.Map;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.function.ServerRequest;
import org.springframework.web.servlet.function.ServerResponse;

import com.machingclee.rabbitmq.config.DelayedQueueConfig;
import com.machingclee.rabbitmq.config.TTLQueueConfig;
import com.machingclee.rabbitmq.controller.dto.MessageWithTtlDTO;

import jakarta.servlet.ServletException;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class MessageController {

    private RabbitTemplate rabbitTemplate;

    @Autowired
    MessageController(RabbitTemplate template) {
        this.rabbitTemplate = template;
    }

    public ServerResponse sendMessage(ServerRequest req) {
        var message = req.pathVariable("message");

        rabbitTemplate.convertAndSend(
                TTLQueueConfig.NORMAL_EXCHANGE,
                TTLQueueConfig.NORMAL_Q_A_ROUTING_KEY,
                "[Send to 10s ttl queue] " + message);

        log.info("Current Time: {}, sent an message t10s-ttl queues: {}",
                new Date().toString(),
                message);
        rabbitTemplate.convertAndSend(
                TTLQueueConfig.NORMAL_EXCHANGE,
                TTLQueueConfig.NORMAL_Q_B_ROUTING_KEY,
                "[Send to 40s ttl queue] " + message);
        log.info("Current Time: {}, sent an message to 40s-ttl queues: {}",
                new Date().toString(),
                message);

        return ServerResponse.ok().body(Map.of("result", message));
    }

    public ServerResponse sendMessageWithTTL(ServerRequest req) throws IOException, ServletException {
        MessageWithTtlDTO body = req.body(MessageWithTtlDTO.class);

        var message = body.getMessage();
        var ttl = body.getTtl();

        rabbitTemplate.convertAndSend(
                TTLQueueConfig.NORMAL_EXCHANGE,
                TTLQueueConfig.NORMAL_Q_C_ROUTING_KEY,
                "[custom ttl message: ]" + message,
                msg -> {
                    msg.getMessageProperties().setExpiration(ttl);
                    return msg;
                });
        log.info("Custom ttl message was sent: " + message);
        return null;
    }
}
\`\`\`

#### Delayed Configuration

##### DelayedQueueConfig

\`\`\`java
package com.machingclee.rabbitmq.config;

import java.util.HashMap;
import java.util.Map;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.CustomExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.amqp.core.Queue;
import org.springframework.beans.factory.annotation.Qualifier;

@Configuration
public class DelayedQueueConfig {
    public static final String DELAYED_QUEUE_EXCHANGE = "delayed.exchange";
    public static final String DELAYED_QUEUE_NAME = "delayed.queue";
    public static final String DELAYED_QUEUE_ROUTING_KEY = "delayed.routingKey";

    @Bean
    public Queue delayedQueue() {
        return new Queue(DELAYED_QUEUE_NAME);
    }

    @Bean
    public CustomExchange delayedExchange() {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-delayed-type", "direct");

        return new CustomExchange(
                DELAYED_QUEUE_EXCHANGE,
                "x-delayed-message",
                true,
                false,
                arguments);
    }

    @Bean
    public Binding bindDelayedQueueToDelayedExchange(
            @Qualifier("delayedQueue") Queue delayedQueue,
            @Qualifier("delayedExchange") CustomExchange delayedExchange) {
        return BindingBuilder
                .bind(delayedQueue)
                .to(delayedExchange)
                .with(DELAYED_QUEUE_ROUTING_KEY).noargs();
    }
}
\`\`\`

##### DelayedQueueConsumer

\`\`\`java
package com.machingclee.rabbitmq.consumer;

import java.util.Date;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import com.machingclee.rabbitmq.config.DelayedQueueConfig;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class DelayedQueueConsumer {
    @RabbitListener(queues = DelayedQueueConfig.DELAYED_QUEUE_NAME)
    public void receiveDelayedQueue(Message message) {
        String msg = new String(message.getBody());
        log.info("[Delayed Consumer] {}, {}", new Date().toString(), msg);
    }
}
\`\`\`

##### HTTP Handlers to Publish Delayed Messages

\`\`\`java
@Slf4j
@Component
public class MessageController {
    public ServerResponse delayedMessage(ServerRequest req) {
        var ttl = Integer.parseInt(req.pathVariable("ttl"));
        var message = req.pathVariable("msg");

        log.info("[message delayed for {}s]: {}", ttl, message);
        rabbitTemplate.convertAndSend(
                DelayedQueueConfig.DELAYED_QUEUE_EXCHANGE,
                DelayedQueueConfig.DELAYED_QUEUE_ROUTING_KEY,
                "[message with ttl: " + ttl + "] " + message,
                msg -> {
                    msg.getMessageProperties().setDelay(ttl);
                    return msg;
                });

        return ServerResponse.ok().body(Map.of("result", message));
    }
}
\`\`\`
`;export{n as default};
