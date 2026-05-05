const n=`---
title: "SQL for Table Migrations in the Course of Developement"
date: 2023-11-11
id: blog0212
tag: sql
intro: "Record the workflow used in database migration, integrated with tools like dbdiagram.io."
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

<Center></Center>

### dbdiagram.io

First you may need to register and sign in:

- https://dbdiagram.io/

### Problem Description: Add a new Table users, With accounts.owner ref: > users.username

This usually gives rise to the following:

**Problems.** An error \`Violation of foreign key constraint\`

**Reason.** This is because the existing data in table A has no reference to Table B (as a new table there is no data yet), therefore the reference key constraint must fail **_unless all table has no data_**.

### Model the Problem with Real SQL Code

#### Create accounts, transfers and entries

Let's model this situation in code, let's first create the following tables, which in dbdiagram.io has a very nice visuallization:

<center></center>

[![](/assets/tech/212/image.png)](/assets/tech/212/image.png)

The table schemas above can be written in \`DBML\`:

\`\`\`dbml
Table accounts as A {
  id bigserial [pk]
  owner varchar [not null]
  balance bigint [not null]
  currency varchar [not null]
  created_at timestamptz [not null, default: \`now()\`]

  Indexes{
    owner
  }
}

Table entries  {
  id bigserial [pk]
  account_id bigint [ref: > A.id]
  amount bigint [not null, note: "can be +ve or -ve"]
  created_at timestamptz [not null, default: \`now()\`]

  Indexes{
    account_id
  }
}

Table transfers{
  id bigserial [pk]
  from_account_id bigint [ref: > A.id, not null]
  to_account_id bigint [ref: > A.id, not null]
  amount bigint [not null, note: "must be positive"]
  created_at timestamptz [not null, default: \`now()\`]

  Indexes{
    from_account_id
    to_account_id
    (from_account_id, to_account_id)
  }
}
\`\`\`

#### Create User That owns Accounts

After playing around (like CRUD) with these old tables, our accounts table will be full of record with owner field having no reference to any user data (not yet created).

Now in the course of developement we have the following decisions:

- Add a users table
- Create foreign key constraint in accounts table
- Create indexes (owner, currency) in accounts table to prevent accounts with repreated currencies.

[![](/assets/tech/212/image-1.png)](/assets/tech/212/image-1.png)

\`\`\`dbml
Table users as U {
  username varchar [pk]
  hashed_password varchar [not null]
  full_name varchar [not null]
  email varchar [unique]
  password_changed_at timestamptz [not null, default: "0001-01-01 00:00:00Z"]
  created_at timestamptz [not null, default: \`now()\`]
}

Table accounts as A {
  id bigserial [pk]
  owner varchar [ref: > U.username, not null]
  balance bigint [not null]
  currency varchar [not null]
  created_at timestamptz [not null, default: \`now()\`]

  Indexes{
    owner
    (owner, currency) [unique]
  }
}

Table entries  {
  id bigserial [pk]
  account_id bigint [ref: > A.id]
  amount bigint [not null, note: "can be +ve or -ve"]
  created_at timestamptz [not null, default: \`now()\`]

  Indexes{
    account_id
  }
}

Table transfers{
  id bigserial [pk]
  from_account_id bigint [ref: > A.id, not null]
  to_account_id bigint [ref: > A.id, not null]
  amount bigint [not null, note: "must be positive"]
  created_at timestamptz [not null, default: \`now()\`]

  Indexes{
    from_account_id
    to_account_id
    (from_account_id, to_account_id)
  }
}
\`\`\`

Now \`Export to PGSQL\` and only extract the parts corresponding to our changes:

\`\`\`sql
CREATE TABLE "users" (
  "username" varchar PRIMARY KEY,
  "hashed_password" varchar NOT NULL,
  "full_name" varchar NOT NULL,
  "email" varchar UNIQUE,
  "password_changed_at" timestamptz NOT NULL DEFAULT '0001-01-01 00:00:00Z',
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

ALTER TABLE "accounts" ADD FOREIGN KEY ("owner") REFERENCES "users" ("username");

CREATE UNIQUE INDEX owner_currency ON "accounts" ("owner", "currency");

-- +goose Down

DROP TABLE "users"

ALTER TABLE "accounts" DROP FOREIGN KEY "owner";

DROP INDEX "owner_currency" ON "accounts"
\`\`\`

#### Problem and Resolution

- **Problem.** Now existing owners block the table migrataion becuase creating users table with \`accounts.owner\` referencing to \`users.username\` is **_impossible_**.

- **Solution.** We rename \`accounts.owner\` to \`accounts.deprecated_owner\`, drop not null constraint, and create an nullable \`owner\` column.

  Nullability of both columns is essential to let both columns to exist. When table is stable, we can drop the deprecated column and set not-null constraint to the new ower column.

- **Additional Change.**

  \`\`\`sql
  -- +goose Up
  ALTER TABLE "accounts" RENAME COLUMN "owner" to "_deprecated_owner";
  ALTER TABLE "accounts" ALTER COLUMN "_deprecated_owner" DROP NOT NULL;
  ALTER TABLE accounts ADD "owner" varchar;
  \`\`\`

- **With Old Planing.**

  \`\`\`sql
  CREATE TABLE "users" (
  	"username" varchar PRIMARY KEY,
  	"hashed_password" varchar NOT NULL,
  	"full_name" varchar NOT NULL,
  	"email" varchar UNIQUE,
  	"password_changed_at" timestamptz NOT NULL DEFAULT '0001-01-01 00:00:00Z',
  	"created_at" timestamptz NOT NULL DEFAULT (now())
  );
  ALTER TABLE "accounts" ADD FOREIGN KEY ("owner") REFERENCES "users" ("username");
  CREATE UNIQUE INDEX owner_currency ON "accounts" ("owner", "currency");

  -- +goose Down

  ALTER TABLE IF EXISTS "accounts" DROP CONTRAINT IF EXISTS "owner_currency";
  ALTER TABLE IF EXISTS "accounts" DROP CONTRAINT IF EXISTS "accounts_owner_fkey";
  DROP TABLE IF EXISTS "users";
  ALTER TABLE "accounts" DROP COLUMN owner;
  ALTER TABLE "accounts" ALTER COLUMN "_deprecated_owner" SET NOT NULL;
  ALTER TABLE "accounts" RENAME COLUMN "_deprecated_owner" to "owner";
  \`\`\`

Now new and old records will look like:

<center></center>

[![](/assets/tech/212/image-2.png)](/assets/tech/212/image-2.png)

We will be deleting old records (rows without owner) at a suitable timing.
`;export{n as default};
