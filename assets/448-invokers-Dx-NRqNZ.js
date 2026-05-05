const e=`---
title: "Command-Query Based System Part 1: Command Invokers and Query Invokers for Domain Driven Design"
date: 2025-12-30
id: blog0448
tag: springboot, DDD
toc: true
intro: "Introduce Command- and Query-Invoker to achieve CQRS."

---

### Event Entity

The model definition of an \`Event\` entity is defined by:

\`\`\`kotlin
package com.scriptmanager.common.entity

import dev.james.processor.GenerateDTO
import jakarta.persistence.*
import org.hibernate.annotations.DynamicInsert
import org.hibernate.annotations.Generated

@Entity
@GenerateDTO
@DynamicInsert
@Table(name = "event")
class Event(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int? = null,

    @Column(name = "request_id", nullable = false)
    var requestId: String = "",

    @Column(name = "created_at")
    @Generated
    val createdAt: Double? = null,

    @Column(name = "created_at_hk")
    @Generated
    val createdAtHk: String? = null,

    @Column(name = "event_type", nullable = false)
    var eventType: String = "",

    @Column(name = "event", nullable = false, columnDefinition = "TEXT")
    var payload: String = "",

    @Column(name = "request_user_email", nullable = false)
    var requestUserEmail: String = "",

    @Column(name = "success", nullable = false)
    var success: Boolean = true,

    @Column(name = "failure_reason", nullable = false)
    var failureReason: String = ""
)
\`\`\`

### Command Invoker

#### Command

\`\`\`kotlin
package com.scriptmanager.domain.infrastructure

/**
 * Marker interface for commands that return a result of type R.
 * Commands are write operations that may modify state and produce domain events.
 */
interface Command<R>
\`\`\`


#### CommandHandler
\`\`\`kotlin
package com.scriptmanager.domain.infrastructure

interface CommandHandler<T : Any, R> {
    fun handle(eventQueue: EventQueue, command: T): R
}
\`\`\`
#### Invoker

##### Event Queue

In my desktop application I communicate with SQLite via Spring Boot because Spring is good at modeling domain concept via classes. In that case, my command invoker is like:

\`\`\`kotlin-1
package com.scriptmanager.domain.infrastructure

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.module.kotlin.KotlinModule
import com.scriptmanager.common.entity.Event
import com.scriptmanager.common.utils.JsonNodeUtil
import com.scriptmanager.repository.EventRepository
import jakarta.persistence.EntityManager
import org.slf4j.MDC
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Component
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

// Event timing enum (internal use only)
enum class DispatchTiming {
    IMMEDIATE,
    POST_COMMIT
}

// Event wrapper to hold timing information (internal use only)
data class EventWrapper<T : Any>(
    val event: T,
    val timing: DispatchTiming,
    var context: ExecutionContext? = null,
)

// Simplified EventQueue interface
interface EventQueue {
    fun add(event: Any)
    fun addTransactional(event: Any)

    val immediateEvents: List<EventWrapper<Any>>
    val postCommitEvents: List<EventWrapper<Any>>
    val allEvents: List<EventWrapper<Any>>

    // Keep backward compatibility
    val events: List<EventWrapper<Any>>
        get() = immediateEvents + postCommitEvents
}
\`\`\`
Note that we have separated \`immediateEvents\` and \`postCommitEvents\` because events can be transactional (should dispatch only after a transaction is finished).

Our event queue definition will include two methods: \`add\` and \`addTransactional\`, which is to add those events into two queues:

\`\`\`kotlin-48
// Updated EventQueue implementation
class SmartEventQueue : EventQueue {
    private val _events = mutableListOf<EventWrapper<Any>>()

    override fun add(event: Any) {
        val context = captureCurrentCommandContext()
        _events.add(EventWrapper(event, DispatchTiming.IMMEDIATE, context))
    }

    override fun addTransactional(event: Any) {
        val context = captureCurrentCommandContext()
        _events.add(EventWrapper(event, DispatchTiming.POST_COMMIT, context))
    }

    private fun captureCurrentCommandContext(): ExecutionContext {
        var commandName: String? = null

        return ExecutionContext(
            userEmail = "me",
            requestId = MDC.get("requestId"),
            originalMDC = MDC.getCopyOfContextMap(),
            commandName = commandName
        )
    }

    override val immediateEvents: List<EventWrapper<Any>>
        get() = _events.filter { it.timing == DispatchTiming.IMMEDIATE }

    override val postCommitEvents: List<EventWrapper<Any>>
        get() = _events.filter { it.timing == DispatchTiming.POST_COMMIT }

    override val allEvents: List<EventWrapper<Any>>
        get() = _events.toList()
}
\`\`\`

Each event will be wrapped by \`EventWrapper\` when being dispatched, we will determine the timing to dispatch (publish) this event in line-112.

##### Event Dispatcher

\`\`\`kotlin-82
data class ExecutionContext(
    val userEmail: String?,
    val requestId: String?,
    val originalMDC: Map<String, String>?,
    val commandName: String? = null,
)

// Updated DomainEventDispatcher
interface DomainEventDispatcher {
    fun dispatchNow(eventQueue: EventQueue, requestId: String? = null)
    fun dispatch(eventQueue: EventQueue, requestId: String? = null)
}

@Component
class SpringDomainEventDispatcher(
    private val applicationEventPublisher: ApplicationEventPublisher,
) : DomainEventDispatcher {

    override fun dispatchNow(eventQueue: EventQueue, requestId: String?) {
        // Keep backward compatibility - dispatch all events immediately
        dispatchEvents(eventQueue.events, requestId)
    }

    override fun dispatch(eventQueue: EventQueue, requestId: String?) {
        // New method that respects timing
        // Dispatch immediate events right away
        dispatchEvents(eventQueue.immediateEvents, requestId)

        // Register post-commit events for later dispatch
        if (eventQueue.postCommitEvents.isNotEmpty()) {
            registerPostCommitEvents(eventQueue.postCommitEvents, requestId)
        }
    }

    private fun dispatchEvents(wrappedEvents: List<EventWrapper<Any>>, requestId: String?) {
        // Don't modify MDC here - preserve existing context for policy handlers
        // The requestId should already be set by the CommandInvoker
        wrappedEvents.forEach { wrappedEvent ->
            // First publish the wrapper for audit logging (separate transaction)
            applicationEventPublisher.publishEvent(wrappedEvent)

            // Then publish the actual business event (same transaction)
            // This ensures business side effects are atomic with main transaction
            applicationEventPublisher.publishEvent(wrappedEvent.event)
        }
    }

    private fun registerPostCommitEvents(wrapperEvents: List<EventWrapper<Any>>, requestId: String?) {
        val capturedContext = captureCurrentContext(requestId)

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                object : TransactionSynchronization {
                    override fun afterCommit() {
                        withContext(capturedContext) { ctx ->
                            wrapperEvents.forEach { wrappedEvent ->
                                wrappedEvent.context = ctx
                                // Publish both wrapper (for audit) and event (for business logic)
                                applicationEventPublisher.publishEvent(wrappedEvent)
                                applicationEventPublisher.publishEvent(wrappedEvent.event)
                            }
                        }
                    }
                }
            )
        } else {
            // If no transaction is active, dispatch immediately
            dispatchEvents(wrapperEvents, requestId)
        }
    }
\`\`\`
##### ExecutionContext (Metadata for the Request)


- **Case 1 (Without Authentication).**  Our \`captureCurrentContext\` is as simple as passing hard-coded string. Since the purpose is for logging and the only user is the owner of the computer:

  \`\`\`kotlin-152
      private fun captureCurrentContext(requestId: String?): ExecutionContext {
          val user = "me"
          return ExecutionContext(
              userEmail = "me",
              requestId = requestId,
              originalMDC = MDC.getCopyOfContextMap()
          )
      }
  \`\`\`

- **Case 2 (With Authentication ).** Usually a request is dilivered by a thread, and for each thread we authenticate the message passed from the request header (not to be confused by the single-threading model of nodejs, they work differently).

  Once authenticated, we put \`userID,\` \`userEmail\`, or some other extra information into \`MDC\`, a thread-local object via \`MDC.put("key", value)\`.

  For example, let's consider an implmentation of \`AuthAspect\` for a pointcut used to get user from JWT-token:

  <details> 
  <summary><i><b>Implementation of AuthAspect</b></i></summary>




  \`\`\`kotlin 
  @Target(AnnotationTarget.CLASS)
  @Retention(AnnotationRetention.RUNTIME)
  annotation class AccessToken

  @Target(AnnotationTarget.VALUE_PARAMETER)
  @Retention(AnnotationRetention.RUNTIME)
  annotation class RequestUser

  @Aspect
  @Component
  class AuthAspect(
      private val jwtService: JwtService,
      private val eventPublisher: ApplicationEventPublisher,
  ) {
      private val authHeader: String = "authorization"

      companion object {
          private val currentUser = ThreadLocal<JwtPayload>()
          private val currentPublisher = ThreadLocal<ApplicationEventPublisher>()
          fun getCurrentUser(): JwtPayload? = currentUser.get()
          fun getEventPublisher(): ApplicationEventPublisher? = currentPublisher.get()
      }

      @Pointcut("@within(dev.james.alicetimetable.commons.aop.AccessToken)")
      fun getUserPointcut() {
      }

      @Around("getUserPointcut()")
      fun logBefore(joinPoint: ProceedingJoinPoint): Any? {
          val requestAttributes = RequestContextHolder.getRequestAttributes() as? ServletRequestAttributes
          val request = requestAttributes?.request
          try {
              val accessToken = request?.getHeader(authHeader)?.replace("Bearer ", "") ?: ""
              if (accessToken == "") {
                  throw Exception("AccessToken cannot be empty")
              }
              val payload: JwtPayload = jwtService.parseAndVerifyToken(accessToken)!!
              currentUser.set(payload)
              currentPublisher.set(eventPublisher)

              val method = (joinPoint.signature as MethodSignature).method
              val args = joinPoint.args
              val modifiedArgs = Array(args.size) { index ->
                  if (method.parameters[index].isAnnotationPresent(RequestUser::class.java)) {
                      payload
                  } else {
                      args[index]
                  }
              }
              return joinPoint.proceed(modifiedArgs)

          } catch (exception: Exception) {
              if (exception is JWTExpiredException) {
                  throw JWTExpiredException()
              } else {
                  throw Exception(exception.toString())
              }
          }
      }
  }
  \`\`\`
  </details>



  <p></p>

  Now with authentication:

  \`\`\`kotlin-152
      private fun captureCurrentContext(requestId: String?): ExecutionContext {
          val user = AuthAspect.getCurrentUser()
          return ExecutionContext(
              userEmail = user?.company_email,
              requestId = requestId,
              originalMDC = MDC.getCopyOfContextMap()
          )
      }
  \`\`\`


In both cases, the original \`requestId\` is instantiated from the \`invoke\` method of our \`commandHandler\` (see line-245 below), and each thread will have a consistent \`requestId\`. 

This is especially helpful to trace a sequence of commands one after another which are triggered via event by event, as required by a ***single request***.

Next we define a helpful trailing closure when our function requires to access the \`ExecutionContext\` for metadata:


\`\`\`kotlin-160
    private fun withContext(context: ExecutionContext, block: (context: ExecutionContext) -> Unit) {
        // Set up context for event handlers
        context.userEmail?.let { MDC.put("userEmail", it) }
        context.requestId?.let { MDC.put("requestId", it) }
        context.originalMDC?.forEach { (key, value) -> MDC.put(key, value) }

        // Temporarily set user in ThreadLocal if your AuthAspect supports it
        // This depends on how AuthAspect stores the current user

        try {
            block(context)
        } finally {
            MDC.clear()
        }
    }
}
\`\`\`
##### CommandInvoker

We will have a \`Event\` table storing all the \`Command\`s and \`Events\`. 

One \`Command\` can produce multiple \`Event\`s, and side effect ***must*** be carried out via new components with name being suffixed by \`Policy\`.


\`\`\`kotlin-176
interface CommandInvoker {
    fun <T : Any, R> invoke(handler: CommandHandler<T, R>, command: T): R
    fun <R> invoke(command: Command<R>): R
}

@Component
class OneTransactionCommandInvoker(
    private val transactionManager: PlatformTransactionManager,
    private val domainEventDispatcher: DomainEventDispatcher,
    private val commandAuditor: CommandAuditor,
    private val eventRepository: EventRepository,
    private val commandHandlers: List<CommandHandler<*, *>>
) : CommandInvoker {
    private val transactionTemplate: TransactionTemplate = TransactionTemplate(transactionManager)

    /**
     * Map of command class to its handler for fast lookup
     */
    private val handlerMap: Map<Class<*>, CommandHandler<*, *>> = buildHandlerMap()

    private fun buildHandlerMap(): Map<Class<*>, CommandHandler<*, *>> {
        val map = mutableMapOf<Class<*>, CommandHandler<*, *>>()

        commandHandlers.forEach { handler ->
            val commandClass = extractCommandClass(handler)
            if (commandClass != null) {
                if (map.containsKey(commandClass)) {
                    throw IllegalStateException(
                        "Multiple handlers found for command: \${commandClass.simpleName}"
                    )
                }
                map[commandClass] = handler
                println("Registered command handler: \${handler::class.simpleName} for \${commandClass.simpleName}")
            }
        }

        return map
    }

    private fun extractCommandClass(handler: CommandHandler<*, *>): Class<*>? {
        val handlerClass = handler::class.java
        val genericInterfaces = handlerClass.genericInterfaces

        for (genericInterface in genericInterfaces) {
            if (genericInterface is java.lang.reflect.ParameterizedType) {
                val rawType = genericInterface.rawType
                if (rawType == CommandHandler::class.java) {
                    val typeArgs = genericInterface.actualTypeArguments
                    if (typeArgs.isNotEmpty()) {
                        return typeArgs[0] as? Class<*>
                    }
                }
            }
        }
        return null
    }
\`\`\`
- By default each \`commandHandler\` is executed within a transaction automatically (we manage to do this using \`transactionTemplate\`, see line-281 below), and when either one of the nested command failed, it will make everything be rollbacked.

- Also by the dependency injection interface \`List<CommandHandler<*, *>>\`, it will grab all the beans that satisfy the interface \`CommandHandler\`, from which we can prepare a mapping of \`Command-to-Handler\`so that in our controller level we can simply run 
  \`\`\`kotlin
  commandInvoker.invoke(command)
  \`\`\`
  without specifying which handler to handle it.


\`\`\`kotlin-232
    @Suppress("UNCHECKED_CAST")
    override fun <R> invoke(command: Command<R>): R {
        val handler = handlerMap[command::class.java]
            ?: throw IllegalArgumentException(
                "No handler registered for command: \${command::class.simpleName}"
            )

        return invoke(handler as CommandHandler<Any, R>, command as Any)
    }

    override fun <T : Any, R> invoke(handler: CommandHandler<T, R>, command: T): R {
        // Preserve existing requestId for nested commands, or create new one for top-level commands
        val existingRequestId = MDC.get("requestId")
        val requestId = existingRequestId ?: UUID.randomUUID().toString()
        val isNestedCommand = existingRequestId != null

        // Always ensure MDC has the requestId
        MDC.put("requestId", requestId)
        MDC.put("userEmail", "me")
        var commandEventId: Int? = null
        var dispatchedEvents: List<EventWrapper<Any>> = emptyList()

        // Debug logging
        println("Command: \${command.javaClass.simpleName}, isNested: $isNestedCommand, requestId: $requestId")

        try {
            // Execute all commands the same way - use existing transaction if available, otherwise create new one
            val result = if (isNestedCommand && TransactionSynchronizationManager.isSynchronizationActive()) {
                // Execute directly in existing transaction for nested commands
                println("Executing nested command in existing transaction")
                val eventQueue = SmartEventQueue()

                // Log command audit INSIDE the transaction
                val commandEvent = commandAuditor.logCommandInTransaction(command, requestId)
                commandEventId = commandEvent.id

                val result = handler.handle(eventQueue, command)
                dispatchedEvents = eventQueue.allEvents
                domainEventDispatcher.dispatch(eventQueue, requestId)

                // Mark as success immediately (same transaction)
                commandEvent.success = true
                eventRepository.save(commandEvent)

                result
            } else {
                // Create new transaction for top-level commands
                println("Executing top-level command in new transaction")
                var tempDispatchedEvents: List<EventWrapper<Any>> = emptyList()
                val result = transactionTemplate.execute { _ ->
                    val eventQueue = SmartEventQueue()

                    // Log command audit INSIDE the transaction
                    val commandEvent = commandAuditor.logCommandInTransaction(command, requestId)
                    commandEventId = commandEvent.id

                    val result = handler.handle(eventQueue, command)
                    tempDispatchedEvents = eventQueue.allEvents
                    domainEventDispatcher.dispatch(eventQueue, requestId)

                    // Mark as success immediately (same transaction)
                    commandEvent.success = true
                    eventRepository.save(commandEvent)

                    result
                } ?: throw IllegalStateException()
                dispatchedEvents = tempDispatchedEvents
                result
            }

            println("Command completed successfully: \${command.javaClass.simpleName}")
            return result
        } catch (e: Exception) {
            println("Command failed: \${command.javaClass.simpleName}, error: \${e.message}")
            e.printStackTrace()

            // Note: Command audit was rolled back with the transaction
            // We cannot log the failure because the command event was not persisted
            println("Warning: Command audit was rolled back due to transaction failure")

            throw e
        } finally {
            // Only clear MDC for top-level commands to preserve context for nested commands
            if (!isNestedCommand) {
                MDC.clear()
            }
        }
    }
}
\`\`\`


##### Logging 
###### Definitions
The rest is definitions from trial and error to achieve comprehensive logging. For example (events happen in descending order over creation time):

![](/assets/img/2026-01-01-18-31-47.png)

\`\`\`kotlin-321
@Component
class CommandAuditor(
    private val eventRepository: EventRepository,
    private val entityManager: EntityManager,
) {
    private val objectMapper = ObjectMapper().apply {
        registerModule(KotlinModule.Builder().build())
        configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false)
    }

    @Transactional(propagation = Propagation.MANDATORY)
    fun <T : Any> logCommandInTransaction(command: T, requestId: String): Event {
        try {
            val eventJsonNode = JsonNodeUtil.toJsonNode(command).toString()
            val userEmail = "me"

            // Detect if this command is being called from a policy
            val commandEventType = detectPolicyOrigin(command.javaClass.simpleName)

            // Get unique timestamp in milliseconds (no decimals)
            val baseTimestamp = System.currentTimeMillis()
            val nanoOffset = (System.nanoTime()%1000).toInt()  // Use last 3 digits of nanos for uniqueness
            val uniqueTimestamp = baseTimestamp + nanoOffset

            val eventToSave = Event(
                createdAt = uniqueTimestamp.toDouble(),  // Convert to Double for database
                requestId = requestId,
                eventType = commandEventType,
                payload = eventJsonNode,
                requestUserEmail = userEmail,
                success = false  // Will be updated to true if command succeeds
            )

            val savedEvent = eventRepository.save(eventToSave)
            println("AUDIT: Command logged in transaction with createdAt = $uniqueTimestamp")
            return savedEvent
        } catch (e: Exception) {
            println("AUDIT ERROR: Failed to save command: \${e.message}")
            e.printStackTrace()
            throw e
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun <T : Any> logCommandWithPreciseTiming(command: T, requestId: String): Event {
        try {
            val eventJsonNode = JsonNodeUtil.toJsonNode(command).toString()
            val user = "me"
            val userEmail = "me" ?: ""

            // Detect if this command is being called from a policy
            val commandEventType = detectPolicyOrigin(command.javaClass.simpleName)

            // Get unique timestamp in milliseconds (no decimals)
            val baseTimestamp = System.currentTimeMillis()
            val nanoOffset = (System.nanoTime()%1000).toInt()  // Use last 3 digits of nanos for uniqueness
            val uniqueTimestamp = baseTimestamp + nanoOffset

            val eventToSave = Event(
                createdAt = uniqueTimestamp.toDouble(),  // Convert to Double for database
                requestId = requestId,
                eventType = commandEventType,
                payload = eventJsonNode,
                requestUserEmail = userEmail
            )

            val savedEvent = eventRepository.save(eventToSave)
            entityManager.flush() // Force immediate write

            println("AUDIT: Command saved immediately with createdAt = $uniqueTimestamp")
            return savedEvent
        } catch (e: Exception) {
            println("AUDIT ERROR: Failed to save command: \${e.message}")
            e.printStackTrace()
            throw e
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun <T : Any> logCommand(command: T, requestId: String): Event {
        try {
            val eventJsonNode = JsonNodeUtil.toJsonNode(command).toString()
            val user = "me"
            val userEmail = "me" ?: ""
            MDC.put("userEmail", userEmail)

            // Detect if this command is being called from a policy
            val commandEventType = detectPolicyOrigin(command.javaClass.simpleName)

            val eventToSave = Event(
                requestId = requestId,
                eventType = commandEventType,
                payload = eventJsonNode,
                requestUserEmail = userEmail
            )

            val savedEvent = eventRepository.save(eventToSave)

            // Force flush to ensure the data is actually written to database
            entityManager.flush()

            println("AUDIT: Command saved to database with ID: \${savedEvent.id}")
            return savedEvent
        } catch (e: Exception) {
            println("AUDIT ERROR: Failed to save command to database: \${e.message}")
            e.printStackTrace()
            throw e
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    fun logSuccess(eventId: Int) {
        val command = eventRepository.findByIdOrNull(eventId) ?: return
        command.success = true
        eventRepository.save(command)
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun logFailure(commandEventId: Int, error: String) {
        val command = eventRepository.findByIdOrNull(commandEventId) ?: return
        command.success = false
        command.failureReason = error
        eventRepository.save(command)
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun logEventFailures(dispatchedEvents: List<EventWrapper<Any>>, requestId: String, failureMessage: String) {
        try {
            val requestUuid = requestId

            // Find all events for this request that were dispatched
            dispatchedEvents.forEach { eventWrapper ->
                val eventTypeName = eventWrapper.event.javaClass.simpleName

                // Find events in database that match this event type and request ID
                // We need to find events that were logged for this specific event
                val eventsToUpdate = findEventsByTypeAndRequest(eventTypeName, requestUuid)

                eventsToUpdate.forEach { event ->
                    event.success = false
                    event.failureReason = failureMessage
                    // Update the event type to indicate failure
                    if (!event.eventType.endsWith("-- Failed!")) {
                        event.eventType = "\${event.eventType} -- Failed!"
                    }
                    eventRepository.save(event)
                    println("Updated event \${event.eventType} (ID: \${event.id}) with failure reason")
                }
            }

            entityManager.flush()
            println("Successfully updated all dispatched events with failure reasons")
        } catch (e: Exception) {
            println("Error updating events with failure: \${e.message}")
            e.printStackTrace()
            throw e
        }
    }

    private fun findEventsByTypeAndRequest(eventType: String, requestId: String): List<Event> {
        return try {
            // Find events that match both the event type and request ID
            val matchingEvents = eventRepository.findAllByRequestIdAndEventType(requestId, eventType)
            println("Found \${matchingEvents.size} events of type $eventType for request $requestId")
            matchingEvents
        } catch (e: Exception) {
            println("Could not find events for type $eventType and request $requestId: \${e.message}")
            emptyList()
        }
    }

    private fun detectPolicyOrigin(commandName: String): String {
        return try {
            // Get the current stack trace
            val stackTrace = Thread.currentThread().stackTrace

            // Look for policy classes in the stack trace
            var policyName: String? = null
            var eventMethodName: String? = null

            for (stackElement in stackTrace) {
                val className = stackElement.className
                val methodName = stackElement.methodName

                if (className.contains(".policy.") && className.endsWith("Policy")) {
                    // Extract just the policy class name (without package)
                    policyName = className.substringAfterLast(".")
                    eventMethodName = methodName
                    break
                }
            }

            if (policyName != null) {
                // Try to derive the event name from the method name
                val eventName = deriveEventNameFromMethod(eventMethodName)
                return if (eventName != null) {
                    "$eventName > $policyName > $commandName"
                } else {
                    "$policyName > $commandName"
                }
            }

            // If no policy found, return just the command name
            commandName
        } catch (e: Exception) {
            // If anything goes wrong, just return the command name
            println("Warning: Failed to detect policy origin: \${e.message}")
            commandName
        }
    }

    private fun deriveEventNameFromMethod(methodName: String?): String? {
        return try {
            if (methodName == null) return null

            // Common patterns in policy method names:
            // - resetClassNumbersOn(event) -> event type in parameter
            // - extendClassesOnClassMoved -> ClassMovedEvent
            // - extendClassesOnClassesCreated -> ClassesCreatedEvent

            when {
                methodName.contains("On") -> {
                    // Extract the part after "On" and convert to event name
                    val eventPart = methodName.substringAfterLast("On")
                    if (eventPart.isNotEmpty()) {
                        // Convert camelCase to EventName (e.g., "classMoved" -> "ClassMovedEvent")
                        val eventName = eventPart.replaceFirstChar { it.uppercase() }
                        if (!eventName.endsWith("Event")) {
                            "\${eventName}Event"
                        } else {
                            eventName
                        }
                    } else null
                }

                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }
}
\`\`\`

###### On \`propagation = Propagation.MANDATORY\`

By requiring the propagation of the transaction be \`Propagation.MANDATORY\`, we require the transaction for event logging be ***within the same transaction*** of the command invokation. 

This is only a tradeoff for SQLite  database because there cannot be two transactions writing into SQLite db at the same time, which is designed on purpose.

Event ***should not*** be logged synchorously because we don't want the failure of event logging interupt the successful transaction. For traditional database such as PostgreSQL and MySQL one should switch the propagation mode of transaction from \`MANDATORY\` to \`REQUIRES_NEW\`.



### Query Invoker


\`QueryInvoker\` is much more simple because it does not involve any transaction (we can always add logging in the invoker level later on).

#### Query

\`\`\`kotlin
package com.scriptmanager.domain.infrastructure

/**
 * Marker interface for queries that return a result of type R.
 * Queries are read-only operations that do not modify state.
 */
interface Query<R>
\`\`\`

#### Invoker


\`\`\`kotlin-1
package com.scriptmanager.domain.infrastructure

import org.slf4j.LoggerFactory
import org.slf4j.MDC
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.lang.reflect.ParameterizedType
import java.util.UUID

/**
 * QueryInvoker is responsible for routing queries to their appropriate handlers.
 * Unlike CommandInvoker, queries are read-only operations and:
 * - Do not produce domain events
 * - Use read-only transactions (@Transactional(readOnly = true))
 * - Are typically lighter weight
 * - Can be cached or optimized for read performance
 */
interface QueryInvoker {
    /**
     * Invokes the appropriate query handler for the given query.
     * @param query The query to execute
     * @return The query result
     */
    fun <R> invoke(query: Query<R>): R
}

@Component
class DefaultQueryInvoker(
    private val queryHandlers: List<QueryHandler<*, *>>
) : QueryInvoker {

    private val logger = LoggerFactory.getLogger(DefaultQueryInvoker::class.java)

    /**
     * Map of query class to its handler for fast lookup
     */
    private val handlerMap: Map<Class<*>, QueryHandler<*, *>> = buildHandlerMap()

    private fun buildHandlerMap(): Map<Class<*>, QueryHandler<*, *>> {
        val map = mutableMapOf<Class<*>, QueryHandler<*, *>>()

        queryHandlers.forEach { handler ->
            val queryClass = extractQueryClass(handler)
            if (queryClass != null) {
                if (map.containsKey(queryClass)) {
                    throw IllegalStateException(
                        "Multiple handlers found for query: \${queryClass.simpleName}"
                    )
                }
                map[queryClass] = handler
                logger.info("Registered query handler: \${handler::class.simpleName} for \${queryClass.simpleName}")
            } else {
                logger.warn("Could not determine query type for handler: \${handler::class.simpleName}")
            }
        }

        return map
    }

    private fun extractQueryClass(handler: QueryHandler<*, *>): Class<*>? {
        // Look through all generic interfaces
        val genericInterfaces = handler::class.java.genericInterfaces

        for (genericInterface in genericInterfaces) {
            if (genericInterface is ParameterizedType &&
                genericInterface.rawType == QueryHandler::class.java
            ) {
                val typeArguments = genericInterface.actualTypeArguments
                if (typeArguments.isNotEmpty()) {
                    return typeArguments[0] as? Class<*>
                }
            }
        }

        return null
    }

    @Transactional(readOnly = true)
    @Suppress("UNCHECKED_CAST")
    override fun <R> invoke(query: Query<R>): R {
        // Set up MDC for request tracing (optional for queries, but useful for debugging)
        val existingRequestId = MDC.get("requestId")
\`\`\`
Here usually there is non-null \`requestId\` because events are dispatched from our command. 

But there are ocassions something has happended from other domain  (a domain event) that needs to be noticed from our domain service, in that case a event is dispatched via a controller endpoint and \`existingRequestId\` is now being \`null\`.

Here is an example:

- [The \`/events/script-executed/{scriptId}"\` endpoint](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/controller/ScriptController.kt#L152)

\`\`\`kotlin-83
        val requestId = existingRequestId ?: UUID.randomUUID().toString()

        if (existingRequestId == null) {
            MDC.put("requestId", requestId)
        }

        try {
            val handler = handlerMap[query::class.java] as? QueryHandler<Query<R>, R>
                ?: throw IllegalArgumentException(
                    "No handler found for query: \${query::class.simpleName}. " +
                            "Available handlers: \${handlerMap.keys.map { it.simpleName }}"
                )

            logger.debug("Executing query: \${query::class.simpleName} with requestId: $requestId")

            val result = handler.handle(query)

            logger.debug("Query completed: \${query::class.simpleName}")

            return result
        } catch (e: Exception) {
            logger.error("Query failed: \${query::class.simpleName}, error: \${e.message}", e)
            throw e
        } finally {
            // Only clear MDC if we created it
            if (existingRequestId == null) {
                MDC.remove("requestId")
            }
        }
    }
}
\`\`\`
### Event Listeners for Side Effects
#### Policies
##### Concrete Example
As mentioned each side effect ***must*** be carried out from \`Policy\`s in order ***not to burry*** the side effect logic into the sea of uncontrolled  and exploded number of services.

Essentially such a policy is as simple as a event listener defined as the following exmaple:

\`\`\`kotlin
package dev.james.alicetimetable.domain.context.timetable.policy

import dev.james.alicetimetable.domain.context.timetable.commandhandler.*
import dev.james.alicetimetable.domain.context.timetable.command.*
import dev.james.alicetimetable.domain.context.timetable.IHasPackageId
import dev.james.alicetimetable.domain.context.timetable.TimetableDomainEvent
import dev.james.alicetimetable.infra.CommandInvoker
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
class ResetClassNumbersPolicy(
    private val commandInvoker: CommandInvoker,
    private val resetClassNumbersHandler: ResetClassNumbersHandler,
) {
    @EventListener
    fun resetClassNumbersOn(event_: TimetableDomainEvent.GroupOfClassesRemovedEvent) {
        val event = event_ as IHasPackageId
        resetClassNumbersOfPackage(event)
    }

    @EventListener
    fun resetClassNumbersOn(event_: TimetableDomainEvent.SingleClassRemovedEvent) {
        val event = event_ as IHasPackageId
        resetClassNumbersOfPackage(event)
    }

    @EventListener
    fun resetClassNumbersOn(event_: TimetableDomainEvent.ClassMovedEvent) {
        val event = event_ as IHasPackageId
        resetClassNumbersOfPackage(event)
    }

    @EventListener
    fun resetClassNumbersOn(event_: TimetableDomainEvent.ClassesCreatedEvent) {
        val event = event_ as IHasPackageId
        resetClassNumbersOfPackage(event)
    }

    @EventListener
    fun resetClassNumbersOn(event_: TimetableDomainEvent.ClassesRemovedEvent) {
        val event = event_ as IHasPackageId
        resetClassNumbersOfPackage(event)
    }

    @EventListener
    fun resetClassNumbersOn(event_: TimetableDomainEvent.ClassDuplicatedEvent) {
        val event = event_ as IHasPackageId
        resetClassNumbersOfPackage(event)
    }

    private fun resetClassNumbersOfPackage(event: IHasPackageId) {
        val packageId = event.packageId
        val cmd = ResetClassNumbersCommand(packageId = packageId)
        commandInvoker.invoke(resetClassNumbersHandler, cmd)
    }
}
\`\`\`

##### Advantages

As you can see, there are so many reasons we need to reset the numbering of classes in a timetable system of an art school. 

Now 
1. From documentation point of view we know all the reasons why we need to reset the class numbers, and 

2. When one of the cases need special treatment (not managable by the shared logic \`resetClassNumbersOfPackage\`), we can immediately adjust one of the event listener by another private function.

    This avoids the altering of one method breaks the functionality of another method unexpectedly. Of course this can be mitigated by writing comprehensive test case (if any).

3. Now we can write test cases using the event produced by our command handler. We will discuss writing tests in the next article.

#### DomainEventLogger

Side effect means a mutation of the state of the system, and event logging is no exception. 

\`\`\`kotlin 
package com.scriptmanager.domain.infrastructure

import com.scriptmanager.common.entity.Event
import com.scriptmanager.common.utils.JsonNodeUtil
import com.scriptmanager.repository.EventRepository

import org.slf4j.MDC
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener
import java.util.*


@Component
class DomainEventLogger(
    private val eventRepository: EventRepository,
    private val applicationEventPublisher: ApplicationEventPublisher,
) {
    @EventListener
    @Transactional(propagation = Propagation.MANDATORY)  // Join existing transaction
    fun recordSynchronousEvent(wrapperEvent: EventWrapper<Any>) {
        if (wrapperEvent.timing != DispatchTiming.IMMEDIATE) {
            return
        }

        try {
            // Immediate event audit with precise timing
            // This runs in the SAME transaction as the command
            persistEventWithPreciseTiming(wrapperEvent)
        } catch (e: Exception) {
            // Log audit failure but don't break the flow
            println("Warning: Failed to persist synchronous event: \${e.message}")
            e.printStackTrace()
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun recordTransactionalEvent(wrapperEvent: EventWrapper<Any>) {
        if (wrapperEvent.timing != DispatchTiming.POST_COMMIT) {
            return
        }
        try {
            // For post-commit events, persist with precise timing
            persistEventWithPreciseTiming(wrapperEvent)
            applicationEventPublisher.publishEvent(wrapperEvent.event)
        } catch (e: Exception) {
            // Log the error but don't let event logging failures break the application
            println("Warning: Failed to persist or publish transactional event: \${e.message}")
            e.printStackTrace()
        }
    }

    private fun persistEventWithPreciseTiming(wrappedEvent: EventWrapper<Any>) {
        val event = wrappedEvent.event
        val ctx = wrappedEvent.context
        val requestID = try {
            UUID.fromString(MDC.get("requestId") ?: ctx?.requestId).toString()
        } catch (e: Exception) {
            ""
        }

        val userEmail = "me"

        // Detect which command dispatched this event
        val eventTypeName = event::class.simpleName ?: ""
        val commandAwareEventType = if (ctx?.commandName != null) {
            "\${ctx.commandName} > $eventTypeName"
        } else {
            detectCommandOrigin(eventTypeName)
        }

        // Get unique timestamp in milliseconds (no decimals)
        val baseTimestamp = System.currentTimeMillis()
        val nanoOffset = (System.nanoTime()%1000).toInt()  // Use last 3 digits of nanos for uniqueness
        val uniqueTimestamp = baseTimestamp + nanoOffset

        val eventJsonNode = JsonNodeUtil.toJsonNode(event)
        val eventToSave = Event(
            createdAt = uniqueTimestamp.toDouble(),  // Convert to Double for database
            eventType = commandAwareEventType,
            payload = eventJsonNode.toString(),
            requestUserEmail = userEmail,
            requestId = requestID
        )

        // Save immediately with precise timing
        eventRepository.save(eventToSave)
        println("AUDIT: Event saved immediately with createdAt = $uniqueTimestamp")
    }

    private fun persistEvent(wrappedEvent: EventWrapper<Any>) {
        val event = wrappedEvent.event
        val ctx = wrappedEvent.context
        val requestID = try {
            UUID.fromString(MDC.get("requestId") ?: ctx?.requestId).toString()
        } catch (e: Exception) {
            ""
        }

        // MDC.set("userEmail") has been executed when we call the command
        // this event may be handled by another thread when it is transactional event listener
        val userEmail = "me"

        // Detect which command dispatched this event
        val eventTypeName = event::class.simpleName ?: ""
        val commandAwareEventType = if (ctx?.commandName != null) {
            "\${ctx.commandName} > $eventTypeName"
        } else {
            detectCommandOrigin(eventTypeName)
        }

        val eventJsonNode = JsonNodeUtil.toJsonNode(event).toString()
        val eventToStore = Event(
            eventType = commandAwareEventType,
            payload = eventJsonNode,
            requestUserEmail = userEmail,
            requestId = requestID
        )
        eventRepository.save(eventToStore)
    }

    private fun detectCommandOrigin(eventTypeName: String): String {
        return try {
            // Get the current stack trace
            val stackTrace = Thread.currentThread().stackTrace

            // Look for command handler classes in the stack trace
            for (stackElement in stackTrace) {
                val className = stackElement.className

                // Look for the specific command handler package structure
                if (className.contains("dev.james.alicetimetable.domain.context.timetable.commandHandler") &&
                    className.endsWith("Handler")
                ) {
                    // Extract the command name from handler name
                    // e.g., "MoveClassHandler" -> "MoveClassCommand"
                    val handlerName = className.substringAfterLast(".")
                    val commandName = handlerName.replace("Handler", "Command")
                    return "$commandName > $eventTypeName"
                }

                // Also look for user context command handlers
                if (className.contains("dev.james.alicetimetable.domain.context.user.commandHandler") &&
                    className.endsWith("Handler")
                ) {
                    val handlerName = className.substringAfterLast(".")
                    val commandName = handlerName.replace("Handler", "Command")
                    return "$commandName > $eventTypeName"
                }

                // Also look for notification context command handlers
                if (className.contains("dev.james.alicetimetable.domain.context.notification.commandHandler") &&
                    className.endsWith("Handler")
                ) {
                    val handlerName = className.substringAfterLast(".")
                    val commandName = handlerName.replace("Handler", "Command")
                    return "$commandName > $eventTypeName"
                }
            }

            // If no command handler found, return just the event name
            eventTypeName
        } catch (e: Exception) {
            // If anything goes wrong, just return the event name
            eventTypeName
        }
    }

}
\`\`\`

`;export{e as default};
