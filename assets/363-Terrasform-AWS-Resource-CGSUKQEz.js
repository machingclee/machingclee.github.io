const n=`---
title: "Terraform from Real Project Experience: ECS, Lambda, RDS, RDS-Proxy, VPC, VPC-Endpoints and IAM-Roles"
date: 2025-02-15
id: blog0363
tag: terraform
toc: true
intro: "Record the functioning configuration of usual resources."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Documentation

A reference that we refer most frequently:

- https://registry.terraform.io/providers/hashicorp/aws/latest/docs

### Project Structure for DEV, UAT, PROD

Here is a basic project structure:

![](/assets/img/2025-02-15-18-45-36.png)

We synchronize \`DEV\`, \`UAT\` and \`PROD\` by sharing the common modules.

#### dev/backends.tf (Terraform Cloud)

##### State Sharing

Register an account in [terrform cloud](https://app.terraform.io/session), then specify your target workspace:

\`\`\`hcl
# provider.tf

terraform {
  cloud {
    organization = "billie"
    workspaces {
      name = "billie-dev"
    }
  }
}
\`\`\`

Upon \`terraform init\`, you will be asked for a token and prompted to a webpage for login. A token will be retrieved on successful login, paste that token into the CLI to continue.

When \`terraform init\` succeeded, the terraform state file will be pulled from the remote cloud.

##### Teams

As in many platforms there can be an admin account which invites others as a member. First go to \`Settings > Teams\`

![](/assets/img/2025-02-16-13-27-34.png)

Then you can add a member once you have invited he/she into your **_organization_** (just follow the instruction _Manage organization users_):

![](/assets/img/2025-02-16-13-19-21.png)

By default **_free account_** only has **_one_** team (named _owner_).

##### Local Execution (Terrafrom Cloud Specific)

Click into the project, and make sure to change the Execution mode to \`Local\`:

[![](/assets/img/2025-02-16-13-31-15.png)](/assets/img/2025-02-16-13-31-15.png)

because we are not doing CI/CD on the cloud. Without this mode change, we cannot \`terraform apply\` to make changes in our CLI locally.

##### Other Backend Options (S3 Bucket)

Apart from terraform cloud backend, another option is to set up

- S3 Buckets (State Storage)
- DynamoDB (State Locking).

Any decent language model can proide the terraform configuration easily.

#### dev/provider.tf (AWS)

This define how terraform handle the resources when they witness a prefix. For example, \`aws\`-prefixed reousrces will be processed by the \`aws\` provider.

\`\`\`hcl
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
\`\`\`

#### dev/variables.tf

Define which parameter must be applied to the entrypoint. They are taken from

- [the following list of files in the project. (section: Setting input variables with priorities)](/blog/article/General-Concept-in-Terraform-Revisit#Setting-input-variables-with-priorities)

In CLI when running \`terraform apply\`, if the variables have not been defined (in our case we define them in \`terraform.tfvars\`), we will be asked to input that in the CLI.

\`\`\`hcl
variable "aws_region" {
  type = string
}

variable "env" {
  type = string
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "db_password" {
  type = string
}

variable "billie_kotlin_lambda_function_name" {
  type = string
}
\`\`\`

#### dev/terraform.tfvars (Project Config File)

This serves as an \`.env\` or \`application.properties\` file in usual backend project. Usually we should \`git-ignore\` those files but we choose not to do so as it lives in our private repository.

\`\`\`hcl
aws_region                         = "ap-southeast-2"
env                                = "dev"
db_name                            = "BillieRDSDev"
db_username                        = "BillieRDSDEVSuperUser"
db_password                        = "BillieRDSDEV2025!BillieRDSDEV2025!!"
billie_kotlin_lambda_function_name = "kotlin-dev-rds-proxy-dev-api"
\`\`\`

### Entrypoint to Create Resources: dev/main.tf

#### dev/main.tf

This is the entrypoint at which we instantiate the resouce modules:

\`\`\`hcl{74-76}
module "networking" {
  source                    = "../modules/networking"
  vpc_cidr                  = "10.101.0.0/16"
  public_cidr_blocks        = ["10.101.2.0/24", "10.101.4.0/24", "10.101.6.0/24"]
  private_cidr_blocks       = ["10.101.1.0/24", "10.101.3.0/24", "10.101.5.0/24"]
  rds_custom_accessible_ips = ["220.246.0.0/16"]
  env                       = var.env
  aws_region                = var.aws_region
  // destroy the lambda vpc first first before destroy the networking module:
}

module "rds_and_rds_proxy" {
  source                 = "../modules/rds_and_rds_proxy"
  db_storage             = 10
  db_engine              = "postgres"
  db_engine_version      = "16.6"
  db_instance_class      = "db.t3.micro"
  db_name                = var.db_name
  db_username            = var.db_username
  db_password            = var.db_password
  db_aws_subnet_group    = module.networking.billie_rds_subnet_group
  rds_security_group_id  = module.networking.billie_rds_sg.id
  db_identifier          = "terraform-billie-\${var.env}-rds-instance"
  db_tag_name            = "terraform-billie-\${var.env}-rds-instance"
  env                    = var.env
  billie_private_subnets = module.networking.billie_private_subnets
  billie_public_subnets  = module.networking.billie_public_subnets
  billie_rds_proxy_sg    = module.networking.billie_rds_proxy_sg
}

module "lambda" {
  source                             = "../modules/lambdas"
  billie_kotlin_lambda_function_name = var.billie_kotlin_lambda_function_name
  billie_private_subnets             = module.networking.billie_private_subnets
  billie_lambda_functions_sg_id      = module.networking.billie_lambda_function_sg.id
  env                                = var.env
  rds_proxy_arn                      = module.rds_and_rds_proxy.rds_proxy_arn
  rds_proxy_id                       = module.rds_and_rds_proxy.rds_proxy_id
}

module "loadbalancing" {
  source                             = "../modules/loadbalancing"
  billie_vpc_id                      = module.networking.billie_vpc_id
  cert_domain                        = "billie-alb-dev.wonderbricks.com"
  billie_container_port              = 9090
  env                                = var.env
  health_check_path                  = "/appInfos/health-check"
  billie_vpc_public_subnets          = module.networking.billie_public_subnets
  billie_vpc_private_subnets         = module.networking.billie_private_subnets
  billie_public_loadbalancer_sg_id   = module.networking.public_loadbalancer_sg_id
  billie_internal_loadbalancer_sg_id = module.networking.internal_loadbalancer_sg_id
  billie_kotlin_lambda_function_name = var.billie_kotlin_lambda_function_name
}

module "ecs" {
  source                                 = "../modules/ecs"
  container_name                         = "terraform-billie-nodejs-dev"
  billie_private_subnets                 = module.networking.billie_private_subnets
  cpu_scaling_threshold_in_percentage    = 100
  memory_scaling_threshold_in_percentage = 100
  min_instance                           = 1
  max_instance                           = 1
  ecr_image_url                          = "798404461798.dkr.ecr.ap-southeast-2.amazonaws.com/billie-v3-prod:prod-2025-01-24-v176-864fe37"
  cpu                                    = 1024
  memory                                 = 3072
  container_port                         = 9090
  ecs_service_security_group_id          = module.networking.billie_nodejs_ecs_sg_id
  load_balancer                          = module.loadbalancing.public_loadbalancer
  target_group                           = module.loadbalancing.billie_nodejs_target_group
  aws_region                             = var.aws_region
  env                                    = var.env
}

output "rds_proxy_endpoint" {
  value = module.rds_and_rds_proxy.rds_proxy_endpoint
}
\`\`\`

Let's quickly explain the highlighted output block:

#### Logging the module outputs

In \`main.tf\` if we write an \`output\` block, the value will be displayed in CLI when executing \`terraform plan\` or \`terraform output\`.

### Custom Modules

- There is a rich source of terraform predefined modules. But if we have adequate experience in AWS console, it is natural to create those resources on our own (as we are already clear what resources are needed).

- In the sequel let's skim through the usual resources that every company uses in their cloud infrastructure.

- When resources are referenced as \`var.something\`, they are created from other module for code organization purpose.

#### Elastic Container Service

##### Prerequisite: Difference between task and task-execution roles

**Execution Role:** This is the role that Lambda itself needs to perform basic operations like writing logs to CloudWatch. These log permissions are essential for Lambda's core functionality.

\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams",
        "logs:GetLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
\`\`\`

**Task Role:** This is for permissions that your Lambda function's code needs to access other AWS services (like S3, DynamoDB, etc.)

##### ecs/locals.tf

We simply define a constant when \`Tag\` or \`Name\` is set.

\`\`\`hcl
locals {
  app_name = var.container_name
}
\`\`\`

##### ecs/resource_cloudwatch_log_group.tf

\`\`\`hcl
resource "aws_cloudwatch_log_group" "ecs_logging" {
  name = "/ecs/\${local.app_name}"
  tags = {
    Environment = var.env
  }
}
\`\`\`

##### ecs/resource_iam.tf

Here we define

- Task execution role (responsible for granting permissions to create and connect aws services)

  **Remark 1.** We keep using AWS managed \`ecsTaskExecutionRole\`.

  **Remark 2.** Note that the default role has \`AmazonECSTaskExecutionRolePolicy\`

  ![](/assets/img/2025-02-16-01-02-23.png)

  which allows **(i)** pulling all images from ECR and **(ii)** creating log stream in any log group:

  ![](/assets/img/2025-02-16-01-03-50.png)

  Therefore the default task-execution-role almost covers any standard usecase.

- Task role (responsible for granting permissions to resouces needed by the code in container listed in task definition)

\`\`\`hcl
# task execution role (pulling images etc) --manage--> task role (using s3 etc)

data "aws_iam_role" "ecs_task_execution_role" {
  name = "ecsTaskExecutionRole"
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "ecs_task_role" {
  name = "\${local.app_name}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}
\`\`\`

##### ecs/resource_scaling_policy.tf

We have constrainted the max and min \`capacity\` to be 1. Note that by default it is still capable of launching two instances simultaneously in order for rolling update.

Nevertheless we have still included scaling policy for completeness:

\`\`\`hcl
# Auto Scaling Target
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = 1 # capacity = # of instances
  min_capacity       = 1
  resource_id        = "service/\${aws_ecs_cluster.cluster.name}/\${aws_ecs_service.service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# CPU Scaling Policy
resource "aws_appautoscaling_policy" "cpu_policy" {
  name               = "\${local.app_name}-cpu-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.cpu_scaling_threshold_in_percentage # Target CPU utilization of 50%
    scale_in_cooldown  = 300                                     # 5 minutes
    scale_out_cooldown = 300                                     # 5 minutes
  }
}

# Memory Scaling Policy
resource "aws_appautoscaling_policy" "memory_policy" {
  name               = "\${local.app_name}-memory-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.memory_scaling_threshold_in_percentage # Target Memory utilization of 50%
    scale_in_cooldown  = 300                                        # 5 minutes
    scale_out_cooldown = 300                                        # 5 minutes
  }
}
\`\`\`

##### ecs/resource_cluster_and_task_def.tf

We combine everything up til now to create a \`task\`. We will next create a \`ECS Service\` using this task definition:

\`\`\`hcl
resource "aws_ecs_cluster" "cluster" {
  name = local.app_name
}

resource "aws_ecs_task_definition" "task" {
  family                   = "terraform-\${local.app_name}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = data.aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      essential = true
      name      = local.app_name
      image     = var.ecr_image_url
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
          name          = "billie-port"
          appProtocol   = "http"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_logging.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  depends_on = [aws_cloudwatch_log_group.ecs_logging]
}
\`\`\`

##### ecs/resource_service.tf

Finally we combine cluster and task definition to create an \`ECS Service\`:

\`\`\`hcl
resource "aws_ecs_service" "service" {
  name                   = local.app_name
  cluster                = aws_ecs_cluster.cluster.id
  task_definition        = aws_ecs_task_definition.task.arn
  desired_count          = 1 # starts with 1
  launch_type            = "FARGATE"
  enable_execute_command = false

  network_configuration {
    subnets          = var.billie_private_subnets[*].id
    security_groups  = [var.ecs_service_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group.arn
    container_name   = local.app_name
    container_port   = var.container_port
  }

  depends_on = [
    aws_cloudwatch_log_group.ecs_logging,
    var.load_balancer,
    var.target_group
  ]
}
\`\`\`

##### ecs/variables.tf

\`\`\`hcl
variable "ecr_image_url" {
  type        = string
  description = "URL include :latest"
}

variable "cpu" {
  type = number
}

variable "memory" {
  type = number
}

variable "min_instance" {
  type = number
}

variable "max_instance" {
  type = number
}

variable "billie_private_subnets" {}

variable "container_port" {
  type = number
}

variable "container_name" {
  type = string
}

variable "cpu_scaling_threshold_in_percentage" {
  type = number
}

variable "memory_scaling_threshold_in_percentage" {
  type = number
}

variable "ecs_service_security_group_id" {
  type = string
}

variable "target_group" {}

variable "aws_region" {
  type = string
}

variable "env" {
  type = string
}

variable "load_balancer" {}
\`\`\`

#### RDS and RDS-Proxy

##### Security Group Schema

![](/assets/img/2025-02-17-01-19-22.png)

##### rds_and_rds_proxy/resource_rds_secrets.tf

- RDS-Proxy can be connected either by \`db_username\` and \`db_password\`, or by IAM role authentication.

- Here we choose to use \`db_username\` and \`db_password\`, for that, we need to create a secret in Secret Manager and let RDS-Proxy to access it.

\`\`\`hcl
resource "random_id" "rds_proxy_random_id" {
  byte_length = 4
  # keepers = {
  #   key_name = var.db_identifier
  # }
}

resource "aws_secretsmanager_secret" "billie_rds_proxy_credentials" {
  name = "terraform/\${var.env}/rds/billie/proxy/\${random_id.rds_proxy_random_id.hex}/credentials"
}

resource "aws_secretsmanager_secret_version" "proxy_credentials" {
  secret_id = aws_secretsmanager_secret.billie_rds_proxy_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
  })
}
\`\`\`

Note that the \`username\` and \`password\` here must be the same as that used by the \`rds\` instance.

##### rds_and_rds_proxy/resource_iam.tf

As mentioned before, we now define custom role for RDS-Proxy and grant permission to access the target secret in AWS Secret Manager.

\`\`\`hcl
# IAM role for RDS-Proxy
resource "aws_iam_role" "billie_rds_proxy" {
  name = "terraform-\${var.env}-rds-billie-proxy-role"
  # trust policy
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "rds.amazonaws.com"
      }
    }]
  })
}

# IAM policy to allow RDS-Proxy to access secrets
resource "aws_iam_role_policy" "billie_rds_proxy_policy" {
  name = "terraform-\${var.env}-billie-rds-proxy-policy"
  role = aws_iam_role.billie_rds_proxy.id
  # this is **inline** policy as it is specific to our billie_rds_proxy role
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetResourcePolicy",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecretVersionIds"
      ]
      Resource = [
        aws_secretsmanager_secret.billie_rds_proxy_credentials.arn
      ]
    }]
  })
}
\`\`\`

##### rds_and_rds_proxy/resource_rds_proxy.tf

\`\`\`hcl
# RDS-Proxy
resource "aws_db_proxy" "billie_rds_proxy" {
  name                   = "terraform-billie-rds-\${var.env}-proxy"
  debug_logging          = false
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 900
  require_tls            = false # important, otherwise the target group in rds-proxy is not available
  role_arn               = aws_iam_role.billie_rds_proxy.arn
  vpc_security_group_ids = [var.billie_rds_proxy_sg.id]
  vpc_subnet_ids         = var.billie_private_subnets[*].id

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.billie_rds_proxy_credentials.arn
  }

  tags = {
    Environment = var.env
  }
}
\`\`\`

##### rds_and_rds_proxy/resource_rds.tf

\`\`\`hcl
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
  publicly_accessible    = true
  skip_final_snapshot    = true # don't save the final snapshot when being destroyed
  tags = {
    Name = var.db_tag_name
  }
  depends_on = [var.db_aws_subnet_group]
}
\`\`\`

##### rds_and_rds_proxy/resource_rds_proxy_default_targetgroup.tf

Next we need to associate RDS-Proxy with our target database.

\`\`\`hcl
resource "aws_db_proxy_default_target_group" "billie_rds_proxy_default_tg" {
  db_proxy_name = aws_db_proxy.billie_rds_proxy.name

  connection_pool_config {
    max_connections_percent      = 100
    max_idle_connections_percent = 50
    connection_borrow_timeout    = 120
  }
}

resource "aws_db_proxy_target" "billie_rds_proxy_target" {
  db_proxy_name          = aws_db_proxy.billie_rds_proxy.name
  target_group_name      = aws_db_proxy_default_target_group.billie_rds_proxy_default_tg.name
  db_instance_identifier = aws_db_instance.billie.identifier
}
\`\`\`

##### rds_and_rds_proxy/outputs.tf

\`\`\`hcl
output "rds_proxy_id" {
  value = aws_db_proxy.billie_rds_proxy.id
}
output "rds_proxy_arn" {
  value = aws_db_proxy.billie_rds_proxy.arn
}

output "rds_proxy_endpoint" {
  value = aws_db_proxy.billie_rds_proxy.endpoint
}
\`\`\`

##### rds_and_rds_proxy/variables.tf

\`\`\`hcl
variable "db_storage" { type = number }
variable "db_engine" { type = string }
variable "db_engine_version" { type = string }
variable "db_instance_class" { type = string }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "db_password" { type = string }
variable "rds_security_group_id" { type = string }
variable "db_identifier" { type = string }
variable "db_tag_name" { type = string }
variable "env" { type = string }
variable "db_aws_subnet_group" {}
variable "billie_rds_proxy_sg" {}
variable "billie_public_subnets" {}
variable "billie_private_subnets" {}
\`\`\`

#### Lambda Functions with RDS-Proxy Configuration

##### Prerequisite: Serverless Framework

Note that we rely on \`serverless\` framework (discuss in [these articles](/blog/category/lambda)) to create a cloudformation stack of lambda function, which do a great job on

- Creation of so many resources behind the scenes (like roles, permissions, policies, vpc configuration, etc).
- Redeployment of the relevant lambda functions.

We will reference to the existing resources, we need to keep the configuration **_as minimal as possible_** since external resources (states) are not managed by our terraform project. We should minimize the impact of accidental deletion of those resources.

##### lambdas/data_kotlin_lambda.tf

Since our lambda functions are not managed by terraform, we use data block to retrieve the state:

\`\`\`hcl
data "aws_lambda_function" "billie_backend_kotlin_api" {
  function_name = var.billie_kotlin_lambda_function_name
}

data "aws_iam_role" "existing_lambda_role" {
  name = split("/", data.aws_lambda_function.billie_backend_kotlin_api.role)[1]
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
\`\`\`

##### lambdas/resource_lambda_rds_proxy_config.tf

For these lambda functions we need to grant their \`iam\` role permissions to

1. Access RDS
2. Access RDS-proxy

\`\`\`hcl
resource "aws_iam_role_policy" "lambda_rds_proxy_policy" {
  name = "terraform-\${var.env}-lambda-rds-proxy-policy"
  role = data.aws_iam_role.existing_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "rds-db:connect"
        Resource = "arn:aws:rds-db:\${data.aws_region.current.name}:\${data.aws_caller_identity.current.account_id}:dbuser:\${var.rds_proxy_id}/*"
      },
      {
        Effect   = "Allow"
        Action   = "rds:DescribeDBProxies"
        Resource = var.rds_proxy_arn
      }
    ]
  })
}
\`\`\`

and additionally

3. We need to set the lambda function into VPC and assign the auto-generated \`ENI\` (Elastic Network Interface) a Security Group in order to access the RDS-Proxy (a VPC resource).

For that, we will set the lambda functions into private subnets and assign them a security group in \`serverless.yml\` as follows

\`\`\`yml
provider:
  vpc:
    securityGroupIds:
      - sg-xxxxxx
    subnetIds:
      - subnet-0cxxx
      - subnet-0cxyy
      - subnet-0cxyz
\`\`\`

Since lambda functions are external resource, the configuration of those lambda functions in terraform should be minimal to **_minimize the impact_** to the terraform project **_caused_** by the accidental deletion of the lambda functions.

##### lambdas/outputs.tf

\`\`\`hcl
output "kotlin_lambda" {
  value = data.aws_lambda_function.billie_backend_kotlin_api
}
\`\`\`

##### lambdas/variables.tf

\`\`\`hcl
variable "billie_kotlin_lambda_function_name" {
  type = string
}

variable "billie_private_subnets" {}
variable "billie_lambda_functions_sg_id" { type = string }
variable "env" { type = string }
variable "rds_proxy_id" { type = string }
variable "rds_proxy_arn" { type = string }
\`\`\`

#### Load Balancer

##### loadbalancing/data_hosted_zone.tf

\`\`\`hcl
data "aws_route53_zone" "hosted_zone" {
  name         = "wonderbricks.com."
  private_zone = false
}
\`\`\`

##### loadbalancing/data_lambda_functions.tf

Recall that our lambda function is a **_snap-started_** function (not ordinary lambda function) wrapping a spring boot application specialized for Java-based projects:

\`\`\`hcl
data "aws_lambda_function" "billie_backend_kotlin_api" {
  function_name = var.billie_kotlin_lambda_function_name
}

data "aws_lambda_alias" "billie_snapstart" {
  function_name = data.aws_lambda_function.billie_backend_kotlin_api.function_name
  name          = "snapstart"
}
\`\`\`

##### loadbalancing/resource_cert_and_route53record.tf

Here we will be creating two \`Route53\` records. One is to **_validate_** we are the owner of the domain (\`aws_route53_record.cert_validation\`):

\`\`\`hcl
resource "aws_acm_certificate" "billie_alb_cert" {
  domain_name       = var.cert_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.billie_alb_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  name    = each.value.name
  type    = each.value.type
  zone_id = data.aws_route53_zone.hosted_zone.id
  records = [each.value.record]
  ttl     = 60
}
\`\`\`

Another one is in \`resource_loadbalancer_alias_route53record.tf\`:

##### loadbalancing/resource_loadbalancer_alias_route53record.tf

(Cont'd) Another one is an alias \`Route53\` record that **_routes_** traffics into our load balancer:

\`\`\`hcl
resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.hosted_zone.id
  name    = var.cert_domain
  type    = "A"

  alias {
    name                   = aws_alb.public_loadbalancer.dns_name
    zone_id                = aws_alb.public_loadbalancer.zone_id
    evaluate_target_health = true
  }
}
\`\`\`

##### loadbalancing/resource_target_groups.tf

For EC2 or resources with elastic IP, we usually define **_both_** \`aws_lb_target_group\` and \`aws_lb_target_group_attachment\`

\`\`\`hcl
# target-definition
resource "aws_lb_target_group" "example" {
  ...
}

# binding
resource "aws_lb_target_group_attachment" "example" {
  target_group_arn = aws_lb_target_group.example.arn
  target_id        = aws_instance.example.id  # EC2 instance ID
  # in case we use elastic IP:
  # target_id        = "172.16.0.1"
  port             = 80
}
\`\`\`

However, for ECS we **_don't need to_** do a \`target_id\`-binding, we config ECS service to bind this target group instead (see the \`load_balancer\` config of resource \`aws_ecs_service.service\`).

\`\`\`hcl
# resource_target_groups.tf

resource "aws_lb_target_group" "billie_nodejs_app" {
  name        = "billie-nodejs-\${var.env}"
  port        = var.billie_container_port
  protocol    = "HTTP"
  vpc_id      = var.billie_vpc_id
  target_type = "ip"

  health_check {
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 10
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
}

# <<<--- start of creating target group of alb for kotlin api lambda
resource "aws_lb_target_group" "billie_kotlin_lambda_target_group" {
  name        = "terraform-billie-kotlin-\${var.env}"
  target_type = "lambda"
}

# Target Group Attachment - using the SnapStart alias
resource "aws_lb_target_group_attachment" "billie_kotlin_lambda_target_group_attachment" {
  target_group_arn = aws_lb_target_group.billie_kotlin_lambda_target_group.arn
  # for non-snapstarted functions, simply use the function.arn:
  target_id        = data.aws_lambda_alias.billie_snapstart.arn
  depends_on       = [aws_lambda_permission.allow_alb_to_execute_billie_kotlin_lambda]
}

resource "aws_lambda_permission" "allow_alb_to_execute_billie_kotlin_lambda" {
  statement_id  = "AllowALBInvoke"
  action        = "lambda:InvokeFunction"
  function_name = data.aws_lambda_function.billie_backend_kotlin_api.function_name
  qualifier     = data.aws_lambda_alias.billie_snapstart.name
  principal     = "elasticloadbalancing.amazonaws.com"
  source_arn    = aws_lb_target_group.billie_kotlin_lambda_target_group.arn
}

# end of creating target group of alb for kotlin api lambda --->>>
\`\`\`

##### loadbalancing/resource_listeners.tf

\`\`\`hcl
resource "aws_lb_listener" "https_nodejs_billie" {
  load_balancer_arn = aws_alb.public_loadbalancer.arn
  port              = 9090
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = aws_acm_certificate.billie_alb_cert.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.billie_nodejs_app.arn
  }
}

resource "aws_lb_listener" "https_kotlin_billie" {
  load_balancer_arn = aws_alb.public_loadbalancer.arn
  port              = 7070
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = aws_acm_certificate.billie_alb_cert.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.billie_kotlin_lambda_target_group.arn
  }
}
\`\`\`

##### loadbalancing/resource_loadbalancers.tf

\`\`\`hcl
resource "aws_alb" "public_loadbalancer" {
  name               = "billie-public-loadbalancer-\${var.env}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.billie_public_loadbalancer_sg_id]
  subnets            = var.billie_vpc_public_subnets[*].id
}
\`\`\`

##### loadbalancing/outputs.tf

\`\`\`hcl
output "billie_nodejs_target_group" {
  value = aws_lb_target_group.billie_nodejs_app
}

output "public_loadbalancer" {
  value = aws_alb.public_loadbalancer
}
\`\`\`

##### loadbalancing/variables.tf

\`\`\`hcl
variable "billie_vpc_id" {
  type = string
}
variable "cert_domain" {
  type = string
}
variable "health_check_path" {
  type = string
}
variable "env" {
  type = string
}
variable "billie_public_loadbalancer_sg_id" {
  type = string
}
variable "billie_internal_loadbalancer_sg_id" {
  type = string
}
variable "billie_vpc_public_subnets" {}
variable "billie_vpc_private_subnets" {}
variable "billie_container_port" {
  type = number
}
variable "billie_kotlin_lambda_function_name" {
  type = string
}
\`\`\`

##### Short summary for listener to route traffics to ECS and Lambda

- **ECS.** We need

  1. \`aws_lb_listener\`
  2. \`aws_lb_target_group\` (without \`aws_lb_target_group_attachment\`) and
  3. ECS service's \`load_balancer\` definition for 1-way binding

- **Lambda Function.** We need

  1. \`aws_lb_listener\`
  2. \`aws_lb_target_group\` and \`aws_lb_target_group_attachment\` binding the lambda function
  3. \`aws_lambda_permission\` to grant invokation permission to target group

#### Networking

##### networking/data_availability_zones.tf

\`\`\`hcl
data "aws_availability_zones" "available" {
  state = "available"
}
\`\`\`

##### networking/data_nat_gateway_elastic_ip.tf

\`\`\`hcl
data "aws_eip" "billie_nat_gateway_ip" {
  filter {
    name   = "tag:Name"
    values = ["billie-private-subnet-\${var.env}"]
  }
}
\`\`\`

##### networking/resource_nat_gateway.tf

\`\`\`hcl
resource "aws_nat_gateway" "main" {
  allocation_id = data.aws_eip.billie_nat_gateway_ip.id
  subnet_id     = aws_subnet.billie_public_subnets[0].id
}
\`\`\`

##### networking/resource_security_groups.tf

\`\`\`hcl
resource "aws_security_group" "billie_lambda_function_sg" {
  name        = "billie_service_\${var.env}_lambda_sg"
  description = "Security Group for all lambda functions for billie service in \${var.env} environment"
  vpc_id      = aws_vpc.billie_vpc.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}



# billie lambdas -> rds-proxy -> rds
resource "aws_security_group" "billie_rds_sg" {
  name        = "terraform-billie-\${var.env}-rds"
  description = "Security Group for Billie RDS"
  vpc_id      = aws_vpc.billie_vpc.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "pgsql allows everything in the VPC to access"
  }

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.rds_custom_accessible_ips
    description = "pgsql allows every connection from wonderbricks office"
  }

  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.billie_rds_proxy.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}
resource "aws_security_group" "billie_rds_proxy" {
  name        = "billie_rds_\${var.env}_proxy"
  description = "Security group for Billie RDS-Proxy for \${var.env} environment"
  vpc_id      = aws_vpc.billie_vpc.id

  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.billie_lambda_function_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "public_loadbalancer" {
  name        = "billie-public-load-balancer-\${var.env}"
  description = "Security group for public loadbalancer in \${var.env} environment"
  vpc_id      = aws_vpc.billie_vpc.id
  ingress {
    description = "any where for now"
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "any where for now"
    from_port   = 7070
    to_port     = 7070
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "private_loadbalancer" {
  name        = "billie-internal-load-balancer-\${var.env}"
  description = "Security group for internal loadbalancer in \${var.env} environment"
  vpc_id      = aws_vpc.billie_vpc.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}


resource "aws_security_group" "billie_nodejs_ecs_service" {
  name        = "billie-nodejs-ecs-\${var.env}"
  description = "Security group for billie nodejs ECS in \${var.env} environment"
  vpc_id      = aws_vpc.billie_vpc.id
  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.public_loadbalancer.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# resources that are available to using this endpoint should be put in the ingress rule
resource "aws_security_group" "vpc_endpoints" {
  vpc_id = aws_vpc.billie_vpc.id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.billie_nodejs_ecs_service.id]
  }


  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "billie-cloudwatch-vpc-endpoint-in-\${var.env}"
  }
}


# Security Group for the VPC Endpoint
resource "aws_security_group" "rds_endpoint_sg" {
  name        = "terraform-\${var.env}-rds-endpoint-sg"
  description = "Security group for RDS VPC endpoint"
  vpc_id      = aws_vpc.billie_vpc.id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.billie_lambda_function_sg.id] # Allow access from Lambda security group
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "terraform-\${var.env}-rds-endpoint-sg"
  }
}
\`\`\`

##### networking/resource_ssm.tf

We can share terraform state to other aws resources via aws-sdk once appropriate permission is granted to the IAM role.

\`\`\`hcl
resource "aws_ssm_parameter" "billie_lambda_sg" {
  name  = "/billie/\${var.env}/terraform/sg/billie-lambda/id"
  type  = "String"
  value = aws_security_group.billie_lambda_function_sg.id
}

resource "aws_ssm_parameter" "private_subnets" {
  name  = "/billie/\${var.env}/terraform/private-subnets/ids"
  type  = "String"
  value = join(",", aws_subnet.billie_private_subnets[*].id)
}
\`\`\`

##### networking/resource_subnets_and_routetables.tf

\`\`\`hcl
resource "aws_subnet" "billie_public_subnets" {
  count                   = length(var.public_cidr_blocks)
  vpc_id                  = aws_vpc.billie_vpc.id
  cidr_block              = var.public_cidr_blocks[count.index]
  map_public_ip_on_launch = true
  availability_zone       = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "billie_public_subnet_\${count.index + 1}"
  }
}

resource "aws_subnet" "billie_private_subnets" {
  count                   = length(var.private_cidr_blocks)
  vpc_id                  = aws_vpc.billie_vpc.id
  cidr_block              = var.private_cidr_blocks[count.index]
  map_public_ip_on_launch = false
  availability_zone       = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "billie_private_subnet_\${count.index + 1}"
  }
}

resource "aws_db_subnet_group" "billie_rds_subnet_group" {
  name       = "billie_rds_subnet_group_\${var.env}"
  subnet_ids = aws_subnet.billie_public_subnets[*].id
  tags = {
    Name = "billie_rds_subnet_group_\${var.env}"
  }
}

resource "aws_internet_gateway" "billie_internet_gateway" {
  vpc_id = aws_vpc.billie_vpc.id

  tags = {
    Name = "billie_igw"
  }
}


resource "aws_route_table" "billie_public_route_table" {
  vpc_id = aws_vpc.billie_vpc.id
  tags = {
    Name = "billie_public_route_table"
  }
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.billie_internet_gateway.id
  }
}

resource "aws_route_table" "nat_gateway_routing" {
  vpc_id = aws_vpc.billie_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
}

resource "aws_route_table_association" "billie_public_subnet_association" {
  count          = length(var.public_cidr_blocks)
  subnet_id      = aws_subnet.billie_public_subnets[count.index].id
  route_table_id = aws_route_table.billie_public_route_table.id
}


resource "aws_route_table_association" "billie_private_subnet_association" {
  count          = length(var.private_cidr_blocks)
  subnet_id      = aws_subnet.billie_private_subnets[count.index].id
  route_table_id = aws_route_table.nat_gateway_routing.id
}
\`\`\`

##### networking/resource_vpc_endpoints.tf

Resources inside our private VPC require VPC-endpoints to reach the "Endpoint Services" such as Cloudwatch and RDS.

Otherwise we need a costly NAT-Gateway with target resources being publicly accessible since NAT Gateway can't provide private access to AWS services.

\`\`\`hcl
resource "aws_vpc_endpoint" "cloudwatch_logs" {
  vpc_id            = aws_vpc.billie_vpc.id
  service_name      = "com.amazonaws.\${var.aws_region}.logs"
  vpc_endpoint_type = "Interface"
  subnet_ids        = aws_subnet.billie_private_subnets[*].id

  security_group_ids = [
    aws_security_group.vpc_endpoints.id
  ]

  tags = {
    Name = "vpc-endpoint for billie private subnets"
  }

  private_dns_enabled = true
}

resource "aws_vpc_endpoint" "rds_vpc_endpoint" {
  vpc_id              = aws_vpc.billie_vpc.id
  service_name        = "com.amazonaws.\${var.aws_region}.rds"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    aws_security_group.rds_endpoint_sg.id
  ]

  subnet_ids = aws_subnet.billie_private_subnets[*].id

  tags = {
    Name = "terraform-\${var.env}-rds-vpc-endpoint"
  }
}
\`\`\`

##### networking/resource_vpc.tf

\`\`\`hcl
resource "aws_vpc" "billie_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "billie-\${var.env}-vpc"
  }

  lifecycle {
    create_before_destroy = true
  }
}
\`\`\`

##### networking/outputs.tf

\`\`\`hcl
output "availability_zone" {
  value = data.aws_availability_zones.available
}

output "billie_vpc_id" {
  value = aws_vpc.billie_vpc.id
}

output "billie_rds_subnet_group" {
  value = aws_db_subnet_group.billie_rds_subnet_group
}

output "billie_rds_sg" {
  value = aws_security_group.billie_rds_sg
}

output "billie_lambda_function_sg" {
  value = aws_security_group.billie_lambda_function_sg
}

output "billie_rds_proxy_sg" {
  value = aws_security_group.billie_rds_proxy
}

output "billie_private_subnets" {
  value = aws_subnet.billie_private_subnets
}

output "billie_public_subnets" {
  value = aws_subnet.billie_public_subnets
}

output "billie_nodejs_ecs_sg_id" {
  value = aws_security_group.billie_nodejs_ecs_service.id
}

output "public_loadbalancer_sg_id" {
  value = aws_security_group.public_loadbalancer.id
}

output "internal_loadbalancer_sg_id" {
  value = aws_security_group.private_loadbalancer.id
}
\`\`\`

##### networking/variables.tf

\`\`\`hcl
variable "vpc_cidr" {
  type = string
}
variable "public_cidr_blocks" {
  type = list(string)
}
variable "private_cidr_blocks" {
  type = list(string)
}
variable "rds_custom_accessible_ips" {
  type = list(string)
}
variable "env" {
  type = string
}

variable "aws_region" {
  type = string
}
\`\`\`

### Useful Remarks

#### RDS-Proxy endpoint remains the same even I destroyed and recreated it

Even if you destroy and recreate it, as long as you use:

- The same proxy name
- The same region
- The same AWS account

You'll get the same endpoint URL. This is actually beneficial for

- DNS caching
- Application configuration stability
- Avoiding the need to update connection strings frequently

#### AWS SSM: Share the terrform outputs to other aws resources

Resources like

\`\`\`hcl
resource "aws_ssm_parameter" "private_subnet_ids" {
  name  = "/\${var.env}/vpc/private_subnet_ids"
  type  = "String"
  value = join(",", aws_subnet.billie_private_subnets[*].id)
}
\`\`\`

can be found in \`AWS Systems Manager > 
Parameter Store\`. These parameters can be accessed by \`aws-sdk\` when the resource has appropriate permission in their policy to access this paramter store.

#### Logging when creating aws resources by local executor provisioner

For any resource we can add \`local-exec\` povisioner to log desired content:

\`\`\`hcl
  provisioner "local-exec" {
    command = <<EOT
      echo "[MODULE DEBUG] Lambda function name: \${data.aws_lambda_function.billie_backend_kotlin_api.function_name}"
      echo "[MODULE DEBUG] Subnet IDs: \${join(",", var.billie_private_subnets[*].id)}"
      echo "[MODULE DEBUG] Security Group ID: \${var.billie_lambda_functions_sg_id}"

      aws lambda update-function-configuration --function-name \${data.aws_lambda_function.billie_backend_kotlin_api.function_name} --vpc-config SubnetIds=\${join(",", var.billie_private_subnets[*].id)},SecurityGroupIds=\${var.billie_lambda_functions_sg_id}
    EOT
  }
\`\`\`

### Troubleshootings

#### Cannot delete a security group because of unknown dependencies

Try executing

\`\`\`text
aws ec2 describe-network-interfaces --filters "Name=group-id,Values=sg-08597314e84ca01e6"
\`\`\`

#### ENI assigned to lambda function is stuck at deletion, blocking the deletion of subnets

When a lambda function is put into a VPC, each subnet will create an ENI to this lambda function.

- Since serverless lambda function is not managed by our terraform, to successfully delete everything listed in terraform state we need to first delete the lambda function which we refer by data block by

  \`\`\`text
  serverless remove --config serverless-something.yml
  \`\`\`

- Recreate that lambda using the **same** \`yml\` file (create all necessary resources like snap-started record)

- Run the shell script to delete all ENI's manually

- Then continue to use \`terraform delete\`

### Other Open Source Toolings

#### Terragrunt

To be studied:

- https://blog.gruntwork.io/how-to-use-terraform-as-a-team-251bc1104973

### References

- [Youtube, _Complete Terraform Course - From BEGINNER to PRO! (Learn Infrastructure as Code_)](https://www.youtube.com/watch?v=7xngnjfIlK4)

- [Udemy, _More than Certified in Terraform 2025_](https://www.udemy.com/course/terraform-certified/?couponCode=24T2MT070225)

- [Article, _Making Terraform and Serverless framework work together_](https://theburningmonk.com/2019/03/making-terraform-and-serverless-framework-work-together/#Reference_Terraform_resources_in_Serverless_Framework)
`;export{n as default};
