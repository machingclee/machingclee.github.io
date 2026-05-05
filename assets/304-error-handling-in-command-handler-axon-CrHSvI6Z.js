const n=`---
title: "Subscription Query and Error Handling of API Calls"
date: 2024-08-03
id: blog0304
tag: kotlin, springboot, axon-framework
toc: true
intro: "Study the error handling for Subscription Query."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Preface

- Almost every request from frontend will require the latest information from backend. 

- Therefore it is crucial to implement a "waiting mechanism" to await for the eventual outcome of ***multiple events*** triggered by a single command.

### API Calls  in Aggregate, Regular EventHandler or Saga (SagaEventHandler)?


#### Reference 
- https://discuss.axoniq.io/t/call-external-api-in-axon/4775

#### Important Takeaways

>  If you want the command to fail in case the call fails, you should do it on the command side, or with a subscribing event handler


### No Please, Don't try to split commands and events in different folders

- Most of the courses in the internet suggest splitting commands and events in two ***separate*** files or packages, which I **strongly disagree**.

- Commands and Events usually spawn in pair, most of them are sequential, naming the commands and events by Step1, Step2, ... alone is not enough. 

- If the order needs to be rearranged, we are going to change the naming of classes in two files, why not just group all of them into one file?

  We suggest the following pattern instead!

  \`\`\`kotlin
  import com.machingclee.payment.enums.PaymentPlan
  import org.axonframework.modelling.command.TargetAggregateIdentifier

  class CommandAndEvents {
      class SubscriptionPlanOrder {
          class Step1 {
              data class CreateCustomerCommand(
                  @TargetAggregateIdentifier
                  val orderId: String,
                  val userEmail: String,
                  val userName: String,
                  val paymentPlan: PaymentPlan,
                  val numOfPersons: Int
              )

              data class CustomerCreatedEvent(
                  val orderId: String,
                  val userEmail: String,
                  val paymentPlan: PaymentPlan,
                  val numOfPersons: Int,
                  val customerId: String
              )

              class Failed {
                  data class CancelCreateCustomerCommand(
                      @TargetAggregateIdentifier
                      val orderId: String,
                      val reason: String
                  )

                  data class CreateCustomerCancelledEvent(
                      val orderId: String,
                      val reason: String
                  )
              }
          }

          class Step2 {
              data class OrderSubscriptionPlanCommand(
                  @TargetAggregateIdentifier
                  val orderId: String,
              )

              data class SubscriptionPlanOrderedEvent(
                  val orderId: String,
                  val email: String
              )

              class Failed {
                  data class CancelOrderPlanCommand(
                      @TargetAggregateIdentifier
                      val orderId: String,
                      val reason: String
                  )

                  data class OrderPlanCancelledEvent(
                      val orderId: String,
                      val reason: String
                  )
              }
          }

          class Step3 {
              data class CreateSessionIdCommand(
                  @TargetAggregateIdentifier
                  val orderId: String,
              )

              data class SessionIdCreatedEvent(
                  val orderId: String,
                  val sessionId: String
              )

              class Failed {
                  data class CancelCreateSessionIdCommand(
                      @TargetAggregateIdentifier
                      val orderId: String,
                      val reason: String
                  )

                  data class CreateSessionIdCancelledEvent(
                      val orderId: String,
                      val reason: String
                  )
              }

          }

          class Step4 {
              data class DoStripePaymentCommand(
                  @TargetAggregateIdentifier
                  val orderId: String,
              )

              data class StripePaymentDoneEvent(
                  val orderId: String,
              )


              class Failed {
                  data class CancelStripePaymentCommand(
                      @TargetAggregateIdentifier
                      val orderId: String,
                      val reason: String
                  )

                  data class StripePaymentCancelledCommand(
                      val orderId: String,
                      val reason: String
                  )
              }


          }

          class Step5 {
              data class SAdjustDBPermissionCommand(
                  @TargetAggregateIdentifier
                  val orderId: String,
              )

              data class DBPermissionAdjustedEvent(
                  val orderId: String,
              )

              class Failed {
                  data class CancelAdjustDBPermissionCommand(
                      @TargetAggregateIdentifier
                      val orderId: String,
                      val reason: String
                  )

                  data class AdjustDBPermissionCancelledEvent(
                      val orderId: String,
                      val reason: String
                  )
              }
          }
      }
  }
  \`\`\`
  In this way our CQRS flow is much more managible.



### Controller Side with Subscription Query



\`\`\`kotlin
import com.machingclee.db.tables.pojos.Stripeorder
import com.machingclee.payment.command.CommandAndEvents
import com.machingclee.payment.dto.OrderSubscriptionPlanDto
import com.machingclee.payment.model.UserContext
import com.machingclee.payment.query.CheckoutOrderQuery
import com.machingclee.payment.service.DbService
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
\`\`\`


### CommandHandler Side

\`\`\`kotlin-1{16-26}
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
  \`\`\`

- Here we define \`cancelCheckoutSubscriptionQuery\` and propagate the exception via \`queryResult\` channel. This channel is identified by the query object \`CheckoutOrderQuery\` and the \`orderId\` parameter.

- Now the \`sessoinId\` is supposed to be published to the \`queryResult\` channel by the \`sagaEventHandler\` handling \`Step3.SessionIdCreatedEvent\`.

- Commands that potentially cause \`Exception\` should be wrapped by a \`try-catch\` (for example, calling Stripe API via its SDK).


Let's study the try-catch blocks below:


\`\`\`kotlin-27{33-60,101-121}
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
\`\`\`
- Note that we also dispatch the related ***compensating*** events with reason. 
- Some entity in our database may also record the error arised. thus we save all of them in database in regular \`eventHandler\`'s.

- We dispatch compensating actions of the ***previous*** command  via \`sagaEventHandler\`.

  For example, if \`Step3.DoSomethingCommand\` fails, then we dispatch the following chain of actions:
  $$
  \\begin{aligned}
  &{\\color{white}\\to} \\texttt{Step3.DoSomethingFailedEvent (from Aggregate)} \\\\
  &\\to \\texttt{Step2.Failed.CancelSomethingCommand (from Saga)} \\\\
  &\\to \\texttt{Step2.Failed.SomethingCancelledEvent (from Aggregate)} \\\\
  &\\to \\texttt{Step1.Failed.CancelAnotherThingCommand (from Saga)} \\\\
  &\\to \\texttt{Step1.Failed.AnotherThingCancelledEvent (from Aggregate)} \\\\
  
  \\end{aligned}
  $$

- In regular \`eventHandler\` we handle the state change for error messages (if any). 

- In the last step we also end the lifecycle of \`saga\`. 
- Not only that, we listen on \`Step1.Failed.AnotherThingCancelledEvent\` in regular event handler to send alert to stakeholders.
`;export{n as default};
