const e=`---
title: "Containerization of Spring Boot Application in Kotlin and Troubles in Deployment through ECS"
date: 2024-09-05
id: blog0318
tag: kotlin, docker, ecs
toc: true
intro: "We record a two-stages dockerfile to build a docker image of spring boot application."
img: docker
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Dockerfile

\`\`\`dockerfile
FROM gradle:8.10.0-jdk21-alpine AS build
WORKDIR /app
COPY . .
RUN gradle clean build --no-daemon

FROM openjdk:21-jdk-slim
WORKDIR /app
COPY --from=build /app/build/libs/payment-0.0.1-SNAPSHOT.jar app.jar
COPY . .
ENV SERVER_PORT=8081
EXPOSE 8081
ENTRYPOINT ["java", "-Dspring.profiles.active=uat", "-jar", "app.jar"]
\`\`\`

- port \`8081\` is used because the container has occupied the port \`8080\` by some process.

- We build the image in two stages, but you can also build the \`jar\` file in your CI worker node, so this step is not necessary.

- In the second stage we keep using \`COPY . .\` because we need the stored tokens for sending email by GMail Service, as well as the GCP credential in json format.

### Find out the jar Filename

We can run the gradle build command once to verify the exact name of the \`jar\` file:

![](/assets/img/2024-09-12-08-49-07.png)

and the build will be located at:

![](/assets/img/2024-09-12-08-49-44.png)

### \\_\\_cacert_entrypoint.sh: exec format error

- From ChatGPT:

  > The error message "\\_\\_cacert*entrypoint.sh: exec format error" typically occurs in Docker when there's a \\*\\*\\_mismatch between the architecture*\\*\\* of the system running the container and the architecture for which the executable file was compiled. This often happens when trying to run an image built for one architecture (like ARM64) on a different architecture (like x86_64), or vice versa.

- Findout the computer processor architecture used by the docker image
  \`\`\`text
  docker inspect --format='{{.Architecture}}' <your-image-name>
  \`\`\`
- Because I was using macbook air M2 to build the image, the architecture was chosen to be \`ARM64\`.

- If we build the image in another machine, the architecture can be different, so it can vary by using different CI/CD worker node.

- Choose a correct one for the deployment target (in ECS we can choose \`ARM64\` in _task definition_)

### build.gradle.kts

#### Config Main Class for the Jar file

\`\`\`kts
tasks.getByName<Jar>("jar") {
    manifest {
        attributes["Main-Class"] = "com.billie.payment.PaymentApplication Kt"
    }
}
\`\`\`

#### Skip the Test

\`\`\`kts
tasks.named<Test>("test") {
    enabled = false
}
\`\`\`

#### Adjust the Application.kt

\`\`\`kotlin
@EnableScheduling
@SpringBootApplication
class PaymentApplication {
    companion object {
        @JvmStatic
        fun main(args: Array<String>) {
            runApplication<PaymentApplication>(*args)
        }
    }

    @Autowired
    fun someOtherInitization(someResource: SomeResource) {

    }
}
\`\`\`

### Weird Healthcheck Failure due to slow Startup Time in ECS, Causing Rollback

#### Problem

If we keep health-check default config (fired per 5 seconds, 3 consecutive success as healthy, etc), then we will be being led to the following failure

![](/assets/img/2024-09-14-16-43-08.png)

which prevents ECS from rolling-update the service into latest image.

#### Solution

- Edit health-check config in our target group:

  ![](/assets/img/2024-09-14-16-44-54.png)

- Change the setting as follows:

  ![](/assets/img/2024-09-14-16-45-34.png)
`;export{e as default};
