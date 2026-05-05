const e=`---
title: "Role and User Management in PostgreSQL"
date: 2024-06-07
id: blog0265
tag: sql, db-management, postgresql
intro: "Record SQL script for managing db user persmissions"
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Create User and Drop User

\`\`\`sql
CREATE USER testuser WITH PASSWORD 'testpassword123321';
\`\`\`
\`\`\`sql
DROP USER IF EXISTS testuser;
\`\`\`

### User = Role + Login Persmission
From [AWS Documentation](https://aws.amazon.com/blogs/database/managing-postgresql-users-and-roles):

- **Users**, **groups**, and **roles** ***are the same thing*** in PostgreSQL, with the only difference being that users have permission to log in by default. The \`CREATE USER\` and \`CREATE GROUP\` statements are actually aliases for the \`CREATE ROLE\` statement.

  ![](/assets/img/2024-06-08-18-03-45.png)

- Therefore managing users is enough and we will ignore \`roles\` in users management. 

- Also from PostgreSQL documentation command that applies to a role can also be applied to a user as well.

### Grant Permissions to a User

In the sequel let's assume we are working on:
- a database called \`billie\`
- a user called \`testuser\`

#### Connection
A permission to connect to a database:
\`\`\`sql
GRANT CONNECT ON DATABASE billie TO testuser;
\`\`\`
#### Enable or Disable to Grant Usage on Schema (Optional)
- If a user is **not** a **database maintainer**, that user should not have this right and this part **can be skipped**.
- Although a usage is granted, there is no right yet.
\`\`\`sql
GRANT USAGE ON SCHEMA public TO testuser;
\`\`\`
\`\`\`sql
REVOKE USAGE ON SCHEMA public FROM testuser;
\`\`\`

#### Grant or Revoke Usage (Create, Delete, Alter Table) on Schema
##### Create Table

\`\`\`sql
GRANT USAGE, CREATE ON SCHEMA public TO testuser;
\`\`\`
or the ***opposite*** 
\`\`\`sql
REVOKE USAGE, CREATE ON SCHEMA public FROM testuser;
\`\`\`

##### Alter Table (No such thing)

From [PostgreSQL Documentation](https://www.postgresql.org/docs/current/sql-altertable.html):
- ***Only the owner*** of a table can alter the table.
- Each table can only have one owner (not including \`superuser\`).
- In worst case, \`superuser\` can change the table ownership by 
  \`\`\`sql
  ALTER TABLE table_name OWNER TO new_owner_name;
  \`\`\`
  and let another developer  take care of that table.

##### Delete Table (No such thing)

- ***Only the owner*** of a table can drop the table. 

- Therefore in theory only two users can drop a table.




#### Grant SELECT, INSERT, UPDATE, DELETE Rights

##### For Existing Tables only

Note that the following command only applies to existing tables. The user has ***no privilege*** to new tables ***created after the execution***.

\`\`\`sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO testuser;
\`\`\`
We need to run the next command (in the next code block) \`ALTER DEFAULT ...\` in order to apply the changes to new tables as well.

##### Extends to Tables in the Future

\`\`\`sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO testuser;
\`\`\`
Note that we will be needing to run the opposite
\`\`\`sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM testuser;
\`\`\`
in order to delete this role. 


### Create a User with Limited Rights for Backend's CRUD Service
#### Creation

\`\`\`sql-1{4,6,8-11}
CREATE USER testuser WITH PASSWORD 'aaaabbb';

GRANT CONNECT ON DATABASE billie TO testuser;
GRANT USAGE ON SCHEMA public TO testuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO testuser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO testuser;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO testuser;
--or
  REVOKE SELECT ON TABLES FROM testuser
\`\`\`

- Line 4 ***is necessary***, without that \`testuser\` can view the tables but ***cannot*** even \`select\` within the table.
- Line 6 ***is necessary***, otherwise \`testuser\` cannot insert record with auto-incremented counter as \`id\`, unless the only type of \`id\` we use is \`UUID\`.

- Lines 8-11 are needed only when you want to adjust the right of \`testuser\`.

If you need to grant \`CREATE\` right of a schema to a person (e.g., table creation, usually a trusted person who performs well), add:
\`\`\`sql
GRANT USAGE, CREATE ON SCHEMA public TO testuser;
\`\`\`




#### Deletion 
\`\`\`sql-1
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE 
SELECT, INSERT, UPDATE, DELETE ON TABLES FROM testuser;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM testuser
REVOKE ALL PRIVILEGES ON DATABASE billie FROM testuser;
REVOKE USAGE ON SCHEMA public FROM testuser;
DROP USER IF EXISTS testuser;
\`\`\`

- Lines 4-7 should be executed one by one. Running in batch may fail.

### Useful SQL for Querying Users and Their Priviledges
#### View a list of Database Users

\`\`\`sql
SELECT usename AS role_name,
  CASE 
     WHEN usesuper AND usecreatedb THEN 
	   CAST('superuser, create database' AS pg_catalog.text)
     WHEN usesuper THEN 
	    CAST('superuser' AS pg_catalog.text)
     WHEN usecreatedb THEN 
	    CAST('create database' AS pg_catalog.text)
     ELSE 
	    CAST('' AS pg_catalog.text)
  END role_attributes
FROM pg_catalog.pg_user
ORDER BY role_name desc;
\`\`\`
![](/assets/img/2024-06-08-18-58-33.png)


#### View Priviledges Owned by a User

\`\`\`sql
SELECT 
    grantee,
    table_schema AS schema,
    table_name,
    privilege_type AS privilege,
    grantor
FROM information_schema.table_privileges
WHERE grantee = 'testuser';
\`\`\`

![](/assets/img/2024-06-08-18-53-56.png)

Now we can \`REVOKE\` the right one by one.`;export{e as default};
