const n=`---
title: "Useful Util Functions to Log Excutation time and the Hibernate Generated Query within a code block by Trailing Closures"
date: 2024-12-02
id: blog0346
tag: springboot
toc: false
intro: "We introduce simple functions for logging."
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>


\`\`\`kotlin
import ch.qos.logback.classic.Level
import ch.qos.logback.classic.LoggerContext
import org.slf4j.LoggerFactory

object LoggingUtil {
    fun <T> hibernateSQL(block: () -> T): T {
        val loggerContext = LoggerFactory.getILoggerFactory() as LoggerContext
        val hibernateLogger = loggerContext.getLogger("org.hibernate.SQL")
        val originalLevel = hibernateLogger.level

        try {
            hibernateLogger.level = Level.DEBUG
            return block()
        } finally {
            hibernateLogger.level = originalLevel
        }
    }

    fun <T> duration(tag: String, block: () -> T): T {
        val startTime = System.currentTimeMillis()
        val result = block()
        val duration = System.currentTimeMillis() - startTime
        println("[METRIC: $tag] \${duration}ms")
        return result
    }
}
\`\`\``;export{n as default};
