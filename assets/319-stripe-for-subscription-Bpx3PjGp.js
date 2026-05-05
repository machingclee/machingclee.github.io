const e=`---
title: "Stripe Technical Detail for Add, Upgrade, Downgrade, and Cancel Subscrpition"
date: 2024-09-15
id: blog0319
tag: kotlin, stripe
toc: true
intro: "We record how to adjust a stripe subscription in code using kotlin."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### API-Version

Make sure to use the latest API-version (as in this blog post), which can be configured in stripe dashboard from here:

![](/assets/img/2024-09-14-17-07-11.png)

**_Otherwise_** the event json structure will be different, and you may run into trouble like \` java.util.NoSuchElementException: No value present\` when your code execute:

\`\`\`kotlin
fullEvent.dataObjectDeserializer.\`object\`.get()
\`\`\`

Recall that \`.get()\` method usually means it is of type \`Optional\` in \`java\`.

### Testing Webhook

#### Install Stripe CLI

To install Stripe CLI we can follow the [official instruction](https://docs.stripe.com/stripe-cli). For mac it is as simple as running:

\`\`\`text
brew install stripe/stripe-cli/stripe
\`\`\`

#### Connect to Your Stripe Account

After installing CLI, we execute:

\`\`\`text
stripe login --api-key sk_test_51PffJDR...
stripe listen --forward-to http://localhost:8080/stripe-test/webhook
\`\`\`

### Cont'd From Previous Stripe Basic Post

#### From $\\texttt{checkout.session.complete}$ to $\\texttt{customer.subscription.updated}$

We have introduced a basic stripe event: the \`checkout.session.completed\` event, and how to get the latest customized \`ID\` from the event from [this post](/blog/article/Stripe-Events-and-metadata-in-Stripe-Checkout-Sessions).

As time goes by, we find that the \`checkout.session.completed\` event only applies to new subscription, it **_does not work_** with subscription changes (like upgrade, downgrade, cancel, etc).

Therefore for unifying everything we shift our focus to \`customer.subscription.updated\` event.

#### Handle Delayed Billing Events

##### Doubled Events Emission upon Downgrading and Deleting Subscription

- When downgrading and canelling subscription, we would like the event only to take place at the end of billing period.

- **_Unfortunately_**, a \`customer.subscription.updated\` event will be emitted **_immediately_** once after we make changes (an almost identical event will be fired again at the end of billing period), we need to study how to distinguish them and **_ignore_** the immediately fired one.

##### How to Ignore Immediately Triggered Subscription Update Event

- For every \`subscription.updated\` event there is a field \`previousAttributes\` that indicates what is being changed in the subscription, in kotlin we invoke

  \`\`\`text{2}
  val fullEvent = Event.retrieve(event.id)
  fullEvent.data.previousAttributes
  \`\`\`

  to get a \`Map\` of previous values object.

- When \`Cancel\`/\`Downgrade\` occurs, the \`latest_invoice\` will get updated (and it will not be there at the end of billing period). Therefore we can define a boolean
  \`\`\`kotlin
  val isBillingUpdate = (fullEvent.data.previousAttributes != null)
          && fullEvent.data.previousAttributes.containsKey("latest_invoice")
          && fullEvent.data.previousAttributes["latest_invoice"] != null
  \`\`\`
  to distinguish two \`subscription.update\` events.

### Subscribe, Upgrade, Downgrade, Cancel

#### Strategy

##### Quantity Adjustment for Subscriptions

The actual implementation of \`add\`, \`upgrade\`, \`downgrade\` and \`cancel\` operations are all controlled by adjusting quantities of the products with appropriate \`setters\` setting **proration behaviour** and **billing cylces**:

- \`Subscribe\` <span><up/></span> the quantity from 0 to 1

- \`Upgrade\`, \`Downgrade\` <span><down/></span> the quantity of the old product by 1, and <span><up/></span> that of the new product.
- \`Cancel\` simply <span><down/></span> the quantity of target product by 1.

##### Proration Period and Billing Cycle

We model a subscription plan as a stripe **_product_** in Stripe world, which must live within a Stripe Subscription.

This **_product_** is configured to have recurring price and therefore become a **_subscription_** (in common sense), thus

$$
\\text{subscription}\\Big|_\\text{stripe sense} \\supseteq \\left\\{ \\text{subscription}\\Big|_\\text{ordinary}\\right\\},
$$

namely, a stripe subsciprtion can contain a list of ordinary subscriptions.

For \`Subscribe\` and \`Upgrade\`, the billing action should be **_immediate_**, and that of \`Downgrade\` and \`Cancel\` should be **_delayed_** until the end of billing period.

In stripe the "immediate" and "delayed" billing actions are controlled by

- **Proration Behaviour** and
- **Billing Anchor**

\`\`\`text
Immediate Action:  ProrationBehavior.ALWAYS_INVOICE,
Delayed Action:   (ProrationBehavior.NONE, BillingCycleAnchor.UNCHANGED)
\`\`\`

For example, suppose a user have subscribed an upgraded plan for $0.3$ month and downgraded for $0.7$ month right before the next billing period,  then 

$$
\\underbrace{30\\cdot\\texttt{\\$downgraded_plan}}_\\text{covers the new plan}  - \\underbrace{0.7\\cdot 30 \\cdot (\\texttt{\\$upgraded_plan}- \\texttt{\\$downgraded_plan})}_\\text{compensation for the first month}
$$

will be charged at start of the next period.

#### Check Existing Active Subscription

- This step is crucial, we always check whether a customer has active subscription in order to determine if we need to create a checkout page for customer.

- If a subscription already exists, we instead provide a confirmation dialog in the frontend since the customer don't need to provide the payment information again.

\`\`\`kotlin
fun getActiveSubscriptionOfCustomer(stripCustomerId: String): Subscription? {
    val param = SubscriptionListParams.builder()
        .setCustomer(stripCustomerId)
        .setStatus(SubscriptionListParams.Status.ACTIVE)
        .addExpand("data.items")
    val subscriptions = Subscription.list(param.build())

    return subscriptions.data.firstOrNull()
}
\`\`\`

#### New Subscription and Metadata

##### Handle Checkout Session and Add Metadata to Subscriptions

\`\`\`kotlin-1
@Service
class StripeService(
    ...injected dependencies
) {
    fun createCheckoutSession(
        orderId: String,
        stripCustomerId: String,
        priceId: String,
        productName: String,
        numOfPersons: Int?
    ): String {
\`\`\`

At this point we need \`priceId\` instead of \`productId\` since each product has a list of \`price\`'s, we **_should not_** directly work with \`product\` (to make room for discounted price later).

\`\`\`kotlin-12
        // https://docs.stripe.com/api/checkout/sessions/create
        val sessionParam = SessionCreateParams.builder()
            .setSuccessUrl("$purchasePageURL/success?productName=$productName")
            .setCancelUrl("$purchasePageURL/failed?orderId=$orderId")
\`\`\`

$\\uparrow$ Here we handle the display of failed and success cases in our frontend.

\`\`\`kotlin-16{18,22}
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setPrice(priceId)
                    .setQuantity((numOfPersons ?: 1).toLong())
                    .build()
            )
            .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
\`\`\`

$\\uparrow$ Now we set our product to bill users periodically.

Finally let's attach an \`orderId\` so that later we can trace back the latest transaction that leads to the quantity change:

\`\`\`kotlin-23{31,32}
            .setCustomer(stripCustomerId)
            .setSavedPaymentMethodOptions(
                SessionCreateParams.SavedPaymentMethodOptions.builder()
                    .setPaymentMethodSave(SessionCreateParams.SavedPaymentMethodOptions.PaymentMethodSave.ENABLED)
                    .build()
            )
            .setSubscriptionData(
                SubscriptionData.builder()
                    .putMetadata("orderId", orderId)
                    .putMetadata("createdAt", System.currentTimeMillis().toString())
                    .build()
            )
            .build()
        val session = Session.create(sessionParam)
        val sessionId = session.id
        logger.info { "Session Created" }
        return sessionId
    }
}
\`\`\`

##### Metadata Analysis of $\\texttt{customer.subscription.updated}$ Event

Note that we have put \`metadata\` in the previous code block, the \`orderId\` represents the identifier of row in our \`Order\` table that contains a **_complete list_** of order information.

<!-- - It is a beneficial to us to put the \`createdAt\` as well here because later on when we subscribe items -->

\`\`\`json-1{5-8,14}
"data": {
  "object": {
    "id": "si_QqZbSMBKfEkewL",
    "object": "subscription",
    "metadata": {
      "createdAt": "1726306800814",
      "orderId": "0191efe7-5072-950e-2e48-0ea96226db41"
    },
    "items": {
      "object": "list",
      "data": [
        {
          "object": "subscription_item",
          "metadata": {},
          "price": {
            "id": "price_1PyQMKErCGxv56Y5GQPupsch",
            ...
          },
          "quantity": 1,
          "subscription": "sub_1PysSfErCGxv56Y5PoaUzxMR",
          ...
        },
\`\`\`

**_When creating checkout session_**, It is unfortunate that the builder

\`\`\`kotlin
SessionCreateParams.LineItem.builder()
\`\`\`

does not provide a \`setMetadata\` setter (i.e., we can't put \`metadata\` to \`lineItem\` at this stage), therefore the \`orderId\` lying in the \`subscription\` object (when we create checkout session) is exactly also the \`orderId\` of **_the first_** object without \`metadata\` in \`items\`.

Next suppose we purchase another subscribed item, then this time we have an existing subscription to which we _add_ a "_product_" (with recurring price), resulting in:

\`\`\`json-23{25-28}
        {
          "object": "subscription_item",
          "metadata": {
            "createdAt": "1726306839585",
            "orderId": "0191efe7-e703-85ff-5952-219554642eef"
          },
          "price": {
            "id": "price_1PyQOrErCGxv56Y5EHhAQcMA",
            ...
          },
          "quantity": 7,
          "subscription": "sub_1PysSfErCGxv56Y5PoaUzxMR",
          ...
        }
      ],
      ...
    }
  }
}
\`\`\`

Here comes the importance of \`createdAt\`, \`customer.subscription.updated\` contains a list of items with the same interface, the \`orderId\` with the latest \`createdAt\` will be the latest order identifier we want.

#### Update Existing Subscription

##### Subscription Item

- **Special Enum for Subscription Item Inited Event.** Since adding a subscription item (with 0 quantity) is also a subscription update event. We introduce the following enum:

\`\`\`kotlin
enum class MetadataOperation(val code: String) {
      INIT_SUBSCRIPTION_ITEM("INIT_SUBSCRITION_ITEM")
}
\`\`\`

- **Helper Function: \`getSubItemFromSubscriptionAndPriceId\`.**

  - It is helpful to find the \`SubscriptionItem\` of the target \`priceId\` within an \`Subscription\` since:

    - We need to deal with the number of subscribed items

    - Operation within the same subscription scope can ensure all products are billed within the same period and enable stripe to calculate the **_prorated cost_** for us.

  - For example, a subscription plan can have number $>1$ because we model some of our plans as a sharable asset assignable to "team member" inside our system.

  - We then assign this enum into our \`metadata\`

    \`\`\`kotlin{11}
    private fun getSubItemFromSubscriptionAndPriceId(subscription: Subscription, priceId: String): SubscriptionItem {
        val subItem = subscription.items.data.find { it ->
            it.price.id == priceId
        }
        if (subItem != null) {
            return subItem
        } else {
            val itemParams = SubscriptionUpdateParams.Item.builder()
                .setPrice(priceId)
                .putMetadata("createdAt", System.currentTimeMillis().toString())
                .putMetadata("operation", SubscriptionChangeEvent.MetadataOperation.INIT_SUBSCRIPTION_ITEM.code)
                .setQuantity(0L)
                .build()
            val updateParams = SubscriptionUpdateParams.builder()
                .addItem(itemParams)
                .build()
            val updatedSubscription = subscription.update(updateParams)
            return updatedSubscription.items.data.find { it ->
                it.price.id == priceId
            }!!
        }
    }
    \`\`\`

    so that later we can ignore this \`init-item-event\` by using the boolean:

    \`\`\`kotlin{21-22}
    class SubscriptionChangeEvent {
        enum class MetadataOperation(val code: String) {
            INIT_SUBSCRIPTION_ITEM("INIT_SUBSCRITION_ITEM")
        }

        data class Metadata(val orderId: String, val createdAt: String?, val operation: String?)
        data class Data(val subscription: String, val metadata: Metadata)
        data class Items(val data: List<Data>)
        data class DataObject(val items: Items, val metadata: Metadata)
    }

    val fullEvent = Event.retrieve(event.id)
    val subscriptionUpdatedEventDataObject = Gson().fromJson(
        fullEvent.dataObjectDeserializer.\`object\`.get().toJson(),
        SubscriptionChangeEvent.DataObject::class.java
    )
    val lastUpdatedItem = subscriptionUpdatedEventDataObject.items.data.sortedByDescending {
        it.metadata.createdAt ?: "0"
    }.firstOrNull()

    val isInitItem = lastUpdatedItem?.metadata?.operation ==
            SubscriptionChangeEvent.MetadataOperation.INIT_SUBSCRIPTION_ITEM.code
    \`\`\`

##### Subscribe Additional Product

We update the active subscription by simply setting a new item into it.

Since \`metadata\` is like a persistent record, it will confuse our system if we don't manually remove it (by \`.putMetadata("operation", "")\`). We need to ensure the erasion of \`operation\` field for any subsequent update:

\`\`\`kotlin-1{14,19}
fun addSubscriptionItemsByPriceId(
    fromPriceId: String,
    quantityIncrement: Long,
    activeSubscription: Subscription,
    orderId: String,
) {
    val targetSubscriptionItem = getSubItemFromSubscriptionAndPriceId(activeSubscription, fromPriceId)
    val newQuantity = targetSubscriptionItem.quantity + quantityIncrement
    val subItemUpdate = SubscriptionUpdateParams.Item.builder()
        .setId(targetSubscriptionItem.id)
        .setQuantity(newQuantity)
        .putMetadata("orderId", orderId)
        .putMetadata("createdAt", System.currentTimeMillis().toString())
        .putMetadata("operation", "")
        .build()

    val updateParams = SubscriptionUpdateParams.builder()
        .addItem(subItemUpdate)
        .setProrationBehavior(ProrationBehavior.ALWAYS_INVOICE)
        .build()

    activeSubscription.update(updateParams)
}
\`\`\`

Note that the payment should be **_immediate_**, \`ProrationBehavior.ALWAYS_INVOICE\` makes sure the charging from the existing payment method is directly triggered on any update.

##### Upgrade and Immediate Downgrade

Both upgrade and downgrade represent a switch between items in a \`zero-sum\` fashion:

\`\`\`kotlin-1{15,23,18,26}
fun switchSubscriptionItemsByPriceId(
    fromPriceId: String,
    targetPriceId: String,
    activeSubscription: Subscription,
    orderId: String,
    isImmediate: Boolean = true,
) {
    val fromSubscriptionItem = getSubItemFromSubscriptionAndPriceId(activeSubscription, fromPriceId)
    val targetSubscriptionItem = getSubItemFromSubscriptionAndPriceId(activeSubscription, targetPriceId)
    val updatedSub = Subscription.retrieve(activeSubscription.id)
    val currTimestamp = System.currentTimeMillis()

    val fromSubItemParams = SubscriptionUpdateParams.Item.builder()
        .setId(fromSubscriptionItem.id!!)
        .setQuantity(fromSubscriptionItem.quantity - 1)
        .putMetadata("orderId", orderId)
        .putMetadata("createdAt", currTimestamp.toString())
        .putMetadata("operation", "")
        .build()

    val toSubItemParams = SubscriptionUpdateParams.Item.builder()
        .setId(targetSubscriptionItem.id!!)
        .setQuantity(targetSubscriptionItem.quantity + 1)
        .putMetadata("orderId", orderId)
        .putMetadata("createdAt", currTimestamp.toString())
        .putMetadata("operation", "")
        .build()

    val updateSubParamsPrebuild = SubscriptionUpdateParams.builder()
        .addAllItem(listOf(fromSubItemParams, toSubItemParams))
\`\`\`

For upgrade \`isImmediate\` should be set to \`true\`:

\`\`\`kotlin-31{33,36-37}
    if (isImmediate) {
        updateSubParamsPrebuild
            .setProrationBehavior(ProrationBehavior.ALWAYS_INVOICE)
    }
\`\`\`

so that the billing is immediate with invoice being dispatched immediately.

On the other hand, if our action is an **_immediate downgrade_**, we set \`isImmediate\` to \`false\` to get non-immediate billing action:

\`\`\`kotlin-35{37-38}
   else {
       updateSubParamsPrebuild
           .setProrationBehavior(ProrationBehavior.NONE)
           .setBillingCycleAnchor(SubscriptionUpdateParams.BillingCycleAnchor.UNCHANGED)
   }
   updatedSub.update(updateSubParamsPrebuild.build())
}
\`\`\`

##### Subscription Schedules for Scheduled Downgrade/Unsubscription

- Another case for downgrade is to delay the downgrade request until the start of the next billing period.

- This makes perfect sense in case of **_unsubscription_**  (as a kind of downgrade) which should only **_takes effect at the end of billing period_** because customer has already paid for the service.

Now we demonstrate an example of scheduling the changes of a product quantity:

> **Objective.** We create a function \`scheduleAmountChangeByPriceId\` which schedules a change of the amount of a product that takes effect at the start of ***next billing period***.


Let's define an helper function and our schedule function:

\`\`\`kotlin-1
private fun getExistingSchedule(customerId: String, activeSubscription: Subscription): SubscriptionSchedule? {
    val listParams = SubscriptionScheduleListParams.builder()
        .setCustomer(customerId)
        .build()
    val existingSchedules = SubscriptionSchedule.list(listParams)
    val existingSchedule = existingSchedules.data
        .filter {
            it.subscription == activeSubscription.id
        }.sortedByDescending {
            it.created
        }.firstOrNull()
    return existingSchedule
}

\`\`\`
\`\`\`kotlin-15
fun scheduleAmountChangeByPriceId(
    increment: Int,
    priceId: String,
    customerId: String,
    activeSubscription: Subscription,
): SubscriptionSchedule {
    val currentPeriodEnd = activeSubscription.currentPeriodEnd
    val existingSchedule = getExistingSchedule(customerId, activeSubscription)
    val targetItem = getSubItemFromSubAndPriceId(activeSubscription, priceId)

    val schedule = if (existingSchedule != null) {
        existingSchedule
    } else {
        val params = SubscriptionScheduleCreateParams.builder()
            .setFromSubscription(activeSubscription.id)
            .build()
        SubscriptionSchedule.create(params)
    }
\`\`\`

Let's pause and explain the strategy here. What I learned from a conversation:

<a href="/assets/img/2024-09-28-02-59-19.png" target="_blank">![](/assets/img/2024-09-28-02-59-19.png)</a>

Therefore let's create a new list of phases and update it:

\`\`\`kotlin-33
    val updateParamsBuilder = SubscriptionScheduleUpdateParams.builder()
        .setEndBehavior(SubscriptionScheduleUpdateParams.EndBehavior.RELEASE)

    schedule.phases.forEach { phase ->
        val phaseBuilder = SubscriptionScheduleUpdateParams.Phase.builder()
        phase.startDate?.let { phaseBuilder.setStartDate(it) }
        phase.endDate?.let { phaseBuilder.setEndDate(it) }
        phase.items.forEach { item ->
            phaseBuilder.addItem(
                SubscriptionScheduleUpdateParams.Phase.Item.builder()
                    .setPrice(item.price)
                    .apply {
                        if (phase.endDate > currentPeriodEnd && item.price == priceId) {
                            setQuantity(item.quantity + increment)
                        } else {
                            setQuantity(item.quantity)
                        }
                    }
                    .build()
            )
        }
        updateParamsBuilder.addPhase(phaseBuilder.build())
    }
\`\`\`

Finally let's handle an edge case here:

- A new subscription has no schedule, and;

- When \`existingSchedule == null\`, we created a new schedule in line 25.

- By default any new schedule will have a phase describing the current items in the latest subscription period.

- Since our latest schedule have at most \`phase.endDate == currentPeriodEnd\`, line 46 cannot be reached in this case.

- Subsequently we manually add a phase in the next billing period so that we actually have an schedule for which \`phase.endDate > currentPeriodEnd\`:

  \`\`\`kotlin-56{58}
      if (existingSchedule == null) {
          val phaseBuilder = SubscriptionScheduleUpdateParams.Phase.builder()
              .setStartDate(currentPeriodEnd)
              .addItem(
                  SubscriptionScheduleUpdateParams.Phase.Item.builder()
                      .setPrice(priceId)
                      .setQuantity(targetItem.quantity + increment)
                      .build()
              )
          updateParamsBuilder.addPhase(phaseBuilder.build())
      }

      return schedule.update(updateParamsBuilder.build())
  }
  \`\`\`

##### Undo a Schedule

We simply call

\`\`\`kotlin
fun scheduleAmountChangeByPriceId(
    increment: Int,
    priceId: String,
    customerId: String,
    activeSubscription: Subscription,
): SubscriptionSchedule
\`\`\`

with the _compensating_ \`increment\` in **_opposite sign_**.

Alternatively, one can save the \`scheduleId\` in the database so that when we click \`undo\` in the frontend, the backend execute the following:

\`\`\`kotlin
SubscriptionSchedule.retrieve(scheduleId).cancel()
\`\`\`

For me doing the opposite via \`scheduleAmountChangeByPriceId\` did the job.

### Renewal of Existing Subscribed Items

At the end of billing period, yet another subscription updated event is emitted which simply changes (as can be found in previous values object):

- \`current_period_start\`
- \`current_period_end\`
- \`latest_invoice\`

We can trigger the renewal logic in our database by using the boolean:

\`\`\`kotlin
val prevValues = fullEvent.data.previousAttributes
val isBillingPeriodUpdate = (prevValues != null) &&
        prevValues.containsKey("latest_invoice") &&
        prevValues.containsKey("current_period_start") &&
        prevValues.containsKey("current_period_end")
\`\`\`

Of course we can also handle the cancel/downgrade logic at the same time. In my case:

\`\`\`kotlin{15,16}
fun handleEndOfBillingPeriod(
    prevStartDate: Double,
    prevEndDate: Double,
    newStartDate: Double,
    newEndDate: Double,
    planOwnerUserEmail: String,
    subscriptionId: String,
) {
    val subscription = Subscription.retrieve(subscriptionId)
    subscription.items.data.forEach {
        val priceId = it.price.id
        val product = stripeproductDao.fetchByStripepriceid(priceId).firstOrNull() ?: throw Exception("stripe product cannot be found")
        val seatDomains = seatRepository.fetchActiveSeatsByUserEmail(planOwnerUserEmail, product.type!!)
        seatDomains.forEach { seatDomain ->
            val iscancelScheduled = seatDomain.seat?.cancelscheduled ?: false
            val isdowngradeScheduled = seatDomain.getPersonalSeataData()?.downgradescheduled ?: false
            when {
                iscancelScheduled -> {
                    seatDomain.inactivate()
                    seatDomain.inactivateCounter()
                }

                isdowngradeScheduled -> {
                    val seat = seatDomain.seat
                    if (seat?.type === QuotaSeattype.PERSONAL_POWERFUL_BILLIE) {
                        seatDomain.inactivate()
                        seatDomain.inactivateCounter()
                    }
                }

                else -> {
                    seatDomain.getLatestActiveCounter()?.let {
                        val isOldCounterToRenew = it.startdate < prevEndDate
                        if (isOldCounterToRenew) {
                            seatDomain.inactivateCounter()
                            seatDomain.addNewUsageCounter(
                                newStartDate,
                                newEndDate
                            )
                        }
                    }
                }
            }
            seatDomain.save()
        }
    }
}
\`\`\`

### Test Clock

#### Why?

In stripe testclocks are mutually isolated worlds, we need to associate each of stripe test users with a testclock in order to view the changes for like **_1 month later_**.

This is a must-have feature for testing **_delayed subscription actions_** like unsubscription, downgrading subscription and also testing the billing behaviour from Stripe.

#### Test Clock Subscription

In Stripe when a customer is associated with a testclock, then all of his/her subscription will be isolated within each testclock as follows:

- List of testclocks:

  ![](/assets/img/2024-09-15-19-08-49.png)

- Subscription within testclock:

  ![](/assets/img/2024-09-15-19-12-38.png)

#### Test Clock Manipulation

##### Create a Test Clock and a Test Customer

\`\`\`kotlin-1{2,5}
fun createTestClockCustomer(emailAddress: String): CreateTestClockCustomerReturn {
    val testClock = createTestClock()
    val customerParams = CustomerCreateParams.builder()
        .setEmail(emailAddress)
        .setTestClock(testClock.id)
        .build()
    val customer = Customer.create(customerParams)
\`\`\`

Up to this point we are done with creating a user with testclock.

##### Assign Payment Method

Next the following is optional which is only useful for **writing test cases**.

**Remark.** Since we will have no UI finishing the checkout session, that means we need to finish the session by code, but that amounts to the need to create subscription via program in code-based test-cases (and we need payment method for getting invoice).

\`\`\`kotlin-8
    val paymentMethodParams = PaymentMethodCreateParams.builder()
        .setType(PaymentMethodCreateParams.Type.CARD)
        .putExtraParam("card[token]", "tok_mastercard")
        .build()
    val paymentMethod = PaymentMethod.create(paymentMethodParams)

    val attachParams = PaymentMethodAttachParams.builder().setCustomer(customer.id).build()
    paymentMethod.attach(attachParams)
    customer.update(CustomerCreateParams.builder()
                        .setInvoiceSettings(CustomerCreateParams.InvoiceSettings
                                                .builder()
                                                .setDefaultPaymentMethod(paymentMethod.id)
                                                .build()
                        ).build().toMap()
    )
    return CreateTestClockCustomerReturn(stripeCusotomerId = customer.id,
                                          testClockId = testClock.id)
\`\`\`

##### Advance The Test Clock

- If we are implementing a frontend to let internal users advance the time, we could write:

  \`\`\`kotlin
  data class AdvanceTestclockRequestDto(val testclockId: String)

  suspend fun advanceTestclockByMonth(advanceTestclockRequestDto: AdvanceTestclockRequestDto) = coroutineScope {
      val (testclockId) = advanceTestclockRequestDto
      val testClock = TestClock.retrieve(testclockId)
      val testclockTimeMillis = testClock.frozenTime * 1000
      testClock?.let {
          withContext(Dispatchers.IO) {
              var now = DateTime(testclockTimeMillis)
              now = now.plusDays(31)
              now = now.plusHours(1)
              it.advance(TestClockAdvanceParams.builder().setFrozenTime((now.millis / 1000)).build())
              delay(2500)
              now = now.plusHours(1)
              it.advance(TestClockAdvanceParams.builder().setFrozenTime((now.millis / 1000)).build())
          }
      }
  }
  \`\`\`

- If a test user has access to the stripe account, they can directly advance it here:

  ![](/assets/img/2024-09-15-19-45-29.png)
`;export{e as default};
