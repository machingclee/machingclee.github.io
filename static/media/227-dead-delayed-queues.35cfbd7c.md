---
title: "Dead and Delayed Queues"
date: 2023-12-24
id: blog0227
tag: sql
intro: "Record the implementation of various queues and integrate them with springboot."
toc: true
---

#### RabbitMQUtil

```java
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
```

#### Dead Exchange

##### Dead Due to TTL

###### Normal Consumer (TTL)

```java
package com.machingclee.rabbitmq.dead_exchange_ttl;

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
```

###### Dead Queue Consumer (TTL)

```java
package com.machingclee.rabbitmq.dead_exchange_ttl;

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
```

###### Producer (TTL)

```java
package com.machingclee.rabbitmq.dead_exchange_ttl;

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
```

##### Dead Due to Rejection


###### Normal Consumer (Rejection)

```java
package com.machingclee.rabbitmq.dead_exchange_from_rejected;

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
```



###### Dead Queue Consumer (Rejection)


```java
package com.machingclee.rabbitmq.dead_exchange_from_rejected;

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
```

###### Producer (Rejection)

```java
package com.machingclee.rabbitmq.dead_exchange_from_rejected;

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
```

##### Dead Due to Max Queue Length

###### Normal Consumer (Max Queue Length)
```java
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
```


###### Dead Queue Consumer (Max Queue Length)

```java
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
```
###### Producer (Max Queue Length)

```java
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
```
