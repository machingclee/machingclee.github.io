const n=`---
title: Spring Data MongoDB
date: 2025-08-28
id: blog0409
tag: springboot, kotlin
toc: true
intro: Suppose that we need to handle mongoDB using kotlin due to whatever strange reason, let's define simple repository and caveats that we may encounter due to extra-ordinary flexibility in  schema of MongoDB.
img: spring
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

### Imports in build.gradle.kts


\`\`\`kts
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-mongodb")
}
\`\`\`

### Basic Document Definition


\`\`\`kotlin-1
import org.springframework.data.mongodb.core.index.CompoundIndex
import org.springframework.data.mongodb.core.mapping.Document
import org.springframework.data.mongodb.core.mapping.Field


@Document(collection = "my_collection")
@CompoundIndex(
    def = "{'nested.doc.id': 1}", // here 1 means an ascending index
    name = "any_id_name"
)
\`\`\`
You can specify multiple fields like \`"{'field1': 1, 'field2': -1}"\` for compound indexes
\`\`\`kotlin-11
data class SomeMongoClass(
    @Id // ObjectID field _id will be mapped to id in String using this annotation
    val published: Boolean
    val model1s: List<NestedModel1>? = emptyList(),
    val createdAt: Float?,
    val updatedAt: Float?,
) {
    data class NestedModel1(
        val model2s: List<NestedModel2>? = emptyList(),
        val happy: Boolean
        ...
    ) {
        data class NestedModel2(
            @Field("id")    // with this the mongo sub-document will 
                            // have _id attribute which is an ObjectId
            val id: String?= null
            ...
        ) : Serializable
    }
}

\`\`\`

### Basic Repository

\`\`\`kotlin
import org.bson.types.ObjectId
import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.data.mongodb.repository.Query


interface SomeMongoClassRepository : MongoRepository<SomeMongoClass, ObjectId> {
    @Query(value = "{ \\$or: [{ 'model1s.model2s.id' : { \\$in: ?0 } }, ... ] }")
    fun findAllByResultSummaryUuidIn(resultSummaryUuids: List<String>): MutableList<SomeMongoClass>
}
\`\`\`
Here we wrap the custom query by \`@Query\`. For complex aggregation pipeline we can ask LLM model for help.

At this point we can create standard query in this interface by naming convention such as 

\`\`\`kotlin
    fun findByCreatedAt(...): SomeMongoClass
\`\`\`
When the setup is correct the function name can be auto-completed.

### Query for Documents with Dramatically Varying Schema

#### Problem

As the project grows, our schema may change dramatically due to business growth. It is inevitable to manage old data that failed to be parsed into \`SomeMongoClass\`.

As long as ***one*** result cannot be parsed into \`SomeMongoClass\`, query generated from the interface \`SomeMongoClassRepository\` via spring-data mongo will ***always*** fail.

#### Solution

- To tackle this problem we need to query for results regardless of its schema (namely, we fetch \`Document\`'s). 

- We then parse the documents into desired data type from our code and handle the exception gracefully.


\`\`\`kotlin{11,14}
class SomeQueryService (
    private val mongoTemplate: MongoTemplate,
) {
    private fun getResultsAfter(afterTimestamp: Long): List<SomeMongoClass> {
        val query = Query.query(
            Criteria().orOperator(
                Criteria.where("createdAt").exists(true).gt(afterTimestamp),
                Criteria.where("updatedAt").exists(true).gt(afterTimestamp)
            )
        )
        return mongoTemplate.find(query, Document::class.java, "my_collection")
            .mapNotNull { doc ->
                try {
                    mongoTemplate.converter.read(SomeMongoClass::class.java, doc)
                } catch (e: MappingInstantiationException) {
                    println("Skipping document with mapping issues: \${doc.getObjectId("_id")}")
                    null
                } catch (e: Exception) {
                    println(e)
                    null
                }
            }
    }
}
\`\`\``;export{n as default};
