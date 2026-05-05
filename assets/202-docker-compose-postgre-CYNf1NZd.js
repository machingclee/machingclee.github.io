const e=`---
title: "Postgresql and MySQL DB from Docker-Compose and Clone From Existing DB"
date: 2025-08-02
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

### Spin up a Database

#### PostgreSQL

\`\`\`yml
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
\`\`\`

#### MySql

\`\`\`yml
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
\`\`\`

### PostgreSQL: Clone Data from Remote DB Server to Localhost:5432

Here we also add custom scripts to manually seed data for particular purpose.

\`\`\`bash
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
docker run --rm -v $(pwd):/backup \\
  -e PGPASSWORD=$SOURCE_DB_PASSWORD \\
  postgres:15 pg_dump \\
  -h $SOURCE_DB_HOST \\
  -U $SOURCE_DB_USER \\
  -d $SOURCE_DB_NAME \\
  -F c -f /backup/database_dump.dump

echo "Creating Local Database ..."
docker run --rm \\
  -e PGPASSWORD=$TARGET_DB_PASSWORD \\
  postgres:15 createdb \\
  -h $TARGET_DB_HOST \\
  -U $TARGET_DB_USER \\
  $TARGET_DB_NAME

echo "Importing DB Data into $TARGET_DB_HOST/$TARGET_DB_NAME"
docker run --rm -v $(pwd):/backup \\
  -e PGPASSWORD=$TARGET_DB_PASSWORD \\
  postgres:15 pg_restore \\
  -h $TARGET_DB_HOST \\
  -U $TARGET_DB_USER \\
  -d $TARGET_DB_NAME \\
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
\`\`\`

### Enable SSL Connection for PostgreSQL

Some cloud database service provider often require SSL (such as AWS RDS)  as a default connection mode (indicated by \`?sslmode=require\` in our connection string).

To replicate the remote setup locally we need to allow SSL connection as well.

To do this, let's modify the docker-compose.yml:

\`\`\`yml{7,14-22}
version: "2"
services:
  db:
    image: postgres
    volumes:
      - ./data/db:/var/lib/postgresql/data
      - ./ssl:/var/lib/postgresql/ssl
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: pguser
      POSTGRES_PASSWORD: pguser
      POSTGRES_DB: pgdb
      # Enable SSL
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=trust"
    command: >

      postgres
      -c ssl=on
      -c ssl_cert_file=/var/lib/postgresql/ssl/server.crt
      -c ssl_key_file=/var/lib/postgresql/ssl/server.key
      -c ssl_ca_file=/var/lib/postgresql/ssl/ca.crt
\`\`\`

- Now \`mkdir ssl && cd ssl\` and then execute 
  \`\`\`bash
  openssl req -new -x509 -days 365 -nodes -text -out ca.crt \\ 
        -keyout ca.key -subj "/CN=postgres-ca"
  \`\`\`
- As shown below, our certificate only allows \`localhost\` as the domain of our database
  \`\`\`bash
  openssl req -new -nodes -text -out server.csr \\
        -keyout server.key -subj "/CN=localhost"
  \`\`\`
  we can connect to our database by \`127.0.0.1\` as well.

- \`\`\`bash 
  openssl x509 -req -in server.csr -text -days 365 -CA ca.crt \\
        -CAkey ca.key -CAcreateserial -out server.crt
  \`\`\`
- \`\`\`bash
  chmod 600 server.key && chmod 644 server.crt ca.crt && ls -la
  \`\`\`
  At this point we have the following in our \`ssl\` directory:
  \`\`\`text
  total 56
  drwxr-xr-x  8 chingcheonglee  staff   256 Aug  1 15:46 .
  drwxr-xr-x  9 chingcheonglee  staff   288 Aug  1 15:45 ..
  -rw-r--r--@ 1 chingcheonglee  staff  4140 Aug  1 15:46 ca.crt
  -rw-------@ 1 chingcheonglee  staff  1704 Aug  1 15:46 ca.key
  -rw-r--r--@ 1 chingcheonglee  staff    41 Aug  1 15:46 ca.srl
  -rw-r--r--@ 1 chingcheonglee  staff  4042 Aug  1 15:46 server.crt
  -rw-r--r--@ 1 chingcheonglee  staff  3357 Aug  1 15:46 server.csr
  -rw-------@ 1 chingcheonglee  staff  1704 Aug  1 15:46 server.key
  \`\`\`
  And we can docker-compose up to spin up a server that allows SSL connection.`;export{e as default};
