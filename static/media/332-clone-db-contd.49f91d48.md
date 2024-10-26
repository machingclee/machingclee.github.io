---
title: Destroy all Tables To Apply Dump Files in an Existing Database
date: 2024-10-25
id: blog0332
tag: sql
toc: true
intro: "Let's discuss how to clone a database again."
---


<style>
  img {
    max-width: 660px;
  }
</style>

#### Dumping to Existing Database


- Let consider a situation where we have a `.dump` file created from a database (see in [this blog post](/blog/article/Postgresql-and-MySQL-DB-from-Docker-Compose-and-Clone-From-Existing-DB) how we do this).

- By applying a `.dump` file we can create all tables in an existing database, but the following is not appropriate:
  > Create a new database
  because our teammates are working on that and no one wants to reconfigure the host, the credentials, etc.

- Therefore we come up with the next solution:

  > Destroy (remove) all tables in an existing database, and then apply `.dump` file to create all tables




#####  Destructively Remove all Tables in a Database (Not removing the database)

```sql
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) 
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;
```

Next for the sake of completeness let's truncate the commands in [that previous blog post](/blog/article/Postgresql-and-MySQL-DB-from-Docker-Compose-and-Clone-From-Existing-DB) and apply it selectively:

##### Step 1. Clone a Database into a Dump File

```bash
export SOURCE_DB_USER=
export SOURCE_DB_PASSWORD=
export SOURCE_DB_HOST=
export SOURCE_DB_NAME=

echo "Cloning Remote DB ..."
docker run --rm -v $(pwd):/backup \
  -e PGPASSWORD=$SOURCE_DB_PASSWORD \
  postgres:15 pg_dump \
  -h $SOURCE_DB_HOST \
  -U $SOURCE_DB_USER \
  -d $SOURCE_DB_NAME \
  -F c -f /backup/database_dump.dump
```

##### Step 2. (Optional) Create a Database in a PostgreSQL Server

Make sure an existing database server has been spin up. ***Skip this step*** if you are cloning data into an ***shared database*** (e.g., not local).

```bash 
export TARGET_DB_HOST="host.docker.internal"
export TARGET_DB_USER="pguser"
export TARGET_DB_PASSWORD="pguser"
export TARGET_DB_NAME="some-name"

echo "Creating Local Database ..."
docker run --rm \
  -e PGPASSWORD=$TARGET_DB_PASSWORD \
  postgres:15 createdb \
  -h $TARGET_DB_HOST \
  -U $TARGET_DB_USER \
  $TARGET_DB_NAME
```

##### Step 3. Dump Data into an Existing Database

```bash
export TARGET_DB_HOST="host.docker.internal"
export TARGET_DB_USER="pguser"
export TARGET_DB_PASSWORD="pguser"
export TARGET_DB_NAME="some-name"

echo "Dumping DB Data Into $TARGET_DB_HOST/$TARGET_DB_NAME"
docker run --rm -v $(pwd):/backup \
  -e PGPASSWORD=$TARGET_DB_PASSWORD \
  postgres:15 pg_restore \
  -h $TARGET_DB_HOST \
  -U $TARGET_DB_USER \
  -d $TARGET_DB_NAME \
  -c -C /backup/database_dump.dump
```

Beware of the meaning of 
```bash 
/backup/database_dump.dump
```
Since we have mounted a volume referencing to the current working directory (see the `-v $(pwd):/backup`), `/backup/database_dump.dump` refers to the file in the local directory:
```bash 
$(pwd)/database_dump.dump
```

##### Step 4. Custom Follow-up Actions After Dumping Data

```bash
export TARGET_DB_HOST="host.docker.internal"
export TARGET_DB_USER="pguser"
export TARGET_DB_PASSWORD="pguser"
export TARGET_DB_NAME="some-name"

echo "Follow-up Actions in Progress ..."
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



#### Remove all Database by TRUNCATE TABLE \<table\> CASCADE

As mentioned in step 4 above we may wish to have follow-up actions, and usually it is to remove data and also all  children  from other tables referencing to our data via a foreign-key ***forcefully***. 

There is a better command than `DELETE FROM <table>` in this case!

```sql
TRUNCATE TABLE parent_table CASCADE;
```