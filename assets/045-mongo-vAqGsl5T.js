const n=`---
title: Set up Local Environment for Mongo using Docker
date: 2022-02-25
id: blog045
tag: coding, mongo
intro: Since I have docker already installed, just record a few steps to get the local development ready using mongo db with authentication.
---

### Start from Docker Hub

We don't need to install anything from mongo website, we just need to pull the mongo image from docker hub.

To have authentication, a super/root user called \`admin\` must be created in the first place. For that, instead of just running the image, we pass the environment variables

- \`MONGO_INITDB_ROOT_USERNAME\` and
- \`MONGO_INITDB_ROOT_USERNAME\`
  in

\`\`\`text
docker run
  -d
  --name bddms-mongo \\
  -p 27017:27017 \\
  -e MONGO_INITDB_ROOT_USERNAME=admin \\
  -e MONGO_INITDB_ROOT_PASSWORD=123 \\
  -v "/c/Users/user/OneDrive/Documents/db_backup/docker_bddms":/data/db mongo
\`\`\`

Here my local directory \`/c/Users/user/OneDrive/Documents/db_backup/docker_bddms\` is mount as a volume to the container's directory \`/data/db\`.

### Create User in Mongo Shell

When this image is run in the detached mode, run

\`\`\`text
docker exec -it cb39731a97ff sh
\`\`\`

to get into the cli of the container running our mongo instance with id \`cb39731a97ff\`.

We are ready to init the mongo shell and add user. For this, run

\`\`\`text
mongo -u admin -p 123
\`\`\`

For sheer purpose of fulfilling the hard-coded config in the project, I need:

- A user called \`bdsons\` with pwd \`bdsonspass\`;
- \`authSource=admin\` for authentication, i.e., create a user \`bdsons\` **_inside_** the database \`admin\`;
- \`bdsons\` to have access right to the database \`bdsons\`.

Therefore:

\`\`\`text
use admin

db.createUser({ \\
user: "bdsons", pwd: "bdsonspass", \\
roles:[{db: "admin", role:"readWrite"}, {db:"bdsons", role:"readWrite"}] \\
})
\`\`\`

Then by running \`db.getUsers()\` we have

\`\`\`text
[
  ...,
  {
    "_id" : "admin.bdsons",
    "userId" : UUID("815c8f70-a65f-452d-a877-864d2d69fa00"),
    "user" : "bdsons",
    "db" : "admin",
    "roles" : [
      {
        "role" : "readWrite",
        "db" : "bdsons"
      },
      {
        "role" : "readWrite",
        "db" : "admin"
      }
    ],
    "mechanisms" : [
      "SCRAM-SHA-1",
      "SCRAM-SHA-256"
    ]
  }
]
\`\`\`

\`authSource\` in the connection string to mongodb will look at \`user.db\` for authentication (trap: not the \`"db"\` in the \`roles\`).

### Connect to the mongoDb with Auth

Now I can connect to the database named \`bdsons\` by using the string:

\`\`\`text
mongodb://bdsons:bdsonspass@localhost:27017/bdsons?authSource=admin
\`\`\`
`;export{n as default};
