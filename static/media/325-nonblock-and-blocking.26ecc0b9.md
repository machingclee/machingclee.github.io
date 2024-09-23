---
title: "Run Blocking Servlet Requests to Achieve Non-Blocking Performance"
date: 2024-09-23
id: blog0325
tag: kotin, springboot
toc: true
intro: "We study how to effectively deliver request to non-blocking coroutine scope and release that thread for other request."
---


<style>
  img {
    max-width: 660px;
  }
</style>


#### The DeferredResult<T> Trick

```kotlin{5}
class SomeController() {
    @PostMapping("/create-customer-portal-session")
    fun createCustomerPortalSession(
        @RequestBody createCustomerPortalSessionDto: CreateCustomerPortalSessionDto,
    ): DeferredResult<Success<CreateCustomerPortalSessionResult>> {
        val deferredSessionURL = someApplicationService.createCustomerPortalSession(
            createCustomerPortalSessionDto
        )
        return deferredSessionURL
    }
}
```
- When we return `DeferredResult`, Spring understands that the result is not immediately available. It doesn't block the servlet thread but instead releases it back to the thread pool.

- Spring sets up an asynchronous context to handle the `DeferredResult`. It doesn't actively wait for the result but is prepared to process it when it becomes available.

- When `setResult()` is called on the `DeferredResult` (within a coroutine), Spring is notified that the result is ready.

- The thread that calls `setResult()` notifies Spring's asynchronous request handling mechanism.

- Spring then uses one of its own servlet container threads to process the result and send it back to the client.

#### What Happens in Application Service?


We initiate `DeferredResult(timeout in Long)` as a placeholder:

```kotlin-1
class SomeApplicationService() {
    fun createCustomerPortalSession(
        createCustomerPortalSessionDto: CreateCustomerPortalSessionDto,
    ): DeferredResult<Success<CreateCustomerPortalSessionResult>> {
        val deferredSessionURL = DeferredResult<Success<CreateCustomerPortalSessionResult>>(10000L)
```
We later `setResult` in a coroutine scope asynchronously

```kotlin-6{15}
        val scope = CoroutineScope(Dispatchers.IO)
        scope.launch {
            try {
                val (customerId) = createCustomerPortalSessionDto
                val params = SessionCreateParams.builder()
                    .setCustomer(customerId)
                    .setReturnUrl(managePlanURL)
                    .build()
                val session = Session.create(params)
                deferredSessionURL.setResult(Success(CreateCustomerPortalSessionResult(session.url)))
            } catch (err: Exception) {
                deferredSessionURL.setErrorResult(err)
            } finally {
                scope.cancel()
            }
        }
        return deferredSessionURL
    }
}
```
