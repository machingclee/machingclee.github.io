const n=`---
title: "Lambda Function Running Spring Boot in Docker Image"
date: 2024-09-07
id: blog0322
tag: kotlin, springboot, lambda
toc: true
intro: "Run a spring boot in docker image using lambda function"
img: aws
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Repository 
- https://github.com/machingclee/2024-11-13-lambda-springboot-in-docker-image

### Serverless Framework

#### serverless.yml

\`\`\`yml
service: billie-payment-kotlin-dockerized

provider:
  name: aws
  region: ap-southeast-2
  stage: uat
  architecture: arm64 # because I am using macbook air m2, otherwise empty this field
  iam:
    role:
      name: \${self:service}-\${self:provider.stage}-role
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
\`\`\`

#### Dockerfile
Make sure to use your correct \`.jar\` filename:

\`\`\`dockerfile{8}
FROM gradle:8.10.0-jdk21-alpine AS build
WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon

FROM public.ecr.aws/lambda/java:21
RUN mkdir -p $LAMBDA_TASK_ROOT/lib/
ARG JAR_FILE="application.jar"
COPY --from=build /app/build/libs/\${JAR_FILE} $LAMBDA_TASK_ROOT
RUN mkdir -p \${LAMBDA_TASK_ROOT}/extract && \\
    cd \${LAMBDA_TASK_ROOT}/extract && \\
    jar -xf \${LAMBDA_TASK_ROOT}/\${JAR_FILE} && \\
    mv \${LAMBDA_TASK_ROOT}/extract/BOOT-INF/classes/* \${LAMBDA_TASK_ROOT}/ && \\
    mv \${LAMBDA_TASK_ROOT}/extract/BOOT-INF/lib/* \${LAMBDA_TASK_ROOT}/lib && \\
    mv \${LAMBDA_TASK_ROOT}/extract/META-INF/* \${LAMBDA_TASK_ROOT}/META-INF/ && \\
    if [ -d \${LAMBDA_TASK_ROOT}/BOOT-INF/classes/META-INF ]; then \\
        mv \${LAMBDA_TASK_ROOT}/BOOT-INF/classes/META-INF/* \${LAMBDA_TASK_ROOT}/META-INF/ && \\
        rmdir \${LAMBDA_TASK_ROOT}/BOOT-INF/classes/META-INF; \\
    fi && \\
    rm -rf \${LAMBDA_TASK_ROOT}/extract \${LAMBDA_TASK_ROOT}/\${JAR_FILE} \${LAMBDA_TASK_ROOT}/BOOT-INF

CMD ["com.billie.payment.StreamLambdaHandler::handleRequest"]
\`\`\`

### PostgreSQL Specific Integration

For detail please refer to [this article](/blog/article/JPA-with-DB-First-Approach-Surgery-on-JOOQ-s-POJO-into-Base-Entity-Class). Which includes

- Enum Handling (special annotatoin needed)
- Tables are named in camel cases (special \`PhysicalNamingStrategy\` needed)


### Spring Boot Specialized for Lambda

Write the following file at the same level as the entrypoint of the application:

#### Dependencies

\`\`\`kts
implementation("com.amazonaws:aws-lambda-java-core:1.2.3")
implementation("com.amazonaws.serverless:aws-serverless-java-container-springboot3:2.0.3")
\`\`\`

#### Initializr

[![](/assets/img/2024-11-12-23-59-36.png)](/assets/img/2024-11-12-23-59-36.png)

#### StreamLambdaHandler.handleRequest

\`\`\`kt
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
            } catch (e: ContainerInitializationException) {
                e.printStackTrace()
                throw RuntimeException("Could not initialize Spring Boot application", e)
            }
        }
    }
}
\`\`\``;export{n as default};
