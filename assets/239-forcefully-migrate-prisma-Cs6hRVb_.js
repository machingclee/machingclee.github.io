const n=`---
title: "Forcefully Make Prisma Ignore The Changes in a Migrated .sql File"
date: 2024-02-25
id: blog0239
tag: nodejs, sql, prisma
intro: "We record how to mark a manually changed sql file as a successful migration in prisma."
toc: true
---

<style>
  img {
    max-width: 660px
  }
</style>

### Procedures

- Sometimes we don't want prisma to notice the changes in migration file as we have done some adjustment ***manually*** (and make the corresponding changes in migration file as well so that it automatically migrates to production).



- Run   to the target migration:
  \`\`\`text
  shasum -a 256 prisma/migrations/20220510001642_my_migration/migration.sql
  \`\`\`


- This will produce something like:
  \`\`\`text
  fc27e97b9a61877f7f59d59a69c8c0bd2cd3271bc44b9f208800ed458d18a10b  prisma/migrations/20220510001642_my_migration/migration.sql
  \`\`\`
- Update the database of target row with \`checksum\` column with the hash:  
  \`\`\`text
  fc27e97b9a61877f7f59d59a69c8c0bd2cd3271bc44b9f208800ed458d18a10b
  \`\`\`

  ![](/assets/img/2024-02-26-01-00-33.png)

- Then \`yarn migrate\` should have no warning such as:
  \`\`\`text
  The migration \`20240219084746_constraint_admin_to_invite_people\` was modified after it was applied.
  We need to reset the "public" schema at "ep-aged-morning-26453078.ap-southeast-1.aws.neon.tech"

  Do you want to continue? All data will be lost.
  \`\`\`
  which is of course ***NO***!

### Reference 

- [https://echobind.com/post/make-prisma-ignore-a-migration-change](https://echobind.com/post/make-prisma-ignore-a-migration-change)`;export{n as default};
