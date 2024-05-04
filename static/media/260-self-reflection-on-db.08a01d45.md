---
title: "Self-Reflection on Database Schema Design"
date: 2024-05-02
id: blog0260
tag: sql
intro: "Record some mistake they can be avoid when designing a database schema."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Preface

Recently I have developed a mobile application for the company I am working at. I am grateful to have an oppurtunity and precious experience to design the whole system from zero.

<a href="/assets/img/2024-05-04-20-39-27.png">![](/assets/img/2024-05-04-20-39-27.png)</a>

#### What I failed
- **Sparsity of Table.** Even some data looks identitcal, I have tried to mix data of two interfaces into one table, for example:

  <a href="/assets/img/2024-05-04-18-42-15.png"><img src="/assets/img/2024-05-04-18-42-15.png" width="180"/></a>

  where the type of this record depends on `SessionType`. It causes some of the column being always `null` (i.e., ***sparsity***), and it causes confusion when do we use this variable. 
  
  From this lesson I should have made additional two tables named 
  - `InstantIssueDetail` and
  - `ReplyDetail`, 
  
  and link to these two tables via 
  - `InstantIssueDetail.session_id` and 
  - `ReplyDetail.session_id`   
  respectively. The new tables group all the `type`-specific data.

- Similar case such as message can be of type `Image`, `Voice`, `Text`, and forturnately I can avoid the sparsity timely:

  <a href="/assets/img/2024-05-04-20-44-21.png"><img src="/assets/img/2024-05-04-20-44-21.png" width="400"/></a>


- **Didn't Stop Bad Design at the Beginning.** In the past we had a tech lead designing a `UserRegistration` table (where `User` table has been made) which serves as an intermediate table before `User`.

  However 90% of data are the same. As the working experience of the lead is 5 to 6-years more than me therefore I am afraid to oppose this idea, which results in unpredictable extra amount of works as every time we deal with registration we need to look at two tables. 

  If we want to select data, we need to `case, when, then, else, end` many times.

#### What I succeeded
Researched on various methods, orm, youtube videos for database adminstration, eventually 

- Adopted **Prisma** as a table migration tool in light of `Flyway` in spring boot and `Goose` in golang.

- Use **Kysely** as a ***type-safe*** query builder.

- Standardize the approach to ***version*** all the schema changes in database, and reproduce all the changes to different environments.

Our product works well with the database and developers can easily write their query with good semantic meaning, for example: 

<a href="/assets/img/2024-05-04-20-28-16.png">![](/assets/img/2024-05-04-20-28-16.png)</a>

which an ORM cannot provide. Note that a table carries different meaning in differnent context!

