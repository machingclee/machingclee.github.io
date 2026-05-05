const n=`---
title: "Global Exception Handler"
date: 2024-06-18
id: blog0268
tag: springboot, kotlin
intro: "Config a global setting of how the error should return to frontend."
toc: false
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>


Folder Structure:

![](/assets/img/2024-06-18-01-28-15.png)


Implementation:

\`\`\`kotlin
package com.kotlinspring.exceptionHandler

import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseBody

@ControllerAdvice
class GlobalExceptionHandler {
    @ResponseBody
    @ExceptionHandler(Exception::class)
    fun handleException(e: Exception): Map<String, Any?> {
        return mapOf(
            "success" to false,
            "errorMessage" to e.message
        )
    }
}
\`\`\``;export{n as default};
