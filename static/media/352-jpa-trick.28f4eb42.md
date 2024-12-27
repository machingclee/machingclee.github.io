---
title: "JPA Notes for Database First Approach"
date: 2024-12-26
id: blog0352
tag: springboot
toc: true
wip: true
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

#### Auto-Generated Field whose value comes from pre-defined sql function

Simple add `@Generated`
