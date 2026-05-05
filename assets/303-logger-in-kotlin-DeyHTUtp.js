const n=`---
title: "Logger in Kotlin"
date: 2024-08-01
id: blog0303
tag: kotlin, springboot
toc: false
intro: "Record the minimal code template for KotlinLogger."
img: kotlin
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Dependencies

\`\`\`text
implementation("io.github.oshai:kotlin-logging-jvm:5.1.0")
\`\`\`

### Code Implementation

\`\`\`kotlin
import io.github.oshai.kotlinlogging.KLogger
import io.github.oshai.kotlinlogging.KotlinLogging
...

@Component
@ProcessingGroup("order-subscription-plan")
class SubscriptionPlanOrderEventHandlers(
    val stripCustomerDao: StripecustomerDao,
    val stripeorderDao: StripeorderDao,
) {
    companion object {
        var logger: KLogger = KotlinLogging.logger {}
    }
}
\`\`\`

And we log the messages via \`logger.info { "Some Message" }\`.`;export{n as default};
