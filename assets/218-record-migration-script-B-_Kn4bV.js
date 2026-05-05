const n=`---
title: "Record Table Migration Script in SQL"
date: 2023-11-17
id: blog0218
tag: sql
intro: "A list of sql script for copy and paste."
toc: true
---

### Tables

##### Create Standard Table

\`\`\`sql
CREATE TABLE "accounts" (
  "id" bigserial PRIMARY KEY, -- or "id" uuid PRIMARY KEY
  "owner" varchar NOT NULL,
  "balance" bigint NOT NULL,
  "is_blocked" boolean NOT NULL DEFAULT false,
  "currency" varchar NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);
\`\`\`

##### Create Index

\`\`\`sql
CREATE INDEX ON "accounts" ("owner");
\`\`\`

##### Create Unique Index (prevent row with duplicate field)

\`\`\`sql
CREATE UNIQUE INDEX ON "accounts" ("owner", "currency");
\`\`\`

##### Create Join Index

\`\`\`sql
CREATE INDEX ON "transfers" ("from_account_id", "to_account_id");
\`\`\`

##### Add Foreign Key

\`\`\`sql
ALTER TABLE "tableA" ADD FOREIGN KEY ("tableB_id") REFERENCES "tableB" ("id");
\`\`\`

##### Drop Foreign Key

\`\`\`sql
ALTER TABLE IF EXISTS "table_name" DROP CONTRAINT IF EXISTS "tableA_tableB_fkey";
\`\`\`

##### Set a Field to NOT NULL or NULL

\`\`\`sql
ALTER TABLE "table_name" ALTER COLUMN "field" SET NOT NULL;
ALTER TABLE "table_name" ALTER COLUMN "field" DROP NOT NULL;
\`\`\`

##### Add a Column

\`\`\`sql
ALTER TABLE "table_name" ADD "field" varchar;
\`\`\`

##### Drop a Column

\`\`\`sql
ALTER TABLE "table_name" DROP COLUMN "field";
\`\`\`

##### Rename a Column

\`\`\`sql
ALTER TABLE "table_name" RENAME COLUMN "fieldA" to "fieldB";
\`\`\`

### Models

##### Create

\`\`\`sql
-- name: CreateUser :one
INSERT INTO users (
  username, email, passowrdHash
) VALUES (
  $1, $2, $3
)
RETURNING *;
\`\`\`

##### Get One

\`\`\`sql
-- name: GetAccount :one
SELECT * FROM accounts
WHERE id = $1 LIMIT 1;
\`\`\`

##### Get Many

\`\`\`sql
-- name: ListAccounts :many
SELECT * FROM accounts
WHERE owner = $1
ORDER BY id
LIMIT $2
OFFSET $3;
\`\`\`

##### Update One

\`\`\`sql
-- name: UpdateAccount :one
UPDATE accounts
SET balance = $2
WHERE id = $1
RETURNING *;
\`\`\`

##### Delete One

\`\`\`sql
-- name: DeleteAccount :exec
DELETE FROM accounts WHERE id = $1;
\`\`\`

##### Do Math in SQL

\`\`\`sql
-- name: AddAccountBalance :one
UPDATE accounts
SET balance = balance + sqlc.arg(amount)
WHERE id = sqlc.arg(id)
RETURNING *;
\`\`\`
`;export{n as default};
