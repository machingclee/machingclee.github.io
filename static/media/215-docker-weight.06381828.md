---
title: "Two Stage Docker Image"
date: 2023-11-14
id: blog0216
tag: docker
intro: "We build smaller docker image by copying the only used components into new docker image"
toc: false
---

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
