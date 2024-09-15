---
title: "Lambda Function Running Spring Boot in Docker Image"
date: 2024-09-06
id: blog0322
tag: aws, docker, kotlin, springboot
toc: true
intro: "Run a spring boot in docker image using lambda function"
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Dependencies 

```kotlin
dependencies {
    implementation("com.amazonaws:aws-lambda-java-core:1.2.3")
    implementation("com.amazonaws.serverless:aws-serverless-java-container-springboot3:2.0.3")
}
```

#### serverless.yml

```yml
service: billie-payment-kotlin-dockerized

provider:
  name: aws
  region: ap-southeast-2
  stage: uat
  architecture: arm64 # because I am using macbook air m2, otherwise empty this field
  iam:
    role:
      name: ${self:service}-${self:provider.stage}-role
  ecr:
    images:
      billie-payment-kotlin-lambda-uat:
        path: ./

functions:
  api:
    image:
      name: billie-payment-kotlin-lambda-uat
    timeout: 900
    environment:
      SPRING_PROFILES_ACTIVE: uat
    events:
      - http: ANY /
      - http: ANY /{proxy+}

custom:
  serverless-offline:
    useDocker: true

plugins:
  - serverless-offline
```

#### Dockerfile

- The main problem of the gradle task `bootJar` or `build` is that they define classes inside of `BOOT-INF/classes` and `BOOT-INF/lib`. 

- But `public.ecr.aws/lambda/java:21` seeks for definition at the `$LAMBDA_TASK_ROOT` directory (i.e., `/var/task`). 

- Therefore after extracting the `jar`'s from `/var/task/application.jar` which is built from `bootJar` task, we simply move `classes` and `lib` to the `/var/task` level:


```dockerfile
FROM gradle:8.10.0-jdk21-alpine AS build
WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon

FROM public.ecr.aws/lambda/java:21
RUN mkdir -p $LAMBDA_TASK_ROOT/lib/
ARG JAR_FILE="application.jar"
COPY --from=build /app/build/libs/${JAR_FILE} $LAMBDA_TASK_ROOT
RUN mkdir -p ${LAMBDA_TASK_ROOT}/extract && \
    cd ${LAMBDA_TASK_ROOT}/extract && \
    jar -xf ${LAMBDA_TASK_ROOT}/${JAR_FILE} && \
    mv ${LAMBDA_TASK_ROOT}/extract/BOOT-INF/classes/* ${LAMBDA_TASK_ROOT}/ && \
    mv ${LAMBDA_TASK_ROOT}/extract/BOOT-INF/lib/* ${LAMBDA_TASK_ROOT}/lib && \
    mv ${LAMBDA_TASK_ROOT}/extract/META-INF/* ${LAMBDA_TASK_ROOT}/META-INF/ && \
    if [ -d ${LAMBDA_TASK_ROOT}/BOOT-INF/classes/META-INF ]; then \
        mv ${LAMBDA_TASK_ROOT}/BOOT-INF/classes/META-INF/* ${LAMBDA_TASK_ROOT}/META-INF/ && \
        rmdir ${LAMBDA_TASK_ROOT}/BOOT-INF/classes/META-INF; \
    fi && \
    rm -rf ${LAMBDA_TASK_ROOT}/extract ${LAMBDA_TASK_ROOT}/${JAR_FILE} ${LAMBDA_TASK_ROOT}/BOOT-INF

CMD ["com.billie.payment.StreamLambdaHandler::handleRequest"]
```

- `CMD ["com.billie.payment.StreamLambdaHandler::handleRequest"]` is not the eventual command run by this container, if we run 
  ```text
  docker inspect --format='{{.Config.Entrypoint}}' <image-id>
  ```
  we can find that the image built by this dockerfile has `/lambda-entrypoint.sh` as the final entrypoint.

#### build.gradle.kts

- Make sure the let `Main-Class` point to your entry point. 

- The docker image from `public.ecr.aws/lambda/java:21` will handle another entrypoint using `StreamLambdaHandler` for us.



```kotlin
tasks.getByName<Jar>("jar") {
    manifest {
        attributes["Main-Class"] = "com.billie.payment.PaymentApplicationKt"
    }
}

tasks.named<Test>("test") {
    enabled = false
}

tasks.named<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>("compileTestKotlin") {
    enabled = false
}
```

#### StreamLambdaHandler

```kotlin
package com.billie.payment

import com.amazonaws.serverless.exceptions.ContainerInitializationException
import com.amazonaws.serverless.proxy.model.AwsProxyRequest
import com.amazonaws.serverless.proxy.model.AwsProxyResponse
import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler
import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.RequestStreamHandler
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream


class StreamLambdaHandler : RequestStreamHandler {
    @Throws(IOException::class)
    override fun handleRequest(inputStream: InputStream, outputStream: OutputStream, context: Context) {
        handler!!.proxyStream(inputStream, outputStream, context)
    }

    companion object {
        private var handler: SpringBootLambdaContainerHandler<AwsProxyRequest, AwsProxyResponse>? = null

        init {
            try {
                handler = SpringBootLambdaContainerHandler.getAwsProxyHandler(PaymentApplication::class.java)
                // If you are using HTTP APIs with the version 2.0 of the proxy model, use the getHttpApiV2ProxyHandler
                // method: handler = SpringBootLambdaContainerHandler.getHttpApiV2ProxyHandler(Application.class);
            } catch (e: ContainerInitializationException) {
                // if we fail here. We re-throw the exception to force another cold start
                e.printStackTrace()
                throw RuntimeException("Could not initialize Spring Boot application", e)
            }
        }
    }
}
```
