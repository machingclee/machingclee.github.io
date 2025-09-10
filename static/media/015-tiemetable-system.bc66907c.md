---
id: portfolio015
title: "Commercial Timetable System for an Art School"
intro: Manage timetable for teachers and automate the payment notification.
thumbnail: /assets/img/2025-09-06-12-35-35.png
tech: Vite; Express; PGSQL, Lambda Function,  Domain Driven Design, Spring Boot
thumbWidth: 600
thumbTransX: -200
thumbTransY: -220
hoverImageHeight: 160
date: 2025-09-06

---

<style>
    video {
      border-radius: 4px;
      max-width: 660px;
    }
    img{
        margin-top: 10px;
        margin-bottom: 10px;
        max-width: 660px;
    }
    /* Alternative solid color version */
    .download-btn-solid {
      background: #3b82f6;
      border: none;
      border-radius: 8px;
      color: white;
      cursor: pointer;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 16px;
      font-weight: 600;
      padding: 6px 24px;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
      margin-bottom: 20px;
    }

    .download-btn-solid:hover {
      background: #2563eb;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }
    table{

      width: 100%;
      td, th {
        padding: 5px 10px;
      }
      tr:nth-child(2n){
        background-color: rgba(0,0,0,0.05);
      }
      td:nth-child(1) {
        vertical-align: top;
        width:170px;
      }
    }
</style>

<Center>

<a href="/assets/img/2025-09-06-12-40-32.png">
<img src="/assets/img/2025-09-06-12-40-32.png" />
</a>


</Center>

#### Who is this System For? 
This is a timetable system developed for an art school  [木棉花水墨畫室](https://www.cottontreeinkart.com).



<!-- 


#### Something to be Skipped

This article is mainly a description on how DDD was applied to the project. In order not to distract readers the implementation detail of the following will be skipped:

- How to implement a `commandInvoker` with `eventQueue`

- How to handle synchronous event and transactional event in custom `eventQueue`.
- How to interact with existing database using JPA

etc. -->

#### Sample Video

The following is a demonstration of maintaining invariance via policies. We will revisit this video in the upcoming section:

- <customanchor href="/portfolio/Commercial-Timetable-System-for-an-Art-School#New-Business-Logic-Comes!!-Domain-Invariance-via-Policies-for-Open-Closed-Principle-with-Video-Demonstration">New Business Logic Comes‼ Domain Invariance via Policies for Open-Closed Principle with Video Demonstration</customanchor> <p></p>


<iframe width="560"  style="margin-top:10px"  height="315" src="https://www.youtube.com/embed/is70ChP4ubU?si=q2bjsVbAgZVruLwG" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

#### Tech-Stack

|  |  |
|-------|--------------|
| Frontend | • React (Vite) • Redux-RTK-query • Redux-Toolkit • Tailwind |
| Backend |  • ~~Nodejs, Express.js, Prisma, Prisma-Kysely~~ (all deprecated) <br>• Kotlin • Spring Boot • JPA<br>• JOOQ (for entity generation from existing database)|
|Database| • PostgreSQL provided by Neon-tech <br> •  Schema design and migration via Prisma|
|Deployment| <table><tbody><tr><td style="width:150px">• Frontend</td><td>React-build is stored in S3, served by Cloudfront and routed by Route53 for custsom domain</td></tr><tr><td style="width:150px">• Backend</td><td>Snap-started lambda function</td></tr></tbody></table>| 

#### Why DDD? What am I going to solve?

##### Problems of architecture as simple as Controller-Service-Repository (CSR)

In the course of development several backend problems in CSR-architecture pop up easily that I always feel painful:

<Example>

**Problem 1 (No (and not possible to have) clear separation of responsibility among services).**  From CSR point of view, service is just an interface to handle or to break the request into serveral pieces, and *nothing more*, that causes the problem.

As time goes by, developer is easy to build *multiple services* serving a similar purpose. 

Suppose I have a project system, now I want to design a service to let project owner add someone as a member. You can go either way:

- `ProjectService.addMember`

- `MemberService.joinProject`

There is no true or false among the choices, but our domain logic now *can go anywhere*, or even *repeatedly defined* like the `join-project` example above. 

Another common example is to change a column from `true` to `false`, as it may seem too trivial to create a service for that. This is also a domain logic that can be spread everywhere.

</Example>

<Example>

**Problem 2.1 (Side Effects Become a Mess).** When dealing with side effects, namely:
- Some change in a table will cause other events to happen, such as some change in another table or sending notification, etc.

The only way the CSR-architecture can handle it is to *add the handling* of extra logics at the end or even at the middle of *ALL existing related services*.  Problems arise:

- First, the Open-Closed principle is easy to break and maintaining this chain of side effects is exhausting. 

- Second, this kind of side effect is *not easy to be  documented*, the domain logic involved is hard to be traced and hard to be understood by new team members trying to participate in adjusting that domain logic.

</Example>


Worse still, 

<Example>

**Problem 2.2 (Side Effect can be Transactional).** There are two kinds of side effects:

- Atomic

- Non-atomic

Do you want the whole successful transaction be ruined and rollbacked by the failure of sending an email notification? 

It is not trivial to implement a "transactional" side effect (e.g., send the email only when a transaction has been commited), especially when that side effect is dispatched in the middle of a chain of transaction script.

</Example>

##### How does DDD help?

Both problem can be easily solved by the methodology in DDD. 

- **For problem 1**, we handle all the state change from the domain behaviour of an aggregate root. We do all the data modification within the same ***consistency boundary***. 

  If we want to kick a member out of a project, let's fetch the project, and execute 
  ```kotlin
  project.kickMember(member)
  ```
  it is ***impossible*** to do it in the reverse way: `member.leave(project)`, because `member` does not contain enough information to do ***domain logic validation*** (which we call ***invariance*** in DDD). 
  
  For example, assume a project cannot have fewer than 3 persons. A single member does not contain the information of other members, however, a project *does*, which is possible to keep the invariance within itself.

- **For problem 2**, we simply use an event-driven architecture, and DDD is inherently based on ***events***.  DDD's `Command`'s and `Event`s are a good fit for side effects.

  - To solve problem 2.1, the tight coupling of logic can now be decoupled by event and event-handler. 

  
  - To solve problem 2.2, using JPA from the ecosystem of Spring Boot,  atomic side effect can be handled by 
    `@Eventlistener`, and side effect after succeeded transaction can now be handled by `@TransactionalEventListener`.

  Event-Driven architecture can also be a mess ***without documentation*** because `eventHandler` handles the side effect silently. However, if we documentate it properly, then ***everything is explicit***. 


  [![](/assets/img/2025-09-06-18-44-57.png)](/assets/img/2025-09-06-18-44-57.png)

  Now we have a good place to documentate the complex domain requirement. 
  
  We will discuss how we operate with these `Command`, `Event` and `Policy` in depth in the next section.

#### System Design 



##### Overview of Domain Objects Involved 

###### The Class Diagram

[![](/assets/img/2025-09-06-12-42-28.png)](/assets/img/2025-09-06-12-42-28.png)


###### Entities

Simply put, the system has 

- `User`

  The table name is generic, for now they are all ***teachers***, for the future ***there can be parents***, ***students***, etc, by creating the separate tables that refer to `User` (and we need a data migration to migrate users to `teacher` table as well).

- `Student` (Aggregate Root)

  Not able to sign in the system, therefore no reference / Junction Table to our `User` table.

- `Student Package`

  A purchased product of a student. Which records the course, the number of classes, the due date, etc.

  - `Class`

    A unit of scheduled event, including data such as location, time to attend, the class attendence status, etc.

    A class is said to be ***extended*** if it has a non-null reference from `extended_class` table where we place all the extension detail (like reason, extend from which class, etc). 


These are the major entities involved in our system. 

##### Diagram for Event Storming, the Detailed Planning of System Implementation 

Event Storming is an indispensible part of ***D***omain ***D***riven ***D***esign (DDD). This project is also a practice of  abiding by the rules in the design methodology of DDD.

You may ***click*** the following image or download button to get the **PDF**:

[![](/assets/img/2025-09-06-13-07-10.png)](/assets/portfolios/pdfs/timetable.pdf)


<a href="/assets/portfolios/pdfs/timetable.pdf">
<button class="download-btn-solid" >Download</button>
</a>


  

#### Coding Example of Command-Event System

##### Basic user Request with Side Effect

Let's take the following route as an example. The  `ClassesCreatedEvent` is triggered by (at least)  a  `CreateClassesCommand`:

[![](/assets/img/2025-09-06-22-22-35.png)](/assets/img/2025-09-06-22-22-35.png)

Note that `ClassesCreatedEvent` can be a side effect of other commands as well, thus it does not come as a surprise there are 3 incoming routes to this `ClassesCreatedEvent`:

[![](/assets/img/2025-09-06-22-23-51.png)](/assets/img/2025-09-06-22-23-51.png)

This is the power of event driven system, we can trace the potential causes of how would some database changes happen (when documented correctly).


###### Step 1. Invoke the command from controller

Here `Command` and `CommandHandler` replace the ***application service*** layer in DDD. 

`Command` collects all necessary information for the `CommandHandler`, and `Command` itself is a ***simple object for logging!*** (which we will be doing in `CommandInvoker`).

- Command Definition: <br/>
  [![](/assets/img/2025-09-06-22-00-57.png)](/assets/img/2025-09-06-22-00-57.png)

- Invoke a command: <br/>
  [![](/assets/img/2025-09-06-22-00-19.png)](/assets/img/2025-09-06-22-00-19.png)


###### Step 2. Handle the command with invariance within aggregate

Command Handler Definition:
[![](/assets/img/2025-09-06-22-02-16.png)](/assets/img/2025-09-06-22-02-16.png)

Here we have come across a domain behaviour:  
```kotlin
targetPackage.addClasses()
```
domain invariances have been maintained by:

[![](/assets/img/2025-09-08-03-55-47.png)](/assets/img/2025-09-08-03-55-47.png)

<Example>

**Remark.** Here the validation rules are maintained in a separated class, that validation class is linked to the entity class via a function literal ([detail](/blog/article/Code-Separation-of-Domain-Entity-Class-Domain-Behaviour-Actions-and-the-Corresponding-Validations#StduentPackageValidation-Class)). It is to avoid writing everything within the same class.


</Example>

Finally we add an event into `eventQueue` and let `commandInvoker` dispatch it once the command is finished.


###### Step 3. Handle side effects via policies (if any)

Once the `ClassesCreatedEvent` is dispatched, from our implementation diagram it needs to be handled by `ClassOnHolidayMustBeExtendedPolicy`. 

If a class happens to be created on an holiday, we just extend this class (to a makeup lesson) 

[![](/assets/img/2025-09-07-03-01-15.png)](/assets/img/2025-09-07-03-01-15.png)

Note that we also need to handle side effects from other events, as shown in the event-storming diagram!


##### New Business Logic Comes!! Domain Invariance via Policies for Open\-Closed Principle with Video Demonstration

<Example>
New requirements come:

- Any package should have an expiry date. 
- No class of this package can be created beyond this expiry date.

</Example>


There starts to be confusion. We can throw exception in a policy to force JPA to rollback all the relevant changes when handling an event, but the act of maintaining domain invariance should stay within the aggregate, that means we either 
- break the open-closed principle, or 

- break the DDD-spirit of maintaining its own invariance whenever possible (unless cross aggregates invariance happens).

There are always tradeoff for which no option is absolutely correct, we need to strike the balance between code maintainability and methodology. 

If we insist on DDD, then we need to adjust all domain behaviour and add the corresponding validation logic. Doesn't it sound quite simular to the CSR architecture? We lose the advantage of DDD being intrinsically an event-driven design. 



For code maintainability, now we extend the usage of domain events, they are not just for side-effect, but also for invariances. Then we skim through the candidates of events that can possibly break the invariance, now we add a new policy and create the associative arrows:

![](/assets/img/2025-09-10-04-55-02.png)


From coding point of view we get:

[![](/assets/img/2025-09-10-05-00-20.png)](/assets/img/2025-09-10-05-00-20.png)

For a video demostration on the the workflow of UI application being blocked by invariance:

<iframe width="560"  style="margin-top:10px"  height="315" src="https://www.youtube.com/embed/is70ChP4ubU?si=q2bjsVbAgZVruLwG" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

<p></p>

1. We add a class on `2026-10-11` which an expiry date `2026-10-11` on which we cannot add any class any more

 

    **Remark.** The class creation process is taking long for the following reason:
    [![](/assets/img/2025-09-11-07-15-58.png)](/assets/img/2025-09-11-07-15-58.png)

    We need to be rigorous enough to ensure no class conflict can actually happen:
    [![](/assets/img/2025-09-11-07-16-50.png)](/assets/img/2025-09-11-07-16-50.png)



2. We witness an error from backend at the lower right corner corresponding to our backend exception:
    ![](/assets/img/2025-09-10-05-26-15.png)

3. We add a class on `2026-10-10`, it succeeded
4. The class in step 3 is then moved to `2026-10-11`, the domain invariance for `ClassMovedEvent` again throw exception for expiry date:
  ![](/assets/img/2025-09-11-07-09-11.png)

##### Logging 

###### Series of commands and events

When we invoke a command, and when we dispatch an event, we also log down the data in our database:

[![](/assets/img/2025-09-08-09-32-57.png)](/assets/img/2025-09-08-09-32-57.png)

- Here we have `request_id` to group all commands and events coming from the same http request.

- We have also logged the user who make this request

- We have logged all failed commmands as well. 




###### Failure of a command



[![](/assets/img/2025-09-07-03-08-02.png)](/assets/img/2025-09-07-03-08-02.png)

When a command ***fail***, for now we don't have `SomethingFailedEvent`. In the future we can add a try-catch logic in `CommandHandler` to dispatch a ***compensating command*** in the catch flow.




#### Value Objects for Domain Invariance

Value objects are the must-have ingradient of DDD as they are also in charge of maintaining invariance within a domain.

##### @Embedded and @Embeddable


Our `Student` aggregate is define dy

```kt-1{14-15,18-29}
class Student(
    @Id
    @Column(name = "id")
    ...
    @Suppress("INAPPLICABLE_JVM_NAME")
    @set:JvmName("setIsActive")
    var isActive: Boolean? = null,
    @Column(name = "preferred_name")
    var preferredName: String? = null,
    @Column(name = "remark")
    var remark: String? = null,
    @Embedded
    var birthdate: Birthdate,
    @Embedded
    var grade: Grade,
) : AbstractAggregateRoot<Student>() {

    @Embeddable
    data class Grade(
        @Column(name = "grade", nullable = false)
        final val value: String,
    ) {
        init {
            val isValidStringValue = AVAILABLE_GRADES.contains(value)
            if (!isValidStringValue) {
                throw TimetableException("Grades can only be any of ${AVAILABLE_GRADES.toString()}")
            }
        }
    }


    @OneToMany(cascade = [jakarta.persistence.CascadeType.ALL], orphanRemoval = true)
    ...
```

where 

```kt
val AVAILABLE_GRADES = listOf(
        "K1", "K2", "K3",
        "P1", "P2", "P3", "P4", "P5", "P6",
        "F1", "F2", "F3", "F4", "F5", "F6",
        "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G11", "G12"
    )
```

Now invariance is maintained in a much cleaner way! We can think of meaningful application of value objects easily. Such as `Address`, `Email`, `PhoneNumber`, all need to be validated!

<Example>

**Remark.** Without value objects, we would have created a validation method in one of the `Service`'s. 

Again, we eventually would have many validation rules spread to several ***seeminly related*** services. There is no rule to confine the responsibility of a service due to the chaoticity of CSR architecture.  

Maybe we have `CommonValidationService`, we have `StudentValidationService`, or maybe we have a dedicated `EmailValidationService`, you name it.

It sounds horrible, isn't it?




</Example>

##### KspKotlin, Create an Auto-Generated `.toDTO()` method that "flattens" or "unwinds" a value object

We have also configured `KspKotlin` to auto-generate a  `toDTO()` function  that outputs a `DTO` class, which transform the ***snake-cased*** column name (defined in `@Column`) into a ***camel-cased*** name:


<Example>

**Remark.** For detail how to config `kspKotlin`, the reader can refer to my article 
- [Auto-generated Mapper From Entity Classes into DTO Classes](/blog/article/Auto-generated-Mapper-From-Entity-Classes-into-DTO-Classes)

</Example>

```kotlin{9,32}
public data class StudentDTO(
  public val id: UUID?,
  public val firstName: String,
  public val lastName: String,
  public val chineseFirstName: String?,
  public val chineseLastName: String?,
  public val schoolName: String,
  public val studentCode: String?,
  public val grade: String,
  public val phoneNumber: String?,
  public val wechatId: String?,
  public val birthdate: Double,
  public val parentEmail: String,
  public val createdAt: Double?,
  public val createdAtHk: String?,
  public val parentId: UUID?,
  public val gender: Gender,
  public val shouldAutoRenewPackage: Boolean?,
  public val isActive: Boolean?,
  public val preferredName: String?,
  public val remark: String?,
)

public fun Student.toDTO(): StudentDTO = StudentDTO(
    id,
    firstName,
    lastName,
    chineseFirstName,
    chineseLastName,
    schoolName,
    studentCode,
    grade.value,
    phoneNumber,
    wechatId,
    birthdate.value,
    parentEmail,
    createdAt,
    createdAtHk,
    parentId,
    gender,
    shouldAutoRenewPackage,
    isActive,
    preferredName,
    remark,
)
```

When we return frontend a `DTO` object, no code is needed to extract the value from Value Objects.



#### Side Story: The Project is Developed from Nodejs Express, then Transitioned into Kotlin Springboot, but WHY?


##### Examples (SQL-First Approach)

The application is composed of various SQLs when interacting with database:

<Example>


**Example 1 (Complexity Level 1).** The following implicitly executes domain logic via SQL operation
[![](/assets/img/2025-09-07-18-09-07.png)](/assets/img/2025-09-07-18-09-07.png)

</Example>


<Example>

**Example 2 (Complexity Level 2).** The following tries to do two separate `LATERAL JOIN`'s and `Json Aggregate`'s:
[![](/assets/img/2025-09-07-18-03-29.png)](/assets/img/2025-09-07-18-03-29.png)



</Example>




<Example>

**Example 3 (Complexity Level $\infty$).**  The following is taken from a deprecated project:

[![](/assets/img/2025-09-07-18-33-09.png)](/assets/img/2025-09-07-18-33-09.png)


- You need to have the knowledge how `WITH some_table AS (SELECT ...)` works and how to achieve this in other query-builder framework. 

- Plus we still have lateral joins and json aggregates there.

</Example>

<br/>


##### Problems of the SQL-First Approach

1. SQL statements itself is highly unreadable, even there are query builders. 

2. Long SQL is hard to debug, we cannot add a breakpoint to investigate the data.

3. Moreover, the project is now tightly coupled with knowledge from specific SQL. There are those kind of tricks that only appear in  PostgreSQL like we have 
    ```sql
    SELECT DISTINCT ON + ORDER BY
    ``` 
    for data deduplication. But `DISTINCT ON` is Postgre-only. Other example like `ON CONFLICT DO NOTHING`, `JSONB` query, etc, useful queries are Postgre-specific.

##### Short Summary 

In short, when maintainability is our concern, we should reduce SQL as much as possible. We should let framework generate them such as using ORM. 


##### Introduced Event System to Handle side Effects

As mentioned in previous sections, we wish to manage side effect in a clean way. For that I implemented a set of annotations: `@listener`, `@order`, and also classes `Event` and a util function `applicationEventPublisher` that mimics the baviour in spring boot.

[![](/assets/img/2025-09-07-19-01-22.png)](/assets/img/2025-09-07-19-01-22.png)

<Example>

**Remark.** For a more detailed summary on how to implement annotation in typescript, the reader can refer to this article: 

- [ApplicationEventPublisher with Decorators for Domain Driven Design](/blog/article/ApplicationEventPublisher-with-Decorators-for-Domain-Driven-Design)

  
</Example>



At this point the problem is the lack of clear documentation on how events were created and handled.

When creating this set of annotations I have no notion of `Command`, I was unable to create diagram for clear documentation. Thus the events become a black box in the system. 



##### Finally

But hey! If we wish so many good features from Spring Boot, why don't we jump into it ......?  The project is refactored completely afterwards.

#### Book and Video References

- Code Opinion, *https://www.youtube.com/@CodeOpinion/videos*, Youtube

- bitbone, [*实践者的 DDD 独家秘籍*](https://www.bilibili.com/video/BV1Nc411m7BZ/?spm_id_from=333.788.videopod.sections&vd_source=ed60287fd90cfd8c9101587902f829e4), BiliBili (需付費)
- bitbone, [*领域驱动设计指南*](https://ddd-fans.github.io/ddd-guideline/)

- 无知者云, [*产品代码都给你看了，可别再说不会 DDD*](https://www.cnblogs.com/davenkin/p/ddd-introduction.html)

- Vaughn Vernon, *實戰領域驅動設計 (譯)*, 博碩文化股份有限公司

- 彭晨阳, *复杂软件设计之道*, 机械工业出版社

