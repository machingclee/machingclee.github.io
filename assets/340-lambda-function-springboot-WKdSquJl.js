const e=`---
title: "Snapstarted Lambda running Spring Boot and Transition into Spring Boot as a Node.js Developer"
date: 2024-11-16
id: blog0340
tag: springboot, aws, lambda, serverless
toc: true
intro: "Record miscellaneous detail of transitioning into Spring Boot as a node.js developer."
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Lambda function configuration

#### serverless.yml

Note that the highlighted line enables us to snapshot a lambda function:

\`\`\`yml{15}
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
\`\`\`

Here \`%cd%\` is for windows machine, if you are using linux, please change it to \`$(pwd)\`.

#### The LambdaHandler

\`\`\`kotlin
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
\`\`\`

#### Minimal build.gradle.kts for a Complete Project

\`\`\`kts
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
\`\`\`

### Spring Boot in Node.js Developer Perspective

#### Replacement of Middleware by AOP Programming

In node.js we usually write

\`\`\`ts
app.use("/file", jwtAuthMiddleware, fileRouter);
app.use("/search", jwtAuthMiddleware, searchRouter);
\`\`\`

to validate incoming requests or to inject desired object into our **_context_** object before reaching any of our routers (in \`express\` case, the context is our \`req\`).

##### \`Filter\` and \`HandlerInterceptor\`, no, not what we want

In spring boot there are two similar concepts that serve this purpose:

- \`Filter\` (Servlet Level)
- \`Interceptor\` (Application Level in which \`@Bean\`'s are available)

The drawback using these approches is the interception is **_highly implicit_**. For example, to add an interceptor at applicaiton level we need to define our customer \`HandlerInterceptor\` class object and add it manually:

\`\`\`kt
@Configuration
class JwtWebMvcConfigurer(
    private val jwtHandlerInterceptor: JwtHandlerInterceptor
) : WebMvcConfigurer {

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(jwtHandlerInterceptor).addPathPatterns("/course/**")
    }
}
\`\`\`

Adding a filter follows a simular pattern.

##### Adding middleware via direct annotation

Instead we can annotate a controller by \`@AccessToken\` which do all the token-validation and "user-data-injection" for us:

\`\`\`kt{3}
@RestController
@RequestMapping("/hello")
@AccessToken
class HelloController(
    @Value("\\\${stage.env}") private val env: String,
    private val orderRepository: OrderRepository,
    private val eventRepository: EventRepository,
    private val gmailService: GmailService,
    private val roleRepository: RoleRepository,
) {
    @GetMapping("/create-relation")
    @Transactional
    ...
\`\`\`

Let's define our \`@AccessToke\`!

##### Define an Aspect Triggered by \`@AccessToken\`

\`\`\`kt
package com.your.package.commons.aop

import com.wonderbricks.billie.service.JwtPayload
import com.wonderbricks.billie.service.JwtService
import org.aspectj.lang.annotation.Aspect
import org.aspectj.lang.annotation.Pointcut
import org.springframework.stereotype.Component
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes
import io.fusionauth.jwt.JWTExpiredException
import org.aspectj.lang.ProceedingJoinPoint
import org.aspectj.lang.annotation.Around
import org.aspectj.lang.reflect.MethodSignature

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class AccessToken

@Target(AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
annotation class RequestUser

@Aspect
@Component
class AccessTokenAspect(private val jwtService: JwtService) {
    private val authHeader: String = "authorization"

    @Pointcut("@within(com.wonderbricks.billie.commons.aop.AccessToken)")
    fun getUserPointcut() {
    }

    @Around("getUserPointcut()")
    fun logBefore(joinPoint: ProceedingJoinPoint): Any? {
        val requestAttributes = RequestContextHolder.getRequestAttributes() as? ServletRequestAttributes
        val request = requestAttributes?.request
        try {
            val accessToken = request?.getHeader(authHeader)?.replace("Bearer ", "") ?: ""
            if (accessToken == "") {
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
    }
}
\`\`\`

For more refined access control using custom annotations, we may simply ask chat-gpt for the code implementation.

##### \`HandlerMethodArgumentResolver\`: Configure Spring Boot to Resolve \`@RequestUser\`

We want to access our data annotated by \`@RequestUser\` in the same fashion as \`@RequestBody\`.

However by default spring boot will validate all parameters passing through the argument of each method (e.g., \`@RequestBody\` or \`@PathVariable\`), in which it has no idea how to validate our \`@RequestUser\`-annotated data.

Therefore we need to make configuration to let spring boot ignore this annotation in the input argument of a controller method:

\`\`\`kt
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
\`\`\`

Now we get the parsed user object easily via anntation!

![](/assets/img/2024-11-16-18-38-00.png)

#### File Uploading

In node.js we handle file uploading (with \`formdata\` as request body) by using

\`\`\`js
import multiparty from "multiparty";

const handler = (req: Request, res: Response) => {
    const form = new multiparty.Form();
    form.parse(req);
    form.on("part", async (inputStream: multiparty.Part) => {
        ...
    })
}
\`\`\`

Now in spring boot:

\`\`\`kt
@PostMapping("/upload)
fun fileUpload(@RequestPart("file") file: MultipartFile?) {
    val uploadFile = file?.inputStream?.let {
        ...
    }
}
\`\`\`

Remember to enable \`Multipart\` file option:

\`\`\`yml
# appplication.yml
spring:
  servlet:
    multipart:
      enabled: true
      max-file-size: 10MB
      max-request-size: 10MB
\`\`\`

#### JPA using relation tables

##### The Prisma Model

By mentioning Prisma with spring boot, it implicitly means that we are using database-first approach. Therefore we need to reverse-engineer existing database into jpa \`@Entity\` classes. We have mentioned how to do it in [**_this article_**](/blog/article/JPA-with-DB-First-Approach-Surgery-on-JOOQ-s-POJO-into-Base-Entity-Class) with the help of JOOQ.

Beware of the detail of:

- how to handle PostgreSQL enums and
- how to config PostgreSQL to enclose the table name in every single query by double quotes.
  These are discussed in depth in the article as well.

Let's read about a prisma definition of our 3 tables, which is basically a **_one-to-many_** model (one role has many permissions):

\`\`\`prisma
model Role {
  id                String                @id @default(dbgenerated("ulid_as_uuid()")) @db.Uuid
  name              String
  displayName       String
  description       String
  createdAt         Float                 @default(dbgenerated("gen_created_at()"))
  createdAtHK       String                @default(dbgenerated("gen_created_at_hk_timestr()"))
  updatedAt         Float                 @default(0)
  RelRolePermission Rel_Role_Permission[]
  RelProjectRole    Rel_Project_Role[]

  @@unique([name])
  @@index([id])
}

model Permission {
  id                String                @id @default(dbgenerated("ulid_as_uuid()")) @db.Uuid
  codeName          String
  displayName       String
  description       String
  createdAt         Float                 @default(dbgenerated("gen_created_at()"))
  createdAtHK       String                @default(dbgenerated("gen_created_at_hk_timestr()"))
  updatedAt         Float                 @default(0)
  RelRolePermission Rel_Role_Permission[]

  @@unique([codeName])
  @@index([id])
}

model Rel_Role_Permission {
  id           Int        @id @default(autoincrement())
  roleId       String     @db.Uuid
  Role         Role       @relation(fields: [roleId], references: [id])
  permissionId String     @db.Uuid
  Permission   Permission @relation(fields: [permissionId], references: [id])
  createdAtHK  String     @default(dbgenerated("gen_created_at_hk_timestr()"))
  createdAt    Float      @default(dbgenerated("gen_created_at()"))
  updatedAt    Float      @default(0)

  @@unique([permissionId, roleId])
  @@index([permissionId, roleId])
}
\`\`\`

##### The JPA Equivalent Definition

Now let's try to model this relation by an \`@Entity\` class in \`jpa\`:

\`\`\`kt
@Entity
@DynamicInsert
@Table(
    name = "Role",
    schema = "public"
)
class Role(
    @Id
    @Column(name = "id")
    @GeneratedValue(generator = "ulid_as_uuid")
    var id: UUID? = null,
    @Column(name = "name", nullable = false)
    var name: String,
    @Column(name = "displayName", nullable = false)
    var displayname: String,
    @Column(name = "description", nullable = false)
    var description: String,
    @Column(name = "createdAt")
    var createdat: Double? = null,
    @Column(name = "createdAtHK")
    var createdathk: String? = null,
    @Column(name = "updatedAt")
    var updatedat: Double? = null
) {
    @OneToMany
    @Cascade(CascadeType.ALL)
    @JoinTable(
        name = "\\"Rel_Role_Permission\\"",
        joinColumns = [JoinColumn(name = "roleId", referencedColumnName = "id")],
        inverseJoinColumns = [JoinColumn(name = "permissionId", referencedColumnName = "id")]
    )
    val permissions: MutableSet<Permission> = mutableSetOf()
}
\`\`\`

- Note that our relation table name must be **_enclosed by double quotes_** due to the presence of capital letters.
- We use \`@Cascade(CascadeType.ALL)\` to ask \`jpa\` to help us persist the in-memory state of \`Rel_Role_Permission\` and \`Permission\` tables.

  Note that we even didn't mention the presense of the \`Permission\` table in our \`@JoinTable\` definition! It is implicit in our foreign-key relation (if defined correctly).

##### The Magic Happens

Now in the past when creating a relation with data-centric approach we need to

1. persist an entity in \`Role\`
2. persist an entity in \`Permission\`
3. finally persist an entity in \`Rel_Role_Permission\`

Now the creation of these entities boils down to an object-oriented orchestration:

\`\`\`kt
@Transactional
fun createRoleAndPermission () {
    val newRole = Role(name = "TEST_ROLE",
                       displayname = "Test Role",
                       description = "This is a test role")
    val newPermission = Permission(codename = "TEST_PERMISSION_$index",
                                   displayname = "Test Permission $index",
                                   description = "this is a test permission number $index")
    newRole.add(newPermission)
    roleRepository.save(newRole)
}
\`\`\`

and 3 entities are persisted automatically.

##### The $N+1$ Problem

In spring boot there is a well-known trap for beginners called $N+1$ problem. Which basically means

- $\\Large \\mathbf 1$ query for fetching $N$ entities and
- each of $\\Large \\mathbf N$ entities dispatches one **_additional_** query;
  causing a total of $N+1$ queries for a single data-fetching.

Let's explain it and solve it by a concrete example. But before that let's add the following to investigate the generated SQL:

\`\`\`yml
# application.yml

spring:
  jpa:
    open-in-view: false
    show-sql: true
    properties:
      hibernate:
        format_sql: true
\`\`\`

Now consider the following relations:

![](/assets/img/2024-11-21-00-52-22.png)

which by code is modelled as follows:

\`\`\`kt
class Projectmember(
    @Id
    @Column(name = "id")
    @GeneratedValue(generator = "ulid_as_uuid")
    var id: UUID? = null,
    @Column(name = "userId", nullable = false)
    var userid: UUID,
    @Column(name = "roleId", nullable = false)
    var roleid: UUID,
    @Column(name = "createdAt")
    var createdat: Double? = null,
    @Column(name = "createdAtHK")
    var createdathk: String? = null,
) {
    @OneToOne
    @JoinTable(
        name = "Rel_Project_ProjectMember",
        joinColumns = [JoinColumn(name = "projectMemberId", referencedColumnName = "id")],
        inverseJoinColumns = [JoinColumn(name = "projectId", referencedColumnName = "id")]
    )
    var project: Project? = null
}
\`\`\`

Suppose that we run

\`\`\`kt
@Transactional
fun getMembersRecord() {
    return projectMemberRepository.findByUserid(UUID.fromString(userId))
}
\`\`\`

then we get two records from our database:

![](/assets/img/2024-11-21-00-55-23.png)

**_Trouble Happended._** Since we directly return the result, behind the scene an eager-loading is triggered to dispatch **_2 additional_** queries due to the \`@OneToOne\` relation (the case is worse if it is \`@OneToMany\`), resulting in $2+1$ queries:

\`\`\`text
Hibernate:
    select
        p1_0."id",
        p1_0."createdAt",
        p1_0."createdAtHK",
        p1_0."roleId",
        p1_0."userId",
        p1_1."projectId"
    from
        "public"."ProjectMember" p1_0
    left join
        "Rel_Project_ProjectMember" p1_1
            on p1_0."id"=p1_1."projectMemberId"
    where
        p1_0."userId"=?
Hibernate:
    select
        p1_0."id",
        p1_0."address",
        p1_0."avatarUrl",
        p1_0."companyId",
        p1_0."createdAt",
        p1_0."createdAtHK",
        p1_0."lat",
        p1_0."long",
        p1_0."name",
        p1_0."region",
        p1_0."userId",
        p1_0."utc"
    from
        "public"."Project" p1_0
    where
        p1_0."id"=?
Hibernate:
    select
        p1_0."id",
        p1_0."address",
        p1_0."avatarUrl",
        p1_0."companyId",
        p1_0."createdAt",
        p1_0."createdAtHK",
        p1_0."lat",
        p1_0."long",
        p1_0."name",
        p1_0."region",
        p1_0."userId",
        p1_0."utc"
    from
        "public"."Project" p1_0
    where
        p1_0."id"=?
\`\`\`

To solve it, in our repository we add:

\`\`\`kt{3}
interface ProjectMemberRepository : CrudRepository<Projectmember, UUID> {
    // or @EntityGraph(attributePaths = ["project"])
    @Query("SELECT pm FROM Projectmember pm LEFT JOIN FETCH pm.project where pm.userid = ?1")
    fun findByUserid(userid: UUID): List<Projectmember>?
}
\`\`\`

Now our new results are all fetched by simply one query!

\`\`\`text
Hibernate:
    select
        p1_0."id",
        p1_0."createdAt",
        p1_0."createdAtHK",
        p1_0."roleId",
        p1_0."userId",
        p2_0."id",
        p2_0."address",
        p2_0."avatarUrl",
        p2_0."companyId",
        p2_0."createdAt",
        p2_0."createdAtHK",
        p2_0."lat",
        p2_0."long",
        p2_0."name",
        p2_0."region",
        p2_0."userId",
        p2_0."utc"
    from
        "public"."ProjectMember" p1_0
    left join
        "Rel_Project_ProjectMember" p1_1
            on p1_0."id"=p1_1."projectMemberId"
    left join
        "public"."Project" p2_0
            on p2_0."id"=p1_1."projectId"
    where
        p1_0."userId"=?
\`\`\`

**Remarks.**

- Here we **_prefer_** to use the JPQL \`@Query\` approach because it provides a certain extent of **_type-safty_** (we even get an auto-completion based on the properties in the class of \`Projectmember\`) while \`@EntityGraph\` does not.

- Also try to avoid having multiple \`left join fetch\`'s in a single JPQL as it might be buggy and not performant:

  > The error **_cannot simultaneously fetch multiple bags_** occurs in JPA when trying to eagerly fetch multiple collection relationships (like @OneToMany or @ManyToMany) in a single query. This is due to limitations in how JPA handles collections with JOIN fetches.

  You can define \`findByUseridFetchA\`, \`findByUseridFetchB\` with different \`left join fetch\` clauses based on your actual need.
`;export{e as default};
