const e=`---
title: "Self-Reflection on Database Schema Design"
date: 2024-05-02
id: blog0260
tag: sql
intro: "Record some mistake that can be avoided when designing a database schema."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Preface

Recently I have developed a mobile application for the company I am working at. I am grateful to have an oppurtunity and precious experience to design the whole system from zero.

<a href="/assets/img/2024-05-04-20-39-27.png">![](/assets/img/2024-05-04-20-39-27.png)</a>

### What I failed
- **Sparsity of Table.** Some data looks identitcal, I have therefore tried to mix two interfaces into one table, for example:

  <a href="/assets/img/2024-05-04-18-42-15.png"><img src="/assets/img/2024-05-04-18-42-15.png" width="180"/></a>

  where the type of this record depends on \`SessionType\`, which determines whether we use \`isDraftInstantIssue\` or \`isDraftReply\`. It causes some of the column being always \`null\` (i.e., ***sparsity***), and it causes confusion when do we use these booleans.
  
  From this lesson I should have made additional two tables named 
  - \`InstantIssueDetail\` and
  - \`ReplyDetail\`, 
  
  and link these two tables to the original table via 
  - \`InstantIssueDetail.session_id\` and 
  - \`ReplyDetail.session_id\`   
  respectively. The new tables group all the \`type\`-specific data.

- Similar to the above case. A message can be of type \`Image\`, \`Voice\`, \`Text\`, and forturnately I can avoid the sparsity timely:

  <a href="/assets/img/2024-05-04-20-44-21.png"><img src="/assets/img/2024-05-04-20-44-21.png" width="400"/></a>


- **Didn't Stop Bad Design at the Beginning (Data Duplication).** In the past we had a tech lead designing a \`UserRegistration\` table (where \`User\` table has been made already) which serves as an intermediate table before \`User\`.

  However ***90% of data are the same***. This results in unpredictable extra amount of works as every time we deal with registration we need to look at two tables. 

  If we want to select data, we need to \`case, when, then, else, end\` many times.

### What I succeeded
Researched on various ORMs, youtube videos on those frameworks, pros and cons, combining the experience with sql tutorial from other languages, eventually 

- Adopted **Prisma** as a table migration tool in light of \`Flyway\` in spring boot and \`Goose\` in golang.

- Used **Kysely** as a ***type-safe*** query builder.

- Standardized the approach to ***version*** all the schema changes in database, and reproduce all the changes to different environments.

Our product works well with the database and developers can easily write their query with good semantic meaning, for example: 

<a href="/assets/img/2024-05-04-20-28-16.png">![](/assets/img/2024-05-04-20-28-16.png)</a>

which an ORM cannot provide. Note that a table carries different meaning in differnent context!

`;export{e as default};
