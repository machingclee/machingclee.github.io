const e=`---
title: "Stripe Events and metadata in Stripe Checkout Sessions"
date: 2024-08-10
id: blog0312
tag: stripe, kotlin
toc: true
intro: "When creating a transaction we need to wait for the checkout-session-completed event in order to execute follow-up action in our own system, we relies on metadata to follow the transaction."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Setup Forwarding Endpoint for Stripe Webhook

#### Install CLI

[Offcial Download Site](https://docs.stripe.com/stripe-cli)

#### Login
\`\`\`text
stripe login --api-key sk_test_51PffJDRt6IuPF...
\`\`\`

#### Forward to ...
\`\`\`text
stripe listen --forward-to http://localhost:8080/event/webhook
\`\`\`


### Construct metadata in Creating Checkout Session for Subscription

\`\`\`kotlin{26-30}
@Service
class StripeService(
    private val stripeCustomerDao: StripecustomerDao,
    @Value("\\\${stripe.api-key}") private val stripeSecretKey: String,
    @Value("\\\${stripe.purchase-page-url}") private val purchasePageURL: String,
) {
    fun createOrderSubscriptionPlanSession(
        orderId: String,
        stripCustomerId: String,
        priceId: String,
        productName: String,
        quantity: Int
    ): String {
        // https://docs.stripe.com/api/checkout/sessions/create
        val sessionParam = SessionCreateParams.builder()
            .setSuccessUrl("$purchasePageURL/success?productName=$productName")
            .setCancelUrl("$purchasePageURL/failed?orderId=$orderId")
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setPrice(priceId)
                    .setQuantity(quantity.toLong())
                    .build()
            )
            .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
            .setCustomer(stripCustomerId)
            .setSubscriptionData(
                SubscriptionData.builder()
                    .putMetadata("orderId", orderId)
                    .build()
            )
            .build()
        val session = Session.create(sessionParam)
        val sessionId = session.id
        return sessionId
    }
}
\`\`\`

### Get Subscription and its metadata from Webhook's \`checkout.session.completed\` Event
#### Strategy

- Since our \`metadata\` is embedded into \`Subscription\` object, there is no metadata in our checkout session events.

- To get desired metadata, we follow the path:
  1. Get \`subscriptionId\` from \`checkout.session.completed\` event
  2. Get \`Subscription\` from this \`subscriptionId\`, 
  3. Get \`metadata\` from this \`Subscription\`.


#### Listening Controller

\`\`\`kotlin{14}
@RestController
@RequestMapping("/event")
class EventController(
    private val stripeService: StripeService,
    private val commandGateway: CommandGateway,
    private val queryGateway: QueryGateway,
    private val dbService: DbService,
) {
    @PostMapping("/webhook")
    fun reactToStripeEvents(@RequestBody event: Event): RestResponse.Success<Any> {
        val checkoutSuccess = event.type == PaymentEventType.CHECKOUT_SESSION_COMPLETED.code
        when (event.type) {
            PaymentEventType.CHECKOUT_SESSION_COMPLETED.code -> {
                val orderId = stripeService.getOrderIdFromStripeCheckoutCompletedEventId(event.id)
                    ?: throw Exception("Order id cannot be found")
                val cmd = CommandAndEvents.SubscriptionPlanOrder.Step5.GrantDBPermissionCommand(orderId = orderId)
                commandGateway.send(cmd,LoggingCallback.INSTANCE)
            }
        }
        return RestResponse.Success()
    }
}
\`\`\`

#### Get \`orderId\` from metadata in Subscription via Checkout Completed Event

\`\`\`kotlin{25}
data class EventDataObject(val subscription: String)

@Service
class StripeService(
    private val stripeCustomerDao: StripecustomerDao,
    @Value("\\\${stripe.api-key}") private val stripeSecretKey: String,
    @Value("\\\${stripe.purchase-page-url}") private val purchasePageURL: String,
) {
    private var stripeInited: Boolean = false

    public fun initStripe() {
        if (!stripeInited) {
            Stripe.apiKey = this.stripeSecretKey
            stripeInited = true
        }
    }

    fun getOrderIdFromStripeCheckoutCompletedEventId(eventId: String): String? {
        val event = Event.retrieve(eventId)
        val subscriptionId = Gson().fromJson(
            event.dataObjectDeserializer.\`object\`.get().toJson(),
            EventDataObject::class.java
        ).subscription
        val subscription = Subscription.retrieve(subscriptionId)
        val orderId = subscription.metadata.get("orderId")
        return orderId
    }
}
\`\`\``;export{e as default};
