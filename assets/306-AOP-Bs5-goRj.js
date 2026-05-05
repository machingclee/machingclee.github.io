const n=`---
title: "AOP in Kotlin"
date: 2024-08-05
id: blog0306
tag: kotlin, springboot
toc: true
intro: "We record how to introduce reusuable interceptor in kotlin."
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Annotation on Methods

We start with a simple case:

\`\`\`kotlin 
package com.machingclee.payment.annotation

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
@MustBeDocumented
annotation class LogParam(
    val value: String = ""
)
\`\`\`
From this we can annotate any method with \`@LogParam\`. 

Here is a code example on what can be done:

\`\`\`kotlin 
import org.aspectj.lang.ProceedingJoinPoint
import org.aspectj.lang.annotation.Around
import org.aspectj.lang.annotation.Aspect
import org.aspectj.lang.reflect.MethodSignature
import org.springframework.stereotype.Component

@Aspect
@Component
class LogAspect {
    @Around("@annotation(com.machingclee.payment.annotation.LogParam)")
    fun around(point: ProceedingJoinPoint): Any? {
        val name = point.signature.name
        println("function $name is called")

        val signature = point.signature as MethodSignature
        val method = signature.method
        val annotation = method.getAnnotation(LogParamType::class.java)
        val value = annotation.value
        val parameterTypes = method.parameterTypes[0].name
        println("annotation $value and parameterTypes $parameterTypes")
        return point.proceed()
    }
}
\`\`\`
A helpful usecase is to validate user's access right before accessing a specific controller (method).

### Annotation on Class

Sometimes we would like to have interceptor applied to all the methods of a class, we replace \`@Target(AnnotationTarget.FUNCTION)\` by \`@Target(AnnotationTarget.CLASS)\` and write:

\`\`\`kotlin 
@Aspect
@Component
class LogAspect {
    @Around("@within(com.machingclee.payment.annotation.LogParam)")
    fun around(point: ProceedingJoinPoint): Any? {
        try {
            val signature = point.signature as MethodSignature
            val method = signature.method
            val annotation = method.getAnnotation(LogParamType::class.java)
            println("parmeters: \${method.parameters[0]}")
            val annotation = method.getAnnotation(LogParamType::class.java)
            val value = annotation.value
            val parameterTypes = method.parameterTypes[0].name
            println("annotation $value and parameterTypes $parameterTypes")
            return point.proceed()
        } catch (e: Exception) {
            println(e.message)
            return null
        }
    }
}
\`\`\`
Here \`@within\` will target to all methods of a class annotated by \`LogParam\`.

### More References

- We can go even further, we can target to all \`public\` methods, or method whose name ***ends with*** \`Test\` etc. There is a cheatsheet to create such a ***pointcut***.

  - [Aspectj Cheatsheet](https://blog.espenberntsen.net/2010/03/20/aspectj-cheat-sheet/)

- More discussion on \`pointcut\` can be found:

  - [Discussion and Examples by cheatsheet Author in StackOverflow](https://stackoverflow.com/questions/2011089/aspectj-pointcut-for-all-methods-of-a-class-with-specific-annotation)

- Apart from \`@Around\`, we have \`@Before\`, \`@After\`, \`@AfterThrowing\`, etc, annotations, you may find more resource from

  - [AOP 與 Pointcut 淺談](https://bingdoal.github.io/backend/2020/11/aop-and-point-cut-in-spring-boot/)`;export{n as default};
