const n=`---
title: "Logging of Commands and Events in Axon Framework"
date: 2024-08-06
id: blog0307
tag: kotlin, springboot, axon-framework
toc: true
intro: "We record how to use interceptor and custom annotation to record the flow of commands and events."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Logging of Commands in Aggregate and Logging of Events in Saga

#### AggregateCommandLoggingDispatchInterceptor
\`\`\`kotlin
package com.machingclee.payment.interceptor

import io.github.oshai.kotlinlogging.KLogger
import io.github.oshai.kotlinlogging.KotlinLogging
import org.axonframework.commandhandling.CommandMessage
import org.axonframework.messaging.MessageDispatchInterceptor
import org.springframework.stereotype.Component
import java.util.function.BiFunction


@Component
class AggregateCommandLoggingDispatchInterceptor() : MessageDispatchInterceptor<CommandMessage<*>?> {
    companion object {
        var logger: KLogger = KotlinLogging.logger {}
    }

    override fun handle(messages: List<CommandMessage<*>?>): BiFunction<Int, CommandMessage<*>?, CommandMessage<*>?> {
        return BiFunction { index: Int?, genericCommand: CommandMessage<*>? ->
            val command = genericCommand?.payload
            logger.info { "[Aggregate] $command" }
            genericCommand
        }
    }
}
\`\`\`

#### SagaEventLoggingDispatchInterceptor
\`\`\`kotlin
package com.machingclee.payment.interceptor

import io.github.oshai.kotlinlogging.KLogger
import io.github.oshai.kotlinlogging.KotlinLogging
import org.axonframework.eventhandling.EventMessage
import org.axonframework.messaging.MessageDispatchInterceptor
import org.springframework.stereotype.Component
import java.util.function.BiFunction


@Component
class SagaEventLoggingDispatchInterceptor : MessageDispatchInterceptor<EventMessage<*>?> {
    companion object {
        var logger: KLogger = KotlinLogging.logger {}
    }

    override fun handle(messages: MutableList<out EventMessage<*>?>): BiFunction<Int, EventMessage<*>?, EventMessage<*>?> {
        return BiFunction { index, event ->

            logger.info { "[Saga] \${event?.payload ?: ""}" }
            event
        }
    }
}
\`\`\`

#### Registration of Interceptors
\`\`\`kotlin 
@SpringBootApplication
class PaymentApplication {
    companion object {
        @JvmStatic
        fun main(args: Array<String>) {
            runApplication<PaymentApplication>(*args)
        }
    }

    @Autowired
    fun configureCommandBus(
        commandBus: CommandBus,
        aggregateCommandLoggingInterceptor: AggregateCommandLoggingDispatchInterceptor,
    ) {
        commandBus.registerDispatchInterceptor(aggregateCommandLoggingInterceptor)
    }

    @Autowired
    fun configureEventBus(
        eventBus: EventBus,
        sagaEventLoggingDispatchInterceptor: SagaEventLoggingDispatchInterceptor,
    ) {
        // note that an EventStore is a more specific implementation of an EventBus
        eventBus.registerDispatchInterceptor(sagaEventLoggingDispatchInterceptor)
    }
}
\`\`\`





### Logging Events in EventHandlers via AOP

#### Warning to Axon-Managed Beans

- \`AOP\` ***cannot be applied to*** beans managed by axon-framework.

- Thus we can't apply custom annotations to \`@Aggregate\` and \`@Saga\`. 


#### Define Annotation to add Interceptor to all Methods of a Class
##### Annotation
\`\`\`kotlin
package com.machingclee.payment.annotation

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@MustBeDocumented
annotation class EventHandlerLogging
\`\`\`
##### Aspect

\`\`\`kotlin 
package com.machingclee.payment.aspect

import com.machingclee.payment.service.GmailService
import io.github.oshai.kotlinlogging.KLogger
import io.github.oshai.kotlinlogging.KotlinLogging
import org.aspectj.lang.ProceedingJoinPoint
import org.aspectj.lang.annotation.Around
import org.aspectj.lang.annotation.Aspect
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Aspect
@Component
class EventHandlerLoggingAspect {
    companion object {
        var logger: KLogger = KotlinLogging.logger {}
    }

    @Around("@within(com.machingclee.payment.annotation.EventHandlerLogging)")
    fun around(joinPoint: ProceedingJoinPoint): Any? {
        val argument = joinPoint.args[0]
        logger.info { "[EvtHandler] $argument" }
        return joinPoint.proceed()
    }
}
\`\`\`
#### Apply it to Regular EventHandler (not axon-managed)

\`\`\`kotlin
import com.machingclee.db.tables.daos.ProductDao
import com.machingclee.db.tables.daos.StripecustomerDao
import com.machingclee.db.tables.daos.StripeorderDao
import com.machingclee.db.tables.pojos.Stripecustomer
import com.machingclee.db.tables.pojos.Stripeorder
import com.machingclee.payment.annotation.EventHandlerLogging
import com.machingclee.payment.command.CommandAndEvents.SubscriptionPlanOrder.*
import com.machingclee.payment.query.CheckoutOrderQuery
import io.github.oshai.kotlinlogging.KLogger
import io.github.oshai.kotlinlogging.KotlinLogging
import org.axonframework.commandhandling.gateway.CommandGateway
import org.axonframework.config.ProcessingGroup
import org.axonframework.eventhandling.EventHandler
import org.axonframework.queryhandling.QueryUpdateEmitter
import org.springframework.stereotype.Component
import java.util.UUID


@EventHandlerLogging
@Component
@ProcessingGroup("SubscriptionPlanOrder")
class SubscriptionPlanOrderEventHandlers(
    val stripCustomerDao: StripecustomerDao,
    val stripeOrderDao: StripeorderDao,
    val queryUpdateEmitter: QueryUpdateEmitter,
    val productDao: ProductDao,
    val commandGateway: CommandGateway,
) {

    private final fun cancelSessionIdSubscriptionQuery(
        orderId: String,
        e: Exception,
    ) {
        queryUpdateEmitter.completeExceptionally(
            CheckoutOrderQuery::class.java, { query ->
                query.orderId == orderId
            }, e
        )
    }

    companion object {
        var logger: KLogger = KotlinLogging.logger {}
    }

    @EventHandler
    fun on(event: Step1.CustomerCreatedEvent) {
        try {
            val customer = stripCustomerDao.fetchByCompanyemail(event.userEmail).firstOrNull()
            if (customer != null) {
                return
            }
            stripCustomerDao.insert(
                Stripecustomer(
                    companyemail = event.userEmail,
                    stripecustomerid = event.customerId
                )
            )
        } catch (e: Exception) {
            commandGateway.sendAndWait<Any>(
                Step1.Failed.CancelCreateCustomerCommand(
                    orderId = event.orderId,
                    reason = "Cannot Insert Customerd into DB"
                )
            )
        }
    }

    @EventHandler
    fun on(event: Step2.SubscriptionPlanOrderedEvent) {
        try {
            val product = productDao.fetchByStripepriceid(event.priceId).firstOrNull()
                ?: throw Exception("Product does not exist")

            val order = Stripeorder(
                id = UUID.fromString(event.orderId),
                useremail = event.email,
                productid = product.id!!,
                quantity = event.quantity
            )
            stripeOrderDao.insert(order)
        } catch (e: Exception) {
            cancelSessionIdSubscriptionQuery(event.orderId, e)
        }
    }

    @EventHandler
    fun on(event: Step2.Failed.OrderPlanCancelledEvent) {
        val orderId = UUID.fromString(event.orderId)
        val order = stripeOrderDao.fetchById(orderId).firstOrNull()
            ?: throw Exception("order not found for id $orderId")
        order.error = event.reason
        stripeOrderDao.update(order)
    }

    @EventHandler
    fun on(e: Step3.SessionIdCreatedEvent) {
        val stripeOrder = stripeOrderDao.fetchById(UUID.fromString(e.orderId)).firstOrNull()
            ?: throw Exception("stripeOrder is null, orderId: \${e.orderId}")
        stripeOrder.stripesessionid = e.sessionId
        stripeOrderDao.update(stripeOrder)
    }
}
\`\`\`

### Logging Result

\`\`\`text{7-8}
[Aggregate]   CreateCustomerCommand(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2, userEmail=james.lee@wonderbricks.com, userName=Ching-Cheong Lee, priceId=price_1PkKdeRt6IuPFjtubZDJnKkl, productName=Crew Maximizer, numOfPersons=0, quantity=1, productType=CREW_MAXIMIZER)
[Saga]        CustomerCreatedEvent(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2, userEmail=james.lee@wonderbricks.com, numOfPersons=0, customerId=cus_Qa5z59bzyYXZ7K, priceId=price_1PkKdeRt6IuPFjtubZDJnKkl, quantity=1, productType=CREW_MAXIMIZER, productName=Crew Maximizer)
[EvtHandler]  CustomerCreatedEvent(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2, userEmail=james.lee@wonderbricks.com, numOfPersons=0, customerId=cus_Qa5z59bzyYXZ7K, priceId=price_1PkKdeRt6IuPFjtubZDJnKkl, quantity=1, productType=CREW_MAXIMIZER, productName=Crew Maximizer)
[Aggregate]   CreateProductRecordCommand(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2)
[Saga]        ProductRecordCreatedEvent(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2, productId=1)
[Aggregate]   OrderSubscriptionPlanCommand(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2)
[Saga]        SubscriptionPlanOrderedEvent(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2, email=james.lee@wonderbricks.com, priceId=price_1PkKdeRt6IuPFjtubZDJnKkl, quantity=1)
[EvtHandler]  SubscriptionPlanOrderedEvent(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2, email=james.lee@wonderbricks.com, priceId=price_1PkKdeRt6IuPFjtubZDJnKkl, quantity=1)
[Aggregate]   CreateSessionIdCommand(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2)
[Saga]        SessionIdCreatedEvent(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2, sessionId=cs_test_a1XjD2uwE8zXsvzKIbiFfgIcdeQ9Y6KYV7tdf6MEBfsfjAjfamdkKBpDaz)
[EvtHandler]  SessionIdCreatedEvent(orderId=019128b2-4347-c5d7-1ca9-fe425a972dc2, sessionId=cs_test_a1XjD2uwE8zXsvzKIbiFfgIcdeQ9Y6KYV7tdf6MEBfsfjAjfamdkKBpDaz)
\`\`\`

- From the highlights, there is no guarantee an event from command **first** reaches event handler, **then** saga handler. 

- If error in regular event handler occurs, 
  1. Dispatch a compensating command in the event (via \`commandGateway\`, also stop subscription query if there is any in the cycle.), 

  2. Dispatch a compensating event to an \`@EndSaga\` event handler, and
  3. Adjust also a boolean in saga's class variable to stop potentially triggered event handler.
`;export{n as default};
