const n=`---
title: "Remote State for Whole Development Team; Create and Deploy on a Public Subnet of Custom VPC"
date: 2023-10-15
id: blog0194
tag: aws, cloud, terraform
intro: "Let's split our code in multiple terraform files."
toc: true
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

### Remote State

We create a versioned and Encryped S3 bucket and start our \`main.tf\` by

\`\`\`hcl
terraform {
  backend "s3" {
    bucket = "machingclee-terraform-remote-state"
    key    = "dev/network/terraform.tfstate"
    region = "ap-northeast-1"
  }
}
\`\`\`

Note that if we are working with \`web\` layer, then change the key to

\`\`\`text
"dev/web/terraform.tfstate"
\`\`\`

### Network-Layer: Let's Create our own vpc and Public Subnet

#### main.tf

First:

- [AWS best practice to not use the default VPC for workflows](https://aquasecurity.github.io/tfsec/v1.8.0/checks/aws/vpc/no-default-vpc/)

The following code actually repeat what is done in [this video](https://www.youtube.com/watch?v=TUTqYEZZUdc).

![](/assets/tech/194/image.png)

\`\`\`hcl
provider "aws" {}

terraform {
  backend "s3" {
    bucket = "machingclee-terraform-remote-state"
    key    = "dev/network/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr
  tags = {
    Name  = "\${var.env}-vpc"
    Owner = "James Lee"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name  = "\${var.env}-igw"
    Owner = "James Lee"
  }
}

resource "aws_subnet" "public_subnets" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = element(var.public_subnet_cidrs, count.index)
  map_public_ip_on_launch = true
  tags = {
    Name  = "\${var.env}-public-\${count.index + 1}"
    Owner = "James Lee"
  }
}

resource "aws_route_table" "public_subnet" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = {
    Name  = "\${var.env}-route-public-subnets"
    Owner = "James Lee"
  }
}

resource "aws_route_table_association" "public_routes" {
  count          = length(aws_subnet.public_subnets[*].id)
  route_table_id = aws_route_table.public_subnet.id
  subnet_id      = element(aws_subnet.public_subnets[*].id, count.index)
}
\`\`\`

#### outputs.tf

The following outputs will be reusable by terraform file of web-layer.

\`\`\`hcl
output "vpc_id" {
  value = aws_vpc.main.id
}

output "vpc_cidr" {
  value = aws_vpc.main.cidr_block
}

output "public_subnsets_ids" {
  value = aws_subnet.public_subnets[*].id
}
\`\`\`

### Web-Layer: Deploy an EC2 Instance on this Public Subnet

#### main.tf

\`\`\`hcl
provider "aws" {}

locals {
  network_outputs = data.terraform_remote_state.network.outputs
}

terraform {
  backend "s3" {
    bucket = "machingclee-terraform-remote-state"
    key    = "dev/web/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

# fetch network remote
data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "machingclee-terraform-remote-state"
    key    = "dev/network/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

resource "aws_instance" "web" {
  ami                    = "ami-08a706ba5ea257141"
  instance_type          = "t2.micro"
  subnet_id              = local.network_outputs.public_subnsets_ids[0]
  vpc_security_group_ids = [aws_security_group.web.id]
  user_data              = file("user_data.sh")

  tags = {
    Name  = "WebServer Built by Terraform"
    Owner = "James Lee"
  }
}

resource "aws_security_group" "web" {
  name        = "Webserver James"
  description = "Security Group for Webserver James"
  vpc_id      = local.network_outputs.vpc_id

  ingress {
    description = "Allow port HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow port HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }


  ingress {
    description = "Allow port HTTPS"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [local.network_outputs.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name  = "WebServer Built by Terraform"
    Owner = "James Lee"
  }
}
\`\`\`
`;export{n as default};
