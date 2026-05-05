const n=`---
title: "Terraform Project to Manage Console-Created Lambdas"
date: 2025-02-27
id: blog0366
tag: terraform
toc: true
intro: "Record an architecture to manage simple lambda functions that can be created directly in aws console."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Why?

For sure it is very handy to define lambda functions, and then test it and deploy it in console directly. But problem occurs when:

1. You have **_plenty of them_**,
2. with each being granted appropriate **_policy_** for differnet AWS **_resources_**, or even internal VPC resources.
3. You need to define the common connection-endpoint/credential (like database host, service API-key, etc) which are shared by many lambda functions
4. You need to replicate all of the above in \`DEV\`, \`UAT\` and \`PROD\` environment.

Without a terraform project to manage all of them, you are bound to run into chaos in very early stage.

### Separation of Concerns (Namespaces)

- This project **_only_** focues on **_versioning_** the lambda functions (as well as the layers they use) sporatically defined in AWS console. The creation of polices and the attachments are not governed here.

- That being said, our current project is created in a **_separated namespace_** (in terms of terraform cloud).

- Policies like RDS-Proxy Access, S3 Access, DynamoDB Access, Apigateway Websocket API Access, etc, should all be managed in the root terraform module in which you define your core infrastructure.

### Project Structure

![](/assets/img/2025-03-04-02-01-36.png)

### Module Creating Function and Layer

Let's focus on this part:

![](/assets/img/2025-03-04-02-02-49.png)

#### main.tf

We will apply offical modules to create our own custom module.

##### Define a Function

\`\`\`hcl-1{15}
# main.tf

module "lambda_function" {
  source        = "terraform-aws-modules/lambda/aws"
  function_name = var.function_name
  description   = var.description
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  publish       = true

  source_path = var.nodejs_function_source_path

  store_on_s3 = false

  layers = module.lambda_layer_nodejs_pgs[*].lambda_layer_arn

  environment_variables = var.env_variable

  tags = {
    Module = "lambda-with-layer"
  }
}
\`\`\`

Note that the highlighted is an import of the layer defined in the module right below:

##### Define a Layer

\`\`\`hcl
# main.tf

module "lambda_layer_nodejs_pgs" {
  count  = length(var.nodejs_layer_source_path) > 0 ? 1 : 0
  source = "terraform-aws-modules/lambda/aws"

  create_layer = true

  layer_name          = "terraform-pg-layer"
  description         = "Layer to enable import pg from 'pg'"
  compatible_runtimes = ["nodejs22.x", "nodejs18.x", "nodejs20.x"]

  source_path = var.nodejs_layer_source_path
  store_on_s3 = false
}
\`\`\`

#### outputs.tf

\`\`\`hcl
output "function_name" {
  value = var.function_name
}

output "invoke_arn" {
  value = module.lambda_function.lambda_function_invoke_arn
}
\`\`\`

The \`invoke_arn\` is used in defining the websocket-api of apigateway through terraform. This will not be used in this article.

#### variables.tf

\`\`\`hcl
variable "env" {
  type = string
}
variable "description" {
  type = string
}

variable "nodejs_layer_source_path" {
  type = string
}

variable "nodejs_function_source_path" {
  type    = string
  default = ""
}

variable "function_name" {
  type = string
}

variable "env_variable" {}

\`\`\`

### Lambda Function File Structure and Lambda Layer Structure

#### Function

#### NPM Package Layer

### Deploy a set of Lambda Functions with shared Configuration and Credentials

Each function must be named \`index.js\` or \`index.mjs\`, with a folder containing it:

![](/assets/img/2025-03-04-02-22-48.png)

#### Import configs from AWS Parameter Store (SSM) and Existing AWS Resources

- Each nodejs layer must be of the form \`<layer-name>/nodejs/\`
- of which you need to define \`package.json\` and
- you need an \`node_modules\` by running \`yarn\` or \`npm install\`.

![](/assets/img/2025-03-04-02-24-47.png)

##### Direct import of resources

\`\`\`hcl
# r_data_and_local.tf

data "aws_db_proxy" "billie_rds_proxy" {
  	name = var.rds_proxy_identifier
}
\`\`\`

##### Handle json string from SSM

\`\`\`hcl
# r_data_and_local.tf

data "aws_ssm_parameter" "rds_proxy_parameter" {
	name = var.rds_proxy_parameter_name
}

locals {
	rds_proxy_config = jsondecode(data.aws_ssm_parameter.rds_proxy_parameter.value)
}
\`\`\`

We access the attribute in the json string by \`local.rds_proxy_config.db.username\`

##### Deploy Functions and Create Layers with Configs in Environment Variables

\`\`\`hcl
# r_websocket_lambdas.tf

locals {
  websocket_lambdas = {
    connect = {
      function_name   = "notification-socket-connect-\${var.env}"
      function_source = "../../src/functions/websocket-notification/connect"
      layer_source    = "../../src/layers/nodejs-pg-layer"
      description     = "api gateway websocket in \${var.env} on socket connection"
    }
    disconnect = {
      function_name   = "notification-socket-disconnect-\${var.env}"
      function_source = "../../src/functions/websocket-notification/disconnect"
      layer_source    = "../../src/layers/nodejs-pg-layer"
      description     = "api gateway websocketin \${var.env} on socket disconnection"
    }
    api-publisher = {
      function_name   = "notification-api-publisher-\${var.env}"
      function_source = "../../src/functions/websocket-notification/websocket-api-publisher"
      layer_source    = ""
      description     = "Used to publish messages to connectionId"
    }
  }
}


module "wbsocket_lambda" {
  for_each                    = local.websocket_lambdas
  function_name               = each.value.function_name
  source                      = "../../modules/simple_lambda_function"
  nodejs_function_source_path = each.value.function_source
  nodejs_layer_source_path    = each.value.layer_source
  description                 = each.value.description
  env                         = var.env
  env_variable = {
    db_user     = local.rds_proxy_config.db.username
    db_password = local.rds_proxy_config.db.password
    db_host     = local.rds_proxy_config.db.host
    db_name     = local.rds_proxy_config.db.dbname
  }
}
\`\`\`

Now all of our lambda functions can access \`process.env.db_password\`!

##### Store results as a json string into SSM

Sometimes we wish to store the specific data of lambda resources back to AWS (most of the time the \`function_name\` itself is enough)

\`\`\`hcl
# r_ssm_parameters.tf

resource "aws_ssm_parameter" "billie_notificatoin_socket" {
  name = "/billie/\${var.env}/notification/web/lambdas"
  type = "String"
  value = jsonencode({
    connect = {
      function_name = module.wbsocket_lambda["connect"].function_name
      invoke_arn    = module.wbsocket_lambda["connect"].invoke_arn
    }
    disconnect = {
      function_name = module.wbsocket_lambda["disconnect"].function_name
      invoke_arn    = module.wbsocket_lambda["disconnect"].invoke_arn
    }
    api_publisher = {
      function_name = module.wbsocket_lambda["api-publisher"].function_name
      invoke_arn    = module.wbsocket_lambda["api-publisher"].invoke_arn
    }
  })
}
\`\`\`

#### Prototype of Project Configuration in DEV: variables.tf

This file serves as a strong typing of \`terraform.tfvars\`:

\`\`\`hcl
# variables.tf

variable "aws_region" { type = string } # overridable by github action
variable "env" { type = string }        # overridable by github action
variable "rds_proxy_identifier" { type = string }
variable "rds_proxy_parameter_name" {
  type = string
}
\`\`\`
`;export{n as default};
