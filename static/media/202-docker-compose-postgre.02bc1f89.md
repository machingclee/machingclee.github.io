---
title: "Postgresql and MySQL DB from Docker-Compose and Clone From Existing DB"
date: 2024-09-08
id: blog0202
tag: docker, sql, postgresql, mysql
intro: "Record a docker-compose.yml to host a postgresql/mysql db locally. Also we clone existing DB by docker-command using postgres image"
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

#### Spin up a Database

##### PostgreSQL

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

##### MySql

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

#### PostgreSQL: Clone Data from Remote DB Server to Localhost:5432

Here we also add custom scripts to manually seed data for particular purpose.

```bash
docker pull postgres:15

## Wait for services to be healthy
#echo "Waiting for services to be healthy..."

export SOURCE_DB_USER=
export SOURCE_DB_PASSWORD=
export SOURCE_DB_HOST=
export SOURCE_DB_NAME="billie-dev"

export TARGET_DB_HOST="host.docker.internal"
export TARGET_DB_USER="pguser"
export TARGET_DB_PASSWORD="pguser"
export TARGET_DB_NAME=$SOURCE_DB_NAME

echo "Cloning Remote DB ..."
docker run --rm -v $(pwd):/backup \
  -e PGPASSWORD=$SOURCE_DB_PASSWORD \
  postgres:15 pg_dump \
  -h $SOURCE_DB_HOST \
  -U $SOURCE_DB_USER \
  -d $SOURCE_DB_NAME \
  -F c -f /backup/database_dump.dump

echo "Creating Local Database ..."
docker run --rm \
  -e PGPASSWORD=$TARGET_DB_PASSWORD \
  postgres:15 createdb \
  -h $TARGET_DB_HOST \
  -U $TARGET_DB_USER \
  $TARGET_DB_NAME

echo "Importing DB Data into $TARGET_DB_HOST/$TARGET_DB_NAME"
docker run --rm -v $(pwd):/backup \
  -e PGPASSWORD=$TARGET_DB_PASSWORD \
  postgres:15 pg_restore \
  -h $TARGET_DB_HOST \
  -U $TARGET_DB_USER \
  -d $TARGET_DB_NAME \
  -c -C /backup/database_dump.dump

# James Stripe Product Data:
echo "Update to use James Stripe Data ..."
cat <<EOF > temp_script.sql
DELETE FROM "Quota_UsageCounter";
DELETE FROM "Quota_PersonalSeat";
DELETE FROM "Quota_TeamSeat";
DELETE FROM "Quota_Seat";
DELETE FROM "StripeProduct";
INSERT INTO "public"."StripeProduct" ("productName", "stripePriceId", "type") VALUES
('Powerful Billie', 'price_1PnuH6Rt6IuPFjtugpMi882V', 'PERSONAL_POWERFUL_BILLIE'),
('Handy Billie', 'price_1PnuH7Rt6IuPFjtuXl0RYniy', 'PERSONAL_HANDY_BILLIE'),
('Team Plan', 'price_1PxKSsRt6IuPFjtugx1WqZYw', 'TEAM_PLAN');
EOF
docker run --rm -e PGPASSWORD=$TARGET_DB_PASSWORD -v $(pwd)/temp_script.sql:/tmp/script.sql postgres:15 psql -h $TARGET_DB_HOST -d $TARGET_DB_NAME -U $TARGET_DB_USER -f /tmp/script.sql
rm temp_script.sql
echo "Done"
```
