---
title: "Goose and Sqlc for Database Migration and Query Function Generation"
date: 2023-10-28
id: blog0203
tag: go sql postgresql
intro: "We record a workflow of using goose and sqlc to work with changes of database schema."
toc: true
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

#### Installations

- ```text
  go install github.com/pressly/goose/v3/cmd/goose@latest
  ```
- - **_For mac and linux users_**, run
    ```text
    go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
    ```
    and from now on `sqlc generate` will be available in your shell.
  - **_For windows user_**, the `sqlc` package about wouldn't work, instead we run
    ```text
    docker run --rm -v "%cd%:/src" -w /src sqlc/sqlc generate
    ```
    in `cmd`.

#### Workflow for Database Migrations

##### Create/Change DB by Writing Code-First Migration Files

- Create `sql/schema/` and write migration files:

  **sql/schema/001_users.sql**

  ```sql
  -- +goose Up

  CREATE TABLE users (
      id UUID PRIMARY KEY,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      name TEXT NOT NULL
  );

  -- +goose Down
  DROP TABLE users;
  ```

  **sql/schema/002_users_apikey.sql**

  ```sql
  -- +goose Up
  ALTER TABLE users ADD COLUMN api_key VARCHAR(64) UNIQUE NOT NULL DEFAULT (
    encode(sha256(random()::text::bytea), 'hex')
  );

  -- +goose Down
  ALTER TABLE users DROP COLUMN api_key;
  ```

  **sql/schema/003_feeds.sql**

  ```sql
  -- +goose Up

  CREATE TABLE feeds (
      id UUID PRIMARY KEY,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      name TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE
  );

  -- +goose Down
  DROP TABLE users;
  ```

  **sql/schema/004_feeds_uuid_nonull.sql**

  ```sql
  -- +goose Up
  ALTER TABLE feeds ALTER COLUMN user_id SET NOT NULL;

  -- +goose Down
  ALTER TABLE feeds ALTER COLUMN user_id DROP NOT NULL;
  ```

##### Execute the Migrations

- After each migration is inserted, we run `sh db_migrate_up.sh`, where

  ```shell
  # db_migrate_up.sh
  DB_URL=postgresql://pguser:pguser@127.0.0.1:5432/rssagg

  cd sql/schema
  goose postgres $DB_URL up
  ```

##### Create sqlc.yaml to Geneate Struct and Script in Go

- Create a `sqlc.yaml` at the root project level:

  ```yml
  version: "2"
  sql:
    - schema: "sql/schema"
      queries: "sql/queries"
      engine: "postgresql"
      gen:
        go:
          out: "internal/database"
  ```

##### Execute sqlc generate

- After table migration is done, we create correponding schema as struct, queries as functions in `go`:
  ```text
  sqlc generate
  ```
  or in windows cmd prompt (or create a `.bat` file):
  ```text
  docker run --rm -v "%cd%:/src" -w /src sqlc/sqlc generate
  ```

#### Reference

- [Go Programming – Golang Course with Bonus Projects](https://www.youtube.com/watch?v=un6ZyFkqFKo)
