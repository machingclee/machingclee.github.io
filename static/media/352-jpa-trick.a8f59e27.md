---
title: "JPA Notes from real Project Experience"
date: 2024-12-29
id: blog0352
tag: springboot
toc: true
intro: "We record the use of ksp package that auto-generates DTO mapper for annotated entity classes."
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Json Fields

##### Json Column in JPA

```kotlin
    @Column(name = "event", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var event: JsonNode
```

##### JsonUtil that converts data class into JsonNode

```kotlin
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
            throw Exception("Could not convert to JsonNode: ${e.message}", e)
        }
    }
}
```

#### Auto-Generated Field whose value comes from Pre-defined SQL Function

Simple add `@Generated`

#### Rollback for any kind of Exception

Let's study the following case:

```kotlin{2}
// some ApplicationService
@Transactional(rollbackOn = [Exception::class])
fun moveClass(reqBody: MoveClassRequest) {
    val (classId, toDayTimestamp, toHourTimestamp) = reqBody
    val cls = classRepository.findByIdOrNull(classId) ?: throw Exception("Class not found")
    val studentId = cls.studentPackage?.student?.id ?: throw Exception("Student not found")
    val student = studentRepository.findByIdOrNull(studentId) ?: throw Exception("Student not found")
    student.moveClass(classId, toDayTimestamp.toDouble(), toHourTimestamp.toDouble())
}
```

where

```kotlin
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
            packageValidation.`target class (possibly from other package) should not have time conflict with current package`(targetClassToMove)
            packageValidation.`should not create classes that are in the past`(targetClassAsList)
        }
    }
}
```

- Without `@Transactional(rollbackOn = [Exception::class])` since we updated `targetClassToMove` before all those validations, the `dirty-checking` mechanism of JPA (which tracks the changes and generate SQL) will make a persistent update to the class entity model.

- It is because by default JPA **_only rollbacks_** on `RuntimeException` or on its subclasses such as `IllegalArgumentException`.

- Having put `@Transactional(rollbackOn = [Exception::class])` we are safe from dirty record.

#### When will DomainEvent of an AbstractAggregateRoot be Triggered?

##### Events are dispatched asynchronously

Consider an abstract aggregate root:

```kotlin
class Entity: AbstractAggregateRoot<Entity>() {
    ...
}
```

Now suppose that

- `repository.save(entity)` is executed.
- `entity` has an non-empty domain event list.
- The **_transaction has been finished_**

Then `jpa` will dispatch and empty the event list inside of `entity`.

```kotlin
@Transactional
fun someFunction(){
    entity.update1(param1)
    repository.save(entity)

    entity.update2(param2)
    repository.save(entity)
    // after the end of this scope, transaction submitted,
    // events generated from update1 and update2 are then dispatched asynchronously
}
```

That is to say, the following listeners **_are not executed sequentially_**:

```kotlin
@Component
class Listener {
    @EventListener
    fun afterUpdate1on(event: Update1Finished) {}

    @EventListener
    fun afterUpdate2on(event: Update2Finished) {}
}
```

##### When should we use domain events?

###### Atomic operations are no big deal

We simply create side effect within a domain (can be triggered from **_another_** domain) for which atomic operation is not of our concern. If we need atomic operation, we should keep the logic within a single transactional scope.

###### Decouple domain behaviour from entity

We simply decouple the `Entity.behaviour()` logic from our `Entity` because we know that the following happen:

- The behaviour may involve **_multiple_** domain objects that are **_not within_** `Entity`
- Those domain objects cannot be within the boundary of a **_single_** parent domain object (otherwise simply move our `behaviour` to the parent).

Or else,

- I simply want to trigger the behaviour by event because we have a listener to record all dispatched events as a historical record.

**Remark 1.** In these cases please make sure our application service only has **_one_** domain event dispatched, which servers as an _entrypoint_ to bring the orchestration of domain behaviours into the `SomeDomainEventListener` class.

**Remark 2.** On `DomainEventListener` and `ApplicationService`:

- We can consider `DomainEventListener` as a substitute of `ApplicationService` to maintain the "_behaviour pattern_" (in order not to create **inorganized** "_service_" to avoid service explosion).

- They **_bear the same role_** (orchestrate domain behaviours), but one serves for UI and one serves for events from domain object.

**Remark 3.** Contd' from the above, domain services, as in `ApplicationService` layer, can be injected into `DomainEventListner` for code simplification and reuse.
