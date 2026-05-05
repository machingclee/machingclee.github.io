const e=`---
title: "Run Blocking Servlet Requests to Achieve Non-Blocking Performance"
date: 2024-09-23
id: blog0325
tag: kotlin, springboot
toc: true
intro: "We study how to effectively deliver request to non-blocking coroutine scope and release that thread for other request."
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### The DeferredResult<T> Trick

\`\`\`kotlin{5}
class SomeController() {
    @PostMapping("/create-customer-portal-session")
    fun createCustomerPortalSession(
        @RequestBody someDto: SomeDto,
    ): DeferredResult<Success<SomeResult>> {
        val deferredSessionURL = someApplicationService.createCustomerPortalSession(
            someDto
        )
        return deferredSessionURL
    }
}
\`\`\`

- When we return \`DeferredResult\`, Spring understands that the result is not immediately available. It doesn't block the servlet thread but instead releases it back to the thread pool.

- Spring sets up an asynchronous context to handle the \`DeferredResult\`. It doesn't actively wait for the result but is prepared to process it when it becomes available.

- When \`setResult()\` is called on the \`DeferredResult\` (within a coroutine), Spring is notified that the result is ready.

- The thread that calls \`setResult()\` notifies Spring's asynchronous request handling mechanism.

- Spring then uses one of its own servlet container threads to process the result and send it back to the client.

### What Happens in Application Service?

We initiate \`DeferredResult(timeout in Long)\` as a placeholder, we later \`setResult\` in a coroutine scope asynchronously:

\`\`\`kotlin-1{15}
class SomeApplicationService() {
    fun createCustomerPortalSession(
        someDto: SomeDto,
    ): DeferredResult<Success<SomeResult>> {
        val deferredSessionURL = DeferredResult<Success<SomeResult>>(10000L)
        val scope = CoroutineScope(Dispatchers.IO)
        scope.launch {
            try {
                val (customerId) = someDto
                val params = SessionCreateParams.builder()
                    .setCustomer(customerId)
                    .setReturnUrl(managePlanURL)
                    .build()
                val session = Session.create(params)
                deferredSessionURL.setResult(Success(SomeResult(session.url)))
            } catch (err: Exception) {
                deferredSessionURL.setErrorResult(err)
            } finally {
                scope.cancel()
            }
        }
        return deferredSessionURL
    }
}
\`\`\`

### Customer DSL to Simplify the Logic Via Trailing Closure

We further simplify the previous code block via the following util:

\`\`\`kotlin
@Component
class DeferUtil {
    fun <T> defer(block: suspend () -> T): DeferredResult<T> {
        val deferredResult = DeferredResult<T>(20000L)
        val scope = CoroutineScope(Dispatchers.IO)
        scope.launch {
            try {
                val result = block()
                deferredResult.setResult(result)
            } catch (err: Exception) {
                deferredResult.setErrorResult(err)
            } finally {
                scope.cancel()
            }
        }
        return deferredResult
    }
}
\`\`\`

Now our \`SomeApplicationService\` becomes

\`\`\`kotlin{4-10}
class SomeApplicationService(private val deferUtil: DeferUtil) {
    fun createCustomerPortalSession(someDto: SomeDto): DeferredResult<Success<SomeResult>> {
        val deferred = deferUtil.defer {
            val (customerId) = someDto
            val params = SessionCreateParams.builder()
                    .setCustomer(customerId)
                    .setReturnUrl(managePlanURL)
                    .build()
            val session = Session.create(params)
            Success(result=SomeResult(session.url))
        }
        return deferred
    }
}
\`\`\`
`;export{e as default};
