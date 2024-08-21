---
title: "Monolithic DDD Without ORM by Separating Data and Domain Behaviour"
date: 2024-08-21
id: blog0316
tag: springboot, kotlin
toc: true
intro: "There are two ways for DDD Project in spring boot: DDD using ORM and that with ORM, let's discuss the one without ORM in this article"
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Separation of Data and Domain Behaviour
##### Data

###### AbstractRepository

- A repository should only manage data and should only have two purposes:
  1. Get the aggregate
  2. Save the aggregate
- But if we implement `repository.save(aggregate)`, then we need to expose 
  - `aggregate.domainEvents`
  - `aggregate.clearEvents()`
  - `aggregate.registerEvent()` 
  for the `repository` to act with. 
- But these attributes and methods **should not** be exposed to any one except for the repository, this is not achievable.
- We therefore move the `save` method to the domain object itself. 


```kotlin 
abstract class AbstractRepository<T, ID> {
    abstract fun findById(id: ID): T
    // abstract fun save () { ... }  implemented in aggregate object instead
}
```

**Remark.**
- If we do DDD with ORM provided by `spring-data`, i.e., using `CrudRepositry<T>` or `JpaRepository<T>` with `T` being inherited from `AbstractAggregateRoot`, then by `repository.save()`, the ORM will dispatch all events stored in the events attribute annotated by `@DomainEvents`. 

- This approach is feasible if we start everything from JPA's `Entity` classes. Details can be found [here](https://dev.to/kirekov/spring-data-power-of-domain-events-2okm?fbclid=IwY2xjawEyAyJleHRuA2FlbQIxMQABHS8mGlKwXbe-CGD_GFhoeq3VIzl-BrXN9BqGBBuotx1HwZx4pBUVPmmUTQ_aem_KYDcdoX9EKyttjP_VAYMpQ).

- However, if we start from an existing database (which is my case), then turning our schema into `Entity` classes is not pragmatic.





###### OrderRepository: AbstractRepository

Now we create our concret repository with "micro-orm" such as type-safed query builder. In this article we use `JOOQ`.

`JOOQ`, apart from being a query builder, also has an option to generate all `DAO` objects for us ([here](/blog/article/-Spring-boot-in-Kotlin-with-JOOQ-and-Prisma-Simple-Commands-for-Gradles-Integration-and-Unit-Tests) for more detail). 

If your choice of framework does not provide a `DAO` such as `prisma-kysely`, then simply write the `select *` query built form the framework. The replacement should be obvious to do:


```kotlin 
import com.billie.db.tables.daos.StripeorderDao
import com.billie.db.tables.daos.StripeorderdetailDao
import com.billie.payment.domain.AbastractRepository
import com.billie.payment.domain.OrderDomain
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Component
import java.util.*

@Component
class OrderRepository(
    private val stripeorderDao: StripeorderDao,
    private val stripeorderdetailDao: StripeorderdetailDao,
    private val applicationEventPublisher: ApplicationEventPublisher
) : AbastractRepository<OrderDomain, String>(applicationEventPublisher) {

    override fun findById(id: String): OrderDomain {
        // can be replaced by db.selectAll().selectFrom("your_table").where("id", "=", id) 
        val order = stripeorderDao.findById(UUID.fromString(id))!!
        val orderDetail = stripeorderdetailDao.fetchByStripeorderid(UUID.fromString(id)).first()
        return OrderDomain(order, orderDetail, applicationEventPublisher)
    }
}
```

Let's define the `OrderDomain` object in the next section right below.

Recall that an aggregate is a domain object, we name the aggregate by its aggregate root. In our case, our root is `Order`, thus the name `OrderDomain`.


##### Domain Behaviour
###### Domain Model

```kotlin-1
package com.billie.payment.domain

import com.billie.db.enums.Status
import com.billie.db.tables.daos.StripeorderDao
import com.billie.db.tables.daos.StripeorderdetailDao
import com.billie.db.tables.pojos.Stripeorder
import com.billie.db.tables.pojos.Stripeorderdetail
import com.billie.payment.exceptions.OrderException
import org.joda.time.DateTime
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

data class OrderSucceededEvent(
    val order: Stripeorder,
    val orderDetail: Stripeorderdetail,
    val succeededAt: Double,
    val invoicePaidEventId: String,
    val subscriptionId: String
)

data class OrderDetailCreatedEvent(val orderDetail: Stripeorderdetail)

class OrderDomain(
    private val order: Stripeorder,
    private var orderDetail: Stripeorderdetail?,
    private val applicationEventPublisher: ApplicationEventPublisher
) {
    private val domainEvents: MutableList<Any> = mutableListOf()

    private fun clearDomainEvents() {
        domainEvents.clear()
    }

    private fun registerEvent(event: Any) {
        domainEvents.add(event)
    }

    fun save() {
        for (event in domainEvents) {
            applicationEventPublisher.publishEvent(event)
        }
        clearDomainEvents()
    }
```
Up to this point our domain object just consists of boilerplate code, here comes the behavioural part!
```kotlin-45
    fun updateOrdersucceededInfo(invoicePaidEventId: String, subscriptionId: String) {
        if (orderDetail == null) {
            throw OrderException("Order detail should not be null", order.id.toString())
        }

        order.status = Status.SUCCEEDED
        order.succeededat = DateTime().millis.toDouble()
        orderDetail!!.invoicepaideventid = invoicePaidEventId
        orderDetail!!.subscriptionid = subscriptionId

        registerEvent(
            OrderSucceededEvent(
                order,
                orderDetail!!,
                succeededAt = order.succeededat!!,
                invoicePaidEventId,
                subscriptionId
            )
        )
    }

    fun addStripeOrderDetail(orderDetail_: Stripeorderdetail) {
        orderDetail = orderDetail_
        registerEvent(OrderDetailCreatedEvent(orderDetail_))
    }
}
// completion of OrderDomain
```
Finally we create side effect via `EventHandler`:
```kotlin-72
@Component
class OrderEventHandler(
    private val stripeorderDao: StripeorderDao,
    private val stripeorderdetailDao: StripeorderdetailDao,
) {
    @EventListener
    // @Order(1) add order if needed
    fun on(event: OrderSucceededEvent) {
        println("I catch the event: $event")
        val order = event.order
        val orderDetail = event.orderDetail
        order.status = Status.SUCCEEDED
        order.succeededat = event.succeededAt
        orderDetail.subscriptionid = event.subscriptionId
        orderDetail.invoicepaideventid = event.invoicePaidEventId

        stripeorderDao.update(order)
        stripeorderdetailDao.update(orderDetail)
    }

    @EventListener
    fun on(event: OrderDetailCreatedEvent) {
        stripeorderdetailDao.insert(event.orderDetail)
    }
}
```

#### Use Cases
##### Case 1: Creation of domain object within an aggregate
```kotlin
    private fun createOrderDetail(
        orderId: UUID,
        targetUserEmail: String,
        activeSubscription: Subscription?
    ) {
        val orderDomain = orderRepository.findById(orderId.toString())
        val detail = Stripeorderdetail(
            stripeorderid = orderId,
            operationtargetemail = targetUserEmail,
            subscriptionid = activeSubscription?.id,
        )
        orderDomain.addStripeOrderDetail(detail)
        orderDomain.save()
    }
```
##### Case 2: Update of domain object within an aggregate
```kotlin
    private fun updateOrderStatusAndDetail(orderId: String, invoicePaideventId: String, subscriptionId: String) {
        val orderDomain = orderRepository.findById(orderId)
        orderDomain.updateOrdersucceededInfo(orderId, invoicePaideventId)
        orderDomain.save()
    }
```

Note that both 
- `orderDomain.addStripeOrderDetail`  
- `orderDomain.updateOrdersucceededInfo` 
are simply creating events, and `save()` is simply a dispatch of all events.

#### Appendix

##### @TransactionalEventListener

Based on `Claude-3.5-Sonnet-200k`:

- When you dispatch an event using `ApplicationEventPublisher` and handle it with an `@EventListener`, by default these operations occur on the same thread in Spring.

- The event publication and handling happen synchronously unless you've explicitly configured asynchronous event processing. This means the thread that publishes the event will be blocked until all listeners have finished processing it.

However, if we have finished a `@Transactional`-annotated function and triggered an email notification by an event, we don't want the failure of sending email rollbacks everything we have done.

In this case we annotate our `EventHandler` that sends email by `@TransactionalEventListener` instead! It is different from `@EventListner` by its `phase` attribute:
- `BEFORE_COMMIT`
- `AFTER_COMMIT` $\leftarrow$ the default one
- `AFTER_ROLLBACK`
- `AFTER_COMPLETION`

##### Configure `JOOQ` to use Spring's Transactional Manager

```kotlin 
import org.jooq.SQLDialect
import org.jooq.impl.DataSourceConnectionProvider
import org.jooq.impl.DefaultConfiguration
import org.jooq.impl.DefaultDSLContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.jdbc.datasource.TransactionAwareDataSourceProxy
import org.springframework.transaction.annotation.EnableTransactionManagement
import javax.sql.DataSource

@Configuration
@EnableTransactionManagement
class JooqConfig {
    @Bean
    fun connectionProvider(dataSource: DataSource) =
        DataSourceConnectionProvider(TransactionAwareDataSourceProxy(dataSource))

    @Bean
    fun dslContext(configuration: org.jooq.Configuration) = DefaultDSLContext(configuration)

    @Bean
    fun configuration(connectionProvider: DataSourceConnectionProvider): org.jooq.Configuration {
        return DefaultConfiguration().apply {
            set(connectionProvider)
            set(SQLDialect.POSTGRES)
        }
    }
}
```


#### Reference 

1. [Aggregate (Root) Design: Separate Behavior & Data for Persistence](https://www.youtube.com/watch?v=GtWVGJp061A), CodeOpinion
2. [Spring Data — Power of Domain Events](https://dev.to/kirekov/spring-data-power-of-domain-events-2okm?fbclid=IwY2xjawEyAyJleHRuA2FlbQIxMQABHS8mGlKwXbe-CGD_GFhoeq3VIzl-BrXN9BqGBBuotx1HwZx4pBUVPmmUTQ_aem_KYDcdoX9EKyttjP_VAYMpQ), Semyon Kirekov