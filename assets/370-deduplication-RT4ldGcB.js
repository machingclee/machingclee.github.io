const e=`---
title: "Deduplicate data in Database"
date: 2025-03-14
id: blog0370
tag: sql
toc: true
intro: "Record a simple migration script to remove all duplicated rows before adding a unique index to a column in a table."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Duplicated Data

Assume that a translation table has a column \`messageId\` and a column \`createdAt\`. Which accidentally has more than one records:

\`\`\`text
messageId   createdAt           translation
123         1600000000000       I am James
123         1700000000000       I am James
123         1800000000000       I am James
321         1750000000000       Hi James
321         1850000000000       Hi James, nice to meet you
\`\`\`

We want to reduce these groups of records into simply one per group, let's say only the latest one:

\`\`\`text
messageId   createdAt           translation
123         1800000000000       I am James
321         1850000000000       Hi James, nice to meet you
\`\`\`

Here is how we do it easily:

### SQL Script to Remove Duplicated Records

\`\`\`sql{3,4}
delete from "MessageTranslation" where id not in (
	-- all translation that is latest among dulicated message
	select distinct on ("messageId") "MessageTranslation".id from "MessageTranslation"
    order by "MessageTranslation"."messageId", "MessageTranslation"."createdAt" desc
)
\`\`\`

- The highlighted lines represent the \`id\`'s of translation record that is latest among the set of messages having the same \`messageId\`.

  **_Reason._**

  - We first order the results by \`messageId\`
  - next we further order them by \`createdAt desc\`
  - We \`select distinct on ("messageId")\` to select the **_first occurence_** of results "grouped by" the \`order by\` clause.

    Note that if we need to order by $n$ ($n\\ge2$) columns, we would need to \`distinct on\` the first $n-1$ columns.

- Finally we have selected desired results, we delete those that are not desired.
`;export{e as default};
