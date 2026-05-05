const e=`---
title: "JPA and DDD Notes from Real Project Experience"
date: 2024-12-29
id: blog0352
tag: springboot, DDD, jpa
toc: true
intro: "We record the use of ksp package that auto-generates DTO mapper for annotated entity classes."
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Json Fields

#### Json Column in JPA

\`\`\`kotlin
    @Column(name = "event", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var event: JsonNode
\`\`\`

#### JsonUtil that converts data class into JsonNode

\`\`\`kotlin
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.module.kotlin.KotlinModule

object JsonNodeUtil {
    private val objectMapper = ObjectMapper().apply {
        registerModule(KotlinModule.Builder().build())
        configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false)
    }

    fun <T> toJsonNode(value: T): JsonNode {
        return try {
            when (value) {
                is JsonNode -> value  // If already JsonNode, return as is
                is String -> objectMapper.readTree(value)  // If String, parse directly
                else -> objectMapper.valueToTree(value)    // For other types, convert directly
            }
        } catch (e: Exception) {
            throw Exception("Could not convert to JsonNode: \${e.message}", e)
        }
    }
}
\`\`\`

### Auto-Generated Field whose value comes from Pre-defined SQL Function

Simply add \`@Generated\` to the \`@Column\`-annotated field with import

\`\`\`text
import org.hibernate.annotations.Generated
\`\`\`

We get the database-generated value after \`repository.save(eneity)\`.

### Rollback for any kind of Exception

Let's study the following case:

\`\`\`kotlin{2}
// some ApplicationService
@Transactional(rollbackOn = [Exception::class])
fun moveClass(reqBody: MoveClassRequest) {
    val (classId, toDayTimestamp, toHourTimestamp) = reqBody
    val cls = classRepository.findByIdOrNull(classId) ?: throw Exception("Class not found")
    val studentId = cls.studentPackage?.student?.id ?: throw Exception("Student not found")
    val student = studentRepository.findByIdOrNull(studentId) ?: throw Exception("Student not found")
    student.moveClass(classId, toDayTimestamp.toDouble(), toHourTimestamp.toDouble())
}
\`\`\`

where

\`\`\`kotlin
class SomeDomainModel {
    fun moveClass(classId: Int, toDayTimestamp: Double, toHourTimestamp: Double) {
        val allClasses = mutableSetOf<Class>()

        for (studentPackage in this.studentPackages) {
            val classes = studentPackage.classes
            allClasses += classes
        }

        val targetClassToMove = allClasses.find { it.id == classId } ?: throw Exception("Class not found")

        targetClassToMove.dayUnixTimestamp = toDayTimestamp
        targetClassToMove.hourUnixTimestamp = toHourTimestamp

        val targetClassAsList = listOf(targetClassToMove)

        for (studentPackage in this.studentPackages) {
            val packageValidation = studentPackage.Validation()
            packageValidation.\`target class (possibly from other package) should not have time conflict with current package\`(targetClassToMove)
            packageValidation.\`should not create classes that are in the past\`(targetClassAsList)
        }
    }
}
\`\`\`

- Without \`@Transactional(rollbackOn = [Exception::class])\` since we updated \`targetClassToMove\` before all those validations, the \`dirty-checking\` mechanism of JPA (which tracks the changes and generate SQL) will make a persistent update to the class entity model.

- It is because by default JPA **_only rollbacks_** on \`RuntimeException\` or on its subclasses such as \`IllegalArgumentException\`.

- Having put \`@Transactional(rollbackOn = [Exception::class])\` we are safe from dirty record.

### The terms Domain Object and Aggregate Root in JPA

#### In Other Languages

- In other languages **_aggregate root_** should always use a list of ids to reference its internal member:

  \`\`\`C#
  // C#
  public class Order
  {
      private readonly HashSet<OrderLineId> _orderLineIds;
  }
  \`\`\`

  \`\`\`golang
  // Golang
  type Order struct {
      OrderLineIDs []string  // just IDs
  }
  \`\`\`

  and classes _without further reference_ to other entities are simply **_domain object_**.

- Both aggregate root and domain object have behaviour.

#### Things are Different with JPA

But \`jpa\` is particularly well-established to implementing DDD principle, in aggregates our _id_'s are automatically binded with the asscoiated entities automatically:

\`\`\`kotlin
class StudentPackage() {
    @OneToMany
    @Cascade(CascadeType.ALL)
    @JoinTable(
        name = "rel_class_studentpackage",
        joinColumns = [JoinColumn(name = "student_package_id", referencedColumnName = "id")],
        inverseJoinColumns = [JoinColumn(name = "class_id", referencedColumnName = "id")]
    )
    var classes: MutableSet<Class> = mutableSetOf()
}
\`\`\`

In \`jpa\` there is no technical code difference between **_Aggregate Root_** and **_Domain Object_**. The term is more about how the business model group things together.

Whether or not to expose a method to mutate the aggregate member directly depends on whether or not you expose (implement) that method only in root level.

### When will DomainEvent of an AbstractAggregateRoot be Dispatched?

Consider an abstract aggregate root:

\`\`\`kotlin
class Entity: AbstractAggregateRoot<Entity>() {
    ...
}
\`\`\`

Now suppose that

- \`repository.save(entity)\` is executed.
- \`entity\` has an non-empty domain event list.
- The **_transaction has been finished_**

Then \`jpa\` will dispatch and empty the event list inside of \`entity\`.

\`\`\`kotlin
@Transactional
fun someFunction(){
    entity.update1(param1)
    repository.save(entity)

    entity.update2(param2)
    repository.save(entity)
    // after the end of this scope, transaction submitted,
    // events generated from update1 and update2 are then dispatched asynchronously
}
\`\`\`

That is to say, the following listeners **_are not executed sequentially_**:

\`\`\`kotlin
@Component
class Listener {
    @EventListener
    fun afterUpdate1on(event: Update1Finished) {}

    @EventListener
    fun afterUpdate2on(event: Update2Finished) {}
}
\`\`\`

### When Should we use Domain Events?

#### Atomic operations are no big deal

We simply create side effect within a domain (can be triggered from **_another_** domain) for which atomic operation is not of our concern. If we need atomic operation, we should keep the logic within a single transactional scope.

#### Decouple domain behaviour from entity

We simply decouple the \`Entity.behaviour()\` logic from our \`Entity\` because we know that the following happen:

<Example>

**Case 1.**

- The behaviour may involve **_multiple_** domain objects that are **_not within_** \`Entity\`
- Those domain objects cannot be within the boundary of a **_single_** parent domain object (otherwise simply move our \`behaviour\` to the parent).

</Example>

<Example>

**Case 2.**

- We simply want to trigger the behaviour by event because we have a listener to record all dispatched events as a historical record.

</Example>

In both cases we just want the domain behaviour to simply register an event, which serves as an entrypoint for the subsequent domain actions in the \`DomainEventListener\`.

##### Remark 1: Domain Event as an Entrypoint

In both cases above please make sure our \`ApplicationService\` has only **_one_** domain event dispatched, which serves as an _entrypoint_ and let \`DomainEventListner\` orchestrate the domain behaviours.

##### Remark 2: \`ApplicationService\` and \`DomainEventListener\`

- Both \`ApplicationService\` and \`DomainEventListener\` orchestrate domain behaviours, but one serves for UI and one serves for events from domain object.

- We can consider \`DomainEventListener\` as a substitute of \`ApplicationService\` to maintain the "_behaviour pattern_" (in order not to create **inorganized** "_service_" to avoid service explosion).

##### Remark 3: How about \`DomainService\`?

Continued from the above, domain services, as in \`ApplicationService\` layer, can be injected into \`DomainEventListner\` for code simplification and code reuse.

Note that we resort to domain service only when the logic cannot be fitted into **_one single entity_**.

For example, I have a set of \`Class\`'s, and each class belongs to a \`Group\`. Now I want to create a set of classes and a single group at the same time, the mix of these actions can naturally be fitted into \`TimeTableDomainService.createRecurringClasses()\`.

### About Factory Method in Domain Objects

#### Define a Factory Method

This is a continuation of **_Remark 3: How about \`DomainService\`?_** above, it is worth a single short section discussing the creation of domain objects.

We should try implementing factory method inside a **_parent_** domain object as it makes the aggregate relation super clear (instead of sporadic "single method"'s spreaded among domain services).

For example:

\`\`\`kotlin
class StudentPackage(...) {
    ...
    companion object {
        fun create(start_date: Long,
                  min: Int,
                  course_id: Int,
                  num_of_classes: Int,
                  default_classroom: Classroom,
                  startDay: DateTime
        ): StudentPackage {
            val pkg = StudentPackage(startDate = start_date.toDouble(),
                                    min = min,
                                    expiryDate = startDay.plusMonths(4).millis.toDouble(),
                                    courseId = course_id,
                                    numOfClasses = num_of_classes,
                                    defaultClassroom = default_classroom)
            // will be triggered once this enetity is saved
            pkg.registerCreatedEvent()
            return pkg
        }

        fun createRecurringClasses(
            startDay: DateTime,
            startHour: DateTime,
            numOfClasses: Int,
            min: Int,
            classroom: Classroom
        ): List<Class> {
            return (0 until numOfClasses).map { week ->
                val nextStartDay = startDay.plusWeeks(week)
                val nextStartHour = startHour.plusWeeks(week)
                Class(
                    dayUnixTimestamp = nextStartDay.millis.toDouble(),
                    hourUnixTimestamp = nextStartHour.millis.toDouble(),
                    min = min,
                    actualClassroom = classroom
                )
            }
        }
    }
}
\`\`\`

#### Apply Factory Methods in \`ApplicationService\`

Here is how we apply these methods inside an \`ApplicationService\` (that serves the UI from a \`POST\`-URL):

\`\`\`kotlin-1{37}
// StudentApplicationService
@Transactional
fun createStudentPackage(studentId: String, reqBody: CreatePackageRequest) {
    val (
        start_date,
        start_time,
        min,
        num_of_classes,
        course_id,
        default_classroom,
    ) = reqBody
    val student = studentRepository.findByIdOrNull(UUID.fromString(studentId)) ?: throw Exception("Student not found")
    val startDay = DateTime(start_date)
    val startHour = DateTime(start_time)
    val newPackage = StudentPackage.create(start_date = start_date,
                                            min = min,
                                            course_id = course_id,
                                            num_of_classes = num_of_classes,
                                            default_classroom = default_classroom,
                                            startDay = startDay)
    studentPackageRepository.save(newPackage)

    val newClasses = StudentPackage.createRecurringClasses(
        startDay = startDay,
        startHour = startHour,
        numOfClasses = num_of_classes,
        min = min,
        classroom = default_classroom
    )

    newPackage.addClasses(newClasses)
    newPackage.updateOfficialEndDateFromLastClass()

    val newGroup = ClassGroup()
    newGroup.addClasses(newClasses)

    student.addPackage(newPackage)
    classGroupRepository.save(newGroup)
    studentRepository.save(student)
}
\`\`\`

To make the function looks small we can abstract some detail into \`TimetableDomainService\`, but that seems meaningless to me at this point and thus no further simplification there.

#### About @Cascade(CascadeType.ALL), avoid saving the same Entity Twice

Let's continue the \`createStudentPackage\` example above.

Be careful if some fields have \`@Cascade(CascadeType.ALL)\` association like the \`Student-StudentPackage\` relation in our example, then we **_should not_** save the \`StudentPackage\` as it will be being saved when saving \`Student\` in line-37. Persisting an entity object twice in a transaction will lead to error.

### About Invariances (不變量) in Aggregate Root

In DDD, an **_invariance_** is a business rule or condition that must remain true at all times within a consistency boundary (usually an **_aggregate_**)

Certainly each data persistence involves a validation rule. Domain object is reponsible for maintaining the invariance as it knows everything it needs.

#### Bad example

Let's build a timetable system for students in a school.

<Example>

**Rules.**

1. Each student registers a course by buying a package.
2. Each package has many classes initially at a specific time.

</Example>

That's all

Now we implement a function to let teachers change the time of a class of one student by drag-and-drop in the UI, then our domain object \`Class\` has the behaviour:

[![](/assets/img/2024-12-29-19-16-22.png)](/assets/img/2024-12-29-19-16-22.png)

**Problem.** Two classes may collide: let $[a_0,b_0]$ be the time interval of \`class0\` and $[a_1,b_1]$ that of \`class1\`, but then we must check $[a_0,b_0]\\cap [a_1,b_1]= \\emptyset$!

#### Improved example, but not ideal

##### Implement Validation Rules

Ok, how about moving the method to an upper level, say to \`StudentPackage\`, so that we have knowledge to classes within a package?

Now we can implement our data validations inside a domain object (it is the most natural candidate to do this since it has _almost all_ domain knowledge to do the validation).

The validations will be executed at the beginning of

\`\`\`kotlin
StudentPackage.moveClass(classId, ...)
\`\`\`

tentatively

[![](/assets/img/2024-12-29-19-40-28.png)](/assets/img/2024-12-29-19-40-28.png)

##### But hangs on!!

No No No, a student can register multiple courses (therefore multiple packages), a single package is not enough!

Finally let's move the method to the next upper level --- The \`Student\`!

#### Final version

[![](/assets/img/2024-12-29-19-39-15.png)](/assets/img/2024-12-29-19-39-15.png)

The returned group of classes will be saved in application service (which serves the UI)

[![](/assets/img/2024-12-29-19-44-03.png)](/assets/img/2024-12-29-19-44-03.png)

**Remark.** Same validation rules can be reused when buying new packages.

### Reference

- [Services in DDD finally explained](https://developer20.com/services-in-ddd-finally-explained/)
- [产品代码都给你看了，可别再说不会 DDD（八）：应用服务与领域服务](https://www.cnblogs.com/davenkin/p/ddd-application-service-and-domain-service.html)
`;export{e as default};
