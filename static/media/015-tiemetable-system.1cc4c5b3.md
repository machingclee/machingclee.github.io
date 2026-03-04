---
id: portfolio015
title: "Commercial Timetable System for an Art School"
intro: Manage timetable for teachers and automate the payment notification.
thumbnail: /assets/img/2025-09-06-12-35-35.png
tech: React, Vite,  Spring Boot, Prisma, PostgreSQL, Lambda Function,  Domain Driven Design
thumbTransX: 0
thumbTransY: 0
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

<center>

<a href="/assets/img/2025-09-06-12-40-32.png">
<img src="/assets/img/2025-09-06-12-40-32.png" />
</a>


</center>




### Tech-Stack


<timetabletechstack></timetabletechstack>



### Briefly About this Project ...


#### Who is the User?

This timetable system is developed and tailor-made for an art school  [木棉花水墨畫室](https://www.cottontreeinkart.com). 




#### Tailor-Made Features and Video Demo


- Create Makeup classes automatically due to Custom Holiday



  <center>

  [![](/assets/img/2025-09-20-04-54-26.png)](/assets/img/2025-09-20-04-54-26.png)

  </center>

  A custom holiday may include ***public holiday*** or ***adverse weather*** like typhoon.


  <center>

  <customvideo src="/assets/videos/005.mp4" />

  </center>

  <Example>


  **Remark.** We adopt **event-driven design** in our backend. 
  
  Since there are ***too many reasons*** a class could be created on an holiday, adjusting the status of a class (corresponding to `ClassMovedEvent`)  is among one of our event handlings, instead of binding the side effect logic at the end of *function that moves the class* in the backend.


  </Example>



- Create student package (of classes)
  <center>

  [![](/assets/img/2025-09-20-03-27-39.png)](/assets/img/2025-09-20-03-27-39.png)

  </center>

- Check coming payment deadline for the next season of classes

  <center>

  [![](/assets/img/2025-09-20-03-28-18.png)](/assets/img/2025-09-20-03-28-18.png)

  </center>

- Send whatsapp message to parents for the deadline

  <center>

  [![](/assets/img/2025-09-20-03-38-01.png)](/assets/img/2025-09-20-03-38-01.png)

  </center>

- Preview the timetable of all students of a single day

  <center>

  [![](/assets/img/2025-09-20-04-36-20.png)](/assets/img/2025-09-20-04-36-20.png)

  </center>

- System Logging, this is to understand what has been executed in the system:

  [![](/assets/img/2025-09-24-01-55-43.png)](/assets/img/2025-09-24-01-55-43.png)

  Testing users can report to the developer of what's wrong with their operations easily.




### Backend Project Structure

<center>

<a href="/assets/img/2025-09-16-04-01-09.png" target="_blank">
<img src="/assets/img/2025-09-16-04-01-09.png" width="380"/>
</a>


</center>


<p></p>

- The only services we have are ***domain services***. Which comprises of orchestration of domain behaviours that cannot be carried out by a single aggregate.

- Most of the responsibilities are spread to domain objects. Therefore we have very few "service" in the system.


- The ***application services***, usually the first layer that a controller interacts with, are replaced by ***CommandHandlers***. 

  It is not for CQRS, it is simply for  better alignment with event storming and better logging.







### System Design 



#### Overview of Domain Objects Involved 

##### The Class Diagram

[![](/assets/img/2025-09-06-12-42-28.png)](/assets/img/2025-09-06-12-42-28.png)


##### Entities

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

#### Event Storming

Event Storming is an indispensible part of DDD. This project is also a practice of  abiding by the rules in the design methodology of DDD.

You may ***click*** the following image or download button to get the **PDF**:

[![](/assets/img/2025-09-29-09-17-15.png)](/assets/portfolios/pdfs/timetable.pdf)


<a href="/assets/portfolios/pdfs/timetable.pdf">
<button class="download-btn-solid" >Download</button>
</a>

#### Reversed Event Storming

To make sure the event-handlings of our system agree with our design, I have designed an "event chart" that is produced by the backend.

This chart is composed of all `command->event->policy[->command]` flows that our backend implemented. Detail can be found in [Event Storming Diagram by React Page](/blog/article/Event-Storming-Diagram-by-React-Page):

- [Sample Diagram (Web Page)](http://event-storming-example.s3-website.ap-northeast-2.amazonaws.com/)

  ![](/assets/img/2026-02-11-17-00-04.png)

Backend implementation to get the command-event flows data:

- https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/common/domainutils/CommandInvoker.kt#L241

This is based on dependency injeciton that injects all `@Component`-annotated commands when lauching a spring boot application.




### Coding Example of Command-Event System


#### Basic user Request with Side Effect

Let's take the following route as an example. The  `ClassesCreatedEvent` is triggered by (at least)  a  `CreateClassesCommand`:

[![](/assets/img/2025-09-06-22-22-35.png)](/assets/img/2025-09-06-22-22-35.png)

Note that `ClassesCreatedEvent` can be a side effect of other commands as well, thus it does not come as a surprise there are 3 incoming routes to this `ClassesCreatedEvent`:

[![](/assets/img/2025-09-06-22-23-51.png)](/assets/img/2025-09-06-22-23-51.png)

This is the power of event driven system, we can trace the potential causes of how would some database changes happen (when documented correctly).


##### Step 1. Invoke the command from controller

Here `Command` and `CommandHandler` replace the ***application service*** layer in DDD. 

`Command` collects all necessary information for the `CommandHandler`, and `Command` itself is a ***simple object for logging!*** (which we will be doing in `CommandInvoker`).

- Command Definition: <br/>
  [![](/assets/img/2025-09-06-22-00-57.png)](/assets/img/2025-09-06-22-00-57.png)

- Command Invokation: <br/>
  [![](/assets/img/2025-09-06-22-00-19.png)](/assets/img/2025-09-06-22-00-19.png)


##### Step 2. Handle the command with invariance within aggregate

- Command Handler Definition:
    [![](/assets/img/2025-09-14-21-53-34.png)](/assets/img/2025-09-14-21-53-34.png)

  Here we have come across a domain behaviour:  
  ```kotlin
  student.addClasses(targetPackage, classes, allowHistoricalRecord)
  ```
  domain invariances have been maintained by:

  ```kotlin
      fun addClasses(targetPackage: StudentPackage, classes: Iterable<Class>, allowHistoricalRecord: Boolean): AddClassesResult {
          for (pkg in studentPackages) {
              pkg.validation {
                  `rule - new classes should not have intersection with current package`(classes)
              }
          }
          // no further validation needed:
          return targetPackage.addClassesWithoutTimeConflictValidation(classes, allowHistoricalRecord = allowHistoricalRecord)
      }
  ```


<Example>

**Remark 1.** Here the validation rules are maintained in a separated class, that validation class is linked to the entity class via a function literal ([detail](/blog/article/Code-Separation-of-Domain-Entity-Class-Domain-Behaviour-Actions-and-the-Corresponding-Validations#StduentPackageValidation-Class)). It is to avoid writing everything within the same class.


</Example>

<Example>

**Remark 2.** Due to performance consideration everything inside `entityManager.escapeFromDirtyCheck` has been deleted from persistent context, therefore data are not persisted via dirty check. 

The domain behaviour only maintains invariance and output the entities that need to be created or deleted. The persistence is then carried out by SQL generated by our `PostgreSQLGenerator` (for batch insert).


</Example>

Finally we add an event into `eventQueue` and let `commandInvoker` dispatch it once the command is finished.


##### Step 3. Handle side effects via policies (if any)

Once the `ClassesCreatedEvent` is dispatched, from our implementation diagram it needs to be handled by `ClassOnHolidayMustBeExtendedPolicy`. 

If a class happens to be created on an holiday, we just extend this class (to a makeup lesson) 

- Policy Definition:
    [![](/assets/img/2025-09-07-03-01-15.png)](/assets/img/2025-09-07-03-01-15.png)

  Note that we also need to handle side effects from other events, as shown in the event-storming diagram!


#### New Business Logic Comes!! Domain Invariance via Policies for Open\-Closed Principle

<Example>
New requirements:

- Any package should have an expiry date. 
- No class of this package can be created beyond this expiry date.

</Example>

##### Should aggregate invariance be always maintained within aggregate itself only?


There starts to be confusion. We can throw exception in a policy to force JPA to rollback all the relevant changes when handling an event (***outside*** of an aggregate).

But the act of maintaining domain invariance should stay within the aggregate, that means we either 

- break the open-closed principle, or 

- break the DDD-spirit of maintaining its own invariance whenever possible (unless cross aggregates invariance happens).

There are always tradeoff for which no option is absolutely correct, we need to strike the balance between code maintainability and methodology. 



##### Policies for Domain Invariance, but isn't rollback also a side effect?

Instead of adding additional logic in domain behaviours to avoid breaking the invariance (making a class start later than the expiry date), let's extend the usage of policies beyond side-effect, they are also now for invariances.


<Example>

**Remark.** But wait, isn't rollbacking to previous state also a side effect? This justifies our choice of maintaining invariances within policies!

</Example>


Now we skim through the candidates of ***events*** that can possibly break the invariance (changing the time of a class), they are respectively:

- `ClassCreatedEvent`

- `ClassMovedEvent`
- `ClassDuplicatedEvent`
- `ClassExtendedEvent`
- `StudentPackageUpdatedEvent`


Then we add a new policy and arrows for record:

![](/assets/img/2025-09-10-04-55-02.png)

After the strategic design, we are already to start coding:

[![](/assets/img/2025-09-10-05-00-20.png)](/assets/img/2025-09-10-05-00-20.png)



##### Video Demonstration


Here is a video demostration on the the workflow of UI application being blocked by invariance:

<iframe width="560" height="315" style="margin-top:10px" src="https://www.youtube.com/embed/zcjYaH0jTBo?si=X4rNS9qJKVSC_pey" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

<p></p>

**1.** We add a class on `2026-09-16` which is an expiry date on which we cannot add any class any more

**2.** We witness an error from backend at the lower right corner corresponding to our backend exception:

![](/assets/img/2025-09-10-05-26-15.png)

**3.** We add a class on `2026-09-15`, it succeeded

**4.** The class in step 3 is then moved to `2026-09-17`, the domain invariance for `ClassMovedEvent` again throw exception for expiry date:

![](/assets/img/2025-09-11-07-09-11.png)



### Logging: Debug by Tracing Commands and Events 


The following is an example of how we can debug a `delete package` request in the system:

[![](/assets/img/2025-09-14-19-16-19.png)](/assets/img/2025-09-14-19-16-19.png)

We also record the exception detail:

[![](/assets/img/2025-09-14-12-40-41.png)](/assets/img/2025-09-14-12-40-41.png)



What we can observe from the logs:

**1.** A package has been deleted successfully in a transaction

**2.** At the same time the system dispatched two events:

- `package deleted` and

-  `classes removed`

**3.** When a class get removed, a policy (side effect) has routed the `classes removed` event to `reset numbers command`, which is to reset the ordering of classes internally in our system.

**4.** Since we have deleted a package, we don't have that package any more:

[![](/assets/img/2025-09-14-12-47-37.png)](/assets/img/2025-09-14-12-47-37.png)

**5.** Changes rollbacked, user was presented an error message from backend.






### Appendix (From my Blog Posts)


- [Problems in Controller-Service-Repository That are Solvable by Tactical Design in DDD (Domain Driven Design)](/blog/article/Problems-in-Controller-Service-Repository-That-are-Solvable-by-Tactical-Design-in-DDD-Domain-Driven-Design-)

- [Problem of SQL Based Nodejs Backend, Should we use Query Builder?](/blog/article/Problem-of-SQL-Based-Nodejs-Backend-Should-we-use-Query-Builder-)


- [Value Objects and Embedded Classes for Domain Invariances](/blog/article/Value-Objects-and-Embedded-Classes)

### Book and Video References

- Code Opinion, *https://www.youtube.com/@CodeOpinion/videos*, Youtube

- bitbone, [*实践者的 DDD 独家秘籍*](https://www.bilibili.com/video/BV1Nc411m7BZ/?spm_id_from=333.788.videopod.sections&vd_source=ed60287fd90cfd8c9101587902f829e4), BiliBili (需付費)
- bitbone, [*领域驱动设计指南*](https://ddd-fans.github.io/ddd-guideline/)

- 无知者云, [*产品代码都给你看了，可别再说不会 DDD*](https://www.cnblogs.com/davenkin/p/ddd-introduction.html)

- Vaughn Vernon, *實戰領域驅動設計 (譯)*, 博碩文化股份有限公司

- 彭晨阳, *复杂软件设计之道*, 机械工业出版社

- fx777, [*Think in Domain-Driven Design*](https://ithelp.ithome.com.tw/users/20111997/ironman/2730?sc=hot&fbclid=IwY2xjawNFBhpleHRuA2FlbQIxMABicmlkETF6czZ4cFBIUlRyMG1iaUw3AR6VLcEW0TAOkblS0myPcuRn9oOVqDymBlFuPQGuPXG5ODKR_z8Rwe1dJ8aryw_aem_lV-t7KZ8_9CuP-0g0gma4A), 第 11 屆 iThome 鐵人賽

<center>

[![](/assets/img/2025-09-14-19-14-03.png)](/assets/img/2025-09-14-19-14-03.png)

</center>
