const e=`---
title: "Problem of SQL Based Nodejs Backend, Should we use Query Builder?"
date: 2025-09-17
id: blog0415
tag: nodejs, sql
toc: true 
img: /assets/img/2025-10-04-21-01-28.png
scale: 1.4
offsetx: 25
offsety: 15
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>




### Examples (SQL-First Approach)

If an application is composed of various SQLs when interacting with the database, it may grow to have several scenarios such as the following:




####  Complexity Level 1

In the most basic form we have maintainable queries via query-builder:

[![](/assets/img/2025-09-07-18-09-07.png)](/assets/img/2025-09-07-18-09-07.png)


#### Complexity Level 2

The following tries to do two separate \`LATERAL JOIN\`'s and \`Json Aggregate\`'s:

[![](/assets/img/2025-09-07-18-03-29.png)](/assets/img/2025-09-07-18-03-29.png)

Complexity increases and it takes developers effort  to understand what's going on.



#### Complexity Level $\\to \\infty$

The following is taken from a deprecated project, it starts to be ***unmaintainable*** even with comments that's trying to explain what's happening:

[![](/assets/img/2025-09-07-18-33-09.png)](/assets/img/2025-09-07-18-33-09.png)


- You need to have the knowledge how 
  \`\`\`sql
  WITH some_table AS (SELECT ...)
  \`\`\`
  works and how to achieve this in other query-builder framework. 

- Plus we still have lateral joins and json aggregates there.


<br/>


### Problems of the SQL-First Approach

1. SQL statements itself, by nature, are ***not easily readable*** compared to traditional programming language, even there are query builders. 

    You may have subqueries, may have \`case if then else end\`, may have tricky use of \`SQL\` functions, that nest into the \`SQL\` statement several times.

2. Long SQL is hard to debug, we cannot add a breakpoint to investigate the data.

<!-- 3. Moreover, the project is now tightly coupled with knowledge from specific SQL. There are those kind of tricks that only appear in  PostgreSQL like we have 
    \`\`\`sql
    SELECT DISTINCT ON + ORDER BY
    \`\`\` 
    for data deduplication. But \`DISTINCT ON\` is Postgre-only. Other example like \`ON CONFLICT DO NOTHING\`, \`JSONB\` query, etc, useful queries are Postgre-specific. -->

3. Complex and tricky SQL can bring huge complexity to the project, which also increases ***mental cost*** for other developers to understand and modify it[^wtever]. 

[^wtever]:
      If you are simply a one-man band, do whatever you want!

### Short Takes From Native SQLs


There are indeed cases where native query is necessary for performance such as batch-insertion, or special queries for dashboard. But we can avoid them when they are not necessary.


We need to be careful in the decision of whether or not to use query builder in a project.

-  In Nodejs world there are 

    - \`Kysely.js\` or \`Prisma-Kysely.js\`
    - \`Knex.js\`

- In Java/Kotlin world there is
    - \`JOOQ\`

      [Example article](/blog/article/Useful-Query-in-JOOQ)

- In Golang world there is 
    - \`Go-Jet\`


### Footnotes`;export{e as default};
