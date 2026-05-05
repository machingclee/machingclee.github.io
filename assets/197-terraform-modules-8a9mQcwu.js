const n=`---
title: "Terraform Modules"
date: 2023-10-16
id: blog0197
tag: aws, cloud, terraform
intro: "How to make a modules and finally, we can apply pre-made modules from others!"
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

### Define a Custom Modules

- Let's exclude \`provider\` in \`main.tf\`

- Create a \`main.tf\` that creates public subnet, private subnet and corresponding internget-gateway and NAT.

\`\`\`hcl
// main.tf

data "aws_availability_zones" "available" {}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr
  tags       = merge(var.tags, { Name = "\${var.env}-vpc" })
}


resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(var.tags, { Name = "\${var.env}-igw" })
}

resource "aws_subnet" "public_subnets" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = element(var.public_subnet_cidrs, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = merge(var.tags, { Name = "\${var.env}-public-\${count.index + 1}" })
}

// create routable + create route for the gateway + attach gateway to the vpc
resource "aws_route_table" "public_subnets" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = merge(var.tags, { Name = "\${var.env}-route-public-subnets" })
}

// config target subnet to use our route table
resource "aws_route_table_association" "public_routes" {
  count          = length(aws_subnet.public_subnets[*].id)
  route_table_id = aws_route_table.public_subnets.id
  subnet_id      = aws_subnet.public_subnets[count.index].id
}

resource "aws_eip" "nat" {
  count  = length(var.private_subnet_cidrs)
  domain = "vpc"
  tags   = merge(var.tags, { Name = "\${var.env}-nat-gw-\${count.index + 1}" })
}


resource "aws_nat_gateway" "nat" {
  count         = length(var.private_subnet_cidrs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public_subnets[count.index].id
  tags          = merge(var.tags, { Name = "\${var.env}-nat-gw-\${count.index + 1}" })
}

# ===== Private Subnets and Routing =====

resource "aws_subnet" "private_subnets" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = merge(var.tags, { Name = "\${var.env}-private-\${count.index + 1}" })
}


resource "aws_route_table" "private_subnets" {
  count  = length(var.private_subnet_cidrs)
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat[count.index].id
  }
  tags = merge(var.tags, { Name = "\${var.env}-route-private-subnet-\${count.index + 1}" })
}


resource "aws_route_table_association" "private_routes" {
  count          = length(aws_subnet.private_subnets[*].id)
  route_table_id = aws_route_table.private_subnets[count.index].id
  subnet_id      = aws_subnet.private_subnets[count.index].id
}
\`\`\`

\`\`\`hcl
// variables.tf

variable "env" {
  default = "dev"
}

variable "vpc_cidr" {
  default = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  default = [
    "10.0.1.0/24",
    "10.0.2.0/24",
  ]
}

variable "private_subnet_cidrs" {
  default = [
    "10.0.11.0/24",
    "10.0.22.0/24",
  ]
}

variable "tags" {
  default = {
    Owner   = "James Lee"
    Project = "Terraform Experiment"
  }
}

\`\`\`

\`\`\`hcl
// outputs.tf

output "vpc_id" {
  value = aws_vpc.main.id
}

output "vpc_cidr" {
  value = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  value = aws_subnet.public_subnets[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private_subnets[*].id
}
\`\`\`

### Apply the Modules

Let move the 3 files into \`module/network/\` directory, then create a new \`main.tf\` in the root directory:

\`\`\`hcl
// main.tf
provider "aws" {}

module "my_vpc_default" {
  source = "../modules/aws_network"
}

module "my_vpc_staging" {
  source   = "../modules/aws_network"
  env      = "staging"
  vpc_cidr = "10.100.0.0/16"
}
\`\`\`

Here we have demonstrated how to apply custom variable (the keys are the ones defined in \`variables.tf\`).

Apart from the inputs (the \`var\`'s), we also have output:

\`\`\`hcl
// outputs.tf

output "my_vpc_id" {
  value = module.my_vpc_default.vpc_id
}

output "my_vpc_cidr" {
  value = module.my_vpc_default.vpc_cidr
}

output "my_public_subnet_ids" {
  value = module.my_vpc_default.public_subnet_ids
}

output "my_private_subnet_ids" {
  value = module.my_vpc_default.private_subnet_ids
}
\`\`\`

### Predefine Modules in the Internet

Modules make terraform code reusable, we can search in

- [AWS Modules from Terraform Registry](https://registry.terraform.io/search/modules?namespace=terraform-aws-modules)

for useful modules that have been made by others.
`;export{n as default};
