const e=`---
title: Distributive Lock in Kotlin
date: 2024-10-04
id: blog0328
tag: redis
toc: true
intro: A simple implementation of distributive lock in Kotlin.
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Dependencies

\`\`\`kotli
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
}
\`\`\`

### application.yml

\`\`\`yml
spring:
  data:
    redis:
      host: XXX.upstash.io
      port: 6379
      password: AdIpAAIjcDEzYTcXXX
      database: 0
      ssl:
        enabled: true
\`\`\`

### Implementation of the Lock

Essentially it is implemented by using \`setnx\` (set value if not exists), a standard command in redis.

\`\`\`kotlin
package com.billie.payment.util

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.stereotype.Component

@Component
class DistributiveLock(
    private val redisTemplate: ReactiveRedisTemplate<String, String>,
) {
    suspend private fun setIfNotExists(key: String, value: String): Boolean {
        return redisTemplate.opsForValue().setIfAbsent(key, value).awaitSingle() ?: false
    }

    suspend fun acquireLock(id: String, lockTimeout: Long = 30): Boolean {
        return setIfNotExists(id, id)
    }

    suspend fun releaseLock(id: String) {
        redisTemplate.delete(id).awaitSingle()
    }

    suspend fun isLocked(id: String): Boolean {
        return redisTemplate.hasKey(id).awaitSingle()
    }

    suspend fun waitForLock(id: String, timeout: Long = 10000): Boolean {
        return withTimeoutOrNull(timeout) {
            while (!acquireLock(id)) {
                delay(100)
            }
            true
        } ?: false
    }
}
\`\`\` 

### Usage

#### Handle Stripe's Repeated Event

Stripe happends to send the same event repeatedly to our backend.

![](/assets/img/2024-10-04-02-46-22.png)

Here our domain event \`TeamplanAddedEvent\` is triggered by the Stripe event twice (as indicated by the same \`stripe_event_id\` with 3 seconds after one another). To handle this:


1. **Concurrency Checking.** We create distributive lock to disable processing the same event within short period (even concurrenly).

2. **Database History Checking.** We mark our \`order\` as completed by \`orderId\`. Next, we check that if \`order.status\` is adjusted in the table, if so, we don't process the event.

Since we wish to handle specific event at most once, we have the next code block:

#### Application

\`\`\`kotlin{14}
@Service
class StripeEventApplicationService(
    private val distributiveLock: DistributiveLock
) {
    suspend fun handleStripeEvent(event: Event) = coroutineScope {
        when (event.type) {
            PaymentEventType.SUBSCRIPTION_UPDATED.code -> {
                logger.info { event.id }
                logger.info { "SUBSCRIPTION_UPDATED event: $event" }
                val (orderId, subscriptionId) = stripeService.getOrderIdAndSubscripionIdFromSubscriptionUpdatedEvent(event)
                if (orderId == null) {
                    return@coroutineScope
                }
                if (!distributiveLock.acquireLock(orderId)) {
                    return@coroutineScope
                }
                ...
            }
        }
    }
}
\`\`\``;export{e as default};
