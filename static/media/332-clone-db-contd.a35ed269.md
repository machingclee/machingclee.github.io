---
title: Restore PostgreSQL DB from Backup
date: 2024-10-25
id: blog0332
tag: sql, db-backup, postgresql
toc: true
intro: "Let's discuss how to clone a database again."
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Dumping Data into an Existing Database

- Let's consider a situation where we have a `.dump` file created from a database (see in [this blog post](/blog/article/Postgresql-and-MySQL-DB-from-Docker-Compose-and-Clone-From-Existing-DB) how we do this).

- By applying a `.dump` file we can create all tables in an existing database, but the following is not appropriate:

  > Create a new database

  because none of our teammates would want to reconfigure the host, the username, the credentials, etc.

- Therefore we come up with the next solution:

  > Destroy (remove) all tables in an existing database, and then apply `.dump` file to create all tables

##### Destructively Remove all Tables in a Database (Not removing the database)

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

Make sure an existing database server has been spin up. **_Skip this step_** if you are cloning data into an **_shared database_** (e.g., not local).

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

- `/backup/database_dump.dump`

Since we have mounted a volume referencing to the current working directory (see the `-v $(pwd):/backup`), we have the following 1-1 correspondence:

- `$(pwd)/database_dump.dump` $\longleftrightarrow$ `/backup/database_dump.dump`

In other words, it refers to the **_local file_** `./database_dump.dump` inside of the directory due to the way we mount the volume.

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

- As mentioned in step 4 above we may wish to have follow-up actions.

- Usually it is to **_forcefully_** clean a table and also to remove all entities from other tables referencing to our data.

There is a better command than `DELETE FROM <table>` in this case!

```sql
TRUNCATE TABLE parent_table CASCADE;
```

#### Conversion From `.dump` into `.sql`
##### Why?

- For one reason we can observe what is actually done by the `.dump` script;
- For another reason we can adjust the "insertion" (like making the insertion into `on conflict do nothing`).

##### The Conversion Script

Given a `database_dump.dump` file in the current diectory, we can execute
```bash 
docker run --rm -v $(pwd):/backup \
  postgres:15 pg_restore -f /backup/database_dump.sql -Fc /backup/database_dump.dump
```
to convert a `database_dump.dump` file back to `database_dump.sql` file.



##### Execute the `.sql` file
To execute this `sql` script for backup we simply run 

```bash
export TARGET_DB_HOST="host.docker.internal"
export TARGET_DB_USER="pguser"
export TARGET_DB_PASSWORD="pguser"
export TARGET_DB_NAME="some-name"

docker run --rm -v $(pwd):/backup \
  -e PGPASSWORD=$TARGET_DB_PASSWORD \
  postgres:15 psql  \
  -h $TARGET_DB_HOST \
  -U $TARGET_DB_USER \
  -d $TARGET_DB_NAME \
  -f /backup/database_dump.sql
```
##### Typical Exmaple of a `database_dump.sql` and how to Change it to avoid Duplicate key

A typical backup `database_dump.sql` script consists of the following block for each table:

```sql
--
-- Data for Name: Quota_UsageCounter; Type: TABLE DATA; Schema: public; Owner: james.lee
--

COPY public."Quota_UsageCounter" (id, "seatId", ..., "summaryGenerated") FROM stdin;
718	601	0	1729262031656	2024-10-18 22:33:51	f	1729262029357	1729262029357	0
719	601	0	1729262403781	2024-10-18 22:40:03	f	1731940429357	1729262029357	0
730	603	0	1729337500635	2024-10-19 19:31:40	f	1729337499664	1729337499664	0
\.
```
Here we use `...` to omit the dummy names (not a valid `sql` syntax!).

The `COPY` clause can be replaced by 

```sql{1,3,9-11}
CREATE TEMP TABLE temp_table AS TABLE public."Quota_UsageCounter" WITH NO DATA;

COPY temp_table (id, "seatId", ..., "summaryGenerated") FROM stdin;
718	601	0	1729262031656	2024-10-18 22:33:51	f	1729262029357	1729262029357	0
719	601	0	1729262403781	2024-10-18 22:40:03	f	1731940429357	1729262029357	0
730	603	0	1729337500635	2024-10-19 19:31:40	f	1729337499664	1729337499664	0
\.

INSERT INTO public."Quota_UsageCounter" (SELECT * FROM temp_table)
ON CONFLICT DO NOTHING;
DROP TABLE temp_table;
```

