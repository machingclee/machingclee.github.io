const e=`---
title: Migration from Terraform-Cloud to S3-Backend; Study on Terragrunt
date: 2025-05-18
id: blog0396
tag: terraform, terragrunt
toc: true
intro: "We study terragrunt via opentofu"
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

### Backend Migration

#### Resource needed

- Resources need to be created manually

We need to create

- S3 Bucket

#### Transit the State from Terraform Cloud to S3-Bucket

##### For existing state in HCP terrraform

Unforturnately there is no simple migration from HCL terraform cloud to s3 bucket. When running \`terraform init -migrate-state\` we will get:

<Example>
Error: Migrating state from HCP Terraform or Terraform Enterprise to another backend is not
yet implemented.

Please use the API to do this: https://www.terraform.io/docs/cloud/api/state-versions.html
/state-versions API reference for HCP Terraform | Terraform | HashiCorp Developer (https://developer.hashicorp.com/terraform/cloud-docs/api-docs/state-versions)

</Example>

So when we have stored our terraform state in terraform cloud, the easiest migration is to directly replicate the infrastructure with s3-bucket as the store.

##### Create the \`s3_backend.tf\`

The new \`s3_backend.tf\`:

\`\`\`hcl
terraform {
  backend "s3" {
    bucket       = "some-state-bucket"
    key          = "my-application-prod-v5/state.tfstate"
    region       = "ap-southeast-2"
    encrypt      = true
    use_lockfile = true
  }
}
\`\`\`

Note that now we control our **_workspace_** by \`key\`.

Unlike old documentation:

- Nowadays latest terraform **_does not need_** the \`dynamodb_table\`.

- Terraform does not rely on dynamodb as a distributive state lock, it simply uses **_conditional_** PUT operation to create a \`.lock\` file.

  The conditional header used by terraform is:

  - \`If-None-Match: *\`

  Which only succeeds if the object doesn't already exist.

- The presence of \`.lock\` file indicates there is currently a infra-migration process, and the operations will fail until the lock is released.

### Terragrunt

#### Installation

- https://terragrunt.gruntwork.io/docs/getting-started/install/

For mac we can directly execute

\`\`\`bash
brew install terragrunt
\`\`\`

#### Application Module

##### Structure

Recall that [this article](/blog/article/Terraform-Modularization-for-DRY-Deployment-from-DEV-to-UAT-and-Input-Infrastructure-Information) we have been in this intermediate step:

![](/assets/img/2025-05-18-22-48-31.png)

Instead of creating our custom application module that wraps the \`r_xxx\` files, let's try to use terragrunt to **_generate_** code which works like a wrapped module.

For the sake of study let's use the following much simpler project:

- https://github.com/Ching-Cheong-Lee/2025-05-18-opentofu-course/tree/main/application

**_Now_** we wrap the resource \`tf\` files into a single module:

[![](/assets/img/2025-05-18-22-55-41.png)](/assets/img/2025-05-18-22-55-41.png)

##### Shared variables

For shaded variables (which are always constant among different deployment stages) we define a yml file at the outmost level:

[![](/assets/img/2025-05-18-23-01-08.png)](/assets/img/2025-05-18-23-01-08.png)

##### Stage-specific variables

[![](/assets/img/2025-05-18-23-03-18.png)](/assets/img/2025-05-18-23-03-18.png)

##### Load the variables

Create \`terragrunt.hcl\`

![](/assets/img/2025-05-18-23-07-08.png)

and write

\`\`\`hcl-1
# terragrunt.hcl

locals {
  backend_data = yamldecode(file(find_in_parent_folders("backend.yaml")))
  environment_data = yamldecode(file("environment.yaml"))
}

inputs = merge(
    local.backend_data,
    local.environment_data
)
\`\`\`

At this point the modules refereneced in \`terraform\` block in \`terragrunt.hcl\` can access variables such as \`var.backend_region\` becuase

- it is defined in \`local.backend_data\` and
- it is inside \`merge\` function.

##### Load the Application Module

This is the module that we would like to "duplicate" by terragrunt.

\`\`\`hcl-12
terraform {
  source = "../../application"

  # before_hook "notification" {
  #  commands = ["apply", "plan"]
  #  execute = ["cmd", "/C", "echo", "Running application on \${local.environment_data["region"]} region."]
  # }
}
\`\`\`

##### Files to generate before terraform execution

\`\`\`hcl-20
generate "providers" {
  path = "providers.tf"
  if_exists = "overwrite"
  contents = <<EOF
provider "aws" {
  region = "\${local.environment_data["region"]}"
}
EOF
}
\`\`\`

Note that line-21 is the path of the file that is **_to be generated_**.

##### Generate backend before terraform execution

\`\`\`hcl-29
remote_state {
  backend = "s3"
  generate = {
    path = "backend.tf"
    if_exists = "overwrite"
  }
  config = {
    bucket = local.backend_data["state_bucket_name"]
    key = "\${local.environment_data["region"]}/terraform.tfstate"
    region = local.backend_data["backend_region"]
    encrypt = true
    dynamodb_table = local.backend_data["lock_table_name"]
  }
}
\`\`\`

line 33 is also the file that is **_to be generated_**.

### Should we use terragrunt?

There are two stands towards if we should use terragrunt. I personally wouldn't use terragrunt because I have already moduliarized my own infra structure, which is already a "DRY" implementation.

Without terragrunt there would also be code duplication of:

- variables.tf
- backends.tf
- provider.tf

but to me the code duplication comes with clarity on the configuration of each environment, which do me more good than harm.
`;export{e as default};
