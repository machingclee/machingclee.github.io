---
title: "Event Based System Design for Controlled Number of API Calls and Delayed Schedule Job per Request"
date: 2023-12-25
id: blog0228
tag: rabbitMQ, message-broker
intro: "Flow diagram to illustrate how we use RabbitMQ in our mobile application."
toc: true
---

#### Control Number of API Calls

<p></p>

<a href="/assets/tech/228/image.png"><img src="/assets/tech/228/image.png" width="660"></a></Center>

<p></p>
<center></center>

#### Delayed Schedule Job

<p></p>

<a href="/assets/tech/228/image-1.png"><img src="/assets/tech/228/image-1.png" width="660"></a></Center>

<p></p>
<center></center>

#### More on Delayed Messages

Note that by **_We set TTL = 1 week ..._** in _Delayed Schedule Job_ section, we mean that we assign

- `x-dead-letter-exchange`
- `x-dead-letter-routing-key`
- `x-message-ttl`

as the arguments (properties) **when creating** `Priority_Q`.

If (varying) `ttl`'s come from the messages, dead-letter queue **_is not capable of_** emitting messages to exchange based on the different `ttl`'s.

Instead we need to delegate the the emisison **from queue** back to **exchange** and use something called `delayed messages exchange` (which requires a Delayed Message Exchange plugin).

See

- [this section](/blog/article/Dead-letter-and-Delayed-Queues#Delayed-Configuration)

for more detail on `delayed messages exchange` in `springboot` setup (note that we need to create our own `CustomExchange`).
