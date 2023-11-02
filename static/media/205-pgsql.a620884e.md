---
title: "PostgreSQL Revisit"
date: 2023-10-31
id: blog0205
tag: SQL
intro: "Study postgreSQL more throughoutly."
toc: true
wip: true
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

#### Alter Table

```sql
ALTER TABLE people RENAME TO users;
ALTER TABLE users RENAME COLUMN handle TO username;
ALTER TABLE users ADD COLUMN password TEXT;
ALTER TABLE transactions ADD COLUMN was_successful BOOLEAN;
ALTER TABLE transactions ADD COLUMN transaction_type TEXT;
```

#### Examples of Constraints

```sql
CREATE TABLE users(
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	age INTEGER NOT NULL,
	country_code TEXT NOT NULL,
	username TEXT UNIQUE,
	password TEXT NOT NULL,
	is_admin BOOLEAN
)

CREATE TABLE employees(
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	department_id INTEGER,
	CONSTRAINT fk_departments -- can be whatever we want, just a name
	FOREIGN KEY (department_id)
	REFERENCES departments(id)
)
```

#### Data Insertion

```sql
INSERT INTO users
	(name, age, contry_code, username, password, is_admin)
	VALUES
	("David", 34, "US" "DavidDev", "insertPractice", false);
```
