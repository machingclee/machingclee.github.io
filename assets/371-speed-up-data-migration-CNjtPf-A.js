const n=`---
title: "Speed up Data Migration using JPA with Channels and CountDownLatch"
date: 2025-03-15
id: blog0371
tag: springboot, kotlin
toc: false
intro: "We record a rate-limited concurrent tasks techique borrowed from golang."
img: kotlin
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

Bear in mind not every annotation for joining table is lazy-loading by default (**_eager-loading_** harms the data migration speed significantly).

We have studied how to create **_rate-limited_** concurrent tasks in golang [**_here_**](/blog/article/Golang-Simple-yet-Useful-Knowledge#Main-Program). With kotlin we can immitate the same concept directly!

\`\`\`kotlin
    suspend fun createDefaultTags() = coroutineScope {
        val batchSize = 20
        val total = teamRepository.count().toDouble()
        val totalPages = Math.ceil(total/batchSize).toInt()
        println("BatchSize: $batchSize, Pages: $totalPages")

        val latch = CountDownLatch(totalPages)
        val channel = kotlinx.coroutines.channels.Channel<Unit>(5)

        for (page in 0..<totalPages) {
            launch(Dispatchers.IO) {
                try {
                    channel.send(Unit)
                    batchInsertTags(page, batchSize, totalPages)
                } catch (e: Exception) {
                    throw e
                } finally {
                    channel.receive()
                    latch.countDown()
                }
            }
        }
        println("Waiting for everything to finish ...")
        latch.await()
        println("Finished!")
    }
\`\`\`

In otherwords,

- \`CountDownLatch\` plays the role as \`sync.WaitGroup\` and
- \`Channel<Unit>\` plays the role as \`chan struct{}\`.
`;export{n as default};
