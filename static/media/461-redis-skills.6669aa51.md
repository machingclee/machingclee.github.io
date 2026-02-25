---
title: "Practical use of Redis"
date: 2026-02-21
id: blog0461
tag: redis
toc: true
wip: true
intro: "Record several practical usage of redis in real application"
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>

### BLMOVE

why and reason and scanerio to use it

and how is it used with LREM to achieve ACK mechanism

when consumption of a message failed in BLMOVE, 
use BRPOP again to the destination queue (specified in BLMOVE) to reconsume the message

also when it failed serveral times, explain how to put it to dead letter queue

write a mermaid diagram to explain the flow



### Problem of using BLMOVE

no ACK
no consumer group in Kafka
messages get stuck when consuumption rate is much slower than receiving rate
List is of linear structure, querying for a single data need O(n) operation

### Stream: Support for Light-Weighted MQ


