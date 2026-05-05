const n=`---
title: "Variables and Remote Execution"
date: 2023-10-13
id: blog0196
tag: aws, cloud, terraform
intro: "We discuss how to manipulate variables (dev, prod, etc...) and plan a small section on remote execution of shell scripts once an instance is launched."
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

### The variables.tf

\`\`\`hcl
variable "aws_region" {
  description = "Region where you want to provision"
  type        = string //number, bool
  default     = "ap-northeast-1"
}

variable "port_list" {
  description = "List of port to open for your webserver"
  type        = list(any)
  default     = ["80", "443"]
}

variable "instance_type" {
  description = "EC2 Instance size to provision"
  type        = string
  default     = "t3.micro"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(any)
  default = {
    Owner       = "James Lee"
    Environment = "Prod"
    Project     = "Pheonix"
  }
}

output "latest_ubuntu20_ami_id" {
  value = data.aws_ami.latest_ubuntu20.id
}

output "latest_amazonlinux_ami_id" {
  value = data.aws_ami.latest_amazonlinux.id
}
\`\`\`

### The main.tf Using variables.tf

\`\`\`hcl
provider "aws" { region = var.aws_region }

resource "aws_security_group" "web" {
  name        = "\${var.tags["Environment"]} WebServer-SG"
  description = "Security Group for WebServer"
  dynamic "ingress" {
    for_each = var.port_list
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
  egress {
    description = "Allow All Ports"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = merge(var.tags, { Name = "\${var.tags["Environment"]} WebServer SG by Terraform" })
}

resource "aws_instance" "web" {
  ami                    = data.aws_ami.latest_amazonlinux.id
  instance_type          = var.instance_type
  vpc_security_group_ids = [aws_security_group.web.id]
  tags                   = merge(var.tags, { Name = "\${var.tags["Environment"]} WebServer Built by Terraform" })
}

resource "aws_eip" "web" {
  instance = aws_instance.web.id
  tags     = merge(var.tags, { Name = "\${var.tags["Environment"]} Elastic IP by Terraform" })
}

data "aws_ami" "latest_ubuntu20" {
  owners      = ["099720109477"]
  most_recent = true
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

data "aws_ami" "latest_amazonlinux" {
  owners      = ["137112412989"]
  most_recent = true
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-6.1-x86_64"]
  }
}
\`\`\`

### The \\*.tfvars

This provides the default values to \`variables.tf\` in a separate file:

#### New variables.tf

\`\`\`hcl
variable "aws_region" {
  description = "Region where you want to provision"
  type        = string //number, bool
}

variable "port_list" {
  description = "List of port to open for your webserver"
  type        = list(any)
}

variable "instance_type" {
  description = "EC2 Instance size to provision"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(any)
}
\`\`\`

#### terraform.tfvars

\`\`\`hcl
aws_region    = "ap-northeast-1"
port_list     = ["80", "443"]
instance_type = "t3.micro"
tags = {
  Owner       = "James Lee"
  Environment = "Prod"
  Project     = "Pheonix"
}
\`\`\`

#### prod.tfvars

Let's rename \`terraform.tfvars\` to \`prod.tfvars\` and \`terraform apply\` again, the \`*.tfvars\` does not take effect. In that case, we try:

\`\`\`text
terraform apply -var-file=prod.tfvars
\`\`\`

### Local Variables

In \`main.tf\` we can write

\`\`\`hcl
locals {
  X = 1
  Y = 2
}

locals {
  amazonlinux_ami = data.aws_ami.latest_amazonlinux.id
  ubuntu_ami      = data.aws_ami.latest_ubuntu20.id
  Z = "\${local.X} and \${local.Y}"
  some_tags = {
    Owner = "James Lee"
  }
}

resource "aws_instance" "web" {
  ami                    = local.amazonlinux_ami
  instance_type          = var.instance_type
  vpc_security_group_ids = [aws_security_group.web.id]
  tags                   = merge(var.tags, local.some_tags, { Name = "\${var.tags["Environment"]} WebServer Built by Terraform" })
}

data "aws_ami" "latest_ubuntu20" {
  owners      = ["099720109477"]
  most_recent = true
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

data "aws_ami" "latest_amazonlinux" {
  owners      = ["137112412989"]
  most_recent = true
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-6.1-x86_64"]
  }
}

...
\`\`\`

### Remote Execution

After an EC2 instance is created, we arrange shell scripts to be executed as subsequent tasks (for example, we may want to install gitlab runner to perform CICD task).

\`\`\`hcl
provider "aws" {
  region = "ca-central-1"
}

resource "aws_default_vpc" "default" {} # This need to be added since AWS Provider v4.29+ to get VPC id

resource "aws_instance" "myserver" {
  ami                    = "ami-0c9bfc21ac5bf10eb"
  instance_type          = "t3.nano"
  vpc_security_group_ids = [aws_security_group.web.id]
  key_name               = "denis-key-ca-central-1"
  tags = {
    Name  = "My EC2 with remote-exec"
    Owner = "Denis Astahov"
  }

  provisioner "remote-exec" {
    inline = [
      "mkdir /home/ec2-user/terraform",
      "cd /home/ec2-user/terraform",
      "touch hello.txt",
      "echo 'Terraform was here...' > terraform.txt"
    ]
    connection {
      type        = "ssh"
      user        = "ec2-user"
      host        = self.public_ip //Same as: aws_instance.myserver.public_ip
      private_key = file("denis-key-ca-central-1.pem")
    }
  }
}


resource "aws_security_group" "web" {
  name   = "My-SecurityGroup"
  vpc_id = aws_default_vpc.default.id # This need to be added since AWS Provider v4.29+ to set VPC id
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    description = "Allow ALL ports"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = {
    Name  = "SG by Terraform"
    Owner = "Denis Astahov"
  }
}
\`\`\`
`;export{n as default};
