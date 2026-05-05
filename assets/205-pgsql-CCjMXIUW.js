const n=`---
title: "PostgreSQL Revisit"
date: 2023-11-04
id: blog0205
tag: sql
intro: "Record the standard qureis in SQL."
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

### Alter Table

- \`\`\`sql
  ALTER TABLE people RENAME TO users;
  ALTER TABLE users RENAME COLUMN handle TO username;
  ALTER TABLE users ADD COLUMN password TEXT;
  ALTER TABLE transactions ADD COLUMN was_successful BOOLEAN;
  ALTER TABLE transactions ADD COLUMN transaction_type TEXT;
  \`\`\`

### Examples of Constraints

- \`\`\`sql
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
  \`\`\`

### Data Insertion

- \`\`\`sql
  INSERT INTO users
  	(name, age, contry_code, username, password, is_admin)
  	VALUES
  	("David", 34, "US" "DavidDev", "insertPractice", false);
  \`\`\`

### Filtering

- \`\`\`sql
  SELECT username FROM users WHERE is_admin=true;
  \`\`\`

### Updating

- \`\`\`sql
  UPDATE emplyees
  SET job_title = "Backend Engineer", salary = 150000
  WHERE id = 251;

  UPDATE users
  SET is_admin = true
  WHERE username = wagslane;
  \`\`\`

### IIF (analog of ternary in javascript)

- \`\`\`sql
  SELECT *,
  IIF(was_successful=true,	'No action required.',	'Perform an audit') AS audit
  FROM transactions;
  \`\`\`

### BETWEEN

- \`\`\`sql
  SELECT name, age FROM users WHERE age BETWEEN 18 and 30;
  SELECT name, age FROM users WHERE age NOT BETWEEN 18 and 30;
  \`\`\`

### DISTINCT

- \`\`\`sql
  SELECT DISTINCT previous_company FROM employees;
  \`\`\`

### IN

- \`\`\`sql
  SELECT name, age, country_code FROM users
  WHERE country_code IN ('US', 'CA', 'MX');
  \`\`\`

### LIKE

- \`%\` match zero or more characters
- \`_\` only matches a _single_ character

- \`\`\`sql
  SELECT * FROM products
  WHERE product_name LIKE '%banana%'; -- ('%banana' or 'banana%', etc)
  \`\`\`

- \`\`\`sql
  SELECT * FROM products
  WHERE product_name LIKE '_oot'; -- (or '__oot' for exactly two characters)
  \`\`\`

### ORDER BY

- \`\`\`sql
  SELECT * FROM transactions
  WHERE amount BETWEEN 10 AND 80
  ORDER BY amount DESC; -- or ASC
  \`\`\`

### Aggregations

#### count

- \`\`\`sql
  SELECT album_id, count(id) as count
  FROM songs
  GROUP BY album_id;
  \`\`\`

#### sum

- \`\`\`sql
  SELECT sum(salary)
  FROM employees;
  \`\`\`

#### max

- \`\`\`sql
  SELECT max(amount), user_id
  FROM transactions
  WHERE user_id=4;
  \`\`\`

#### min

- \`\`\`sql
  SELECT min(amount), user_id
  FROM transactions
  WHERE user_id=4;
  \`\`\`

#### GROUP BY

- \`\`\`sql
  SELECT user_id sum(amount) AS balance
  FROM transactions
  GROUP BY user_id;
  \`\`\`

#### avg

- \`\`\`sql
  SELECT avg(age) FROM users WHERE country_code="US";
  \`\`\`

### HAVING

- A \`HAVING\` clause operates on rows after an aggregation has taken place due to \`GROUP BY\` clause.
- A \`WHERE\` clause operates on rows before an any aggragation.

- \`\`\`sql
  SELECT sender_id, sum(amount) AS balance
  FROM transactions
  WHERE sender_id!=Null AND note note LIKE "%lunch%"
  GROUP BY sender_id
  HAVING balance > 20
  ORDER BY balance ASC;
  \`\`\`

### SUBQUERIES

Both valid, though of different purposes.

- \`\`\`sql
  SELECT * FROM transactions
  WHERE user_id in (
  	SELECT id FROM users
  	WHERE name LIKE "David"
  );
  \`\`\`

- \`\`\`sql
  SELECT * FROM transactions
  WHERE user_id = (
  	SELECT id FROM users
  	WHERE name="David"
  	LIMIT = 1 -- in case there are multiple Davids
  );
  \`\`\`

### JOIN

- \`\`\`sql
  SELECT * FROM users
  INNER JOIN countries ON users.country_code = countries.countr_code;
  \`\`\`

- \`\`\`sql
  SELECT users.name, users.age, countries.name AS country_name
  FROM users
  LEFT JOIN countries ON users.country_code = countries.country_code;
  ORDER BY country_name ASC;
  \`\`\`

  or equivalently (in general **_aliasing namespaces is not a good idea_**):

  \`\`\`sql
  SELECT u.name, u.age, c.name AS country_name
  FROM users u
  LEFT JOIN countries c ON u.country_code = c.country_code;
  ORDER BY country_name ASC;
  \`\`\`

- \`\`\`sql
  SELECT users.name, sum(transactions.amount) as sum, count(transactions.id) as count
  FROM users
  LEFT JOIN transactions on users.id = transactions.user_id
  GROUP BY users.id
  ORDER BY sum DESC;
  \`\`\`

### Create Index

- Syntax:

  \`\`\`sql
  CREATE INDEX index_name on table_name (column_name);
  \`\`\`

Examples:

- \`\`\`sql
  CREATE INDEX email_idx on users (email);
  \`\`\`

- \`\`\`sql
  CREATE INDEX first_name_last_name_age_index
  ON USERS (first_name, last_name, age)
  \`\`\`
`;export{n as default};
