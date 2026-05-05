const n=`---
title: Multithreading with Semaphore
date: 2025-08-27
id: blog0408
tag: springboot, kotlin
toc: false
intro: In the past we have studied how to do limited number of concurrent tasks via buffered channels, an approach inspired from golang. This time we make use of native API of Semaphore to achieve the same goal.
---

For buffered channel approach the reader may refer to [this article](/blog/article/Speed-up-Data-Migration-using-JPA-with-Channels-and-CountDownLatch). This time we dicuss another native API from kotlin called ***Semaphore***.


<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

\`\`\`kotlin{7,17-22}
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit


class SomeConcurrenTask(
    private val transactionTemplate: TransactionTemplate,
) {
    // divide tasks into batches with each being of size at most 20
    val taskIdsBatches = taskIds.chunked(20)
    // concurrnet limit to 10
    val semaphore = Semaphore(10)

    runBlocking {
        val deferredResults = taskIdsBatches.mapIndexed { batchIndex, taskIdsBatch ->
            async(Dispatchers.IO) {
                semaphore.withPermit {
                    println("Processing batch $batchIndex/\${taskIdsBatches.size}")
                    transactionTemplate.execute {
                        someTransaction(taskIdsBatch)
                    }
                }
            }
        }

        println("Waiting for everything to finish ...")
        deferredResults.awaitAll()
        println("Finished!")
    }
}
\`\`\``;export{n as default};
