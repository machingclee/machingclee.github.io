---
title: "Commonly Used Command in Prisma, and More Table Migration Script"
date: 2023-12-16
id: blog0223
tag: sql
intro: "Record the commonly used migration scripts in prisma and sql."
toc: true
---

#### Prisma

In the course of using `prisma` I have developed the following helper commands in `package.json`:

```json
"scripts": {
    "migrate": "env-cmd -f .env-cmdrc -e default,dev npx prisma migrate dev",
    "migrate-create-only": "env-cmd -f .env-cmdrc -e default,dev npx prisma migrate dev --create-only",
    "migrate-deploy:uat": "env-cmd -f .env-cmdrc -e default,uat npx prisma migrate deploy",
    "migrate-resolve:uat": "env-cmd -f .env-cmdrc -e default,uat npx prisma migrate resolve --applied",
    "migrate-rollback:dev": "env-cmd -f .env-cmdrc -e default,dev npx prisma migrate resolve --rolled-back",
    "migrate-rollback:uat": "env-cmd -f .env-cmdrc -e default,uat npx prisma migrate resolve --rolled-back",
}
```

- `migrate` \
  We only run `migration dev` in local (or dev) developement to execute table migration and obtain migration file.
- `migrate-create-only` \
  Used when auto generated sql-migration script (generated from prisma) **_fails to persist data_**.

  We keep updating the `schema.prisma`, `yarn migrate-create-only` to obtain faulty migration script, **_correct it_**, and `yarn migrate`.

- `migrate-deploy:uat` \
  Apply all migration scripts to production server. The scripts are well tested in local development.
- `migrate-resolve:uat` \
  Used when we have manaully updated the table (due to incorrect procedures).

  We record the changes in migration file and run `migrate-resolve:uat <migration-name>` to indicate that the changes has been applied.

- `migrate-rollback:dev`/`migrate-rollback:dev` \
  Sometimes a migration fails, but it still be logged in the table `_prisma_migrations` of our database.

  This can happen if our migration has been executed before we apply our migration script (for example, two developers try to do the same migration).

  In such cases, we run `migrate-rollback:dev`to revoke our execution record, make adjustment to our own script or even make adjustment directly to the database (if we want to drop column, then we add a column in the database for the script to delete that column).

#### SQL Migration Scripts

##### Rename a Table

```text
ALTER TABLE "RoomIssue" RENAME TO "MessagesSession";
```

##### Change the Type of a Column

###### Simple Case

```text
ALTER TABLE "Message" ALTER COLUMN "createdAt" SET DATA TYPE DOUBLE PRECISION;
```

###### Type-Casting, Conditional (via Regex) Casting, with Error Handling

For example, our `createdAt` is a string recording the unix timstamp started from 1970 in `ms`. We:

- cast non-empty `"1234"` string to `1234`.
- cast empty string `""` to `0`, here `CAST("" as numeric)` will make `PGSQL` panic.

```text
ALTER TABLE "Session" ADD COLUMN "temp_column" DECIMAL(14, 0);
UPDATE "Session" SET "temp_column" =
    CASE
      WHEN "createdAt" ~ '^[0-9]+$'
      THEN CAST("createdAt" AS numeric)
      ELSE 0
    END;
ALTER TABLE "Session" DROP COLUMN "createdAt";
ALTER TABLE "Session" RENAME COLUMN "temp_column" TO "createdAt";
```

##### COALESCE, the PostgreSQL version of IFNULL

Examples:

```text
SELECT COALESCE(1, 2);
```

resolves to `1`, and

```text
SELECT COALESCE (NULL, 2 , 1);
```

resolved to `2`.
