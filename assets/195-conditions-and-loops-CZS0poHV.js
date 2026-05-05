const e=`---
title: "Conditions and Loops"
date: 2023-10-14
id: blog0195
tag: aws, cloud, terraform
intro: "Standard technique to create multiple resources by conditions and loops."
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

### Dynamic Field by Ternary Operator

- \`(var.env == "prod") ? true : false\`

- whether to create an attribute block:
  \`\`\`hcl
  dynamic "ebs_block_device" {
    for_each = var.env == "prod" ? [true] : []
    content {
      device_name = "/dev/sdb"
      volume_size = 40
      encrypted   = true
    }
  }
  \`\`\`

Note that \`lookup\` has the signature \`lookup(map, key, default_value)\`, it is an ordinary \`get\` method of a \`Map\` object.

- **Full Example.**

  \`\`\`hcl
  resource "aws_instance" "my_server" {
    ami                    = var.ami_id_per_region[data.aws_region.current.name]
    instance_type          = lookup(var.server_size, var.env, var.server_size["my_default"])
    vpc_security_group_ids = [aws_security_group.my_server.id]

    root_block_device {
      volume_size = 10
      encrypted   = (var.env == "prod") ? true : false
    }

    dynamic "ebs_block_device" {
      for_each = var.env == "prod" ? [true] : []
      content {
        device_name = "/dev/sdb"
        volume_size = 40
        encrypted   = true
      }
    }

    volume_tags = { Name = "Disk-\${var.env}" }
    tags        = { Name = "Server-\${var.env}" }
  }
  \`\`\`

### Conditionally Create a Resource by Count

Note that the block below can be equivalently created by looping a set:

\`\`\`hcl
resource "aws_instance" "bastion_server" {
  count         = var.create_bastion == true ? 1 : 0
  ami           = "ami-0e472933a1395e172"
  instance_type = "t3.micro"
  tags = {
    Name  = "Bastion Server"
    Owner = "Denis Astahov"
  }
}
\`\`\`

### Create Multiple Instances by Looping a Set

\`\`\`hcl
resource "aws_instance" "my_server" {
  for_each      = toset(["Dev", "Staging", "Prod"])
  ami           = "ami-0e472933a1395e172"
  instance_type = "t3.micro"
  tags = {
    Name  = "Server-\${each.value}"
    Owner = "Denis Astahov"
  }
}
\`\`\`

### Create Multiple Instances by Looping a Map of Maps

\`\`\`hcl
// variables.tf
variable "servers_settings" {
  type = map(any)
  default = {
    web = {
      ami           = "ami-0e472933a1395e172"
      instance_size = "t3.small"
      root_disksize = 20
      encrypted     = true
    }
    app = {
      ami           = "ami-07dd19a7900a1f049"
      instance_size = "t3.micro"
      root_disksize = 10
      encrypted     = false
    }
  }
}
\`\`\`

\`\`\`hcl
// main.tf
resource "aws_instance" "server" {
  for_each      = var.servers_settings
  ami           = each.value["ami"]
  instance_type = each.value["instance_size"]

  root_block_device {
    volume_size = each.value["root_disksize"]
    encrypted   = each.value["encrypted"]
  }

  volume_tags = {
    Name = "Disk-\${each.key}"
  }
  tags = {
    Name  = "Server-\${each.key}"
    Owner = "Denis Astahov"
  }
}
\`\`\`
`;export{e as default};
