---
title: "Two Stage Docker Image; Docker-Compose Service B waits for Service A"
date: 2023-11-14
id: blog0216
tag: docker, go, sql
intro: "We build smaller docker image by copying the only used components into new docker image"
toc: true
---

#### Simple Case for a Go Backend

```docker
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
```

#### More Sophisticated case Where PGSql DB and Migration are Considered

##### Dockerize The Go Backend

Lete's build our go programme as well as download the `goose` binary.

```docker
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
```

- Here `wait-for.sh` is downloaded from [here](https://github.com/eficode/wait-for/releases/tag/v2.2.4?fbclid=IwAR1suC95oCkB63bRmBcUOcPuLi5MC4GV6JGJ_41qs-Ou2JsomDSv7CQzSYI)
- `docker-compose-start.sh` is simply the following:
  ```bash
  cd /app/sql/schema
  /go/bin/goose postgres $DB_SOURCE up
  cd /app
  /app/main
  ```
  Note that the `goose` binary is copied form `builder` stage.

##### Use `wait-for.sh` in our docker-compose.yml

Note that `depends_on` in `docker-compose` has no guarantee on launching service B until service A is **_completely up_**.

If we want to make sure our docker-compose is run in the following order:

1. PGSQL db is up and running, then
2. Run db migration and web application in `Go` from our docker image.

Then we need the `wait-for.sh` script downloaded in the previous section, and achieve the correct sequential order by:

```yaml
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
```

Note that `entrypoint` will override the default entrypoint in the docker image and clear the existing `CMD`.
