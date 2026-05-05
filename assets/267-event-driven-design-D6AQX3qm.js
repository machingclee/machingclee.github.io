const e=`---
title: "Event Publishing and Listening in Spring boot"
date: 2024-06-16
id: blog0267
tag: springboot, kotlin
intro: "Record a simple setup for event emitter and listener."
toc: true
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Event 

\`\`\`kotlin
package com.kotlinspring.event

import com.kotlinspring.dto.CourseDTO
import org.springframework.context.ApplicationEvent

data class CreateCourseEvent(private val args: CourseDTO) : ApplicationEvent(args)
\`\`\`


### Event Publisher 

\`\`\`kotlin
package com.kotlinspring.event

import org.springframework.context.ApplicationEvent
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.ApplicationEventPublisherAware
import org.springframework.stereotype.Service


@Service
class EventPublisher : ApplicationEventPublisherAware {
    lateinit var eventPublisher: ApplicationEventPublisher

    fun publishEvent(event: ApplicationEvent) {
        eventPublisher.publishEvent(event)
    }

    override fun setApplicationEventPublisher(applicationEventPublisher: ApplicationEventPublisher) {
        this.eventPublisher = applicationEventPublisher
    }
}
\`\`\`



### Event Receiver

\`\`\`kotlin
@Service
class CourseService(
    val db: DSLContext,
    val courseRepository: CourseRepository
) {
    companion object {
        var logger: KLogger = KotlinLogging.logger {}
    }
    ...
    @EventListener
    fun handleCourseCreatedEvent(event: CreateCourseEvent) {
        val source = event.source as? CourseDTO
        println("This is the source of handleCourseCreatedEvent $source")
    }
    ...
}
\`\`\`

### Await for Events' Completion Using CountDownLatch

In case we need to wait for the event to be consumed completely and give response to the user. 

In the sequel we start to organize files in such a way that every developer can understand what is happening easily:

![](/assets/img/2024-06-17-22-37-56.png)

Let's take \`addCourse\` as an example, we will be:

- dispatching an event \`CreateCourseEvent\`
- waiting for that event to complete with the hlep of \`CountDownLatch\`
- get the latest result by the \`callback\` we passed as a ***trailing closure***:
  \`\`\`kotlin
  { dbResult: Course? -> savedResult = dbResult }
  \`\`\`

\`\`\`kotlin
@RestController
@RequestMapping("/v1")
class CourseController(
    val courseService: CourseService,
    val eventPublisher: EventPublisher
) {
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @RequestMapping("/courses")
    fun addCourse(@RequestBody courseDTO: CourseDTO): Course? {
        val latch = CountDownLatch(1)
        var savedResult: Course? = Course()
        val createCoursePayload = CreateCoursePayload(
            courseDTO,
            latch
        ) { dbResult: Course? -> savedResult = dbResult }
        val createCourseEvent = CreateCourseEvent(createCoursePayload)
        eventPublisher.publishEvent(createCourseEvent)
        latch.await()
        println("latch.await() unlocked!")
        return savedResult
    }
}
\`\`\`
Here 
\`\`\`kotlin
data class CreateCoursePayload(
    val courseDTO: CourseDTO,
    val latch: CountDownLatch,
    val resultCallback: ((savedResult: Course?) -> Unit)?
)

data class CreateCourseEvent(private val args: CreateCoursePayload) : ApplicationEvent(args)
\`\`\`
and 
\`\`\`kotlin
@Order(1)
@Component
class CreateCourseListener(
    private val courseService: CourseService
) : ApplicationListener<CreateCourseEvent> {
    override fun onApplicationEvent(event: CreateCourseEvent) {
        val payload = event.source as CreateCoursePayload
        val courseDTO = payload.courseDTO
        val latch = payload.latch
        val updateCallback = payload.updateCallback
        try {
            val savedCourse = courseService.addCourse(courseDTO)
            updateCallback?.invoke(savedCourse)
            println("Saving Course is Done!")
        } catch (e: Exception) {
            throw e
        } finally {
            latch.countDown()
        }
    }
}
\`\`\`
Here we have annotated our \`EventListener\` by \`@Order(1)\`, which indicates the ***priority of order*** handling the ***same event***. 

In case we need to handle the event by different listeners ***sequentially***, we use \`@Order(1)\`, \`Order(2)\`, ....

### Sequence of Events and Rollback Mechanism`;export{e as default};
