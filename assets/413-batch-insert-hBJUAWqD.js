const e=`---
title: "Performance Boost: Batch Insert in Spring Boot with Relations"
date: 2025-09-14
id: blog0413
tag: kotlin, springboot
toc: true
intro: "We introduce a utility class that generate batch insertion SQL in the signature of \`batchInsert(entities: List<Entity>): List<Entity>\`."
img: /assets/img/2025-10-05-17-07-24.png
scale: 1.4
offsetx: -6
offsety: 12
---


<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>


### In Simples Form 


#### application.yml for Auto Batch-Insert


\`\`\`yml
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        jdbc:
          batch_size: 50
          batch_versioned_data: true
        order_inserts: true
        order_updates: true
        dialect: org.hibernate.dialect.PostgreSQLDialect
        generate_statistics: false
\`\`\`


#### Special Annotation in Entity Classes

##### Sequence Name

\`\`\`kotlin
    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "class_id_seq")
    @SequenceGenerator(name = "class_id_seq", sequenceName = "Class_id_seq", allocationSize = 50)
    var id: Int? = null,
\`\`\`

Here the \`generator\` in \`GeneratedValue\` is equal to the \`name\` in \`SequenceGenerator\`, and they are arbitrary. 

But the \`sequenceName\` must match the one in our database.

To get a list of sequence names, run the following:

\`\`\`sql 
SELECT sequence_name 
FROM information_schema.sequences 
WHERE sequence_schema = 'public';
\`\`\`

##### ID \`GenerationType\`


In the annotation for \`id\`: 
\`\`\`kotlin
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "class_id_seq")
\`\`\` 
the generation type cannot be replaced by \`IDENTITY\` because:

- With \`IDENTITY\` JPA will fetch the id only after insertion is complete.
- With \`SEQUENCE\` JPA can fetch multiple \`id\`s before insertion, this makes the batch insertion possible.



### Things get Difficult With Relations


#### Difficulty

However, things get complicated ***when we have relations***. Many natural operations that work normally by dirty check ***can break*** and block JPA from doing batch insertion. 

There are indeed tricky configurations to make batch processing  with relations possible. Instead of hoping a batch insertion can be executed implicitly, we choose to do it explicitly for consistency.



#### Native SQL Generator for Batch Insertion

This section is PostgreSQL specific.

Instead of writing custom batch-insert native SQL in repository method, we create a reusable service that generates and executes such a SQL for us using the metadata on the annotations in each of the entity classes.



[![](/assets/img/2025-09-14-01-39-56.png)](/assets/img/2025-09-14-01-39-56.png)


##### PostgreSQLGenerator class


\`\`\`kotlin
package dev.james.alicetimetable.commons.utilityclass

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.persistence.EntityManager
import jakarta.persistence.Table
import org.hibernate.annotations.DynamicInsert
import org.springframework.stereotype.Component
import java.lang.reflect.Field
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID


@Component
class PostgreSQLGenerator(
    private val entityManager: EntityManager,
    private val objectMapper: ObjectMapper,
) {
    /**
     * Only entities with @Id field being \`Int\` can use this method
     */
    fun <T : Any> batchInsertReturningAll(entities: List<T>): List<T> {
        if (entities.isEmpty()) return emptyList()

        val entityClass = entities.first()::class.java as Class<T>
        val ids = _batchInsert(entityClass, entities)

        // Set IDs back to entities
        entities.forEachIndexed { index, entity ->
            setEntityId(entity, ids[index])
        }

        return entities
    }

    /**
     * Only entities with @Id field being \`Int\` can use this method
     */
    fun <T : Any> batchInsertReturningIds(entities: List<T>): List<Int> {
        val entityClass = entities.first()::class.java as Class<T>
        return _batchInsert(entityClass, entities)
    }

    /**
     * Any entities
     */
    fun <T : Any> batchDeleteEntities(entities: List<T>): Int {
        if (entities.isEmpty()) return 0

        val entityClass = entities.first()::class.java as Class<T>
        val ids = entities.mapNotNull { entity ->
            val idField = getIdField(entityClass)
            idField?.let { field ->
                field.isAccessible = true
                field.get(entity)
            }
        }

        return _batchDelete(entityClass, ids)
    }

    private fun <T : Any> _batchDelete(entityClass: Class<T>, ids: List<Any>): Int {
        if (ids.isEmpty()) return 0

        val tableName = getTableName(entityClass)
        val idList = ids.joinToString(",") { _formatDeleteValue(it) }

        val sql = """
            DELETE FROM $tableName 
            WHERE id IN ($idList)
        """.trimIndent()

        val query = entityManager.createNativeQuery(sql)
        return query.executeUpdate()
    }


    private fun _formatDeleteValue(value: Any): String {
        return when (value) {
            is String -> "'\${value.replace("'", "''")}'"
            is UUID -> "'$value'"
            else -> value.toString()
        }
    }


    private fun <T : Any> _batchInsert(entityClass: Class<T>, entities: List<T>): List<Int> {
        if (entities.isEmpty()) return emptyList()

        // Check Id Type:
        val idField = getIdField(entityClass)
        if (idField != null && idField.type != Int::class.java && idField.type != java.lang.Integer::class.java) {
            throw IllegalArgumentException("PostgreSQLBatchGenerator only supports Int ID fields. Found: \${idField.type}")
        }

        val tableName = getTableName(entityClass)
        val allColumnMappings = extractColumnMappings(entityClass)

        val hasDynamicInsert = entityClass.getAnnotation(DynamicInsert::class.java) != null

        val processedEntities: List<Map<String, Pair<Field, Any?>>> = entities.map { entity ->
            val fieldValues: Map<String, Pair<Field, Any?>> = allColumnMappings.entries.associate { entry ->
                val columnName = entry.key
                val field = entry.value
                val value = field.get(entity)
                columnName to Pair(field, value)
            }

            if (hasDynamicInsert) {
                fieldValues.filter { (_, fieldValuePair) -> fieldValuePair.second != null }
            } else {
                fieldValues
            }
        }

        val columnsToInsert = if (processedEntities.isNotEmpty()) {
            processedEntities[0].keys.joinToString(", ")
        } else {
            allColumnMappings.keys.joinToString(", ")
        }

        val values = processedEntities.joinToString(",") { entityFields ->
            val fieldValueStrings = entityFields.values.map { (field, value) ->
                formatPostgreSQLValue(value, field)
            }.joinToString(", ")
            "($fieldValueStrings)"
        }

        // PostgreSQL RETURNING clause to get generated IDs
        val sql = """
            INSERT INTO $tableName ($columnsToInsert) 
            VALUES $values 
            RETURNING id
        """.trimIndent()

        val query = entityManager.createNativeQuery(sql)
        val results = query.resultList

        return results.map {
            when (it) {
                is Number -> it.toInt()
                is Array<*> -> (it[0] as Number).toInt()
                else -> it.toString().toInt()
            }
        }
    }

    private fun <T> getIdField(entityClass: Class<T>): Field? {
        return entityClass.declaredFields.find { field ->
            field.getAnnotation(jakarta.persistence.Id::class.java) != null
        }
    }

    private fun <T> setEntityId(entity: T, id: Int) {
        val idField = getIdField(entity!!::class.java)
        idField?.let {
            it.isAccessible = true
            if (it.type == Int::class.java || it.type == java.lang.Integer::class.java) {
                it.set(entity, id)
            } else {
                throw IllegalArgumentException("ID field must be of type Int. Found: \${it.type}")
            }
        }
    }

    private fun getTableName(entityClass: Class<*>): String {
        val tableAnnotation = entityClass.getAnnotation(Table::class.java)
        return if (tableAnnotation != null && tableAnnotation.name.isNotEmpty()) {
            // Use the name from @Table annotation
            "\\"" + tableAnnotation.name + "\\""
        } else {
            // Convert class name to snake_case
            val snakeCaseName = entityClass.simpleName.replace(Regex("([a-z])([A-Z])"), "$1_$2").lowercase()
            "\\"" + snakeCaseName + "\\""
        }
    }

    // PostgreSQL-specific value formatting
    private fun formatPostgreSQLValue(value: Any?, field: Field): String {
        return when {
            value == null -> "NULL"
            value is String -> "'\${value.replace("'", "''")}'"
            value is LocalDateTime -> "'$value'"
            value is LocalDate -> "'$value'"
            value is Instant -> "to_timestamp(\${value.epochSecond})"
            value is Enum<*> -> "'\${value.name}'"
            value is Boolean -> value.toString()
            value is UUID -> "'$value'"
            value is Int -> value.toString()
            value is Double -> value.toString()
            value is Array<*> -> "ARRAY[\${value.joinToString(",") { formatPostgreSQLValue(it, field) }}]"
            value is List<*> -> "ARRAY[\${value.joinToString(",") { formatPostgreSQLValue(it, field) }}]"
            // PostgreSQL JSON support
            isJsonField(field) -> "'\${objectMapper.writeValueAsString(value)}'"
            else -> value.toString()
        }
    }

    private fun isJsonField(field: Field): Boolean {
        return field.getAnnotation(org.hibernate.annotations.JdbcTypeCode::class.java)?.value == org.hibernate.type.SqlTypes.JSON
    }

    private fun <T> extractColumnMappings(entityClass: Class<T>): LinkedHashMap<String, Field> {
        val mappings = linkedMapOf<String, Field>()

        val hasDynamicInsert = entityClass.getAnnotation(DynamicInsert::class.java) != null

        entityClass.declaredFields.forEach { field ->
            field.isAccessible = true

            // Skip @Id with GenerationType.IDENTITY or SEQUENCE
            val idAnnotation = field.getAnnotation(jakarta.persistence.Id::class.java)
            val generatedValue = field.getAnnotation(jakarta.persistence.GeneratedValue::class.java)
            if (idAnnotation != null && generatedValue != null) {
                return@forEach // Skip auto-generated IDs
            }

            // Skip @Transient fields
            if (field.getAnnotation(jakarta.persistence.Transient::class.java) != null) {
                return@forEach
            }

            // Skip JPA relationship annotations
            if (field.getAnnotation(jakarta.persistence.ManyToOne::class.java) != null ||
                field.getAnnotation(jakarta.persistence.OneToMany::class.java) != null ||
                field.getAnnotation(jakarta.persistence.OneToOne::class.java) != null ||
                field.getAnnotation(jakarta.persistence.ManyToMany::class.java) != null
            ) {
                return@forEach
            }

            // Skip collections (relationships)
            if (Collection::class.java.isAssignableFrom(field.type) ||
                Map::class.java.isAssignableFrom(field.type)
            ) {
                return@forEach
            }

            // Get column name
            val columnName = getColumnName(field)
            mappings[columnName] = field
        }

        return mappings
    }

    private fun getColumnName(field: Field): String {
        val columnAnnotation = field.getAnnotation(jakarta.persistence.Column::class.java)
        val columnName = columnAnnotation?.name ?: field.name
        return "\\"$columnName\\""
    }
}
\`\`\`


#### Usage 


##### \`batchInsertReturningIds\`
This is useful if we simply want to insert entities and use the \`id\`s for creating separate relational records in junction table.

In most of the cases this can be replaced by the next more powerful method:


##### \`batchInsertReturningAll\` and \`batchDeleteEntities\`

\`\`\`kotlin-1{29,33}
@Component
class CreateClassesHandler(
    private val classRepository: ClassRepository,
    private val studentFactory: StudentFactory,
    private val studentRepository: StudentRepository,
    private val entityManager: EntityManager,
    private val sqlGen: PostgreSQLGenerator,
) : CommandHandler<CreateClassesCommand, Unit> {
    override fun handle(eventQueue: EventQueue, command: CreateClassesCommand) {
        val (
            studentId, numOfClasses, hourUnixTimestamp, min, studentPackageId, actualClassroom, allowHistoricalRecord, status,
        ) = command

        val student = studentRepository.findByIdFetchingPackagesAndClasses(studentId.toUUID()) ?: throw TimetableException("Student not found")
        val targetPackage = student.studentPackages.find { it.id == studentPackageId } ?: throw TimetableException("Student package not found")

        val (classesAdded, classesRemoved) = entityManager.escapeFromDirtyCheck {
            val classes = studentFactory.createRecurringClasses(
                startDay = DateTime(hourUnixTimestamp.toLong()).toHongKong().withTimeAtStartOfDay(),
                startHour = DateTime(hourUnixTimestamp.toLong()),
                numOfClasses = numOfClasses,
                min = min,
                classroom = actualClassroom,
                status = status
            )
            student.addClasses(targetPackage, classes, allowHistoricalRecord)
        }

        val savedClassesAdded = sqlGen.batchInsertReturningAll(classesAdded.toList())
        sqlGen.batchInsertReturningIds(savedClassesAdded.map {
            RelClassStudentpackage(classId = it.id!!, studentPackageId = targetPackage.id!!)
        })
        sqlGen.batchDeleteEntities(classesRemoved.toList())

        eventQueue.add(TimetableDomainEvent.ClassesCreatedEvent(
            packageId = targetPackage.id!!,
            classesCreated = savedClassesAdded.map { it.toDTO() },
            classesRemoved = classesRemoved.map { it.toDTO() }
        ))
    }
}
\`\`\`
Now \`savedClassesAdded\` is a set of entities that have auto-generated values generated from our database (including \`id\`, \`createdAt\`, etc), thanks to the nature of PostgreSQL's \`RETURNING *\`, 



### Integrate Domain Behaviour with SQL Generation 

#### \`EntityManager.escapeFromDirtyCheck\`

We continue with the previous example, let's look at lines 17-27:

\`\`\`kotlin-17{18}
val (classesAdded, classesRemoved) = 
    entityManager.escapeFromDirtyCheck {
      val classes = studentFactory.createRecurringClasses(
          startDay = DateTime(hourUnixTimestamp.toLong()).toHongKong().withTimeAtStartOfDay(),
          startHour = DateTime(hourUnixTimestamp.toLong()),
          numOfClasses = numOfClasses,
          min = min,
          classroom = actualClassroom,
          status = status
      )
      student.addClasses(targetPackage, classes, allowHistoricalRecord)
}
\`\`\`
To explain what is \`escapeFromDirtyCheck\`, here we first explain what we are trying to avoid.

We ***keep using domain behaviour*** to maintain all the domain invariance, and we return all the necessary results for persistence (for insert, delete, update, etc).

In the past if we have modified our entities, the dirty check mechanism of JPA will calculate a set of SQLs and execute them for us, which ***is not desirable*** as it potentially produces repeated single insertion statements that harm the performance significantly.

For this, we introduce the following extension function for \`EntitiyManager\` in order to make a block of code ***invisible*** from dirty-check mechanism:



#### Implementation and How it works 

\`\`\`kotlin
fun <T> EntityManager.escapeFromDirtyCheck(block: () -> T): T {
    val originalFlushMode = this.flushMode
    try {
        this.flushMode = FlushModeType.COMMIT
        val result = block()
        this.clear()  // Detach all entities
        return result
    } finally {
        this.flushMode = originalFlushMode
    }
}
\`\`\`

- With \`this.flushMode = FlushModeType.COMMIT\` we have stopped unexpected \`flush()\` operations from happening.

- With \`this.clear()\` we detach all entities from persistence context, making them untracible for dirty checking.


#### Caveat

##### When \`flush()\` is needed ...

Assume a transaction goes as follows:

\`\`\`kotlin
fun someHandler () {
    a()
    entityManager.escapeFromDirtyCheck {
        b()
        // implictiy call entityManager.clear() at the end
    }
    c()
}
\`\`\`
Since at the end of \`escapeFromDirtyCheck\` we cleared the persistent context, changes in \`a()\` ***will be erased***. If there are changes that need to be persisted, we add an extra call of \`flush()\` in between:

\`\`\`kotlin{3}
fun someHandler () {
    a()
    entityManager.flush()
    entityManager.escapeFromDirtyCheck {
        b()
        // implictiy call entityManager.clear() at the end
    }
    c()
}
\`\`\`

##### A detailed example

\`\`\`kotlin-1{31,33}
override fun handle(eventQueue: EventQueue, command: CreateStudentPackageCommand): StudentPackage {
    val (
        studentId, startDate, startTime, min, numOfClasses, courseId, defaultClassroom,
    ) = command
    val student = studentRepository.findByIdOrNull(UUID.fromString(studentId)) ?: throw Exception("Student not found")
    val startDay = DateTime(startDate).toHongKong().withTimeAtStartOfDay()
    val startHour = DateTime(startTime)

    if (numOfClasses > 50) {
        throw TimetableException("Do not support more than 50 classes for now")
    }

    val expiryDate = when (numOfClasses) {
        in 0..5 -> startDay.plusMonths(4)
        in 6..30 -> startDay.plusMonths(8)
        in 31..50 -> startDay.plusMonths(13)
        else -> startDay.plusDays(10)
    }

    val newPackage = studentFactory.createPackage(
        start_date = startDate,
        min = min,
        num_of_classes = numOfClasses,
        course_id = courseId,
        default_classroom = defaultClassroom,
        startDay = startDay,
        expiryDate = expiryDate.millis.toDouble(),
    )
    val savedPackage = studentPackageRepository.save(newPackage)
    student.addPackage(savedPackage)
    savedPackage.student = student
    studentRepository.save(student)
    entityManager.flush()
\`\`\`
Again in the past we may simply write
\`\`\`kotlin
student.addPackage(savedPackage)
studentRepository.save(student)
\`\`\`
then a bidirectional relation will be figured out by dirty check mechanism. However, as we will be turning the managed entity \`student\`  to a ***detached state*** via \`entityManager.clear()\` implicitly in \`escapeFromDirtyCheck\`. The record for bidirectional binding will be lost and thus \`savedPackage.student = student\` is necessary before  we \`flush()\` it.


Next we still rely on domain behaviour for domain invariance, but the behaviour will output entities for persistence. We batch insert/delete the entities via generated SQL:


\`\`\`kotlin-34{53-62}
    val newClasses = studentFactory.createRecurringClasses(
        startDay = startDay,
        startHour = startHour,
        numOfClasses = numOfClasses,
        min = min,
        classroom = defaultClassroom,
        status = ClassStatus.PRESENT
    )

    addClassesBySQL(student, savedPackage, newClasses, eventQueue)
    return newPackage
}

private fun addClassesBySQL(
    student: Student,
    savedPackage: StudentPackage,
    newClasses: List<Class>,
    eventQueue: EventQueue,
) {
    val (classesAdded, classesRemoved) = entityManager.escapeFromDirtyCheck {
        student.addClasses(targetPackage = savedPackage,
                            classes = newClasses,
                            allowHistoricalRecord = true)
    }
    val insertedClasses = batchGenerator.batchInsertReturningAll(classesAdded.toList())
    batchGenerator.batchDeleteEntities(classesRemoved.toList())
    batchGenerator.batchInsertReturningAll(insertedClasses.map {
        RelClassStudentpackage(classId = it.id!!, studentPackageId = savedPackage.id!!)
    })

    eventQueue.add(TimetableDomainEvent.StudentPackageCreatedEvent(
        packageId = savedPackage.id!!,
        pkg = savedPackage.toDTO(),
        classes = classesAdded.map { it.toDTO() }))

    eventQueue.add(TimetableDomainEvent.ClassesCreatedEvent(
        packageId = savedPackage.id!!,
        classesCreated = insertedClasses.map { it.toDTO() },
        classesRemoved = classesRemoved.map { it.toDTO() }))
}
\`\`\`

As a summary,  when in doubt, just do the two-way binding manually to play safe.`;export{e as default};
