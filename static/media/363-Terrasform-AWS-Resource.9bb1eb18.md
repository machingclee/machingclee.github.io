---
title: "Create AWS Resources via Terraform"
date: 2025-01-26
id: blog0363
tag: terraform
toc: true
intro: "We study terraform pracitcally by creating common resources in daily work."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

#### Documentation

A reading that we refer most refrequently:

- https://registry.terraform.io/providers/hashicorp/aws/latest/docs

#### AWS Resources

##### Database Module

- main.tf
  ```hcl
  resource "aws_db_instance" "james_db" {
    allocated_storage      = var.db_storage
    engine                 = var.db_engine
    engine_version         = var.db_engine_version
    instance_class         = var.db_instance_class
    db_name                = var.db_name
    username               = var.db_username
    password               = var.db_password
    db_subnet_group_name   = var.db_subnet_group_name
    vpc_security_group_ids = var.vpc_security_group_ids // the RDS instance must be assigned at least one security group.
    identifier             = var.db_identifier
    skip_final_snapshot    = var.skip_final_snapshot
    tags = {
      Name = "james-db"
    }
  }
  ```
- variables.tf

  ```hcl
  variable "db_storage" {
    type        = number
    description = "Should be an integer in GB"
  }

  variable "db_engine" {
    type    = string
    default = "mysql"
  }

  variable "db_engine_version" {
    type = string
  }


  variable "db_instance_class" {
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


  variable "db_subnet_group_name" {
    type = string
  }

  variable "vpc_security_group_ids" {
    type = list(string)
  }

  variable "db_identifier" {
    type = string
  }

  variable "skip_final_snapshot" {
    type = bool
  }
  ```

- outputs.tf
  ```hcl
  output "db_endpoint" {
    value = aws_db_instance.james_db.endpoint
  }
  ```

##### Loadbalancing Module

- main.tf

  ```hcl-1{21}
  resource "aws_lb" "james_lb" {
    name            = "james-loadbalancer"
    subnets         = var.public_subnets
    security_groups = var.public_security_groups
    idle_timeout    = 900
  }

  /*
  Avoid naming conflicts during recreate/redeploy:
  When you destroy and recreate resources, AWS keeps the old name in a "cooling period"
  Without random suffixes, you might get errors like "name already exists" when redeploying
  */

  resource "aws_lb_target_group" "james_target_group" {
    name     = "james-lb-tg-${substr(uuid(), 0, 4)}"
    port     = var.tg_port
    protocol = var.tg_protocol
    vpc_id   = var.vpc_id
    lifecycle {
      ignore_changes        = [name]
      create_before_destroy = true
  ```

  - Note that when set to false, the destruction will be halted because:
  - When we change the port, the target group will be destroyed, and the listener has no where to route the traffic until the new target group is created
  - But listener cannot live without target group, the deletion of the target group will get halted due to AWS's own validation
  - We use `create_before_destroy = true` to make sure there must be an existing target group assignable to the listener

  ```hcl-22
    }
    health_check {
      healthy_threshold   = var.lb_healthy_threshold
      unhealthy_threshold = var.lb_unhealthy_threshold
      timeout             = var.lb_timeout
      interval            = var.lb_interval
    }
  }


  resource "aws_lb_listener" "james_lb_listener" {
    load_balancer_arn = aws_lb.james_lb.arn
    port              = var.listener_port
    protocol          = var.listener_portocol
    default_action {
      type             = "forward"
      target_group_arn = aws_lb_target_group.james_target_group.arn
    }
  }
  ```

- variables.tf

  ```hcl
  variable "public_security_groups" {
    type = list(string)
  }

  variable "public_subnets" {
    type = list(string)
  }

  variable "tg_port" {
    type = string
  }
  variable "tg_protocol" {
    type = string
  }

  variable "vpc_id" {
    type = string
  }

  variable "lb_healthy_threshold" {
    type = string
  }
  variable "lb_unhealthy_threshold" {
    type = string
  }
  variable "lb_timeout" {
    type = number
  }
  variable "lb_interval" {
    type = number
  }

  variable "listener_port" {
    type = number
  }

  variable "listener_portocol" {
    type = string
  }
  ```

- outputs.tf

  ```hcl
  output "james_target_group_arn" {
    value = aws_lb_target_group.james_target_group.arn
  }

  output "lb_endpoint" {
    value = aws_lb.james_lb.dns_name
  }
  ```

##### Networking Module (Security Groups, etc)

- main.tf

  ```hcl
  resource "random_integer" "random" {
    min = 1
    max = 100
  }

  data "aws_availability_zones" "available" {
    state = "available"
  }

  resource "aws_vpc" "james_vpc" {
    cidr_block           = var.vpc_cidr
    enable_dns_hostnames = true
    enable_dns_support   = true

    tags = {
      Name = "james_vpc-${random_integer.random.id}"
    }

    lifecycle {
      create_before_destroy = true
    }
  }

  resource "aws_route_table_association" "james_public_subnet_association" {
    count          = length(var.public_cidrs)
    subnet_id      = aws_subnet.james_public_subnet.*.id[count.index]
    route_table_id = aws_route_table.james_public_route_table.id
  }


  resource "aws_subnet" "james_public_subnet" {
    count                   = length(var.public_cidrs)
    vpc_id                  = aws_vpc.james_vpc.id
    cidr_block              = var.public_cidrs[count.index]
    map_public_ip_on_launch = true
    availability_zone       = data.aws_availability_zones.available.names[count.index]

    tags = {
      Name = "james_public_subnet_${count.index + 1}"
    }
  }

  resource "aws_subnet" "james_private_subnet" {
    count                   = length(var.private_cidrs)
    vpc_id                  = aws_vpc.james_vpc.id
    cidr_block              = var.private_cidrs[count.index]
    map_public_ip_on_launch = false
    availability_zone       = data.aws_availability_zones.available.names[count.index]

    tags = {
      Name = "james_private_subnet_${count.index + 1}"
    }
  }

  resource "aws_internet_gateway" "james_internet_gateway" {
    vpc_id = aws_vpc.james_vpc.id
    tags = {
      Name = "james_igw"
    }
  }

  resource "aws_route_table" "james_public_route_table" {
    vpc_id = aws_vpc.james_vpc.id
    tags = {
      Name = "james_public_route_table"
    }
    route {
      cidr_block = "0.0.0.0/0"
      gateway_id = aws_internet_gateway.james_internet_gateway.id
    }
  }

  # default VPC comes with an Internet Gateway and internet access pre-configured because
  # it's designed for immediate use and backward compatibility with EC2-Classic.
  # It's meant to help users get started quickly, while custom VPCs follow stricter security practices.

  # for new VPC there is no internet gateway and therefore its default route table is a suitable candidate to be assigned
  # to private subnet, and we create additional one for public subnet with a record from igw to 0.0.0.0/0
  resource "aws_default_route_table" "james_private_route_table" {
    default_route_table_id = aws_vpc.james_vpc.default_route_table_id

    tags = {
      Name = "james_private_route_table"
    }
  }

  resource "aws_security_group" "james_ssh_sg" {
    name        = "ssh_sg"
    description = "Security Group for SSH Access"
    vpc_id      = aws_vpc.james_vpc.id

    ingress {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [var.ssh_access_ip]
      description = "for SSH access"
    }

    egress {
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  resource "aws_security_group" "james_http_sg" {
    name        = "james_http_sg"
    description = "Security Group for Http"
    vpc_id      = aws_vpc.james_vpc.id

    ingress {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "port 80 for public access"
    }

    ingress {
      from_port   = 8000
      to_port     = 8000
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "port 8000 for public access"
    }
  }

  resource "aws_security_group" "ec2_security_group" {
    name        = "james_ec2_sg"
    description = "Security Group for EC2"
    vpc_id      = aws_vpc.james_vpc.id
  }


  resource "aws_security_group" "james_private_rds" {
    name        = "james_private_rds"
    description = "Security Group for Private RDS"
    vpc_id      = aws_vpc.james_vpc.id

    ingress {
      from_port   = 3306
      to_port     = 3306
      protocol    = "tcp"
      cidr_blocks = [var.vpc_cidr]
      description = "pgsql allows everything in the VPC to access"
    }

    lifecycle {
      create_before_destroy = true
    }
  }

  resource "aws_db_subnet_group" "james_rds_subnet_group" {
    count      = var.create_db_subnet_group == true ? 1 : 0
    name       = "james_rds_subnet_group"
    subnet_ids = aws_subnet.james_private_subnet.*.id
    tags = {
      Name = "james_rds_subnet_group"
    }
  }
  ```

- variables.tf

  ```hcl
  variable "vpc_cidr" {
    type = string
  }

  variable "public_cidrs" {
    type = list(string)
  }


  variable "private_cidrs" {
    type = list(string)
  }

  variable "ssh_access_ip" {
    type = string
  }

  variable "create_db_subnet_group" {
    type = bool
  }

  ```

- outputs.tf

  ```hcl
  output "vpc_id" {
    value = aws_vpc.james_vpc.id
  }

  output "db_subnet_group_names" {
    value = aws_db_subnet_group.james_rds_subnet_group.*.name
  }

  output "db_security_group_id" {
    value = aws_security_group.james_private_rds.id
  }

  output "public_subnet_ids" {
    value = aws_subnet.james_public_subnet.*.id
  }

  output "public_http_sg" {
    value = aws_security_group.james_http_sg
  }

  output "public_ssh_sg" {
    value = aws_security_group.james_ssh_sg
  }

  output "james_ec2_sg" {
    value = aws_security_group.ec2_security_group
  }
  ```

##### Compute Module (EC2s with K3S associated by RDS)

Note in this module we have used `k3s` connected with `rds` to share `kubenetes state`, meaning that we have created a smaller worker node on our own using multiple ec2 instances.

- main.tf

  ```hcl
  data "aws_ami" "server_ami" {
    most_recent = true
    # it can be found in ec2 > Images > AMIs > Public Images
    owners = ["099720109477"]
    filter {
      name   = "name"
      values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
    }
  }

  resource "random_id" "james_node_id" {
    byte_length = 2
    count       = var.instance_count
    # this acts like an identifier in a map, and will create another
    # random_id with the same key_name

    /*
      The random_id resource with count will generate different random IDs, but it won't create additional instances by itself. The number of instances is controlled by var.instance_count.
      If var.instance_count = 1, you'll only get one instance regardless of random IDs. To create more instances:
      */

    keepers = {
      key_name = var.key_name
    }
  }

  resource "aws_key_pair" "james_auth" {
    key_name   = var.key_name
    public_key = file(var.public_key_path)
  }

  resource "aws_instance" "james_node" {
    count                  = var.instance_count # 1
    instance_type          = var.instance_type  # t3.micro
    security_groups        = [var.ec2_security_group_id]
    ami                    = data.aws_ami.server_ami.id
    key_name               = aws_key_pair.james_auth.key_name
    vpc_security_group_ids = var.public_security_gp_ids
    subnet_id              = var.public_subnet_ids[count.index]
    user_data = templatefile(var.user_data_path, {
      nodename    = "james-node-${random_id.james_node_id[count.index].dec}"
      dbuser      = var.db_user
      dbpass      = var.db_password
      db_endpoint = var.db_endpoint
      dbname      = var.db_name
    })
    root_block_device {
      volume_size = var.vol_size # 10
    }
    tags = {
      Name = "james_node-${random_id.james_node_id[count.index].dec}"
    }
  }

  # attach EC2 instances (target_id's) to the target group (target_group_arn)
  resource "aws_lb_target_group_attachment" "james_tg_attach" {
    count            = var.instance_count
    target_group_arn = var.james_target_group_arn
    target_id        = aws_instance.james_node[count.index].id
    // port = 8000 target port of the EC2, this will override the port in target group on a per instance basis
  }
  ```

- variables.tf

  ```hcl
  variable "instance_count" {
    type = number
  }

  variable "instance_type" {
    type = string
  }

  variable "public_security_gp_ids" {
    type = list(string)
  }

  variable "public_subnet_ids" {
    type = list(string)
  }

  variable "vol_size" {
    type = number
  }

  variable "key_name" {
    type = string
  }

  variable "public_key_path" {
    type = string
  }

  variable "user_data_path" {
    type = string
  }

  variable "db_user" {
    type = string
  }
  variable "db_password" {
    type = string
  }
  variable "db_endpoint" {
    type = string
  }
  variable "db_name" {
    type = string
  }

  variable "ec2_security_group_id" {
    type = string
  }

  variable "james_target_group_arn" {
    type = string
  }
  ```

- userdata.tpl
  ```sh
  #!/bin/bash
  sudo hostnamectl set-hostname ${nodename} &&
  curl -sfL https://get.k3s.io | sh -s - server \
  --datastore-endpoint="mysql://${dbuser}:${dbpass}@tcp(${db_endpoint})/${dbname}" \
  --write-kubeconfig-mode 644 \
  --tls-san=$(curl http://169.254.169.254/latest/meta-data/public-ipv4) \
  --token="th1s1sat0k3n!"
  ```

#### References

- [More than Certified in Terraform 2025](https://www.udemy.com/course/terraform-certified/?couponCode=24T2MT070225)

- [Making Terraform and Serverless framework work together](https://theburningmonk.com/2019/03/making-terraform-and-serverless-framework-work-together/#Reference_Terraform_resources_in_Serverless_Framework)
