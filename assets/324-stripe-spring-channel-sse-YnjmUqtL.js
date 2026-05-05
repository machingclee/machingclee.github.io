const e=`---
title: "SSE, Coroutine and Channel to Notify Frontend for Stripe Events in Spring Boot and Kotlin"
date: 2024-09-21
id: blog0324
tag: kotlin, springboot
toc: true
intro: "A Stripe event is always delayed, and some system relies on database persistent change by Stripe events. We study how frontend can wait for the event before fetching latest data."
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### SSE via WebFlux in the Past

We have a simple illustration of \`SSE\` using spring boot via Java in

- [Server-Sent-Event-in-Java-and-Node-js-Backend](/blog/article/Server-Sent-Event-in-Java-and-Node-js-Backend/)
  That post is optional and can be skipped because this time **_although_** we are still using SSE, we will discard the reliance on \`WebFlux\` framework.

Moreover, we stick everything with native Kotlin nature using coroutines.

### Solution Architecture: Sequence Diagram

In the sequel we plan to achieve the following:

<a href="/assets/img/2024-09-21-11-51-20.png" target="_blank">
<img src="/assets/img/2024-09-21-11-51-20.png" />
</a>
<p></p>

1. We add one product in stripe's customer subscription

2. Once the request is finished, we send a \`GET\` request for \`SSE\` connection

3. The \`SSE\`-get request handler responses an header to ask the frontend to keep connection, meanwhile, it launches a coroutine in which a channel (defined below) is created with channel identifier: \`orderId\` (for each subscription update we have a self-managed table recording all orders), and we **_suspend_** the coroutine by a \`channel.receive()\` method.

4. The thread pool shared with \`Dispatchers.IO\` will resume the task once \`channel.receive()\` gets resolved.

5. Once Stripe sends a \`customer.subscription.updated\` event to our payment backend, we update the database, and dispatch an \`OrderCompletedEvent\` in the system. One of the \`EventHandler\`'s will send success \`true\` via the channel associated with \`orderId\`. When this \`Event\` fails to happen, the channel will be closed due to the default timeout.

6. Finally we close the scope lauching the \`channel\` to avoid memory leakage.

Before we dive into it, let's build a machinery:

### Channel

We will use the following abstraction:

\`\`\`kotlin
@Component
class SuccessResponseChannelManager<T> {
    private val channels = ConcurrentHashMap<String, Channel<T>>()
    private val mutex = Mutex()

    suspend fun createChannel(id: String): Channel<T> = mutex.withLock {
        channels.getOrPut(id) { Channel() }
    }

    suspend fun getResult(id: String): T {
        val channel = channels[id] ?: throw IllegalArgumentException("No channel found for id: $id")
        val result = channel.receive()
        closeChannel(id)
        return result
    }

    suspend fun sendResult(id: String, result: T) {
        val channel = channels[id]
        channel?.send(result)
    }

    private suspend fun closeChannel(id: String) = mutex.withLock {
        channels.remove(id)?.close()
    }
}
\`\`\`

We start off from a simple illustrative example. Later we will modify it into the one we use in the sequence diagram:

### Simple Illustration First

#### Frontend with \`EventSourcePolyfill\`

\`\`\`js
const evtSource = new EventSourcePolyfill(
  "http://localhost:8081/order/sse-get-stripe-event-notification",
  { headers: { Authorization: "Bearer " + authToken } }
);
evtSource.addEventListener("SomeEvent", (event) => {
  console.log("eventevent", event);
});
\`\`\`

- We use \`EventSourcePolyfill\` because the native API \`EventSource\` in the browser does not support setting custom headers.

#### Backend Simply Steaming 1 to 100

Next in the backend we use a blocking way to deliver the request and let a non-blocking coroutine-block handles the SSE Task:

\`\`\`kotlin
@GetMapping("/sse-get-stripe-event-notification", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
fun getOrderNotificationViaChannel(): SseEmitter {
    println("Hint SSE Rroute")
    val emitter = SseEmitter(Long.MAX_VALUE)
    emitter.onCompletion { println("SSE completed") }
    emitter.onTimeout { println("SSE timed out") }
    emitter.onError { e -> println("SSE error: \${e.message}") }

    CoroutineScope(Dispatchers.IO).launch {
        repeat(100) { index ->
            println("SSE $index")
            val eventData = SseEmitter.event()
                .name("SomeEvent")
                .data(index)
                .id(index.toString())
            emitter.send(eventData)
            delay(2000)
        }
        emitter.complete()
    }
    return emitter
}
\`\`\`

- The emitter is returned and the coroutine is launched **_at the same time_**. The main thread delivering the request to handler is released

- The async task is delegated to the thread-pool allocated to \`Dispatchers.IO\`

- Note that in nodejs (see [this post](/blog/article/Server-Sent-Event-in-Java-and-Node-js-Backend#Counterpart-in-Node.js)) we need to add
  \`\`\`js
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  });
  \`\`\`
  in the response header, these will be handled by Spring Boot when we return an \`SseEmitter\` instance.

#### Event in Frontend

In frontend you will see something like (forgive me I didn't record the result in screenshot):

\`\`\`text
event: { id: "1", type: "SomeEvent", data: <JSON.stringified data> }
\`\`\`

### Complete Example

#### Frontend

Based on the **_result_** in the previous section, we define a helper hook

\`\`\`js{12-21}
export default <EventDataType extends { success: boolean }>() => {
    const authToken = useAppSelector(s => s.auth.clientAccessToken);
    const eventSource = useRef<EventSourcePolyfill | null>(null);

    const subscribe = (props: {
        sseEventURL: string,
        eventName: string
    }): Promise<{ success: boolean, result?: EventDataType }> => {
        const { eventName, sseEventURL } = props;
        return new Promise((resolve, _) => {
            try {
                const evtSource = new EventSourcePolyfill(
                    sseEventURL,
                    { headers: { "Authorization": "Bearer " + authToken } }
                );
                eventSource.current = evtSource;
                eventSource.current.addEventListener(eventName, async (event) => {
                    const data = JSON.parse((event as any).data as any) as EventDataType
                    eventSource.current = null;
                    resolve({ success: true, result: data });
                })
            } catch (err) {
                eventSource.current = null;
                resolve({ success: false });
            }
        })
    }

    return { subscribe }
}
\`\`\`

It is a simple wrapper to hide the detail, next inside of our component we define:

\`\`\`js
const { subscribe } = useSSE();

const addAndAssign = async () => {
  PurchaseSeatAlertDialog.close();
  const { orderId } = await addTeamplan(1); // remark 1

  const { success } = await subscribe({
    // remark 2.
    sseEventURL: apiRoutes.GET_ORDER_SUCCESS_SSE(orderId),
    eventName: "DatabaseUpdated",
  });
  if (success) {
    // remark 3.
    await dispatch(
      SeatThunkAction.assignTeamPlan({ targetUserEmails: [userEmail] })
    ).unwrap();
    dispatch(SeatThunkAction.getSeatsFromDB());
  }
};
\`\`\`

**Remark 1.**

- \`Teamplan\` is a stripe product

- \`orderId\` is our self-managed database record id

**Remark 2.**

- Waiting for Stripe event and waiting for database update to be completed

**Remark 3.**

- Once succeeded, we fetch request to change the database (which is only valid when database is synced with Stripe's event, otherwise we get an exception of not-enough resource for assignment)

- Finally we fetch finalized result

#### Backend

##### The Request Handler

\`\`\`kotlin
    // here what apiRoutes.GET_ORDER_SUCCESS_SSE(orderId) above resolved into:
    @GetMapping("/sse-get-stripe-event-notification/{orderId}", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun getOrderSuccessNotificationViaChannel(@PathVariable("orderId") orderId: String): SseEmitter {
        val emitter = SseEmitter(Long.MAX_VALUE)
        emitter.onCompletion { println("SSE completed") }
        emitter.onTimeout { println("SSE timed out") }
        emitter.onError { e -> println("SSE error: \${e.message}") }
        val scope = CoroutineScope(Dispatchers.IO)
        scope.launch {
            try {
                logger.info { "Listening for orderSuccess response" }
                successResponseChannelManager.createChannel(orderId)
                val result = successResponseChannelManager.getResult(orderId)
                val eventData = SseEmitter.event()
                    .name(SSEEvent.DATABASE_UPDATED.code)
                    .data(DatabaseUpdate(result))
                    .id("1")
                emitter.send(eventData)
                emitter.complete()
            } finally {
                scope.cancel()
            }
        }
        return emitter
    }
\`\`\`

##### The Event Handler

Since all database changes are governed by \`EventHandler\`'s (in a Domain Driven Design methodology), adding new functionality is as simple as adding a new \`EventHandler\`:

\`\`\`kotlin{12-16}
@EventHandlerLogging
@Component
class OrderEventHandler(private val ...dependencies) {
    @EventListener
    fun on(event: OrderSucceededEvent) {
        val order = stripeorderDao.findById(event.orderId) ?: throw Exception("Order cannot be null")
        order.status = Status.SUCCEEDED
        order.succeededat = event.succeededAt
        stripeorderDao.update(order)
    }

    @EventListener
    fun sendSuccessResultToChannelOn(event: OrderSucceededEvent) = mono {
        val (orderId, succeededAt) = event
        successResponseChannelManager.sendResult(orderId.toString(), true)
    }
    ...
}
\`\`\`
`;export{e as default};
