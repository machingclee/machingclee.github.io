const e=`---
title: "Useful Query in JOOQ"
date: 2024-08-12
id: blog0314
tag: kotlin, jooq
toc: true
intro: "Record the common usages of JOOQ library."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Subqueries as JSON field in JOOQ

#### What do we have in Kysely?

In \`Kysely\` we have scripts like the following to mimic a \`json_agg\` like statement ([a simple reference for plain SQL](https://stackoverflow.com/questions/60458369/subquery-as-a-json-field)):

- To do a subquery of **_single object_** and embed it into a key called \`voice\`:
  \`\`\`js
  .select(eb => [
      jsonObjectFrom(eb.selectFrom("Voice")
          .select(["Voice.transcription", "Voice.frontendStartTime", "Voice.frontendEndTime", "Voice.jsonUrl"])
          .whereRef("Voice.messageId", "=", "Message.id")
      ).as("voice")
  ])
  \`\`\`
- To do a subquery of **_a list of objects_** and embed it into a key called \`images\`
  \`\`\`js
  .select(eb => [
      jsonArrayFrom(eb.selectFrom("Image")
          .select([
              "Image.id",
              "Image.url"
          ])
          .leftJoin("MessagesSession", "MessagesSession.id", "Image.messagesSessionId")
          .whereRef("Image.messagesSessionId", "=", "LLMSummary.messagesSessionId")
          .where("Image.isDeleted", "!=", true)
      ).as("images")
  ])
  \`\`\`

in the next section we demonstrate the analogs in \`JOOQ\`.

#### Subquery a list of objects in JOOQ

Let \`db\` be an injected \`DSLContext\` object.

\`\`\`kotlin{4-11}
db
    .select(
        TEACHER.NAME.\`as\`("teacherName"),
        multiset(
            select(
                COURSE.NAME.\`as\`("courseName"),
                COURSE.CATEGORY.\`as\`("courseCategory")
            )
                .from(COURSE)
                .where(COURSE.TEACHERID.eq(TEACHER.ID))
        ).\`as\`("courses").convertFrom { it.into(CourseDetail::class.java) }
    )
    .from(TEACHER)
    .where(TEACHER.ID.eq(teacherId))
    .fetchOneInto(TeacherDetail::class.java)
\`\`\`

![](/assets/img/2024-08-13-05-54-26.png)

#### Subquery an object in JOOQ

We keep using \`multiset\`, with an distinction that we convert the list into an object by \`firstOrNull()\`:

\`\`\`kotlin-1{14-16,20-22}
db.select(
    QUOTA_SEAT.asterisk(),
    multiset(
        select(counterTable.asterisk())
            .from(counterTable)
            .where(
                counterTable.SEATID.eq(seatTable.ID)
                    .and(counterTable.ACTIVE.eq(true))
            )
    ).\`as\`("activeCounters").convertFrom { it.into(QuotaUsagecounter::class.java) },
    multiset(select(QUOTA_PERSONALSEAT.asterisk())
                    .from(QUOTA_PERSONALSEAT)
                    .where(QUOTA_PERSONALSEAT.SEATID.eq(seatTable.ID))
    ).\`as\`("personalSeatData").convertFrom { result -> result.map { 
        it.into(QuotaPersonalseat::class.java) }.firstOrNull()
    },
    multiset(select(QUOTA_TEAMSEAT.asterisk())
                    .from(QUOTA_TEAMSEAT)
                    .where(QUOTA_TEAMSEAT.SEATID.eq(seatTable.ID))
    ).\`as\`("teamSeatData").convertFrom { result -> result.map { 
        it.into(QuotaTeamseat::class.java) }.firstOrNull() 
    }
)
    .from(seatTable)
    .where(...)
\`\`\`

Sample Result:

![](/assets/img/2024-09-15-16-53-32.png)

### Batch Insert

Let \`QUOTA\` be an exported value in \`db.tables.references.*\` (in \`jooq\` sense) and \`db\` a \`DSLContext\` object:

\`\`\`kotlin
val record = db.newRecord(QUOTA).apply {
    this.audiolimit = 10
    this.owneremail = "machingclee@gmail.com"
}

db.batchInsert(List(100) { record }).execute()
\`\`\`

### Conditionally Ignored SQL Statement

\`\`\`kotlin{19}
import org.jooq.impl.DSL.*

db.select(
    seatTable.asterisk(),
    multiset(
        select(counterTable.asterisk())
            .from(counterTable)
            .where(
                counterTable.SEATID.eq(seatTable.ID)
                    .and(counterTable.ACTIVE.eq(true))
            )
    ).\`as\`("activeCounters").convertFrom { it.into(QuotaUsagecounter::class.java) }
)
    .from(seatTable)
    .where(
        seatTable.TYPE.eq(seattype)
            .and(seatTable.ACTIVE.eq(true))
            .and(seatTable.OWNEREMAIL.eq(planOwnerEmail))
            .and(if (targetEmail != null) seatTable.ASSIGNTARGETEMAIL.eq(targetEmail) else trueCondition())
            .and(seatTable.ISTRIAL.eq(isTrial))
    )
    .fetch()
    .into(SeatWithCounters::class.java)
\`\`\`

### Where Clause with a Column Inside a Tuple

\`\`\`kotlin
.and(QUOTA_SEAT.TYPE.\`in\`(listOf(QuotaSeattype.PERSONAL_POWERFUL_BILLIE,
                                 QuotaSeattype.PERSONAL_HANDY_BILLIE)))
\`\`\`
`;export{e as default};
