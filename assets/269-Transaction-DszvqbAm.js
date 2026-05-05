const n=`---
title: "Simple Study of Transaction"
date: 2024-06-17
id: blog0269
tag: springboot, kotlin
intro: "We try to throw an exception inside a transaction to see whether a rollback takes place."
toc: false
---

<style>
  img {
    max-width: 660px;
  }
</style>

Let's consider an \`eventHandler\` written in this way:

\`\`\`kotlin
package com.kotlinspring.eventListener.course

import com.kotlinspring.db.tables.pojos.Course
import com.kotlinspring.db.tables.references.COURSE
import com.kotlinspring.event.course.CreateCourseEvent
import com.kotlinspring.event.course.CreateCoursePayload
import io.github.oshai.kotlinlogging.KotlinLogging
import org.jooq.DSLContext
import org.springframework.context.ApplicationListener
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

fun throwException() {
    throw Exception("Intentionally throw an exception")
}

@Order(1)
@Component
class CreateCourseListener(
    private val db: DSLContext
) : ApplicationListener<CreateCourseEvent> {
    val logger = KotlinLogging.logger {}
    override fun onApplicationEvent(event: CreateCourseEvent) {
        val payload = event.source as CreateCoursePayload
        val courseDTO = payload.courseDTO
        val latch = payload.latch
        val resultCallback = payload.resultCallback
        db.transaction { trx ->
            val ctx = trx.dsl()
            try {
                val result = courseDTO.let {
                    ctx.insertInto(COURSE, COURSE.NAME, COURSE.APPROVALSTATUS, COURSE.CATEGORY)
                        .values(it.name, it.approvalStatus, it.category)
                        .returning()
                        .fetchOneInto(Course::class.java)
                }
                throwException()
                resultCallback?.invoke(result)
            } catch (e: Exception) {
                latch.countDown()
                logger.error { e }
                throw e
            }
        }
    }
}
\`\`\`

By throwing \`Exception\`, we let \`@ControllerAdvice\` to catch the error and response a standardized result to the frontend:

\`\`\`json
{
    "success": false,
    "errorMessage": "JWT expired at 2024-06-17T17:38:58Z. Current time: 2024-06-17T17:44:35Z, a difference of 337831 milliseconds.  Allowed clock skew: 0 milliseconds."
}
\`\`\`
opps! Let me login and get a new JWT Token, then retry:

\`\`\`json
{
    "success": false,
    "errorMessage": "Rollback caused"
}
\`\`\`
As desired.`;export{n as default};
