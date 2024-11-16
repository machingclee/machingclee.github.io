---
title: "Snapstarted Lambda running Spring Boot and Transition into Springboot as a node.js developer"
date: 2024-11-16
id: blog0340
tag: spring-boot, aws, lamdba
toc: true
intro: "Record miscellaneous detail of transitioning into Springboot as a node.js developer."
---

<style>
  img {
    max-width: 660px;
  }
</style>


#### Lambda function configuration

##### serverless.yml

Note that the highlighted line enables us to snapshot a lambda function:

```yml{15}
service: <your-application-name>
package:
  individually: true
  artifact: build/libs/function.jar
provider:
  name: aws
  region: ap-southeast-2
  stage: dev
  runtime: java17

functions:
  api:
    timeout: 900
    handler: com.your.package.LambdaHandler
    snapStart: true
    environment:
      SPRING_PROFILES_ACTIVE: dev
      MAIN_CLASS: com.your.package.ApplicationKt
    events:
      - http: ANY /
      - http: ANY /{proxy+}

custom:
  scriptable:
    hooks:
      "before:package:createDeploymentArtifacts": >
        docker run --rm
        -v %cd%:/app
        -w /app
        gradle:jdk17
        gradle lambdaJar

plugins:
  - serverless-scriptable-plugin
```

Note that `%cd%` is for windows, if you are linux, please change it to `$(pwd)`.

##### The LambdaHandler

```kotlin
package com.your.package

import com.amazonaws.serverless.proxy.model.AwsProxyRequest
import com.amazonaws.serverless.proxy.model.AwsProxyResponse
import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.RequestHandler
import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler

class LambdaHandler : RequestHandler<AwsProxyRequest, AwsProxyResponse> {
    companion object {
        private val handler = SpringBootLambdaContainerHandler.getAwsProxyHandler(BillieApplication::class.java)
    }

    override fun handleRequest(input: AwsProxyRequest,  context: Context): AwsProxyResponse {
        return handler.proxy(input, context)
    }
}
```

##### Minimal build.gradle.kts for a Complete Project

```kts
import org.springframework.boot.gradle.tasks.bundling.BootJar

plugins {
    kotlin("jvm") version "1.9.25"
    kotlin("plugin.spring") version "1.9.25"
    id("org.springframework.boot") version "3.3.0-SNAPSHOT"
    id("io.spring.dependency-management") version "1.1.6"
    kotlin("plugin.jpa") version "1.9.25"
    kotlin("plugin.serialization") version "2.0.0"
}

group = "com.your" // com.your.project, here "your" is usually a company
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

repositories {
    mavenCentral()
    maven { url = uri("https://repo.spring.io/milestone") }
    maven { url = uri("https://repo.spring.io/snapshot") }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-aop")
    implementation("com.amazonaws.serverless:aws-serverless-java-container-springboot3:2.0.3")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")
    implementation("io.github.oshai:kotlin-logging-jvm:5.1.0")

    implementation("com.google.api-client:google-api-client:2.0.0")
    implementation("com.google.oauth-client:google-oauth-client-jetty:1.34.1")
    implementation("com.google.apis:google-api-services-gmail:v1-rev20220404-2.0.0")
    implementation("com.google.code.gson:gson:2.11.0")
    implementation("javax.mail:mail:1.4.7")

    implementation("com.amazonaws:aws-lambda-java-core:1.2.3")
    implementation("com.amazonaws:aws-lambda-java-events:3.11.3")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("io.fusionauth:fusionauth-jwt:5.3.3")
    implementation("at.favre.lib:bcrypt:0.10.2")
    runtimeOnly("org.postgresql:postgresql")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict")
    }
}

allOpen {
    annotation("jakarta.persistence.Entity")
    annotation("jakarta.persistence.MappedSuperclass")
    annotation("jakarta.persistence.Embeddable")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.register<Jar>("lambdaJar") {
    archiveFileName.set("function.jar")
    destinationDirectory.set(layout.buildDirectory.dir("libs"))
    from(sourceSets.main.get().output)
    into("lib") {
        from(configurations.runtimeClasspath) {
            exclude("**/tomcat-*.jar")
        }
    }
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}

tasks.named<Jar>("lambdaJar") {
    group = "application"
    description = "Creates a jar file suitable for AWS Lambda deployment"
}

tasks.withType<BootJar> {
    targetJavaVersion = JavaVersion.VERSION_17
}
```




#### Spring Boot in Node.js Developer Perspective

##### Replacement of Middleware by AOP Programming

In node.js we usually write 

```ts
app.use("/file", jwtAuthMiddleware, fileRouter);
app.use("/search", jwtAuthMiddleware, searchRouter);
```

to block incoming requests or to inject desired object (like from request header) into our ***context*** object (in express case, the context is our `req`).

In spring boot there are two similar concepts that serve this purpose:
- `Filter` (Servlet Level)
- `Interceptor` (Application Level in which `@Bean`'s are available)

The drawbacks using these approches is the interception is highly implicit, instead we can annotate a contorller by `@AccessToken` which do all the token-validation and "user-data-injection" for us:

```kt
package com.your.package.commons.aop

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.wonderbricks.billie.service.JwtPayload
import com.wonderbricks.billie.service.JwtService
import org.aspectj.lang.JoinPoint
import org.aspectj.lang.annotation.Aspect
import org.aspectj.lang.annotation.Before
import org.aspectj.lang.annotation.Pointcut
import org.springframework.stereotype.Component
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes
import io.fusionauth.jwt.JWTExpiredException
import jakarta.servlet.http.HttpServletResponse
import org.aspectj.lang.ProceedingJoinPoint
import org.aspectj.lang.annotation.Around
import org.aspectj.lang.reflect.MethodSignature

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class UserFromHeader

@Target(AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
annotation class RequestUser

@Aspect
@Component
class UserFromHeaderAspect(private val jwtService: JwtService) {
    private val authHeader: String = "authorization"

    @Pointcut("@within(com.wonderbricks.billie.commons.aop.UserFromHeader)")
    fun getUserPointcut() {
    }

    @Around("getUserPointcut()")
    fun logBefore(joinPoint: ProceedingJoinPoint): Any? {
        val requestAttributes = RequestContextHolder.getRequestAttributes() as? ServletRequestAttributes
        val request = requestAttributes?.request
        try {
            val accessToken = request?.getHeader(authHeader)?.replace("Bearer ", "") ?: ""
            if (accessToken === "") {
                throw Exception("AccessToken cannot be empty")
            }
            val payload: JwtPayload = jwtService.parseAndVerifyToken(accessToken)!!

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
            val errorMessage = when (exception) {
                is JWTExpiredException -> "JWT_EXPIRED"
                else -> exception.toString()
            }
            throw Exception(errorMessage)
        }
        return joinPoint.proceed()
    }
}
```

For more refined control access using custom annotations, we may simply ask chat-gpt for the code implementation.

##### HandlerMethodArgumentResolver
We want to access our data annotated by `@RequestUser`, however, by default `Spring` will validate all data passing through the argument of each method, in which it has no idea how to validate our `@RequestUser`-annotated data.

Therefore we need to make configuration to let spring boot ignore this annotation in the input argument of a controller method:

```kt
package com.your.package.commons.config

import com.wonderbricks.billie.commons.aop.RequestUser
import org.springframework.context.annotation.Configuration
import org.springframework.core.MethodParameter
import org.springframework.stereotype.Component
import org.springframework.web.bind.support.WebDataBinderFactory
import org.springframework.web.context.request.NativeWebRequest
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.method.support.ModelAndViewContainer
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Component
class RequestUserArgumentResolver : HandlerMethodArgumentResolver {
    override fun supportsParameter(parameter: MethodParameter): Boolean {
        return parameter.hasParameterAnnotation(RequestUser::class.java)
    }

    override fun resolveArgument(
        parameter: MethodParameter,
        mavContainer: ModelAndViewContainer?,
        webRequest: NativeWebRequest,
        binderFactory: WebDataBinderFactory?
    ): Any? {
        // By returning null, it skips Spring's default parameter resolution, allowing custom logic (such as an aspect) to inject the value.
        return null
    }
}

@Configuration
class WebMvcConfig(private var requestUserArgumentResolver: RequestUserArgumentResolver) : WebMvcConfigurer {
    override fun addArgumentResolvers(resolvers: MutableList<HandlerMethodArgumentResolver>) {
        resolvers.add(requestUserArgumentResolver)
    }
}
```

![](/assets/img/2024-11-16-18-38-00.png)