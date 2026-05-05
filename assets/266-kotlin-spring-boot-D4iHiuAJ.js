const e=`---
title: "① Spring boot in Kotlin with JOOQ and Prisma ② Simple Commands for Gradles ③ Integration and Unit Tests"
date: 2024-06-15
id: blog0266
tag: kotlin, springboot, sql, jooq, test
intro: "Record the setup of a spring boot project with JOOQ."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

### build.gradle.kt

In ***Spring Initializr*** choose \`gradle-kotin\`, \`kotlin\`, and choose whatever starter-project that you have seen in the implementation part of the gradle file, namely:
\`\`\`text
implementation("org.springframework.boot:spring-boot-starter-data-jpa")
implementation("org.springframework.boot:spring-boot-starter-jooq")
implementation("org.springframework.boot:spring-boot-starter-validation")
implementation("org.springframework.boot:spring-boot-starter-web")
\`\`\`
The complete gradle file is as follow:
\`\`\`kt
import org.jooq.meta.jaxb.*
import org.jooq.codegen.GenerationTool
import org.jooq.meta.jaxb.Target

val jooqVersion = "3.19.9"
val srcPackage = "com.<company-name>.infrastructure"

group = "com.<company-name>.infrastructure"
version = "0.0.1-SNAPSHOT"

buildscript {
    val jooqVersion = "3.19.9"
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.jooq:jooq-codegen:$jooqVersion")
        classpath("org.postgresql:postgresql:42.3.5")
    }
}

repositories {
    google()
    mavenCentral()
}

plugins {
    id("org.springframework.boot") version "3.3.0"
    id("io.spring.dependency-management") version "1.1.5"
    kotlin("plugin.jpa") version "1.9.24"
    kotlin("jvm") version "1.9.24"
    kotlin("plugin.spring") version "1.9.24"
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    compileOnly("org.jooq:jooq:$jooqVersion")
    compileOnly("org.jooq:jooq-codegen:$jooqVersion")
    runtimeOnly("org.postgresql:postgresql:42.3.5")

    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-jooq")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("io.github.oshai:kotlin-logging-jvm:5.1.0")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webflux")

    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    testImplementation("io.mockk:mockk:1.13.11")
    testImplementation("com.ninja-squad:springmockk:4.0.2")
//    testImplementation("io.projectreactor:reactor-test")
}

tasks.create("generate") {
    println(projectDir.toString() + "main/kotlin")
    GenerationTool.generate(
        Configuration()
            .withJdbc(
                Jdbc()
                    .withDriver("org.postgresql.Driver")
                    .withUrl("jdbc:postgresql://localhost:5432/pgdb")
                    .withUser("pguser")
                    .withPassword("pguser")
            )
            .withGenerator(
                Generator()
                    .withName("org.jooq.codegen.KotlinGenerator")
                    .withDatabase(Database().withInputSchema("public"))
                    .withGenerate(
                        Generate()
                            .withPojos(true)
                            .withDaos(true)
                            .withSpringAnnotations(true)
                            .withJpaAnnotations(true)
                            .withKotlinNotNullPojoAttributes(true)
                            .withKotlinDefaultedNullablePojoAttributes(true)
                    )
                    .withTarget(
                        Target()
                            .withPackageName("$srcPackage.db")
                            .withDirectory("$projectDir/src/main/kotlin")
                    )
            )
    )
}

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

sourceSets {
    test {
        java {
            setSrcDirs(listOf("src/test/integration", "src/test/unit"))
        }
    }
}
\`\`\`

### Installation of Gradle and a few Commands
- First install \`Java\` if you haven't:
  - https://hackmd.io/nyCmAmrORoaMd2GPCEiNkA
- Install \`gradle\`, for windows we can execute the following in powershell:
  \`\`\`text
  choco install gradle
  \`\`\`
- Note that the installation of \`gradle\` is not compulsory, alternatively we can run \`gradle\` inside the spring boot project by 
  \`\`\`text
  /gradlew -q :<the-command>
  \`\`\`
  For example, the following are equivalent:
  \`\`\`bash
  ./gradlew -q :tasks --all
  gradle tasks --all  # in case you have gradle installed
  \`\`\`
- Suppose that you have a working database in \`dev\`, simply run 
  \`\`\`text
  ./gradlew -q :generate
  gradle generate
  \`\`\`
  to generate code in kotlin. Where \`generate\` is a task defined in \`tasks.create("generate") { ... }\` inside \`build.gradle.kt\`.
 
- Clear resinstall all dependencies:
  \`\`\`text
  gradle build --refresh-dependencies
  \`\`\`

### Prisma and JOOQ
#### The Simple Schema
\`\`\`prisma
datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
}

model Course {
    id             String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
    name           String
    category       String
    Teacher        Teacher?             @relation(fields: [teacherId], references: [id])
    teacherId      Int?
    approvalStatus CourseApprovalStatus @default(PENDING)
}

enum CourseApprovalStatus {
    PENDING
    APPROVED
}

model Teacher {
    id     Int      @id @default(autoincrement())
    name   String
    Course Course[]
}
\`\`\`

#### JOOQ Code Generation and JPA Annotation for Data Validation
After we have executed \`gradle generate\`, the following will be generated:

![](/assets/img/2024-06-15-22-27-25.png)

In case you are curious about the detail inside the files, see [***this link***](https://github.com/machingclee/2024-06-15-JOOQ-Kotlin-Springboot/tree/main/src/main/kotlin/com/kotlinspring/db)

- Here \`Pojo\`s are used to communicated with \`DAO\`s
- We can make use of \`DAO\`'s to perform very simple and basic \`CRUD\`.
- For complicated query we make use of classes inside \`references/{Course, Teacher}\` in the next section

The resulting geneated POJO is of the form:

![](/assets/img/2024-06-16-18-17-10.png)

#### Data Persistence with DAO.insert() or db.insertInto()
Consider the folloing \`CourseService\` class:
\`\`\`java
@Service
class CourseService(
    val db: DSLContext,
    val courseRepository: CourseRepository
) {
    companion object {
        var logger: KLogger = KotlinLogging.logger {}
    }

    fun addCourse(courseDTO: CourseDTO): CourseDTO? {
        val course = Course()
        course.name = courseDTO.name
        course.category = courseDTO.category
        course.approvalstatus = courseDTO.approvalStatus
        val courseEntity = courseRepository.save(course)

        logger.info {
            "Save Course is $courseEntity"
        }

        return if (courseEntity != null) {
            CourseDTO(courseEntity.id!!, courseEntity.name!!, courseEntity.category!!, courseEntity.approvalstatus!!)
        } else {
            null;
        }
    }
    ...
}
\`\`\`

Here \`courseRepository.save(course)\` can be implemented in two ways:

\`\`\`java
@Repository
class CourseRepository(
    private val db: DSLContext,
    private val courseDao: CourseDao
) {
    fun save(course: Course): Course? {
        //  or simply courseDao.insert(course)
        val result = db.insertInto(COURSE, COURSE.NAME, COURSE.CATEGORY, COURSE.APPROVALSTATUS)
            .values(course.name, course.category, course.approvalstatus)
            .returning()
            .fetchOneInto(Course::class.java)

        return result
    }
}
\`\`\`
Unfortunately the \`DAO.insert()\` method cannot return anything just saved (like the \`id\`). We are forced to use \`db.insertInto\` in case we need it.

#### Query by Autogeneated Reference Table Object

\`\`\`java
@Service
class CourseService(
    val db: DSLContext,
    val courseRepository: CourseRepository
) {
    companion object {
        var logger: KLogger = KotlinLogging.logger {}
    }
    ...
    // for nested records
    // https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/nested-records/
    // https://blog.jooq.org/jooq-3-15s-new-multiset-operator-will-change-how-you-think-about-sql/
    // https://stackoverflow.com/questions/32332729/jooq-query-with-nested-list
    // https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/multiset-value-constructor/
    // https://www.jooq.org/doc/latest/manual/sql-execution/fetching/ad-hoc-converter/
    // for transaction: https://www.jooq.org/doc/latest/manual/sql-execution/transaction-management/
    fun getTeachers(teacherId: Int): TeacherDetail? {
        val courseResult =
            db
                .select(
                    TEACHER.NAME.\`as\`("teacherName"),
                    multiset(
                        select(
                            COURSE.NAME.\`as\`("courseName"),
                            COURSE.CATEGORY.\`as\`("courseCategory")
                        )
                            .from(COURSE)
                            .where(COURSE.TEACHERID.eq(TEACHER.ID))
                    ).\`as\`("courses").convertFrom { it.into(CourseDetail::class.java) }
                )
                .from(TEACHER)
                .where(TEACHER.ID.eq(teacherId))
                .fetchOneInto(TeacherDetail::class.java)
        return courseResult
    }
}
\`\`\`
The direct output in postman becomes 

![](/assets/img/2024-06-15-22-41-40.png)



### Tests

#### Integration Test
\`\`\`java
package com.kotlinspring.controller

import com.kotlinspring.config.DSLContextConfig
import com.kotlinspring.db.enums.Courseapprovalstatus
import com.kotlinspring.db.tables.daos.CourseDao
import com.kotlinspring.dto.CourseDTO
import com.kotlinspring.repository.CourseRepository
import com.kotlinspring.service.CourseService
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest

import org.springframework.context.annotation.Import
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.ContextConfiguration
import org.springframework.test.web.reactive.server.WebTestClient


@WebFluxTest
@ActiveProfiles("default", "test")
@ContextConfiguration(classes = [DSLContextConfig::class])
@Import(CourseController::class, CourseService::class, CourseRepository::class, CourseDao::class)
class CourseControllerIntegrationTest {
    @Autowired
    lateinit var webTestClient: WebTestClient

    @Test
    fun addCourse() {
        val courseDTO = CourseDTO(null, "Build Nice Course", "James Lee", Courseapprovalstatus.APPROVED)
        val savedCourseDTO = webTestClient.post().uri("/v1/courses")
            .bodyValue(courseDTO)
            .exchange()
            .expectStatus().isCreated
            .expectBody(CourseDTO::class.java)
            .returnResult()
            .responseBody
        Assertions.assertTrue { savedCourseDTO!!.id != null }
        Assertions.assertTrue { savedCourseDTO!!.approvalStatus == Courseapprovalstatus.APPROVED }
        Assertions.assertTrue { savedCourseDTO!!.approvalStatus != Courseapprovalstatus.PENDING }
    }
}
\`\`\`

On test succeeds:

![](/assets/img/2024-06-15-22-44-19.png)

#### Unit Test (with Mocking)


\`\`\`java
package com.kotlinspring.controller

import com.kotlinspring.data.CourseDetail
import com.kotlinspring.data.TeacherDetail
import com.kotlinspring.dto.GetTeacherResponseDTO
import com.kotlinspring.service.CourseService
import com.ninjasquad.springmockk.MockkBean
import io.mockk.every
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.test.web.reactive.server.WebTestClient

@WebMvcTest(controllers = [CourseController::class])
@AutoConfigureWebTestClient
class CourseControllerUnitTest(
    @Autowired var webTestClient: WebTestClient
) {
    @MockkBean
    lateinit var courseServiceMock: CourseService

    @Test
    fun getTeachers() {
        val name = "James Lee"

        every {
            courseServiceMock.getTeachers(any())
        } returns TeacherDetail("James", listOf<CourseDetail>())

        val result = webTestClient.get().uri("/v1/teachers/\${1}")
            .exchange()
            .expectStatus().is2xxSuccessful
            .expectBody(GetTeacherResponseDTO::class.java)
            .returnResult()
            .responseBody

        Assertions.assertTrue { result?.numOfClass == 0 }
    }
}
\`\`\`
Note that we have intentionally make some operation after \`courseServiceMock.getTeachers\` in the \`courseController\`, see [***here***](https://github.com/machingclee/2024-06-15-JOOQ-Kotlin-Springboot/blob/main/src/main/kotlin/com/kotlinspring/controller/CourseController.kt) for detail.`;export{e as default};
