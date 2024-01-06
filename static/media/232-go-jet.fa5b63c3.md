---
title: "Reverse Engineer PostgreSQL to Go Structs"
date: 2024-01-06
id: blog0232
tag: go, jet
intro: "Record the procedure the reverse-engineer a PGSQL database."
toc: false
---

- We will be using this package: https://github.com/go-jet/jet
- `go get -u github.com/go-jet/jet/v2`
- `go install github.com/go-jet/jet/v2/cmd/jet@latest`
- Create a `Makefile` in root directory with content

  ```makefile
  DB_URL = postgresql://pguser:pguser@localhost:5432/udemy

  from-db:
    jet -dsn=$(DB_URL)?sslmode=disable -schema=public -path=./.gen -ignore-tables=_prisma_migrations
  run:
    go run ./cmd/api/*.go
  ```

  If you are windows user you may `choco install make` in powershell with admin mode.

- `make from-db`

- `go get github.com/lib/pq` (if we use pgsql)

- we may encounter warning that we should not use dot import, we disable this warning by

  ```json
    "go.lintTool": "staticcheck",
    "go.lintFlags": [
      "-dot-imports=false"
    ]
  ```

  in `settings.json`,

- Now in `pkg/pgsql/pgsql`

  ```text
  package pgsql

  import (
      "database/sql"
      "log"

      _ "github.com/lib/pq"
  )

  var DB *sql.DB

  func NewDB() *sql.DB {
      db, err := sql.Open(
          "postgres",
          "postgresql://pguser:pguser@localhost:5432/udemy?sslmode=disable"
      )
      if err != nil {
        log.Fatal(err)
      }
      DB = db
      return DB
  }
  ```

- In our `cmd/api/main.go`:

  ```text
  package main

  import (
      "authentication/.gen/udemy/public/model"
      . "authentication/.gen/udemy/public/table"
      "authentication/pkg/pgsql"
      "encoding/json"
      "fmt"
      "log"

      . "github.com/go-jet/jet/v2/postgres"
  )

  func main() {
      db := pgsql.NewDB()
      statement := SELECT(Student.AllColumns).FROM(Student).WHERE(Student.ID.EQ(Int(1)))
      dest := model.Student{}
      err := statement.Query(db, &dest)
      if err != nil {
          log.Fatal(err)
      }
      jsonText, _ := json.MarshalIndent(dest, "", "\t")
      fmt.Println(string(jsonText))
  }
  ```

  We get:

  ```text
  {
        "ID": 1,
        "FirstName": "James",
        "LastName": "Lee",
        "Password": "123",
        "Active": 1,
        "CreatedAt": 1704544094240,
        "UpdatedAt": 1704544094240
  }
  ```
