---
title: Restore MongoDB from Backup
date: 2024-10-25
id: blog0335
tag: mongodb, db-backup
toc: true
intro: "Let's discuss how to restore a mongodb from backup, how does the back up actually?"
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### The Backup Data

Usually a backup data generated from `mongodump` looks the following:

![](/assets/img/2024-10-27-22-27-50.png)

Let's name this folder as `mongo_backup/some_db`.

#### Script to Inject Backuped Data

##### Cloning old data into new Database
```bash
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_NAME=
DB_URL="mongodb+srv://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}"
OPTIONS="retryWrites=true&w=majority"

mongorestore --uri $DB_URL --dir ./mongo_backup/some_db
```
`some_db/` is the directory containing all the files in the image above.

##### Cloning old data into the Original Database for Restoration

This time we should run with the additional flag `--drop`:

```bash
mongorestore --drop --uri $DB_URL --dir ./mongo_backup/some_db
```
which means that for every collection that we are going to restore, we ***first*** drop it.

Note that in this case any ***new*** collection ***not included in*** the `mongo_backup` will not be dropped.