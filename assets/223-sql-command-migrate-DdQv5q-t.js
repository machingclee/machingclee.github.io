const e=`---
title: "Prisma Migration Script"
date: 2024-02-25
id: blog0223
tag: sql, prisma
intro: "Record the commonly used migration scripts in prisma and sql."
toc: true
---

### Prisma

In the course of using \`prisma\` I have developed the following helper commands in \`package.json\`:

\`\`\`json
"scripts": {
    "migrate": "env-cmd -f .env-cmdrc -e default,dev npx prisma migrate dev",
    "migrate:create-only": "env-cmd -f .env-cmdrc -e default,dev npx prisma migrate dev --create-only",
    "migrate:resolve": "env-cmd -f .env-cmdrc -e default,dev npx prisma migrate resolve --applied",
    "migrate:deploy:uat": "env-cmd -f .env-cmdrc -e default,uat npx prisma migrate deploy",
    "migrate:deploy:poc": "env-cmd -f .env-cmdrc -e default,poc npx prisma migrate deploy",
    "migrate:deploy:prod": "env-cmd -f .env-cmdrc -e default,prod npx prisma migrate deploy",
    "migrate-resolve:uat": "env-cmd -f .env-cmdrc -e default,uat npx prisma migrate resolve --applied",
    "migrate-resolve:poc": "env-cmd -f .env-cmdrc -e default,poc npx prisma migrate resolve --applied",
    "migrate-resolve:prod": "env-cmd -f .env-cmdrc -e default,prod npx prisma migrate resolve --applied",
}
\`\`\`

- \`migrate\` \\
  We only run \`migration dev\` in local (or dev) developement to execute table migration and obtain migration file.
- \`migrate-create-only\` \\
  Used when auto generated sql-migration script (generated from prisma) **_fails to persist data_**.

  We keep updating the \`schema.prisma\`, \`yarn migrate-create-only\` to obtain faulty migration script, **_correct it_**, and \`yarn migrate\`.

- \`migrate:deploy:uat\` \\
  Apply all migration scripts to production server. The scripts are well tested in local development.
- \`migrate-resolve:uat\` \\
  Used when we have manaully updated the table (due to incorrect procedures).

  We record the changes in migration file and run \`migrate-resolve:uat <migration-name>\` to indicate that the changes has been applied.


### SQL Migration Scripts

#### Rename a Table

\`\`\`text
ALTER TABLE "RoomIssue" RENAME TO "MessagesSession";
\`\`\`

#### Change the Type of a Column

##### Simple Case

\`\`\`text
ALTER TABLE "Message" ALTER COLUMN "createdAt" SET DATA TYPE DOUBLE PRECISION;
\`\`\`

##### Type-Casting, Conditional (via Regex) Casting, with Error Handling

For example, our \`createdAt\` is a string recording the unix timstamp started from 1970 in \`ms\`. We:

- cast non-empty \`"1234"\` string to \`1234\`.
- cast empty string \`""\` to \`0\`, here \`CAST("" as numeric)\` will make \`PGSQL\` panic.

\`\`\`text
ALTER TABLE "Session" ADD COLUMN "temp_column" DECIMAL(14, 0);
UPDATE "Session" SET "temp_column" =
    CASE
      WHEN "createdAt" ~ '^[0-9]+$'
      THEN CAST("createdAt" AS numeric)
      ELSE 0
    END;
ALTER TABLE "Session" DROP COLUMN "createdAt";
ALTER TABLE "Session" RENAME COLUMN "temp_column" TO "createdAt";
\`\`\`

#### COALESCE, the PostgreSQL version of IFNULL

Examples:

\`\`\`text
SELECT COALESCE(1, 2);
\`\`\`

resolves to \`1\`, and

\`\`\`text
SELECT COALESCE (NULL, 2 , 1);
\`\`\`

resolved to \`2\`.
`;export{e as default};
