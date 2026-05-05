const t=`---
title: "Joda Time"
date: 2024-08-27
id: blog0317
tag: kotlin
toc: true
intro: "Record convenient tool to manage time in kotlin"
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Dependency
\`\`\`text
implementation("joda-time:joda-time:2.12.7")
\`\`\`

### Usage

#### Addition
\`\`\`kotlin
import org.joda.time.DateTime
import org.joda.time.format.DateTimeFormat

val now = DateTime()
val jumpTo = now.plusDays(day)
val nextDayMS = jumpTo.millis 
\`\`\`
#### Date Formatting
\`\`\`kotlin
val createDate = Datetime()
val fmt = DateTimeFormat.forPattern("MMM dd, YYYY")
val formattedCreateDate = fmt.print(createDate)
// or val formattedCreateDate = fmt.print(createDate.millis)
\`\`\`

### Much more Reference from Documentation

- https://js-joda.github.io/js-joda/manual/formatting.html`;export{t as default};
