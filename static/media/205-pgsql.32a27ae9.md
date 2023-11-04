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
);

CREATE TABLE employees(
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	department_id INTEGER,
	CONSTRAINT fk_departments -- can be whatever we want, just a name
	FOREIGN KEY (department_id)
	REFERENCES departments(id)
);
```

#### Data Insertion

```sql
INSERT INTO users
	(name, age, contry_code, username, password, is_admin)
	VALUES
	("David", 34, "US" "DavidDev", "insertPractice", false);
```

#### Filtering

```sql
SELECT username FROM users WHERE is_admin=true;
```

#### Updating

```sql
UPDATE emplyees
SET job_title = "Backend Engineer", salary = 150000
WHERE id = 251;

UPDATE users
SET is_admin = true
WHERE username = wagslane;
```

#### IIF (analog of ternary in javascript)

```sql
SELECT *,
IIF(was_successful=true,	'No action required.',	'Perform an audit') AS audit
FROM transactions;
```

#### BETWEEN

```sql
SELECT name, age FROM users WHERE age BETWEEN 18 and 30;
SELECT name, age FROM users WHERE age NOT BETWEEN 18 and 30;
```

#### DISTINCT

```sql
SELECT DISTINCT previous_company FROM employees;
```

#### IN

```sql
SELECT name, age, country_code FROM users
WHERE country_code IN ('US', 'CA', 'MX');
```

#### LIKE

- `%` match zero or more characters
- `_` only matches a _single_ character

```sql
SELECT * FROM products
WHERE product_name LIKE '%banana%' -- ('%banana' or 'banana%', etc)
```

```sql
SELECT * FROM products
WHERE product_name LIKE '_oot' -- (or '__oot' for exactly two characters)
```
