---
title: "Simple Postgresql Server from Docker-Compose"
date: 2023-10-29
id: blog0202
tag: docker
intro: "Record a few lines to init a postgresql db."
toc: false
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

```yml
version: "2"
services:
  db:
    image: postgres
    volumes:
      - ./data/db:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: pguser
      POSTGRES_PASSWORD: pguser
      POSTGRES_DB: pgdb
```
