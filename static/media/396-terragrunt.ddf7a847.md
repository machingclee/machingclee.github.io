---
title: Migration from Terraform-Cloud to S3-Backend; Study on Terragrunt
date: 2025-05-18
id: blog0396
tag: terraform, terragrunt
toc: true
intro: "We study terragrunt via opentofu"
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

#### Backend Migration

##### Resource needed

- Resources need to be created manually

We need to create

- S3 Bucket

- DynamocDB (for its distributive lock implemented by TTL row)

  [![](/assets/img/2025-05-18-18-58-47.png)](/assets/img/2025-05-18-18-58-47.png)

##### Transit the State from Terraform Cloud to S3-Bucket

###### Step 1. Configure providers.tf

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
```

###### Step 2. Create the `s3_backend.tf` and leave existing `backend.tf` there

1. The old `backend.tf`:

   ```hcl
   # backend.tf
   terraform {
     cloud {
       organization = "billie"
       workspaces {
         name = "billie-prod"
       }
     }
   }
   ```

   Before migration let's leave the `backend.tf` there to let OpenTofu **_detect_** the **_existence_** of two backends.

2. The new `s3_backend.tf`:

   ```hcl{4}
   terraform {
     backend "s3" {
       bucket         = "your-terraform-state-bucket"
       key            = "billie-prod/state.tfstate"
       region         = var.aws_region
       encrypt        = true
       dynamodb_table = "terraform-state-lock"
     }
   }
   ```

   Note that now we control our **_workspace_** by `key`. Among `DEV`, `UAT` and `PROD` we share the same `dynamodb_table` as it is simply for locking purpose when we transit the state of our infrastructure.

###### Step 3. Migrate the state into different backend

Don't use `tofu` at this time for greatest compatibility before our state stabilizes:

```bash
terraform init -migrate-state
```

Enter **_Yes_** for the following question:

```text
Terraform detected that the backend type is changing from "cloud" to "s3".
Do you want to copy existing state to the new backend?
  Pre-existing state was found while migrating the previous "cloud" backend to the
  newly configured "s3" backend. No existing state was found in the newly
  configured "s3" backend. Do you want to copy this state to the new "s3"
  backend? Enter "yes" to copy and "no" to start with an empty state.
```

#### Terragrunt

##### Installation

- https://terragrunt.gruntwork.io/docs/getting-started/install/

For mac we can directly execute

```bash
brew install terragrunt
```

##### Application Module

###### Structure

Recall that [this article](/blog/article/Terraform-Modularization-for-DRY-Deployment-from-DEV-to-UAT-and-Input-Infrastructure-Information) we have been in this intermediate step:

![](/assets/img/2025-05-18-22-48-31.png)

Instead of creating our custom application module that wraps the `r_xxx` files, let's try to use terragrunt to **_generate_** code which works like a wrapped module.

For the sake of study let's use the following much simpler project:

- https://github.com/Ching-Cheong-Lee/2025-05-18-opentofu-course/tree/main/application

**_Now_** we wrap the resource `tf` files into a single module:

[![](/assets/img/2025-05-18-22-55-41.png)](/assets/img/2025-05-18-22-55-41.png)

###### Shared variables

For shaded variables (which are always constant among different deployment stages) we define a yml file at the outmost level:

[![](/assets/img/2025-05-18-23-01-08.png)](/assets/img/2025-05-18-23-01-08.png)

###### Stage-specific variables

[![](/assets/img/2025-05-18-23-03-18.png)](/assets/img/2025-05-18-23-03-18.png)

###### Load the variables

Create `terragrunt.hcl`

![](/assets/img/2025-05-18-23-07-08.png)

and write

```hcl-1
# terragrunt.hcl

locals {
  backend_data = yamldecode(file(find_in_parent_folders("backend.yaml")))
  environment_data = yamldecode(file("environment.yaml"))
}

inputs = merge(
    local.backend_data,
    local.environment_data
)
```

At this point the modules refereneced in `terraform` block in `terragrunt.hcl` can access variables such as `var.backend_region` becuase

- it is defined in `local.backend_data` and
- it is inside `merge` function.

###### Load the Application Module

This is the module that we would like to "duplicate" by terragrunt.

```hcl-12
terraform {
  source = "../../application"

  # before_hook "notification" {
  #  commands = ["apply", "plan"]
  #  execute = ["cmd", "/C", "echo", "Running application on ${local.environment_data["region"]} region."]
  # }
}
```

###### Files to generate before terraform execution

```hcl-20
generate "providers" {
  path = "providers.tf"
  if_exists = "overwrite"
  contents = <<EOF
provider "aws" {
  region = "${local.environment_data["region"]}"
}
EOF
}
```

Note that line-21 is the path of the file that is **_to be generated_**.

###### Generate backend before terraform execution

```hcl-29
remote_state {
  backend = "s3"
  generate = {
    path = "backend.tf"
    if_exists = "overwrite"
  }
  config = {
    bucket = local.backend_data["state_bucket_name"]
    key = "${local.environment_data["region"]}/terraform.tfstate"
    region = local.backend_data["backend_region"]
    encrypt = true
    dynamodb_table = local.backend_data["lock_table_name"]
  }
}
```

line 33 is also the file that is **_to be generated_**.

#### Should we use terragrunt?

There are two stands towards if we should use terragrunt. I personally wouldn't use terragrunt because I have already moduliarized my own infra structure, which is already a "DRY" implementation.

Without terragrunt there would also be code duplication of:

- variables.tf
- backends.tf
- provider.tf

but to me the code duplication comes with clarity on the configuration of each environment, which do me more good than harm.
