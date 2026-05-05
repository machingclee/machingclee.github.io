const e=`---
title: "Auto-generated Mapper From Entity Classes into DTO Classes"
date: 2024-12-24
id: blog0351
tag: springboot, jpa
toc: true
intro: "We record the use of ksp package that auto-generates DTO mapper for annotated entity classes."
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Sample Result

Let's choose the following entity class and annotate it by \`@GenerateDTO\`:

\`\`\`kts{20}
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

\`\`\`

Upon our kspKotlin task we get

![](/assets/img/2024-12-24-04-35-48.png)

where

\`\`\`kts
package dev.james.alicetimetable.commons.database.entities

import dev.james.alicetimetable.commons.database.enums.Classroom
import java.util.UUID
import kotlin.Double
import kotlin.Int
import kotlin.String

public data class StudentPackageDTO(
  public val startDate: Double,
  public val paidAt: Double?,
  public val officialEndDate: Double?,
  public val expiryDate: Double?,
  public val min: Int,
  public val courseId: Int,
  public val createdAt: Double?,
  public val createdAtHk: String?,
  public val numOfClasses: Int,
  public val defaultClassroom: Classroom?,
  public val studentid: UUID?,
  public val uuid: UUID?,
  public val id: Int?,
)

public fun StudentPackage.toDTO(): StudentPackageDTO = StudentPackageDTO(
    startDate,
    paidAt,
    officialEndDate,
    expiryDate,
    min,
    courseId,
    createdAt,
    createdAtHk,
    numOfClasses,
    defaultClassroom,
    studentid,
    uuid,
    id,
)
\`\`\`

### Processor Module

Create a submodule with the following structure:

[![](/assets/img/2024-12-24-04-18-30.png)](/assets/img/2024-12-24-04-18-30.png)

#### Module Configurations

##### settings.gradle.kts

\`\`\`kts
rootProject.name = "processor"

pluginManagement {
    repositories.gradlePluginPortal()
}

dependencyResolutionManagement {
    repositories.mavenCentral()
}
\`\`\`

##### build.gradle.kts

\`\`\`kts
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
\`\`\`

#### Processor and Provider

##### Customer Annotation: GenerateDTO

\`\`\`kt
package dev.james.processor

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.SOURCE)
annotation class GenerateDTO
\`\`\`

##### GenerateDTOProcessor

\`\`\`kt
package dev.james.processor

import com.google.devtools.ksp.processing.*
import com.squareup.kotlinpoet.*
import com.google.devtools.ksp.symbol.KSClassDeclaration
import com.google.devtools.ksp.symbol.KSAnnotated
import com.google.devtools.ksp.symbol.KSPropertyDeclaration
import com.squareup.kotlinpoet.ksp.TypeParameterResolver
import com.squareup.kotlinpoet.ksp.toTypeName
import com.squareup.kotlinpoet.ksp.toTypeParameterResolver
import com.squareup.kotlinpoet.ksp.writeTo

data class DTOProperty(
    val name: String,
    val type: TypeName,
    val accessor: String, // How to access this field from the entity
)

class GenerateDTOProcessor(
    private val codeGenerator: CodeGenerator,
    private val logger: KSPLogger,
) : SymbolProcessor {

    override fun process(resolver: Resolver): List<KSAnnotated> {
        val symbols = resolver.getSymbolsWithAnnotation(GenerateDTO::class.qualifiedName!!)
            .filterIsInstance<KSClassDeclaration>()

        symbols.forEach { classDeclaration ->
            generateDTOAndExtension(classDeclaration, resolver)
        }

        return emptyList()
    }

    private fun generateDTOAndExtension(classDeclaration: KSClassDeclaration, resolver: Resolver) {
        val packageName = classDeclaration.packageName.asString()
        val className = classDeclaration.simpleName.asString()

        // Resolve type parameters for the class
        val typeParameterResolver = classDeclaration.typeParameters.toTypeParameterResolver()

        // Get all DTO properties (regular columns + flattened embedded fields)
        val dtoProperties = mutableListOf<DTOProperty>()

        classDeclaration.getAllProperties().forEach { property ->
            when {
                // Regular @Column properties
                property.annotations.any { it.shortName.asString() == "Column" } -> {
                    val columnName = getColumnName(property) ?: property.simpleName.asString()
                    val camelCaseName = snakeToCamelCase(columnName)
                    val typeName = property.type.toTypeName(typeParameterResolver)
                    dtoProperties.add(DTOProperty(
                        name = camelCaseName,
                        type = typeName,
                        accessor = property.simpleName.asString()
                    ))
                }

                // @Embedded properties - flatten them
                property.annotations.any { it.shortName.asString() == "Embedded" } -> {
                    val embeddedProperties = getEmbeddedProperties(property, resolver, typeParameterResolver)
                    dtoProperties.addAll(embeddedProperties)
                }
            }
        }

        // Generate DTO class
        val dtoClassName = "\${className}DTO"
        val dtoTypeSpec = TypeSpec.classBuilder(dtoClassName)
            .addModifiers(KModifier.DATA)
            .primaryConstructor(
                FunSpec.constructorBuilder()
                    .addParameters(
                        dtoProperties.map { property ->
                            ParameterSpec.builder(property.name, property.type).build()
                        }
                    )
                    .build()
            )
            .addProperties(
                dtoProperties.map { property ->
                    PropertySpec.builder(property.name, property.type)
                        .initializer(property.name)
                        .build()
                }
            )
            .build()

        // Generate extension function
        val extensionFunction = FunSpec.builder("toDTO")
            .receiver(ClassName(packageName, className))
            .returns(ClassName(packageName, dtoClassName))
            .addCode(
                buildString {
                    append("return $dtoClassName(\\n")
                    dtoProperties.forEach { property ->
                        append("    \${property.accessor},\\n")
                    }
                    append(")")
                }
            )
            .build()

        // Write the DTO class and extension function to file
        val fileSpec = FileSpec.builder(packageName, dtoClassName)
            .addType(dtoTypeSpec)
            .addFunction(extensionFunction)
            .build()

        val dependencies = Dependencies(true, *listOfNotNull(classDeclaration.containingFile).toTypedArray())
        fileSpec.writeTo(codeGenerator, dependencies)
    }

    private fun getEmbeddedProperties(
        embeddedProperty: KSPropertyDeclaration,
        resolver: Resolver,
        typeParameterResolver: TypeParameterResolver,
    ): List<DTOProperty> {
        val embeddedProperties = mutableListOf<DTOProperty>()

        // Get the type declaration of the embedded class
        val embeddedTypeDeclaration = embeddedProperty.type.resolve().declaration as? KSClassDeclaration
            ?: return emptyList()

        // Check if it's marked as @Embeddable (optional validation)
        val isEmbeddable = embeddedTypeDeclaration.annotations.any {
            it.shortName.asString() == "Embeddable"
        }

        if (!isEmbeddable) {
            logger.warn("Property \${embeddedProperty.simpleName.asString()} is marked @Embedded but its type is not @Embeddable")
        }

        // Get all properties from the embedded class that have @Column
        embeddedTypeDeclaration.getAllProperties().forEach { embeddedFieldProperty ->
            val columnAnnotation = embeddedFieldProperty.annotations.find {
                it.shortName.asString() == "Column"
            }

            if (columnAnnotation != null) {
                val fieldName = embeddedFieldProperty.simpleName.asString()
                val fieldType = embeddedFieldProperty.type.toTypeName(typeParameterResolver)
                val embeddedPropertyName = embeddedProperty.simpleName.asString()

                // Extract column name from @Column annotation and convert to camelCase
                val columnName = getColumnName(embeddedFieldProperty) ?: fieldName
                val camelCaseName = snakeToCamelCase(columnName)

                embeddedProperties.add(DTOProperty(
                    name = camelCaseName,
                    type = fieldType,
                    accessor = "$embeddedPropertyName.$fieldName"
                ))
            }
        }

        return embeddedProperties
    }

    private fun getColumnName(property: KSPropertyDeclaration): String? {
        val columnAnnotation = property.annotations.find { it.shortName.asString() == "Column" }
        return columnAnnotation?.arguments?.find { it.name?.asString() == "name" }?.value?.toString()?.removeSurrounding("\\"")
    }

    private fun snakeToCamelCase(snakeCase: String): String {
        return snakeCase.split("_").mapIndexed { index, word ->
            if (index == 0) {
                word.lowercase()
            } else {
                word.lowercase().replaceFirstChar { it.uppercase() }
            }
        }.joinToString("")
    }
}
\`\`\`

##### GenerateDTOProcessorProvider

\`\`\`kt
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
\`\`\`

#### Register Provider

Finally create a file

- \`processor/src/main/resources/META-INF/services/com.google.devtools.ksp.processing.SymbolProcessorProvider\`

with the following Content:

\`\`\`text
dev.james.processor.GenerateDTOProcessorProvider
\`\`\`

### Import the Processsor into our main Module

#### Main module settings.gradle.kts

\`\`\`kts{13}
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

// make processor module available to the main module
include("processor")
\`\`\`

#### Main module build.gradle.kts

\`\`\`kts
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
\`\`\`

#### Generate DTO and Mappers

Now we can generate \`DTO\` and \`Mapper\` (which by default is executed on \`bootRun\` as well) by the gradle task

![](/assets/img/2024-12-24-04-30-58.png)
`;export{e as default};
