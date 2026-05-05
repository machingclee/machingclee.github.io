const e=`---
title: "Javascript Compatible Timestamp in PostgreSQL"
date: 2024-02-27
id: blog0241
tag: sql, prisma
intro: "The default Datetime object in PGSQL by default is UTC+0. Application-wise we wish an absolute timestamp that is compatible with frontend (i.e., javascript), here is how."
toc: true
---

<style>
  img {
    max-width: 660px
  }
</style>

### The Result

- Inside our table:
  
  ![](/assets/img/2024-02-28-06-40-03.png)

- \`createdAt\`
  - It is \`js\`-compatible, which is used mostly in frontend;
  - It is also convenient to database for \`ORDER BY\` statements, 
  - Sorting integers (by numerical value) is much easier than 
    - sorting \`String\`'s (by internal sorting rules of characters) or 
    - sorting\`Datetime\`'s (by internal data structure composing of year, month, timezone, etc).

- \`createdAtHK\` is human-readable in HK timezone


### Prisma

We add the following in any prisma model:

\`\`\`prisma
model SomeModel {
    ...
    createdAt         Float           @default(dbgenerated("gen_created_at()"))
    createdAtHK       String          @default(dbgenerated("gen_created_at_hk_timestr()"))
}
\`\`\`

Then we execute

\`\`\`text
npx prisma migrate dev --create-only
\`\`\`

to create a migration \`.sql\` file for further editing (but not execute the changes).


### SQL Functions

Next we fill in the missing implementation of \`gen_created_at\` and \`gen_created_at_hk_timestr\` in the  generated migration \`.sql\` file.


\`\`\`sql
-- in generated migration SQL file
CREATE OR REPLACE FUNCTION gen_created_at() RETURNS float as $$
BEGIN
	return ROUND(extract(epoch from NOW()::TIMESTAMPTZ) * 1000, 0)::float;
END
$$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION gen_created_at_hk_timestr() RETURNS text as $$
BEGIN
	return TO_CHAR((NOW()::TIMESTAMPTZ AT TIME ZONE 'UTC' AT TIME ZONE 'GMT+8'), 'YYYY-MM-DD HH24:MI:SS');
END
$$
LANGUAGE plpgsql;

-- prisma should have generated something similar:
ALTER TABLE your_table ALTER COLUMN "created_at" SET DEFAULT gen_created_at();
ALTER TABLE your_table ADD COLUMN "createdAtHK" TEXT NOT NULL DEFAULT gen_created_at_hk_timestr();
\`\`\`
Now we can start the migration.

`;export{e as default};
