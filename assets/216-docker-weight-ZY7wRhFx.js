const n=`---
title: "Two Stage Docker Image; Docker-Compose with Service B waiting for the Connection of Service A"
date: 2023-11-14
id: blog0216
tag: docker, go, sql
intro: "We build smaller docker image by copying the only used components into new docker image"
toc: true
---

### Simple Case for a Go Backend

\`\`\`docker
# Build Stage
FROM golang:1.21.1-alpine3.18 AS builder
WORKDIR /app
COPY . .
RUN go build -o main main.go

# Run Stage
FROM alpine:3.18
WORKDIR /app
COPY --from=builder /app/main .
COPY app.env .

EXPOSE 8080

CMD ["/app/main"]
\`\`\`

### More Sophisticated case Where PGSql DB and Migration are Considered

#### Dockerize The Go Backend

Lete's build our go programme as well as download the \`goose\` binary.

\`\`\`docker
# Build Stage
FROM golang:1.21.1-alpine3.18 AS builder
WORKDIR /app
COPY . .
RUN go install github.com/pressly/goose/v3/cmd/goose@latest
RUN go build -o main main.go

# Run Stage
FROM alpine:3.18
WORKDIR /app
COPY --from=builder /app/main .
RUN mkdir -p /go/bin
COPY --from=builder /go/bin/goose /go/bin
COPY sql ./sql
COPY app.env .
COPY wait-for.sh .
COPY docker-compose-start.sh .
RUN chmod +x wait-for.sh

EXPOSE 8080

CMD ["/app/main"]
\`\`\`

- Here \`wait-for.sh\` is downloaded from [here](https://github.com/eficode/wait-for/releases/tag/v2.2.4?fbclid=IwAR1suC95oCkB63bRmBcUOcPuLi5MC4GV6JGJ_41qs-Ou2JsomDSv7CQzSYI)
- \`docker-compose-start.sh\` is simply the following:
  \`\`\`bash
  cd /app/sql/schema
  /go/bin/goose postgres $DB_SOURCE up
  cd /app
  /app/main
  \`\`\`
  Note that the \`goose\` binary is copied form \`builder\` stage.

#### Use \`wait-for.sh\` in our docker-compose.yml

Note that \`depends_on\` in \`docker-compose\` has no guarantee on launching service B until service A is **_completely up_**.

If we want to make sure our docker-compose is run in the following order:

1. PGSQL db is up and running, then
2. Run db migration and web application in \`Go\` from our docker image.

Then we need the \`wait-for.sh\` script downloaded in the previous section, and achieve the correct sequential order by:

\`\`\`yaml
version: "2"
services:
  postgres:
    image: postgres
    volumes:
      - ./data/db:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: pguser
      POSTGRES_PASSWORD: pguser
      POSTGRES_DB: pgdb
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      DB_SOURCE: postgresql://pguser:pguser@postgres:5432/pgdb?sslmode=disable
    depends_on:
      - postgres
    entrypoint:
      [
        "/app/wait-for.sh",
        "postgres:5432",
        "--",
        "/app/docker-compose-start.sh",
      ]
\`\`\`

Note that \`entrypoint\` will override the default entrypoint in the docker image and clear the existing \`CMD\`.

Result:

\`\`\`bash
postgres_1  | PostgreSQL Database directory appears to contain a database; Skipping initialization
postgres_1  |
postgres_1  | 2023-11-13 14:34:03.736 UTC [1] LOG:  starting PostgreSQL 16.0 (Debian 16.0-1.pgdg120+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14) 12.2.0, 64-bit
postgres_1  | 2023-11-13 14:34:03.736 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
postgres_1  | 2023-11-13 14:34:03.736 UTC [1] LOG:  listening on IPv6 address "::", port 5432
postgres_1  | 2023-11-13 14:34:03.746 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
postgres_1  | 2023-11-13 14:34:03.770 UTC [30] LOG:  database system was shut down at 2023-11-13 14:33:04 UTC
postgres_1  | 2023-11-13 14:34:03.803 UTC [1] LOG:  database system is ready to accept connections
api_1       | 2023/11/13 14:34:04 goose: no migrations to run. current version: 4
api_1       | [GIN-debug] [WARNING] Creating an Engine instance with the Logger and Recovery middleware already attached.
api_1       |
api_1       | [GIN-debug] [WARNING] Running in "debug" mode. Switch to "release" mode in production.
api_1       |  - using env:     export GIN_MODE=release
api_1       |  - using code:    gin.SetMode(gin.ReleaseMode)
api_1       | [GIN-debug] POST   /account/transfers        --> github.com/machingclee/2023-11-04-go-gin/api.(*Server).createTransfer-fm (4 handlers)
api_1       | [GIN-debug] GET    /account/:id              --> github.com/machingclee/2023-11-04-go-gin/api.(*Server).getAccount-fm (4 handlers)
api_1       | [GIN-debug] GET    /account/list             --> github.com/machingclee/2023-11-04-go-gin/api.(*Server).listAccount-fm (4 handlers)
api_1       | [GIN-debug] [WARNING] You trusted all proxies, this is NOT safe. We recommend you to set a value.
api_1       | Please check https://pkg.go.dev/github.com/gin-gonic/gin#readme-don-t-trust-all-proxies for details.
\`\`\`
`;export{n as default};
