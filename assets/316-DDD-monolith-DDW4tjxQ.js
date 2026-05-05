const e=`---
title: "Monolithic DDD Without ORM by Separating Data and Domain Behaviour"
date: 2024-08-21
id: blog0316
tag: springboot, kotlin, DDD
toc: true
intro: "There are two ways for DDD Project in spring boot: DDD using ORM and that with ORM, let's discuss the one without ORM in this article"
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Separation of Data and Domain Behaviour
#### Data

##### AbstractRepository

- A repository should only manage data and should only have two purposes:
  1. Get the aggregate
  2. Save the aggregate
- But if we implement \`repository.save(aggregate)\`, then we need to expose 
  - \`aggregate.domainEvents\`
  - \`aggregate.clearEvents()\`
  - \`aggregate.registerEvent()\` 
  for the \`repository\` to act with. 
- But these attributes and methods **should not** be exposed to any one except for the repository, this is not achievable.
- We therefore move the \`save\` method to the domain object itself. 


\`\`\`kotlin 
abstract class AbstractRepository<T, ID> {
    abstract fun findById(id: ID): T
    // abstract fun save () { ... }  implemented in aggregate object instead
}
\`\`\`

**Remark.**
- If we do DDD with ORM provided by \`spring-data\`, i.e., using \`CrudRepositry<T>\` or \`JpaRepository<T>\` with \`T\` being inherited from \`AbstractAggregateRoot\`, then by \`repository.save()\`, the ORM will dispatch all events stored in the events attribute annotated by \`@DomainEvents\`. 

  This approach is feasible if we start everything from JPA's \`Entity\` classes. Details can be found [here](https://dev.to/kirekov/spring-data-power-of-domain-events-2okm?fbclid=IwY2xjawEyAyJleHRuA2FlbQIxMQABHS8mGlKwXbe-CGD_GFhoeq3VIzl-BrXN9BqGBBuotx1HwZx4pBUVPmmUTQ_aem_KYDcdoX9EKyttjP_VAYMpQ).

- However, if we start from an existing database (which is my case), then turning our schema into \`Entity\` classes is not pragmatic. 

  Though there are tools like \`jpa-buddy\` that tries to achieve this, but a change of a  table means a rebuild of a \`jpa\` class, it is not easy to version the changes especially we need to write domain behaviour in that file.

- Worse still, \`enum\` is not supported very well from \`jpa-buddy\` into \`jpa\` class.





##### OrderRepository: AbstractRepository

Now we create our concret repository with "micro-orm" such as type-safed query builder. In this article we use \`JOOQ\`.

\`JOOQ\`, apart from being a query builder, also has an option to generate all \`DAO\` objects for us ([here](/blog/article/-Spring-boot-in-Kotlin-with-JOOQ-and-Prisma-Simple-Commands-for-Gradles-Integration-and-Unit-Tests) for more detail). 

If your choice of framework does not provide a \`DAO\` such as \`prisma-kysely\`, then simply write the \`select *\` query built form the framework. The replacement should be obvious to do:


\`\`\`kotlin 
import com.machingclee.db.tables.daos.StripeorderDao
import com.machingclee.db.tables.daos.StripeorderdetailDao
import com.machingclee.payment.domain.AbastractRepository
import com.machingclee.payment.domain.OrderDomain
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
\`\`\`

Let's define the \`OrderDomain\` object in the next section right below.

Recall that an aggregate is a domain object, we name the aggregate by its aggregate root. In our case, our root is \`Order\`, thus the name \`OrderDomain\`.


#### Domain Behaviour Sample 1 (root with single object as a member of aggregate)


\`\`\`kotlin-1
package com.machingclee.payment.domain

import com.machingclee.db.enums.Status
import com.machingclee.db.tables.daos.StripeorderDao
import com.machingclee.db.tables.daos.StripeorderdetailDao
import com.machingclee.db.tables.pojos.Stripeorder
import com.machingclee.db.tables.pojos.Stripeorderdetail
import com.machingclee.payment.exceptions.OrderException
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
    val order: Stripeorder?,
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

    fun updateOrderSessionId(sessionId: String) {
        if (order?.id == null) {
            throw Exception("OrderId cannot be null")
        }
        registerEvent(OrderCheckoutSessionCreated(order.id!!, sessionId))
    }

    fun updateOrderDetailSubscriptionId(subscriptionId: String) {
        registerEvent(SubscriptionCreatedEvent(orderId = order?.id!!, subscriptionId = subscriptionId))
    }

    fun save() {
        for (event in domainEvents) {
            applicationEventPublisher.publishEvent(event)
        }
        clearDomainEvents()
    }
\`\`\`
Up to this point our domain object just consists of boilerplate code, here comes the behavioural part!
\`\`\`kotlin-56
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
\`\`\`
Finally we create side effect via \`EventHandler\`:
\`\`\`kotlin-72
import com.machingclee.db.enums.Status
import com.machingclee.db.tables.daos.StripeorderDao
import com.machingclee.payment.annotation.EventHandlerLogging
import com.machingclee.payment.domain.*
import com.machingclee.payment.extendeddao.ExtendedStripeOrderdetailDao
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import java.util.UUID

@EventHandlerLogging
@Component
class OrderEventHandler(
    private val stripeorderDao: StripeorderDao,
    private val stripeorderdetailDao: ExtendedStripeOrderdetailDao
) {
    @EventListener
    fun on(event: OrderSucceededEvent) {
        val order = stripeorderDao.findById(event.orderId)
        if (order == null) {
            throw Exception("Order cannot be null")
        }
        order.status = Status.SUCCEEDED
        order.succeededat = event.succeededAt
        stripeorderDao.update(order)
    }

    @EventListener
    fun on(event: OrderDetailCompletedEvent) {
        stripeorderdetailDao.insert(event.orderDetail)
    }

    @EventListener
    fun on(event: OrderCheckoutSessionCreated) {
        val (orderId, sessionId) = event
        val order = stripeorderDao.findById(orderId)
        order?.let {
            it.stripesessionid = sessionId
            stripeorderDao.update(order)
        }
    }

    @EventListener
    fun on(event: SubscriptionCreatedEvent) {
        val orderId = event.orderId
        val orderDetail = stripeorderdetailDao.fetchByStripeorderid(orderId).firstOrNull()
            ?: throw Exception("Order detail not found")
        orderDetail.subscriptionid = event.subscriptionId
        stripeorderdetailDao.update(orderDetail)
    }

    @EventListener
    fun on(event: InvoiceUpdatedEvent) {
        val (orderId, invoicePaidEventId, invoicePdfURL) = event
        val orderDetail = stripeorderdetailDao.fetchByStripeorderid(UUID.fromString(orderId)).firstOrNull()!!
        orderDetail.invoicepaideventid = invoicePaidEventId
        orderDetail.invoicepdfurl = invoicePdfURL
        stripeorderdetailDao.update(orderDetail)
    }
}
\`\`\`


### Use Cases
#### Case 1: Creation of domain object within an aggregate
\`\`\`kotlin
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
\`\`\`
#### Case 2: Update of domain object within an aggregate
\`\`\`kotlin
    private fun updateOrderStatusAndDetail(orderId: String, invoicePaideventId: String, subscriptionId: String) {
        val orderDomain = orderRepository.findById(orderId)
        orderDomain.updateOrdersucceededInfo(orderId, invoicePaideventId)
        orderDomain.save()
    }
\`\`\`

Note that both 
- \`orderDomain.addStripeOrderDetail\`  
- \`orderDomain.updateOrdersucceededInfo\` 
are simply creating events, and \`save()\` is simply a dispatch of all events.

### Appendix

#### @TransactionalEventListener

Based on \`Claude-3.5-Sonnet-200k\`:

- When you dispatch an event using \`ApplicationEventPublisher\` and handle it with an \`@EventListener\`, by default these operations occur on the same thread in Spring.

- The event publication and handling happen synchronously unless you've explicitly configured asynchronous event processing. This means the thread that publishes the event will be blocked until all listeners have finished processing it.

However, if we have finished a \`@Transactional\`-annotated function and triggered an email notification by an event, we don't want the failure of sending email rollbacks everything we have done.

In this case we annotate our \`EventHandler\` that sends email by \`@TransactionalEventListener\` instead! It is different from \`@EventListner\` by its \`phase\` attribute:
- \`BEFORE_COMMIT\`
- \`AFTER_COMMIT\` $\\leftarrow$ the default one
- \`AFTER_ROLLBACK\`
- \`AFTER_COMPLETION\`

#### Configure \`JOOQ\` to use Spring's Transactional Manager

\`\`\`kotlin 
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
\`\`\`



#### Domain Behaviour Sample 2 (root with a list of objects as a member of aggregate)

As is the previous example in sample 1, we only expose the aggregate root (which is nullable because we return Aggregate from repository, and sometimes the nullity can help reflect the non-existence).

##### Code Implementation


\`\`\`kotlin
import com.machingclee.db.tables.pojos.QuotaSeat
import com.machingclee.db.tables.pojos.QuotaUsagecounter
import org.springframework.context.ApplicationEventPublisher

data class SeatCancelledEvent(val seatId: Int)
data class NewUsageCounterAddedEvent(val newCounter: QuotaUsagecounter)
data class CountersOfSeatInactivated(val seatId: Int)

class SeatDomain(
    val seat: QuotaSeat?,
    private val activeCounters: MutableList<QuotaUsagecounter>,
    private val applicationEventPublisher: ApplicationEventPublisher
) {
    private val domainEvents: MutableList<Any> = mutableListOf()

    val lastActiveCounter: QuotaUsagecounter?
        get() {
            return activeCounters.sortedByDescending { counter ->
                counter.createdat
            }.firstOrNull()
        }

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

    fun inactivate() {
        if (seat == null) {
            throw Exception("Seat cannot be bull")
        }
        seat.active = false
        registerEvent(SeatCancelledEvent(seat.id!!))
    }
    ...
}
\`\`\`

##### Problem: How to Create such Aggregate Effectively?


- We cannot use \`by lazy { /* some closure */ }\` because lazy loaded attribute has no setter method. Namely, you cannot mutate it.

- Given that we have queried a list of aggregate root, let's say 10 of them. Querying by a for loop that queries a list for 10 times is highly inefficient.


**Solution.** We query all necessary informations ***by simply one SQL***. Let's take \`JOOQ\` as an example, the following sql
\`\`\`kotlin 
data class SeatWithCounters(
    var id: Int? = null,
    var duedate: Double,
    var audiolimit: Double,
    var owneremail: String,
    var assigntargetemail: String? = null,
    var createdat: Double? = null,
    var createdathk: String? = null,
    var type: QuotaSeattype,
    var downgradetoseatid: Int? = null,
    var upgradetoseatid: Int? = null,
    var subscriptionid: String,
    var active: Boolean? = null,
    var counters: MutableList<QuotaUsagecounter>
)

// remove counters only
fun SeatWithCounters.toSeat(): QuotaSeat {
    return QuotaSeat(
        var id = this.id 
        var duedate = this.duedate 
        var audiolimit = this.audiolimit 
        var owneremail = this.owneremail 
        var assigntargetemail = this.assigntargetemail 
        var createdat = this.createdat 
        var createdathk = this.createdathk 
        var type = this.type 
        var downgradetoseatid = this.downgradetoseatid 
        var upgradetoseatid = this.upgradetoseatid 
        var subscriptionid = this.subscriptionid 
        var active = this.active 
    )
}

@Component
class ExtendedSeatDao(
    private val db: DSLContext,
    private val configuration: Configuration
) : QuotaSeatDao(configuration) {

    fun fetchActiveSeatByUserEmail(
        planOwnerEmail: String,
        targetEmail: String?,
        seattype: QuotaSeattype
    ): MutableList<SeatWithCounters> {
        val seatTable = QUOTA_SEAT
        val counterTable = QUOTA_USAGECOUNTER
        return db.select(
            seatTable.asterisk(),
            multiset(
                select(counterTable.asterisk())
                    .from(counterTable).where(counterTable.SEATID.eq(seatTable.ID))
            ).\`as\`("counters").convertFrom { it.into(QuotaUsagecounter::class.java) }
        )
            .from(seatTable)
            .where(
                seatTable.TYPE.eq(seattype)
                    .and(seatTable.ACTIVE.eq(true))
                    .and(seatTable.OWNEREMAIL.eq(planOwnerEmail))
                    .and(if (targetEmail != null) seatTable.ASSIGNTARGETEMAIL.eq(targetEmail) else trueCondition())
            )
            .fetch()
            .into(SeatWithCounters::class.java)
    }
}
\`\`\`
Results in 

![](/assets/img/2024-08-23-00-51-16.png)

Finally we return aggregates in our repository as follows:

\`\`\`kotlin
fun fetchAssignableSeatByUserEmail(ownerEmail: String, seattype: QuotaSeattype): List<SeatDomain> {
    val seats = quotaSeatDao.fetchActiveSeatByUserEmail(ownerEmail, null, seattype)
    return seats.map { seatWithCounters ->
        val counters = seatWithCounters.counters
        val seat = seatWithCounters.toSeat()
        SeatDomain(seat, counters, applicationEventPublisher)
    }
}
\`\`\`

#### Rules from DDD to Prevent Sporatic (Uncontrollable) Database State Change and Some Tradeoff Discussion

- Database state change should only come from:
  1. Aggregate domain event

  2. Application and Domain service via usage of repository
- Further Rules for Architecture:
  - All aggregate root should be created by \`repository.createRoot\` method.
  - The birth of each aggregate member should be due to the behaviour of the root domain object, while the birth of the root domain object should come from repository.
  - Apart from the root, the birth of any other object deserves an event to propagate (we can notify the creation of aggregate root via constructor).
  - If no side effect is to be made, it is acceptable to **inject DAO** into **domain service** for cross-domain data accessment, though not recommended.
- **Application and Domain Service.** Application Service layer achives the following (orchestration):
  - Arrange domain object (like calling \`repository.createRoot()\`)
  - Apply domain service
  - Domain service then arrange the domain behaviours to make side effects
  - Sometimes domain service layer may be an overkill, we arrange domain behaviour in application service layer directly
- **Question.**  Should we inject DAO and repository into Application Service Layer and Domain Service Layer?
  
  **Study From Internet.** For Application Service Layer, the answer is absolutely yes. For Domain Service Layer, it is ***debatable***.

  Suppose we are in the middle of a function in domain service, at which we determine to create a domain object (usually it is the root of an aggregate). It is **cumbersome** to
  1.  Quit the current scope of function;

  2.  Create the target domain object in application service layer;
  3.  Inject that domain object into domain service layer and continue
  
  This obviously breaks our code into multiple pieces inevitably.

  Therefore it is LGTM to inject repository, it is also okay to inject DAO ***for querying data only*** (recall that db state change should be the job of repository and domain behaviours).

### Reference 

1. [Aggregate (Root) Design: Separate Behavior & Data for Persistence](https://www.youtube.com/watch?v=GtWVGJp061A), CodeOpinion
2. [Spring Data — Power of Domain Events](https://dev.to/kirekov/spring-data-power-of-domain-events-2okm?fbclid=IwY2xjawEyAyJleHRuA2FlbQIxMQABHS8mGlKwXbe-CGD_GFhoeq3VIzl-BrXN9BqGBBuotx1HwZx4pBUVPmmUTQ_aem_KYDcdoX9EKyttjP_VAYMpQ), Semyon Kirekov`;export{e as default};
