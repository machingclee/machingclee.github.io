---
title: "Event Publishing and Listening in Spring boot"
date: 2024-06-16
id: blog0267
tag: springboot, kotlin
intro: "Record a simple setup for event emitter and listener."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Event 

```java
package com.kotlinspring.event

import com.kotlinspring.dto.CourseDTO
import org.springframework.context.ApplicationEvent

data class CreateCourseEvent(private val args: CourseDTO) : ApplicationEvent(args)
```


#### Event Publisher 

```java
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
```



#### Event Receiver

```java
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
```

#### Await for Events' Completion Using CountDownLatch

In case we need to wait for the event to be consumed completely and give response to the user. Let take `addCourse` as an example:

```java
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
```
Here 
```java
data class CreateCoursePayload(
    val courseDTO: CourseDTO,
    val latch: CountDownLatch,
    val updateCallback: ((savedResult: Course?) -> Unit)?
)

data class CreateCourseEvent(private val args: CreateCoursePayload) : ApplicationEvent(args)
```
and 
```java
@Service
class CourseService(
    val db: DSLContext,
    val courseRepository: CourseRepository
) {
    @Order(1)
    @EventListener
    fun CreateCourseListener(event: CreateCourseEvent) {
        val payload = event.source as CreateCoursePayload
        val courseDTO = payload.courseDTO
        val latch = payload.latch
        val updateCallback = payload.updateCallback
        try {
            val savedCourse = this.addCourse(courseDTO)
            updateCallback?.invoke(savedCourse)
            println("Saving Course is Done!")
        } catch (e: Exception) {
            throw e
        } finally {
            latch.countDown()
        }
    }
}
```
Here we have annotated our `EventListener` by `@Order(1)`, which indicates the ***priority of order*** handling the ***same event***. 

In case we need to handle the event by different listeners ***sequentially***, we use `@Order(1)`, `Order(2)`, ....