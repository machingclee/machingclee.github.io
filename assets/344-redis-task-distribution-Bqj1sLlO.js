const n=`---
title: "Redis Task Distribution in Kotlin"
date: 2024-11-30
id: blog0344
tag:  springboot
toc: true
intro: "We record LUSH and BRPOP in kotlin"
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Dependencies

\`\`\`text
implementation("org.springframework.boot:spring-boot-starter-data-redis")
\`\`\`

### RedisService

\`\`\`kt
import kotlinx.coroutines.delay
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.reactor.awaitSingleOrNull
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.stereotype.Service


@Service
class RedisService(
    private val redisTemplate: ReactiveRedisTemplate<String, String>
) {
    suspend fun leftPush(key: String, value: String): Long? {
        return redisTemplate.opsForList().leftPush(key, value).awaitSingle()
    }

    suspend fun blockRightPop(key: String): String? {
        var value: String?
        do {
            value = redisTemplate.opsForList().rightPop(key).awaitSingleOrNull()
            if (value == null) {
                delay(500)
            }
        } while (value == null)
        return value
    }
}
\`\`\`

### Demonstration

\`\`\`kt
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dbmigration")
class DbMigrationTests {
   @Test
   fun insert() {
       runBlocking {
           repeat(5) { index ->
               redisService.leftPush("LIST", "$index")
           }
       }
   }

   @Test
   fun awaitForList() = runBlocking {
       println("Waiting ...")
       brpop@ while (true) {
           val value = redisService.blockRightPop("LIST")
           println("poped value $value")
           if (value === "ENDED") {
               break@brpop
           }
       }
   }
}
\`\`\``;export{n as default};
