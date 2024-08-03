---
title: "Subscription Query and its Error Handling"
date: 2024-08-03
id: blog0304
tag: springboot, axon-framework
toc: true
intro: "Study the error handling for Subscription Query"
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Preface

- Almost every request from frontend will require the latest information from backend. 

- Therefore it is crucial to implement a "waiting mechanism" to await for the eventual outcome of ***multiple events*** triggered by a single command.

#### Controller Side with Subscription Query



```kotlin
import com.billie.db.tables.pojos.Stripeorder
import com.billie.payment.command.CommandAndEvents
import com.billie.payment.dto.OrderSubscriptionPlanDto
import com.billie.payment.model.UserContext
import com.billie.payment.query.CheckoutOrderQuery
import com.billie.payment.service.DbService
import org.axonframework.commandhandling.gateway.CommandGateway
import org.axonframework.messaging.responsetypes.ResponseTypes
import org.axonframework.queryhandling.QueryGateway
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/plan")
class SubscriptionPlanController(
    private val commandGateway: CommandGateway,
    private val queryGateway: QueryGateway,
    private val dbService: DbService
) {
    // diagram: https://miro.com/app/board/uXjVKubCBHc=/
    @PostMapping("/purchase")
    fun orderPlan(
        @RequestBody orderSubscriptionPlanDto: OrderSubscriptionPlanDto
    ): Stripeorder {
        val orderId = dbService.generateULIDasUUID()
        val user = UserContext.instance.getUser()
        val queryResult = queryGateway.subscriptionQuery(
            CheckoutOrderQuery(
                orderId = orderId
            ),
            ResponseTypes.instanceOf(Stripeorder::class.java),
            ResponseTypes.instanceOf(Stripeorder::class.java),
        )
        queryResult.use { queryResult ->
            commandGateway.send<String>(
                CommandAndEvents.SubscriptionPlanOrder.Step1.CreateCustomerCommand(
                    orderId = orderId,
                    userEmail = user.email,
                    userName = user.name,
                    paymentPlan = orderSubscriptionPlanDto.plan,
                    numOfPersons = orderSubscriptionPlanDto.numOfPersons ?: 0
                )
            )
            val result = queryResult.updates().blockFirst()
                ?: throw Exception("Stripe order cannot be found, orderId=$orderId")

            return result
        }

        // subscription query here
    }
}
```


#### CommandHandler Side

```kotlin-1{16-26}
@Aggregate
class SubscriptionPlanOrderAggregate() {
    @AggregateIdentifier
    private var orderId: String? = null
    private var userEmail: String? = null
    private var customerId: String? = null
    private var paymentPlan: PaymentPlan? = null
    private var numOfPersons: Int? = null
    private var orderStarted: Boolean = false
    private var stripeSessionId: String? = null

    companion object {
        var logger: KLogger = KotlinLogging.logger {}
    }

    private final fun cancelCheckoutSubscriptionQuery(
        queryUpdateEmitter: QueryUpdateEmitter,
        orderId: String,
        e: Exception
    ) {
        queryUpdateEmitter.completeExceptionally(
            CheckoutOrderQuery::class.java, { query ->
                query.orderId == orderId
            }, e
        )
    }
```
- Here we define `cancelCheckoutSubscriptionQuery` and propagate the exception via `queryResult` channel. This channel is identified by the query object `CheckoutOrderQuery` and the `orderId` parameter.

- Now the `sessoinId` is supposed to be published to the `queryResult` channel by the `sagaEventHandler` handling `Step3.SessionIdCreatedEvent`.

- Commands that potentially cause `Exception` should be wrapped by a `try-catch` (for example, calling Stripe API via its SDK).


Let's study the try-catch blocks below:


```kotlin-27{33-60,101-121}
    @CommandHandler
    constructor (
        cmd: Step1.CreateCustomerCommand,
        stripeService: StripeService,
        queryUpdateEmitter: QueryUpdateEmitter
    ) : this() {
        try {
            logger.info {
                "CreateCustomerCommand"
            }

            val stripeCustomerId = stripeService.createCustomer(
                CreateCustomerDto(
                    email = cmd.userEmail,
                    name = cmd.userName
                )
            )
            val event = Step1.CustomerCreatedEvent(
                orderId = cmd.orderId,
                userEmail = cmd.userEmail,
                paymentPlan = cmd.paymentPlan,
                numOfPersons = cmd.numOfPersons,
                customerId = stripeCustomerId
            )
            apply(event)
        } catch (e: Exception) {
            cancelCheckoutSubscriptionQuery(queryUpdateEmitter, cmd.orderId, e)
            apply(
                Step1.Failed.CreateCustomerCancelledEvent(
                    orderId = cmd.orderId,
                    reason = e.message ?: ""
                )
            )
        }
    }

    @EventSourcingHandler
    fun on(event: Step1.CustomerCreatedEvent) {
        this.orderId = event.orderId
        this.userEmail = event.userEmail
        this.paymentPlan = event.paymentPlan
        this.numOfPersons = event.numOfPersons
        this.customerId = event.customerId

    }

    @CommandHandler
    fun handle(cmd: Step2.OrderSubscriptionPlanCommand) {
        logger.info {
            "OrderSubscriptionPlanCommand"
        }
        apply(
            Step2.SubscriptionPlanOrderedEvent(
                orderId = this.orderId!!,
                email = this.userEmail!!
            )
        )
    }

    @EventSourcingHandler
    fun on(e: Step2.SubscriptionPlanOrderedEvent) {
        orderStarted = true
    }

    @CommandHandler
    fun handle(
        cmd: Step3.CreateSessionIdCommand,
        stripeService: StripeService,
        queryUpdateEmitter: QueryUpdateEmitter
    ) {
        logger.info {
            "CreateSessionIdCommand"
        }
        val plan = paymentPlan ?: throw Exception("Payment plan cannot be null")
        try {
            val sessionId = stripeService.createSession(
                this.customerId!!,
                PriceId.fromPaymentPlan(plan)!!
            )
            apply(
                Step3.SessionIdCreatedEvent(
                    orderId = this.orderId!!,
                    sessionId = sessionId
                )
            )
        } catch (e: Exception) {
            // compensating command
            cancelCheckoutSubscriptionQuery(queryUpdateEmitter, cmd.orderId, e)
            apply(
                Step3.Failed.CreateSessionIdCancelledEvent(
                    orderId = cmd.orderId,
                    reason = e.message ?: ""
                )
            )
        }
    }
}
```
- Note that we also dispatch the related ***compensating*** events with reason. 
- Some entity in our database may also record the error arised. Some of the state may also need to be adjusted. We save all of them in database.

- We trigger the database adjustments by the regular `eventHandler`'s, and dispatch compensating actions of the ***previous*** command  via `sagaEventHandler`.