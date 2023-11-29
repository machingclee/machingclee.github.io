---
title: "Simple Postgresql and MySQL Server from Docker-Compose"
date: 2023-10-29
id: blog0202
tag: docker
intro: "Record a few lines to init a postgresql/mysql db locally."
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

#### PostgreSQL

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

#### MySql

```yml
version: "3"
services:
  mysql:
    restart: always
    image: mysql:5.7.18
    container_name: mysql-lable
    volumes:
      - ./data/db/mysql/mydir:/mydir
      - ./data/db/mysql/datadir:/var/lib/mysql
      - ./data/db/mysql/conf/my.cnf:/etc/my.cnf
      - ./data/db/mysql/source:/docker-entrypoint-initdb.d
    environment:
      - "MYSQL_ROOT_PASSWORD=root"
      - "MYSQL_DATABASE=issue"
    ports:
      - 3306:3306
```
