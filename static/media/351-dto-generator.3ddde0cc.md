---
title: "Auto-generated Mapper From Entity Classes into DTO Classes"
date: 2024-12-24
id: blog0350
tag: springboot
toc: true
intro: "We record the use of ksp package that auto-generates DTO mapper for annotated entity classes."
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Sample Result

Let's choose the following entity class and annotate it by `@GenerateDTO`:

```kts{20}
package dev.james.alicetimetable.commons.database.entities


import dev.james.alicetimetable.commons.database.enums.Gender
import dev.james.alicetimetable.events.StudentEvents
import dev.james.processor.GenerateDTO
import jakarta.persistence.*
import org.hibernate.annotations.DynamicInsert
import org.hibernate.dialect.PostgreSQLEnumJdbcType
import org.hibernate.annotations.JdbcType
import org.springframework.data.domain.AbstractAggregateRoot

import java.io.Serializable
import java.util.UUID


@Suppress("UNCHECKED_CAST")
@Entity
@DynamicInsert
@GenerateDTO
@Table(
    name = "student",
    schema = "public"
)
class Student(
    @Id
    @Column(name = "id")
    @GeneratedValue(generator = "ulid_as_uuid")
    var id: UUID? = null,
    @Column(name = "first_name", nullable = false)
    var firstName: String,
    @Column(name = "last_name", nullable = false)
    var lastName: String,
    @Column(name = "chinese_first_name")
    var chineseFirstName: String? = null,
    @Column(name = "chinese_last_name")
    var chineseLastName: String? = null,
    @Column(name = "school_name", nullable = false)
    var schoolName: String,
    @Column(name = "student_code")
    var studentCode: String? = null,
    @Column(name = "grade", nullable = false)
    var grade: String,
    @Column(name = "phone_number")
    var phoneNumber: String? = null,
    @Column(name = "wechat_id")
    var wechatId: String? = null,
    @Column(name = "birthdate", nullable = false)
    var birthdate: Double,
    @Column(name = "parent_email", nullable = false)
    var parentEmail: String,
    @Column(name = "created_at")
    var createdAt: Double? = null,
    @Column(name = "created_at_hk")
    var createdAtHk: String? = null,
    @Column(name = "parent_id")
    var parentId: UUID? = null,
    @Column(name = "gender", nullable = false)
    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType::class)
    var gender: Gender,
) : AbstractAggregateRoot<Student>() {
    @OneToMany
    @JoinTable(
        name = "rel_student_studentpackage",
        joinColumns = [JoinColumn(name = "student_id", referencedColumnName = "id")],
        inverseJoinColumns = [JoinColumn(name = "student_package_id", referencedColumnName = "id")]
    )
    var studentPackages: MutableList<StudentPackage> = mutableListOf()

    fun deletePackage(studentPackageId: Int) {
        registerEvent(StudentEvents.DeletePackageRequested(studentPackageId))
    }

    fun addPackage(pkg: StudentPackage) {
        studentPackages.add(pkg)
    }
}

```

Upon our kspKotlin task we get

![](/assets/img/2024-12-24-04-35-48.png)

where 

```kts
package dev.james.alicetimetable.commons.database.entities

import dev.james.alicetimetable.commons.database.enums.Gender
import java.util.UUID
import kotlin.Double
import kotlin.String

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
)

public object StudentMapper {
  public fun toDTO(entity: Student): StudentDTO = StudentDTO(
      entity.id,
      entity.firstName,
      entity.lastName,
      entity.chineseFirstName,
      entity.chineseLastName,
      entity.schoolName,
      entity.studentCode,
      entity.grade,
      entity.phoneNumber,
      entity.wechatId,
      entity.birthdate,
      entity.parentEmail,
      entity.createdAt,
      entity.createdAtHk,
      entity.parentId,
      entity.gender,
  )

  public fun fromDTO(dto: StudentDTO): Student = Student(
      dto.id,
      dto.firstName,
      dto.lastName,
      dto.chineseFirstName,
      dto.chineseLastName,
      dto.schoolName,
      dto.studentCode,
      dto.grade,
      dto.phoneNumber,
      dto.wechatId,
      dto.birthdate,
      dto.parentEmail,
      dto.createdAt,
      dto.createdAtHk,
      dto.parentId,
      dto.gender,
  )
}
```

#### Processor Module


Create a submodule with the following structure:

[![](/assets/img/2024-12-24-04-18-30.png)](/assets/img/2024-12-24-04-18-30.png)

##### Module Configurations



###### settings.gradle.kts

```kts
rootProject.name = "processor"

pluginManagement {
    repositories.gradlePluginPortal()
}

dependencyResolutionManagement {
    repositories.mavenCentral()
}

include("processor")
```

######  build.gradle.kts

```kts
plugins {
    kotlin("jvm") version "1.9.10"
}

group = "dev.james"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}


repositories {
    mavenCentral()
}

sourceSets.main {
    kotlin.srcDir("build/generated/ksp/main/kotlin")
}
sourceSets.test {
    kotlin.srcDir("build/generated/ksp/test/kotlin")
}

dependencies {
    testImplementation(kotlin("test"))
    implementation("com.google.devtools.ksp:symbol-processing-api:1.9.10-1.0.13")
    implementation(kotlin("stdlib"))
    implementation("com.squareup:kotlinpoet:1.14.2")
    implementation("com.squareup:kotlinpoet-ksp:1.14.2")
}

tasks.test {
    useJUnitPlatform()
}
```

##### Processor and Provider

###### Customer Annotation: GenerateDTO

```kt
package dev.james.processor

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.SOURCE)
annotation class GenerateDTO
```

###### GenerateDTOProcessor

```kt
package dev.james.processor

import com.google.devtools.ksp.processing.*
import com.squareup.kotlinpoet.*

import com.google.devtools.ksp.symbol.KSClassDeclaration
import com.google.devtools.ksp.symbol.KSAnnotated
import com.squareup.kotlinpoet.ksp.toTypeName
import com.squareup.kotlinpoet.ksp.toTypeParameterResolver
import com.squareup.kotlinpoet.ksp.writeTo

class GenerateDTOProcessor(
    private val codeGenerator: CodeGenerator,
    private val logger: KSPLogger
) : SymbolProcessor {

    override fun process(resolver: Resolver): List<KSAnnotated> {
        val symbols = resolver.getSymbolsWithAnnotation(GenerateDTO::class.qualifiedName!!)
            .filterIsInstance<KSClassDeclaration>()

        symbols.forEach { classDeclaration ->
            generateDTOAndMapper(classDeclaration)
        }

        return emptyList()
    }

    private fun generateDTOAndMapper(classDeclaration: KSClassDeclaration) {
        val packageName = classDeclaration.packageName.asString()
        val className = classDeclaration.simpleName.asString()

        // Resolve type parameters for the class
        val typeParameterResolver = classDeclaration.typeParameters.toTypeParameterResolver()

        // Get all fields annotated with @Column
        val fields = classDeclaration.getAllProperties()
            .filter { property -> property.annotations.any { it.shortName.asString() == "Column" } }

        // Generate DTO class
        val dtoClassName = "${className}DTO"
        val dtoTypeSpec = TypeSpec.classBuilder(dtoClassName)
            .addModifiers(KModifier.DATA)
            .primaryConstructor(
                FunSpec.constructorBuilder()
                    .addParameters(
                        fields.map { field ->
                            val typeName = field.type.toTypeName(typeParameterResolver)
                            ParameterSpec.builder(field.simpleName.asString(), typeName).build()
                        }.toList()
                    )
                    .build()
            )
            .addProperties(
                fields.map { field ->
                    val typeName = field.type.toTypeName(typeParameterResolver)
                    PropertySpec.builder(field.simpleName.asString(), typeName)
                        .initializer(field.simpleName.asString())
                        .build()
                }.toList()
            )
            .build()

        // Generate Mapper class
        val mapperClassName = "${className}Mapper"
        val mapperTypeSpec = TypeSpec.objectBuilder(mapperClassName)
            .addFunction(
                FunSpec.builder("toDTO")
                    .addParameter("entity", ClassName(packageName, className))
                    .returns(ClassName(packageName, dtoClassName))
                    .addCode(
                        buildString {
                            append("return $dtoClassName(\n")
                            fields.forEach { field ->
                                append("    entity.${field.simpleName.asString()},\n")
                            }
                            append(")")
                        }
                    )
                    .build()
            )
            .addFunction(
                FunSpec.builder("fromDTO")
                    .addParameter("dto", ClassName(packageName, dtoClassName))
                    .returns(ClassName(packageName, className))
                    .addCode(
                        buildString {
                            append("return $className(\n")
                            fields.forEach { field ->
                                append("    dto.${field.simpleName.asString()},\n")
                            }
                            append(")")
                        }
                    )
                    .build()
            )
            .build()

        // Write the DTO and Mapper classes to files
        val fileSpec = FileSpec.builder(packageName, dtoClassName)
            .addType(dtoTypeSpec)
            .addType(mapperTypeSpec)
            .build()

        val dependencies = Dependencies(true, *listOfNotNull(classDeclaration.containingFile).toTypedArray())
        fileSpec.writeTo(codeGenerator, dependencies)
    }
}
```

###### GenerateDTOProcessorProvider

```kt
package dev.james.processor

import com.google.devtools.ksp.processing.SymbolProcessor
import com.google.devtools.ksp.processing.SymbolProcessorEnvironment
import com.google.devtools.ksp.processing.SymbolProcessorProvider

class GenerateDTOProcessorProvider : SymbolProcessorProvider {
    override fun create(environment: SymbolProcessorEnvironment): SymbolProcessor {
        return GenerateDTOProcessor(
            codeGenerator = environment.codeGenerator,
            logger = environment.logger
        )
    }
}
```

##### Register Provider

Finally create a file

- `processor/src/main/resources/META-INF/services/com.google.devtools.ksp.processing.SymbolProcessorProvider`

with the following Content:

```text
dev.james.processor.GenerateDTOProcessorProvider
```

#### Import the Processsor into our main Module

##### Main module settings.gradle.kts

```kts{12}
pluginManagement {
    repositories {
        maven { url = uri("https://repo.spring.io/milestone") }
        maven { url = uri("https://repo.spring.io/snapshot") }
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}
rootProject.name = "Alice-Timetable-System"

//
include("processor")
```

##### Main module build.gradle.kts

```kts
plugins {
    kotlin("jvm") version "1.9.10"
    id("com.google.devtools.ksp") version "1.9.10-1.0.13"
    ...
}


// instruct compiler where to to find the generated code
kotlin {
    sourceSets.main {
        kotlin.srcDir("build/generated/ksp/main/kotlin")
    }
    sourceSets.test {
        kotlin.srcDir("build/generated/ksp/test/kotlin")
    }
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict")
    }
}

// import our custom processor
dependencies {
    ksp(project(":processor"))            // register processors
    implementation(project(":processor")) // make custom annotation importable
}
```

##### Generate DTO and Mappers

Now we can generate `DTO` and `Mapper` (which by default is executed on `bootRun` as well) by the gradle task

![](/assets/img/2024-12-24-04-30-58.png)


