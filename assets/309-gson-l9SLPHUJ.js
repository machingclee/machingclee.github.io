const n=`---
title: "Access Nested Properties from Json String in Kotlin"
date: 2024-08-08
id: blog0309
tag: kotlin
toc: true
intro: "We study some example of deserialization of json strings using Gson and kotlinx-serialization-json."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Gson: JSON String into POJO

#### Dependencies of Gson

\`\`\`text
implementation("com.google.code.gson:gson:2.11.0")
\`\`\`

#### Example 1
Let's take an example of \`Event\` from \`Stripe\` sdk, in which I want to access the value of key  \`orderId\` in
\`\`\`json
// via event.dataObjectDeserializer.\`object\`.get().toJson()
{
    ...
    "meatadata": {
        "orderId": "cx_a34_sfFddazadDFfd"
    },
    ...
}
\`\`\`
- The general approach is to reduce whatever \`object\` we have into a json string.

- After a json string is obtained, we model it by a sequence of \`data class\`'s.
  \`\`\`kotlin 
  data class EventObject(val metadata: MetaData)
  data class MetaData(val orderId: String)
  \`\`\`

- We parse by \`Gson\`:

  \`\`\`kotlin
  import com.google.gson.Gson

  val eventObj = Gson().fromJson(
      event.dataObjectDeserializer.\`object\`.get().toJson(), // <-- the json string
      EventObject::class.java
  )
  val orderId = eventObj.metadata.orderId
  \`\`\`


### JSONObject and kotlinx.serialization: Map $\\to$ JSON String $\\to$ POJO

This is intensively used in my \`jwt\` util class in this [blog post](/blog/article/JWT-in-Spring-boot-II-Get-rid-of-Spring-Security-More-on-Parsing-Json-String-into-Pojo#Jwt).

#### Dependencies of org.json and kotlinx-serialization-json
\`\`\`text
plugins {
    kotlin("plugin.serialization") version "2.0.0"
}

dependencies {
    implementation("org.json:json:20240303")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")
}
\`\`\`

#### Example 2

\`\`\`kotlin
import org.json.JSONObject
import kotlinx.serialization.json.Json

val stringPayload = JSONObject(jwt.otherClaims).toString() // jwt.otherClaims is a Map<String, Any>
val tokenPayload = Json.decodeFromString<JwtPayload>(stringPayload)
\`\`\`

#### Remark

- When \`stringPayload\` contains unknown keys compared to \`JwtPayload\`, we should use 
  \`\`\`text
  Json { ignoreUnknownKeys = true }
  \`\`\`
  instead of simply \`Json\`. This is a usual case because sometimes we are just concerned about certain keys inside a json, we don't intent to completely list all of them.

- The \`Gson.fromJson()\`  and \`Json{ ignoreUnknownKeys = true }\` approaches are interchangeable.

`;export{n as default};
