const n=`---
title: "Spring Boot Startup Execution Order, and Place for Database Data Initialization"
date: 2026-04-25
id: blog0488
tag: springboot
toc: true
intro: "Study on integraing application into spring"
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table td:first-child, table th:first-child {
    min-width: 120px;
  }
</style>

### The Problem: Where Do We Initialize Database Data?

A common need in Spring Boot applications is **seeding or resetting data at startup** — for example, setting all task statuses back to \`PENDING\` after a server restart, or pre-populating a lookup table.

The question is: **which lifecycle hook is the right place to do this?**

We have two main candidates: \`@PostConstruct\` and \`ApplicationRunner\`. Choosing the wrong one can cause runtime errors that are hard to debug — a \`@Repository\` or \`EntityManager\` that looks wired but isn't fully ready yet will throw a \`NullPointerException\` or a JPA initialization error silently during startup.

This article walks through the Spring Boot startup sequence to show exactly **why \`ApplicationRunner\` is the safe choice for database work**, and when \`@PostConstruct\` is appropriate instead.

---

### Full Sequence

\`\`\`plantuml
@startuml
skinparam defaultFontName Helvetica
skinparam defaultFontSize 16
skinparam ArrowColor #555555
skinparam RectangleBorderColor #888888
skinparam RectangleBackgroundColor #F9F9F9
skinparam RectangleRoundCorner 12

rectangle "1. Bean instantiation &\\nconstructor injection" as S1
rectangle "2. @PostConstruct methods" as S2
rectangle "3. Full ApplicationContext\\nrefresh completes" as S3
rectangle "4. ApplicationRunner /\\nCommandLineRunner execute\\n(safe for DB work)" as S4
rectangle "5. Embedded server starts\\naccepting HTTP requests\\n(AFTER runners finish)" as S5

S1 -down-> S2
S2 -down-> S3
S3 -down-> S4
S4 -down-> S5
@enduml
\`\`\`

The embedded server (Tomcat/Netty) will open its ports **only after** all of the \`ApplicationRunner\`s have returned.


This is enforced inside \`SpringApplication.run()\`:

\`\`\`plantuml
@startuml
skinparam defaultFontName Helvetica
skinparam defaultFontSize 16
skinparam ArrowColor #555555
skinparam RectangleBorderColor #888888
skinparam RectangleBackgroundColor #F9F9F9
skinparam RectangleRoundCorner 12

rectangle "SpringApplication.run()" as Start
rectangle "refreshContext()" as A
rectangle "afterRefresh()" as B
rectangle "startedContext()" as C
rectangle "Ready to handle\\nHTTP requests" as D

Start -down-> A
A -down-> B : wires all beans
B -down-> C : ApplicationRunners execute
C -down-> D : server opens port,\\naccepts requests
@enduml
\`\`\`



### \`ApplicationRunner\`

#### Imports

\`ApplicationRunner\` comes from Spring Boot — no extra dependency needed beyond \`spring-boot-starter\`:

\`\`\`kotlin
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.core.annotation.Order
import org.springframework.core.Ordered
import org.springframework.stereotype.Component
\`\`\`

#### Example

\`\`\`kotlin
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class TableInitializer(
    private val myRepository: MyRepository
) : ApplicationRunner {

    override fun run(args: ApplicationArguments) {
        myRepository.reinitStatus()
    }
}
\`\`\`

Use \`@Order(Ordered.HIGHEST_PRECEDENCE)\` when we have multiple runners and need this one to go first.

#### Why Repositories Are Safe Inside \`ApplicationRunner\`

**"Safe"** here means the JPA infrastructure is fully initialized — \`EntityManagerFactory\`, the \`DataSource\` connection pool, and all \`@Repository\` proxies are ready to accept calls. 

Attempting the same DB work inside \`@PostConstruct\` is risky because that hook fires during bean creation, before the full context refresh completes: JPA proxies may exist as objects but their underlying infrastructure may not be wired yet, leading to \`LazyInitializationException\` or \`NullPointerException\` at runtime.

By the time \`ApplicationRunner.run()\` is called, the full \`ApplicationContext\` is refreshed:

| Infrastructure | Status |
|---|---|
| \`EntityManagerFactory\` | Initialized |
| \`DataSource\` connection pool | Open |
| \`@Repository\` proxies | Fully wired |
| Transaction manager | Ready |

---

### \`@PostConstruct\`

#### Imports

\`@PostConstruct\` is part of the Jakarta EE annotations, available in Spring Boot via \`spring-boot-starter\` (bundled through \`jakarta.annotation-api\`):

\`\`\`kotlin
import jakarta.annotation.PostConstruct
import org.springframework.stereotype.Component
\`\`\`

**Remark.** For older Spring Boot 2.x projects still on Java EE, the import is \`javax.annotation.PostConstruct\` instead.

#### Example

\`\`\`kotlin
@Component
class CacheWarmer(
    private val configProperties: ConfigProperties
) {
    private lateinit var allowedRoles: Set<String>

    @PostConstruct
    fun init() {
        // runs after this bean is fully wired, safe for in-memory work
        allowedRoles = configProperties.roles.toSet()
    }
}
\`\`\`

---

### \`@PostConstruct\` vs \`ApplicationRunner\`

| | \`@PostConstruct\` | \`ApplicationRunner\` |
|---|---|---|
| Timing | During bean creation | After full context startup |
| Repositories safe to use | Risky (JPA infra may not be ready) | Always safe |
| Order control | \`@DependsOn\` | \`@Order(n)\` |
| Server accepting requests | Not yet | Not yet (both run before) |
| Recommended for DB init | No | Yes |

---

### Rule of Thumb
- Use \`@PostConstruct\` for pure in-memory initialization;

- Use \`ApplicationRunner\` for anything touching the database or other fully-wired Spring infrastructure.
`;export{n as default};
