---
title: "Useful Query in JOOQ"
date: 2024-08-12
id: blog0314
tag: kotlin, jooq
toc: true
intro: "Record a JOOQ usage"
---

<style>
  img {
    max-width: 660px;
  }
</style>


#### Subqueries as JSON field in JOOQ

##### What do we have in Kysely?

In `Kysely` we have scripts like the following to mimic a `json_agg` like statement ([a simple reference for plain SQL](https://stackoverflow.com/questions/60458369/subquery-as-a-json-field)):

- To do a subquery of ***single object*** embedded inside a key called `voice`:
  ```js
  .select(eb => [
      jsonObjectFrom(eb.selectFrom("Voice")
          .select(["Voice.transcription", "Voice.frontendStartTime", "Voice.frontendEndTime", "Voice.jsonUrl"])
          .whereRef("Voice.messageId", "=", "Message.id")
      ).as("voice")
  ])
  ``` 
- To do a subquery of ***a list of objects*** inside a key called `images`
  ```js
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
  ```

in the next section we demonstrate the analogs in  `JOOQ`.

##### Subquery a list of objects in JOOQ
Let `db` be an injected `DSLContext` object.
```kotlin
db
    .select(
        TEACHER.NAME.`as`("teacherName"),
        multiset(
            select(
                COURSE.NAME.`as`("courseName"),
                COURSE.CATEGORY.`as`("courseCategory")
            )
                .from(COURSE)
                .where(COURSE.TEACHERID.eq(TEACHER.ID))
        ).`as`("courses").convertFrom { it.into(CourseDetail::class.java) }
    )
    .from(TEACHER)
    .where(TEACHER.ID.eq(teacherId))
    .fetchOneInto(TeacherDetail::class.java)
```

![](/assets/img/2024-08-13-05-54-26.png)

##### Subquery an object in JOOQ
Referred from [this post](https://github.com/jOOQ/jOOQ/issues/14174), we replace `multiset` by `field` from above and write:
```kotlin 
field(
    select(
        row(
          user.ID,
          user.NICKNAME,
          user.ROLE
        )
    ).from(user)
    .where(user.ID.eq(food.CREATED_BY)) 
).`as`("createdBy")
```


#### Batch Insert
Let `QUOTA` be an exported value in `db.tables.references.*` (in `jooq` sense) and `db` a `DSLContext` object:

```kotlin 
val record = db.newRecord(QUOTA).apply {
    this.audiolimit = 10
    this.owneremail = "machingclee@gmail.com"
}

db.batchInsert(List(100) { record }).execute()
```