const n=`---
title: "SQLite Foreign Key Constraint Must be Enabled Manually"
date: 2025-12-27
id: blog0447
tag: sql, sqlite
intro: Remark on the foreign key constraint in sqlite specifically
img: /assets/img/2026-01-07-06-51-03.png
scale: 1
offsetx: 0
offsety: -5
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>

### Overview

SQLite has **foreign keys disabled by default**, unlike PostgreSQL or MySQL. This requires explicit configuration in every database connection to enable foreign key constraints and CASCADE deletion.



### How to Check if Foreign Keys Are Enabled

\`\`\`sql
PRAGMA foreign_keys;
\`\`\`

**Returns:**
- \`0\` = Foreign keys are **disabled** (default)
- \`1\` = Foreign keys are **enabled**



### How to Enable Foreign Keys

#### Method 1: Per-Connection PRAGMA

Execute this SQL command **every time** you connect to the database:

\`\`\`sql
PRAGMA foreign_keys = ON;
\`\`\`

#### Method 2: Connection URL Parameter

Add \`foreign_keys=true\` to your connection string:

\`\`\`text
file:path/to/database.db?foreign_keys=true
jdbc:sqlite:path/to/database.db?foreign_keys=true
\`\`\`

This automatically executes \`PRAGMA foreign_keys = ON\` for every connection.

#### Method 3: TablePlus Bootstrap Command

For SQL client tools like **TablePlus**, you can configure a bootstrap command that runs automatically on every connection:

1. Open TablePlus connection dialog
2. Click **"Bootstrap commands..."** button
3. Add the following command:

\`\`\`sql
PRAGMA foreign_keys = ON;
\`\`\`

4. Click "Save"
5. Click "Connect"

This ensures foreign keys are enabled automatically every time you connect with TablePlus.



### Important Notes

1. **Foreign keys are per-connection settings** - Each database connection must enable foreign keys independently
2. **Table structure is permanent** - CASCADE constraints must be defined when creating tables
3. **Existing tables may need recreation** - If tables were created without CASCADE, you must drop and recreate them



### References

- [SQLite Foreign Key Support](https://www.sqlite.org/foreignkeys.html)
- [SQLite PRAGMA foreign_keys](https://www.sqlite.org/pragma.html#pragma_foreign_keys)
`;export{n as default};
