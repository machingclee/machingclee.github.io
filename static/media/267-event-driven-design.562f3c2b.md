---
title: "Event Driven Design in Spring boot"
date: 2024-06-16
id: blog0267
tag: springboot
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
