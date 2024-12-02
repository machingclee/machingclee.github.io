---
title: "Annotation to Specify Which JPA Method to be Logged for Hibernate Generated SQL"
date: 2024-12-02
id: blog0346
tag: springboot
toc: false
intro: "We introduce an annotation to annotate a jpa method so as to print only the log of that method."
---

<style>
  img {
    max-width: 660px;
  }
</style>



```kt
import ch.qos.logback.classic.Level
import ch.qos.logback.classic.LoggerContext
import org.aspectj.lang.ProceedingJoinPoint
import org.aspectj.lang.annotation.Around
import org.aspectj.lang.annotation.Aspect
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class LogQuery

@Aspect
@Component
class LogQueryAspect {
    @Around("@annotation(LogQuery)")
    fun logQuery(joinPoint: ProceedingJoinPoint): Any? {
        log.info("Executing query: ${joinPoint.signature.name}")

        // Enable SQL logging temporarily
        val loggerContext = LoggerFactory.getILoggerFactory() as LoggerContext
        val hibernateLogger = loggerContext.getLogger("org.hibernate.SQL")
        val originalLevel = hibernateLogger.level

        try {
            hibernateLogger.level = Level.DEBUG
            return joinPoint.proceed()
        } finally {
            hibernateLogger.level = originalLevel
        }
    }

    companion object {
        private val log = LoggerFactory.getLogger(LogQueryAspect::class.java)
    }
}
```