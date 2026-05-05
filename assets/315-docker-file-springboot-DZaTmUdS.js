const n=`---
title: "Dockerfile for Springboot Application in Gradle"
date: 2024-08-17
id: blog0315
tag: springboot, docker
toc: true
intro: "Record a two-stage docker file for building springboot application."
img: docker
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Dockerfile.{uat, prod}

\`\`\`dockerfile
FROM gradle:8.10.0-jdk21-alpine AS build
WORKDIR /app
COPY . .
RUN gradle clean build --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/payment-0.0.1-SNAPSHOT.jar .
CMD ["java","-Dspring.profiles.active=uat", "-jar", "payment-0.0.1-SNAPSHOT.jar"]
\`\`\`

- Replace \`uat\` by \`prod\` for \`Dockerfile.prod\`.

### build.gradle.kts

\`\`\`kotlin{9,25}
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

group = "com.machingclee"
version = "0.0.1-SNAPSHOT"
java.sourceCompatibility = JavaVersion.VERSION_21

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict")
    }
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinJvmCompile>().configureEach {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_21)
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.getByName<Jar>("jar") {
    manifest {
        attributes["Main-Class"] = "com.machingclee.payment.PaymentApplicationKt"
    }
}
\`\`\`

- \`-Xjsr305=strict\` is required to let compiler run for nullity type-check.

- Because we are using \`kotlin\`, make sure to add a \`Kt\` suffix in the classname:

  ![](/assets/img/2024-08-17-21-45-00.png)`;export{n as default};
