---
title: "Lambda Function Running Spring Boot in Docker Image"
date: 2024-09-07
id: blog0322
tag: kotlin, springboot, lambda
toc: true
intro: "Run a spring boot in docker image using lambda function"
---

<style>
  img {
    max-width: 660px;
  }
</style>

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
