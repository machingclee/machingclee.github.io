const n=`---
title: "Minimal Code for Setting Prisma as Just a Table Migration tool"
date: 2024-01-05
id: blog0231
tag: prisma, nodejs
intro: "Record minimal code needed to use prisma as just a table migration tool."
toc: false
---

- \`yarn add prisma\`

- Create \`prisma/schema.prisma\`

  \`\`\`js
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }

  model student {
  // or id     Int    @id @default(autoincrement())
    id         String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
    first_name String
    last_name  String
    email      String
  }
  \`\`\`

- Set up a \`.env\`

- Use [this env tool](/blog/article/Environment-Variable-by-env-cmdrc) if necessary to distinguish different \`env\`'s.

- Use [these docker file](/blog/article/Simple-Postgresql-and-MySQL-Server-from-Docker-Compose) to create a database if necessary for experiment.

- Use these [commonly used commands](/blog/article/Commonly-Used-Command-in-Prisma-and-More-Table-Migration-Script) for table migrations.
`;export{n as default};
