const n=`---
title: Restore MongoDB from Backup
date: 2024-10-25
id: blog0335
tag: mongo, db-backup
toc: true
intro: "Let's discuss how to restore a mongodb from backup, how does the back up actually?"
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Back-up MongoDB

#### The \`mongodump\` Command

We usually backup a mongodb via

\`\`\`bash
MONGO_CONNECTION_STRING="mongodb+srv://username:password@host/some_db?retryWrites=true&w=majority"
mongodump --uri "$MONGO_CONNECTION_STRING" --out some/dir/mongo_backup
\`\`\`

#### The Backup Files

The backup data generated looks the following:

![](/assets/img/2024-10-27-22-27-50.png)

If our database name is \`some_db\`, then the back files lie inside \`mongo_backup/some_db/\`.

### Script to Inject Backup Data

#### Cloning old data into new Database

\`\`\`bash
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_NAME=
DB_URL="mongodb+srv://\${DB_USER}:\${DB_PASSWORD}@\${DB_HOST}/\${DB_NAME}"
OPTIONS="retryWrites=true&w=majority"

mongorestore --uri $DB_URL --dir ./mongo_backup/some_db
\`\`\`

\`some_db/\` is the directory containing all the files in the image above.

#### Cloning old data into the Original Database for Restoration

This time we should run with the additional flag \`--drop\`:

\`\`\`bash
mongorestore --drop --uri $DB_URL --dir ./mongo_backup/some_db
\`\`\`

- For every collection that we are going to restore, we **_first_** drop it.

- Note that in this case any **_new_** collection **_not included in_** the \`mongo_backup\` will not be dropped.
`;export{n as default};
