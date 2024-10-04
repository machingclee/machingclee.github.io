---
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

#### Dependencies

```kotlin
implementation("redis.clients:jedis:5.1.4")
```

#### Implementation of the Lock

Essentially it is implemented by using `setnx` (set value if not exists), a standard command in redis.

```kotlin
package com.billie.payment.util

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.springframework.stereotype.Component
import redis.clients.jedis.Jedis
import redis.clients.jedis.JedisPool
import redis.clients.jedis.params.SetParams

@Component
class DistributiveLock(private val jedis: Jedis) {

    suspend fun acquireLock(id: String, lockTimeout: Long = 30): Boolean = withContext(Dispatchers.IO) {
        val params = SetParams().nx().ex(30)
        val result = jedis.set(id, id, params)
        return@withContext result == "OK"
    }

    suspend fun releaseLock(id: String) = withContext(Dispatchers.IO) {
        jedis.del(id)
    }

    suspend fun isLocked(id: String): Boolean = withContext(Dispatchers.IO) {
        jedis.exists(id)
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
``` 

#### Usage

##### Handle Stripe's Repeated Event

Stripe happends to send the same event repeatedly to our backend.

![](/assets/img/2024-10-04-02-46-22.png)

Here our domain event `TeamplanAddedEvent` is triggered by the Stripe event twice (as indicated by the same `stripe_event_id` with 3 seconds after one another). To handle this:


1. **Concurrency Checking.** We create distributive lock to disable processing the same event within short period (even concurrenly).

2. **Database History Checking.** We mark our `order` as completed by `orderId`. Next, we check that if `order.status` is adjusted in the table, if so, we don't process the event.

Since we wish to handle specific event at most once, we have the next code block:

##### Application

```kotlin{14}
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
```