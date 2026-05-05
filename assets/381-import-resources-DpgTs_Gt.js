const e=`---
title: "Import Existing Resources Into Terraform Project"
date: 2025-04-09
id: blog0381
tag: terraform
toc: true
intro: "Certain resources are not supposed to be recreated even we recreate our infrastructure via terraform. Let's study how we define and import database and s3 bucket separately."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Database

\`\`\`hcl-1{19,21-23}
resource "aws_db_instance" "billie" {
  allocated_storage      = var.db_storage
  engine                 = var.db_engine
  engine_version         = var.db_engine_version
  instance_class         = var.db_instance_class
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = var.db_aws_subnet_group.name
  vpc_security_group_ids = [var.rds_security_group_id]
  identifier             = var.db_identifier
  storage_encrypted      = true
  publicly_accessible    = true
  skip_final_snapshot    = true # don't save the final snapshot when being destroyed
  tags = {
    Name = var.db_tag_name
  }
  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      db_name
    ]
  }
  depends_on = [var.db_aws_subnet_group]
}
\`\`\`

Note that we have to add line-19 to avoid any mistake that deletes this resource (any adjustment that leads to a deletion will be forbiddened by terraform).

Line 21-23 simply ignore the mismatch between our own terraform \`dbname\` and the **_actual_** \`dbname\` (it doesn't quite matter to us for that mismatch).

Now to import the database, we execute:

\`\`\`bash
terraform import aws_db_instance.billie <db-identifier>
\`\`\`

Then

\`\`\`bash
terraform apply -target=aws_db_instance.billie
\`\`\`

to confirm the changes.

### S3 Bucket

\`\`\`hcl
resource "aws_s3_bucket" "existing_bucket" {
  bucket = var.bucket_name

  tags = {
    Name        = "Billie File Sync Bucket"
    Environment = var.env
  }

  lifecycle {
    prevent_destroy = true
  }
}
\`\`\`

For the same reason as rds resource we set \`prevent_destroy = true\`. And the import procedure is the same:

\`\`\`bash
terraform import aws_s3_bucket.existing_bucket <bucket-name>
\`\`\`

also

\`\`\`bash
terraform apply -target=aws_s3_bucket.existing_bucket
\`\`\`

to confirm the changes.

### Potential Error and Summary

- When importing existing resources terraform will scan the whole project, we will get an error if there are resources that **_cannot be determined in the planning stage_**.

  But very likely we are in a situation where we just want to deploy / import the database first without deploying any other resources (e.g., we just want to do it stage by stage, creating database is one of the milestones).

  In this case we just **_comment out_** all the resouces that are yet to be created, and then \`terraform import\` and \`terraform apply -target\` again.

- Note that for terraform import the **_identifier_** that we should use **_may vary_** according to different resources, when in doubt we just need to check the documentation.
`;export{e as default};
