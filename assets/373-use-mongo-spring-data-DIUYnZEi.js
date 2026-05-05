const n=`---
title: 'Mongo in "JPA": spring-boot-starter-data-mongodb'
date: 2025-03-18
id: blog0373
tag: mongo, jpa, springboot
toc: true
intro: "Record how to interact with mongodb in a ***JPA*** manner."
img: spring
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Dependencies

\`\`\`text
implementation("org.springframework.boot:spring-boot-starter-data-mongodb")
\`\`\`

### Define a Document Class (Namely, a Collection)

\`\`\`kotlin-1{12}
import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.mapping.Document
import java.io.Serializable

enum class LLMDefaultLanguage(val code: String) {
    EN("en"),
    TC("tc");
}

@Document(collection = "llmsummaries")
data class LLMSummary(
    @Id
    val id: String? = null,
    val isDeleted: Boolean?,
    val defaultLanguage: String?,
    val messagesSessionId: String?,
    val messagesSessionType: String?,
    val timeZone: String?,
    val success: Boolean?,
    val time_cost: Float?,
    val version: String?,
    val model_meta: List<ModelMeta>?,
    val result: List<LLMResult>?,
    val zhResult: List<LLMResult>?,
    val createdAt: String?,
    val updatedAt: String?
) {
\`\`\`

Here the \`@Id\`-annotated field will be translated into \`_id: ObjectID\` (into db) and into \`id: String\` (out of db) automatically.

\`\`\`kotlin-28{59}
    data class LLMResult(
        var issueId: String?,
        var summaryUuid: String?,
        val groupID: Int?,
        val lang: String?,
        val endTime: String?,
        val startTime: String?,
        val startTimestamp: Float?,
        val endTimestamp: Float?,
        val originalScripts: List<OriginalScript>? = listOf(),
        val imgUrls: List<String>?,
        val keyPoints: List<String>?,
        val summary: String?,
        val title: String?,
        val priority: OnOffProperty?,
        val sentiment: OnOffProperty?,
        val is_identity: Boolean?,
        val impact: List<OnOffProperty>?,
        val speechAct: List<OnOffProperty>?,
        val topic: List<OnOffProperty>?
    ) {
        data class OriginalScript(
            val time: Float,
            val name: String,
            val text: String
        )
    }

    data class OnOffProperty(
        var name: String? = null,
        var on: Boolean? = null,
        @Field("id")
        var id: String? = null,
    ) : Serializable
\`\`\`

\`id\` is a reserveed keyword for \`spring-data-mongo\`. Without otherwise specified, \`id\` field will be saved as \`_id\` in mongo document. To enforce the \`id\`-naming, we need to use \`@Field("id")\`.

\`\`\`kotlin-63
    data class ModelMeta(
        val model_name: String,
        val token_count: TokenCount
    ) {
        data class TokenCount(
            val input_tokens: Int,
            val output_tokens: Int,
            val total_tokens: Int
        )
    }
}
\`\`\`

### Define a Repository

#### Auto Generated Queries and Custom Queries

By defining a class above explicitly, now we can enjoy the auto-completed repository method within the repository method:

\`\`\`kotlin-1{10,11}
import com.wonderbricks.billie.commons.mongo.LLMSummary
import org.bson.types.ObjectId
import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.data.mongodb.repository.Query
import java.util.stream.Stream

interface LLMSummaryMongoRepository : MongoRepository<LLMSummary, ObjectId> {
    fun findAllByResultSummaryUuidIn(resultSummaryUuids: List<String>): MutableList<LLMSummary>

    @Query(sort = "{ '_id': -1 }",
           value = "{ \\$or: [{ 'result.summaryUuid' : ?0 }, { 'zhResult.summaryUuid' : ?0 } ] }")
    fun findByResultSummaryUuid(uuid: String?): Stream<LLMSummary>?

    fun findByMessagesSessionIdIn(sessionIds: List<String>): List<LLMSummary>

    fun findByMessagesSessionId(sessionId: String): LLMSummary?
\`\`\`

Remarks on \`@Query\` highlighted above:

- Unlike jpa the positional argument starts from \`?0\` (while in jpa we starts from \`?1\`).

- Unlike jpa the use of \`@Param\` for named parameter is not supported by default (special config in \`application.yml\` is needed).

#### Complex Update Aggregation Pipeline

For complex query we can write custom filter using \`@Query\` and custom aggregation pipeline using \`@Update\`.

\`\`\`kotlin-17
    @Query("""
    {
        'result': { \${'$'}exists: true },
        'result.topic': { \${'$'}exists: true }
    }
    """)
    @Update("""
        {
            '\${'$'}pull': {
                'result.\${'$'}[].topic': {
                    'id': { \${'$'}in: ?0 }
                }
            }
        }
    """)
    fun removeEnResultsTopicByTagIds(tagIds: List<String>)
}
\`\`\`

Note that the \`@Update\` part can be an object or an **_array_** of objects, as in the native \`updateMany\` API in \`javascript\` world:

\`\`\`js
db.collection.updateMany({ filter }, [
  { $set: { field: expression } },
  { $unset: ["fieldToRemove"] },
]);
\`\`\`

### Indexing

To add an index in a nested field, we add the following right below \`@Document\`.

\`\`\`kotlin
@CompoundIndex(
    def = "{'result.topic.id': 1}",
    name = "topic_id_idx"
)
\`\`\`

Here \`1\` means that we add an index in ascending order (adding index is like adding a sortable keys).
`;export{n as default};
