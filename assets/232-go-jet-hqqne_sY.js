const n=`---
title: "Reverse Engineer PostgreSQL to Go Structs"
date: 2024-01-06
id: blog0232
tag: go, jet, sql
intro: "Record the procedure the reverse-engineer a PGSQL database."
toc: true
---

### Repository

- https://github.com/machingclee/2024-01-06-experiment-prisma-with-go-jet

### Usage

#### Installations

- We will be using this package: https://github.com/go-jet/jet
- \`go get -u github.com/go-jet/jet/v2\`
- \`go install github.com/go-jet/jet/v2/cmd/jet@latest\`

#### Makefile

- Create a \`Makefile\` in root directory with content

  \`\`\`makefile
  DB_URL = postgresql://pguser:pguser@localhost:5432/udemy

  from-db:
    jet -dsn=$(DB_URL)?sslmode=disable -schema=public -path=./.gen -ignore-tables=_prisma_migrations
  run:
    go run ./cmd/api/*.go
  \`\`\`

  If you are windows user you may \`choco install make\` in powershell with admin mode.

- \`make from-db\`

#### pkg/pgsql/pgsql.go

- \`go get github.com/lib/pq\` (if we use pgsql)
- Now in \`pkg/pgsql/pgsql\`

  \`\`\`go
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
  \`\`\`

#### pkg/user/handler.go

- \`\`\`go
  package user

  import (
    "authentication/.gen/udemy/public/model"
    "authentication/.gen/udemy/public/table"
    "database/sql"

    . "github.com/go-jet/jet/v2/postgres"
  )

  type HandlerRepo struct {
    db *sql.DB
  }

  var Repo *HandlerRepo

  func NewHandler(db *sql.DB) {
    Repo = &HandlerRepo{
      db: db,
    }
  }

  func (m *HandlerRepo) GetUsers() []model.User {
    db := m.db
    statement := SELECT(table.User.AllColumns).FROM(table.User)
    var users []model.User
    statement.Query(db, &users)
    return users
  }

  \`\`\`

#### cmd/api/routes.go

- \`\`\`go
  package main

  import (
      "authentication/pkg/user"
      "fmt"
      "net/http"

      "github.com/go-chi/chi/v5"
      "github.com/go-chi/chi/v5/middleware"
  )

  func routes() http.Handler {
      r := chi.NewRouter()
      r.Use(middleware.Logger)
      r.Use(middleware.Recoverer)

      r.Route("/user", func(r chi.Router) {
          r.Get("/", func(w http.ResponseWriter, r *http.Request) {
              u := user.Repo.GetUsers()
              fmt.Println(u)
          })
      })
      return r
  }
  \`\`\`

#### cmd/api/main.go

- \`\`\`go
  package main

  import (
      "authentication/pkg/pgsql"
      "authentication/pkg/user"
      "log"
      "net/http"
  )

  func main() {
      db := pgsql.NewDB()
      user.NewHandler(db)

      srv := http.Server{
          Addr:    ":8080",
          Handler: routes(),
      }

      err := srv.ListenAndServe()
      log.Fatal(err)
  }
  \`\`\`

- We get:

  \`\`\`go
  {
        "ID": 1,
        "FirstName": "James",
        "LastName": "Lee",
        "Password": "123",
        "Active": 1,
        "CreatedAt": 1704544094240,
        "UpdatedAt": 1704544094240
  }
  \`\`\`
`;export{n as default};
