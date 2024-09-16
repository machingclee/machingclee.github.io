---
title: "Stripe Technical Detail for Add, Upgrade, Downgrade, and Cancel Subscrpition"
date: 2024-09-15
id: blog0319
tag: kotlin, stripe
toc: true
intro: "We record how to adjust a subscription in code using kotlin."
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### API-Version

Make sure to use the latest API-version (as in this blog post), which can be configured in stripe dashboard from here:

![](/assets/img/2024-09-14-17-07-11.png)

**_Otherwise_** the event json structure will be different, and you may run into trouble like ` java.util.NoSuchElementException: No value present` when your code execute:

```kotlin
fullEvent.dataObjectDeserializer.`object`.get()
```

Recall that `.get()` method usually means it is of type `Optional` in `java`.

#### Testing Webhook

##### Install Stripe CLI

To install Stripe CLI we can follow the [official instruction](https://docs.stripe.com/stripe-cli). For mac it is as simple as running:
```text
brew install stripe/stripe-cli/stripe
```

##### Connect to Your Stripe Account

After installing CLI, we execute:

```text
stripe login --api-key sk_test_51PffJDR...
stripe listen --forward-to http://localhost:8080/stripe-test/webhook
```





#### Cont'd From Previous Stripe Basic Post

##### From $\texttt{checkout.session.complete}$ to $\texttt{customer.subscription.updated}$

We have introduced a basic stripe event: the `checkout.session.completed` event, and how to get the latest customized `ID` from the event from [this post](/blog/article/Stripe-Events-and-metadata-in-Stripe-Checkout-Sessions).

As time goes by, we find that the `checkout.session.completed` event only applies to new subscription, it **_does not work_** with subscription changes (like upgrade, downgrade, cancel, etc).

Therefore for unifying everything we shift our focus to `customer.subscription.updated` event.

##### Handle Delayed Billing Events
###### Doubled Events Emitted upon Downgrading and Deleting Subscription

- When downgrading and canelling subscription, we would like the event only to take place at the end of billing period.

- **_Unfortunately_**, a `customer.subscription.updated` event will be emitted **_immediately_** once after we make changes (an almost identical event will be fired again at the end of billing period), we need to study how to distinguish them and **_ignore_** the immediately fired one. 

###### How to Ignore Immediately Triggered Subscription Update Event

- For every `subscription.updated` event there is a field `previousAttributes` that indicates what is being changed in the subscription, in kotlin we invoke 
  ```text{2}
  val fullEvent = Event.retrieve(event.id)
  fullEvent.data.previousAttributes
  ```
  to get a `Map` of previous values object.

- When `Cancel`/`Downgrade` occurs, the `latest_invoice` will get updated  (and it will not be there at the end of billing period). Therefore we can define a boolean
  ```kotlin
  val isBillingUpdate = (fullEvent.data.previousAttributes != null)
          && fullEvent.data.previousAttributes.containsKey("latest_invoice")
          && fullEvent.data.previousAttributes["latest_invoice"] != null
  ```
  to distinguish two `subscription.update` events.

#### Subscribe, Upgrade, Downgrade, Cancel

##### Strategy

###### Quantity Adjustment for Subscriptions

The actual implementation of `add`, `upgrade`, `downgrade` and `cancel` operations are all controlled by adjusting quantities of the products with appropriate `setters` setting **proration behaviour** and **billing cylces**:

- `Subscribe` $\Large \nearrow$ the quantity from 0 to 1

- `Upgrade, Downgrade` $\Large\searrow$ the quantity of the old product by 1, and $\Large \nearrow$ that of the new product.
- `Cancel` simply $\Large\searrow$ the quantity of target product by 1.

###### Proration Period and Billing Cycle

We model a subscription plan as a stripe **_product_** in Stripe world, which must live within a Stripe Subscription.

This **_product_** is configured to have recurring price and therefore become a **_subscription_** (in normal sense), therefore

$$
\text{subscription}\Big|_\text{stripe sense} \supseteq \left\{ \text{subscription}\Big|_\text{normal sense}\right\},
$$

namely, a stripe subsciprtion can contain a list of subscriptions in normal sense.

For `Subscribe` and `Upgrade`, the billing action should be **_immediate_**, and that of `Downgrade` and `Cancel` should be **_delayed_** until the end of billing period.

In stripe the "immediate" and "delayed" billing actions are controlled by

- **Proration Behaviour** and
- **Billing Anchor**

```text
Immediate Action:  ProrationBehavior.ALWAYS_INVOICE,
Delayed Action:   (ProrationBehavior.NONE, BillingCycleAnchor.UNCHANGED)
```

##### Check Existing Active Subscription

- This step is crucial, we always check whether a customer has active subscription in order to determine if we need to create a checkout page for customer.

- If a subscription already exists, we instead provide a confirmation dialog in the frontend since the customer don't need to provide the payment information again.

- We need this subscription object because we can add, remove, adjust the amount of the subscribed items so that they are all billed within the same period and let stripe calculate the ***prorated cost*** for us.

```kotlin
fun getActiveSubscriptionOfCustomer(stripCustomerId: String): Subscription? {
    val param = SubscriptionListParams.builder()
        .setCustomer(stripCustomerId)
        .setStatus(SubscriptionListParams.Status.ACTIVE)
        .addExpand("data.items")
    val subscriptions = Subscription.list(param.build())

    return subscriptions.data.firstOrNull()
}
```

##### Manage New Subscription

###### Handle Checkout Session

```kotlin-1
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
```

At this point we need `priceId` instead of `productId` since each product has a list of `price`'s, we **_should not_** directly work with `product` (to make room for discounted price later).

```kotlin-12
        // https://docs.stripe.com/api/checkout/sessions/create
        val sessionParam = SessionCreateParams.builder()
            .setSuccessUrl("$purchasePageURL/success?productName=$productName")
            .setCancelUrl("$purchasePageURL/failed?orderId=$orderId")
```

$\uparrow$ Here we handle the display of failed and success cases in our frontend.

```kotlin-16{18,22}
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setPrice(priceId)
                    .setQuantity((numOfPersons ?: 1).toLong())
                    .build()
            )
            .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
```

$\uparrow$ Now we set our product to bill users periodically,

```kotlin-23{31,32}
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
```

###### Metadata Analysis of $\texttt{customer.subscription.updated}$ Event

Note that we have put `metadata` in the previous code block, the `orderId` represents the identifier of row in our `Order` table that contains a **_complete list_** of order information.

<!-- - It is a beneficial to us to put the `createdAt` as well here because later on when we subscribe items -->

```json-1{5-8,14}
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
```

**_When creating checkout session_**, It is unfortunate that the builder

```kotlin
SessionCreateParams.LineItem.builder()
```

does not provide a `setMetadata` setter (i.e., we can't put `metadata` to `lineItem` at this stage), therefore the `orderId` lying in the `subscription` object (when we create checkout session) is exactly also the `orderId` of **_the first_** object without `metadata` in `items`.

Next suppose we purchase another subscribed item, then this time we have an existing subscription to which we _add_ a "_product_" (with recurring price), resulting in:

```json-23{25-28}
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
```

Here comes the importance of `createdAt`, `customer.subscription.updated` contains a list of items with the same interface, the `orderId` with the latest `createdAt` will be the latest order identifier we want.

##### Update Existing Subscription

###### Helper Function: `getSubItemFromSubAndPriceId` and Subscription Item Inited Event

- It is helpful to find the `SubscriptionItem` of the target `priceId` within an `Subscription` since we need to deal with the number of subscribed items.

- For example, a subscription plan can have number $>1$ because we model some of our plans as a sharable asset assignable to "team member" inside our system.



- Since adding an subscription item (with 0 quantity) is also trigger a subscription update event.
  ```kotlin
  enum class MetadataOperation(val code: String) {
        INIT_SUBSCRIPTION_ITEM("INIT_SUBSCRITION_ITEM")
  }
  ```
- We then assign this enum into our `metadata` 
  ```kotlin{11}
  private fun getSubItemFromSubAndPriceId(subscription: Subscription, priceId: String): SubscriptionItem {
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
  ```
  so that later we can ignore this `init-item-event` by using the boolean:
  ```kotlin
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
      fullEvent.dataObjectDeserializer.`object`.get().toJson(),
      SubscriptionChangeEvent.DataObject::class.java
  )
  val lastUpdatedItem = subscriptionUpdatedEventDataObject.items.data.sortedByDescending {
      it.metadata.createdAt ?: "0"
  }.firstOrNull()

  val isInitItem = lastUpdatedItem?.metadata?.operation ==
          SubscriptionChangeEvent.MetadataOperation.INIT_SUBSCRIPTION_ITEM.code
  ```

###### Subscribe Additional Product

We update the active subscription by simply setting a new item into it:

```kotlin-1{19}
fun addSubscriptionItemsByPriceId(
    fromPriceId: String,
    quantityIncrement: Long,
    activeSubscription: Subscription,
    orderId: String,
) {
    val targetSubscriptionItem = getSubItemFromSubAndPriceId(activeSubscription, fromPriceId)
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
```

Note that the payment should be **_immediate_**, `ProrationBehavior.ALWAYS_INVOICE` makes sure the charging from the existing payment method is directly triggered on any update.

###### Upgrade and Downgrade

Both upgrade and downgrade represents a switch between items in a `zero-sum` fashion:

```kotlin-1{15,23}
fun switchSubscriptionItemsByPriceId(
    fromPriceId: String,
    targetPriceId: String,
    activeSubscription: Subscription,
    orderId: String,
    isImmediate: Boolean = true,
) {
    val fromSubscriptionItem = getSubItemFromSubAndPriceId(activeSubscription, fromPriceId)
    val targetSubscriptionItem = getSubIteswitchSubscriptionItemsByPriceIdmFromSubAndPriceId(activeSubscription, targetPriceId)
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
```

However, `upgrade` and `downgrade` differs from being an **_immediate_** or **_delayed_** action, we should manually detemine the proration behaviour:

```kotlin-32{34,37-38}
    if (isImmediate) {
        updateSubParamsPrebuild
            .setProrationBehavior(ProrationBehavior.ALWAYS_INVOICE)
    } else {
        updateSubParamsPrebuild
            .setProrationBehavior(ProrationBehavior.NONE)
            .setBillingCycleAnchor(SubscriptionUpdateParams.BillingCycleAnchor.UNCHANGED)
    }
    updatedSub.update(updateSubParamsPrebuild.build())
}
```

###### Unsubscribe

Cancelling a subscription amounts to decreasing the product with recurring price by 1.

```kotlin{7,10,18-19}
fun decreasePriceIdByOne(
    cancelPriceId: String,
    activeSubscription: Subscription,
    orderId: String,
) {
    val targetSubscriptionItem = getSubItemFromSubAndPriceId(activeSubscription, cancelPriceId)
    val newQuantity = targetSubscriptionItem.quantity - 1
    val subItemUpdate = SubscriptionUpdateParams.Item.builder()
        .setId(targetSubscriptionItem.id)
        .setQuantity(newQuantity)
        .putMetadata("orderId", orderId)
        .putMetadata("createdAt", System.currentTimeMillis().toString())
        .putMetadata("operation", "")
        .build()

    val updateParams = SubscriptionUpdateParams.builder()
        .addItem(subItemUpdate)
        .setProrationBehavior(ProrationBehavior.NONE)
        .setBillingCycleAnchor(SubscriptionUpdateParams.BillingCycleAnchor.UNCHANGED)
        .build()

    activeSubscription.update(updateParams)
}
```

#### Test Clock

##### Why?

In stripe testclocks are mutually isolated worlds, we need to associate each of stripe test users with a testclock in order to view the changes for like **_1 month later_**.

This is a must-have feature for testing **_delayed subscription actions_** like unsubscription, downgrading subscription and also testing the billing behaviour from Stripe.

##### Test Clock Subscription

In Stripe when a customer is associated with a testclock, then all of his/her subscription will be isolated within each testclock as follows:

- List of testclocks:

  ![](/assets/img/2024-09-15-19-08-49.png)

- Subscription within testclock:

  ![](/assets/img/2024-09-15-19-12-38.png)

##### Test Clock Manipulation

###### Create a Test Clock and a Test Customer

```kotlin-1{2,5}
fun createTestClockCustomer(emailAddress: String): CreateTestClockCustomerReturn {
    val testClock = createTestClock()
    val customerParams = CustomerCreateParams.builder()
        .setEmail(emailAddress)
        .setTestClock(testClock.id)
        .build()
    val customer = Customer.create(customerParams)
```

Up to this point we are done with creating a user with testclock.

###### Assign Payment Method

Next the following is optional which is only useful for **writing test cases**.

**Remark.** Since we will have no UI finishing the checkout session, that means we need to finish the session by code, but that amounts to the need to create subscription via program in code-based test-cases (and we need payment method for getting invoice).

```kotlin-8
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
```


###### Advance The Test Clock

- If we are implementing a frontend to let internal users advance the time, we could write:

  ```kotlin
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
  ```

- If a test user has access to the stripe account, they can directly advance it here:

  ![](/assets/img/2024-09-15-19-45-29.png)
