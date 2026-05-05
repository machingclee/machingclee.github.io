const n=`---
title: "SQL Functions to Generate created_at, human-readable created_at and updated_at"
date: 2024-03-01
id: blog0244
tag: sql
intro: "Convenient simple functions to set as default in SQL."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Scripts
#### Automatic updatedAt
\`\`\`sql
DROP TRIGGER IF EXISTS upd_trig on "MessagesSession";

create or replace FUNCTION upd_trig() RETURNS trigger
   LANGUAGE plpgsql AS
$$BEGIN
   NEW."updatedAt" := gen_created_at();
   RETURN NEW;
END;$$;
\`\`\`
And for every table that you want an \`updatedAt\` column:
\`\`\`sql
CREATE TRIGGER upd_trig BEFORE UPDATE ON your_table
   FOR EACH ROW EXECUTE PROCEDURE upd_trig();
\`\`\`

#### Automatic createdAt
\`\`\`sql
CREATE OR REPLACE FUNCTION gen_created_at() RETURNS float as $$
BEGIN
	return ROUND(extract(epoch from NOW()::TIMESTAMPTZ) * 1000, 0)::float;
END
$$
LANGUAGE plpgsql;
\`\`\`
#### Automatic human readble createdAt in HK
\`\`\`sql
CREATE OR REPLACE FUNCTION gen_created_at_hk_timestr() RETURNS text as $$
BEGIN
	return TO_CHAR((NOW()::TIMESTAMPTZ AT TIME ZONE 'UTC' AT TIME ZONE 'GMT+8'), 'YYYY-MM-DD HH24:MI:SS');
END
$$
LANGUAGE plpgsql;
\`\`\`

### Usages

#### Prisma
\`\`\`prisma
model SomeModel {
    ...
    createdAt     Float   @default(dbgenerated("gen_created_at()"))
    createdAtHK   String  @default(dbgenerated("gen_created_at_hk_timestr()"))
}
\`\`\`

#### Plain SQL

\`\`\`sql
ALTER TABLE "SomeModel"     ADD COLUMN "createdAt" DOUBLE PRECISION NOT NULL DEFAULT gen_created_at(),
ADD COLUMN  "createdAtHK"   TEXT NOT NULL DEFAULT gen_created_at_hk_timestr();
\`\`\`




`;export{n as default};
