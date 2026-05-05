const n=`---
title: "AWS Resources Instanciation in Terraform"
date: 2023-10-10
id: blog0193
tag: aws, cloud, terraform
intro: "A study of Terraform basic building blocks."
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

### A Complete EC2 with Security Group

\`\`\`hcl
provider "aws" {
  region = "ap-northeast-1"
}

resource "aws_instance" "web" {
  ami                    = "ami-08a706ba5ea257141"
  instance_type          = "t2.micro"
  vpc_security_group_ids = [aws_security_group.web.id]
  user_data              = file("user_data.sh")

  tags = {
    Name  = "WebServer Built by Terraform"
    Owner = "James Lee"
  }
}

resource "aws_default_vpc" "default" {}

resource "aws_security_group" "web" {
  name        = "Webserver James"
  description = "Security Group for Webserver James"
  vpc_id      = aws_default_vpc.default.id

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

Here \`user_data.sh\` is:

\`\`\`bash
#!/bin/bash
yum -y update
yum -y install httpd
echo "<h2> Hello World!</h2> <h3>by external file!</h3>" > /var/www/html/index.html
service httpd start
chkconfig httpd on
\`\`\`

In \`resource "aws_instance" "web" {}\` we can replace \`user_data = file(user_data.sh)\` by

\`\`\`hcl
user_data = templatefile("user_data.sh.tpl", {
  first_name = "James"
  last_name  = "Lee"
  names      = ["John", "Angel", "David", "Victor", "Frank", "Melissa", "Kitana"]
})
\`\`\`

where

\`\`\`hcl
// user_data.sh.tpl

#!/bin/bash
yum -y update
yum -y install httpd

cat <<EOF > /var/www/html/index.html
<html>
<h2>Built by Power of <font color="red">Terraform</font></h2><br>

Server Owner is: \${first_name} \${last_name}<br>

%{ for name in names ~}
Hello to \${name} from \${first_name}<br>
%{ endfor ~}

</html>
EOF

service httpd start
chkconfig httpd on
\`\`\`

### Dynamic Properties

Example of a security group:

\`\`\`hcl
resource "aws_security_group" "web" {
  name        = "Webserver James"
  description = "Security Group for Webserver James"
  vpc_id      = aws_default_vpc.default.id

  ingress {
    description = "Allow port HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = ["80", "8080", "443", "1000", "8443"]
    content {
      description = "Allow port HTTP"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  ingress {
    description = "Allow port SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
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

### Elastic IP

\`\`\`hcl
resource "aws_eip" "web" {
  instance = aws_instance.web.id
  tags = {
    Name  = "WebServer Built by Terraform"
    Owner = "James Lee"
  }
}

resource "aws_instance" "web" {
  ami                    = "ami-08a706ba5ea257141"
  instance_type          = "t2.micro"
  vpc_security_group_ids = [aws_security_group.web.id]
  user_data              = file("user_data.sh")

  tags = {
    Name  = "WebServer Built by Terraform"
    Owner = "James Lee"
  }
}
\`\`\`

### Life Cycle: Create Before Destroy

Since we have attached an elastic IP to an aws instance.

If we specify \`create_before_destroy = true\`, then a new instance will be created first, and our elastic IP will be transferred to new instace, this results in almost zero down time of our web server.

\`\`\`hcl
resource "aws_instance" "web" {
  ami                    = "ami-08a706ba5ea257141"
  instance_type          = "t2.micro"
  vpc_security_group_ids = [aws_security_group.web.id]
  user_data              = file("user_data.sh")

  tags = {
    Name  = "WebServer Built by Terraform"
    Owner = "James Lee"
  }

  lifecycle {
    create_before_destroy = true
  }
}
\`\`\`

### Implicit and Explicit Dependencies

\`\`\`hcl
resource "aws_instance" "my_web_server" {
  ami                    = "ami-08a706ba5ea257141"
  instance_type          = "t2.micro"
  vpc_security_group_ids = [aws_security_group.general.id]
  tags = {
    Name  = "Server-Web"
    Owner = "James Lee"
  }
  depends_on = [aws_instance.my_db_server, aws_instance.my_app_server]
}

resource "aws_instance" "my_app_server" {
  ami                    = "ami-08a706ba5ea257141"
  instance_type          = "t2.micro"
  vpc_security_group_ids = [aws_security_group.general.id]
  tags = {
    Name  = "Server-App"
    Owner = "James Lee"
  }
  depends_on = [aws_instance.my_db_server]
}

resource "aws_instance" "my_db_server" {
  ami                    = "ami-08a706ba5ea257141"
  instance_type          = "t2.micro"
  vpc_security_group_ids = [aws_security_group.general.id]
  tags = {
    Name  = "Server-Db"
    Owner = "James Lee"
  }
}

resource "aws_security_group" "general" {
  dynamic "ingress" {
    for_each = ["80", "443", "22", "3389"]
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "My Security Group"
  }
}
\`\`\`

### Random Password in SSM Parameter Store

\`\`\`hcl
resource "random_password" "main" {
  length           = 20
  special          = true
  override_special = "#!()_"
}

resource "aws_ssm_parameter" "rds_password" {
  name        = "/prod/prod-my-sql-rds/password"
  type        = "SecureString"
  description = "Master Password"
  value       = random_password.main.result

  tags = {
    environment = "production"
  }
}
\`\`\`

Password retrival:

\`\`\`hcl
data "aws_ssm_parameter" "rds_password" {
  name = "/prod/prod-my-sql-rds/password"
}
\`\`\`

And we use \`data.aws_ssm_parameter.rds_password.value\` as the value in attributes.

### Random Password in Secrets Managers

\`\`\`hcl
resource "random_password" "main" {
  length           = 20
  special          = true
  override_special = "#!()_"
}

resource "aws_secretsmanager_secret" "rds_password" {
  name                    = "/prod/rds/password"
  description             = "Password for my RDS database"
  recovery_window_in_days = 0 // completely delete once set up
}

resource "aws_secretsmanager_secret_version" "rds_password" {
  secret_id     = aws_secretsmanager_secret.rds_password.id
  secret_string = random_password.main.result
}

data "aws_secretsmanager_secret_version" "rds_password" {
  secret_id  = aws_secretsmanager_secret.rds_password.id
  depends_on = [aws_secretsmanager_secret_version.rds_password]
}

output "random_password_rds" {
  value     = aws_secretsmanager_secret_version.rds_password.secret_string
  sensitive = true
}
\`\`\`

### JSON as Environment Variable Stored in Secrets Managers

We additionally add a database for more data to store.

\`\`\`hcl
resource "aws_db_instance" "prod" {
  allocated_storage    = 10
  db_name              = "mydb"
  engine               = "mysql"
  engine_version       = "5.7"
  instance_class       = "db.t3.micro"
  username             = "admin"
  password             = random_password.main.result
  parameter_group_name = "default.mysql5.7"
  skip_final_snapshot  = true
}


resource "random_password" "main" {
  length           = 20
  special          = true
  override_special = "#!()_"
}

resource "aws_secretsmanager_secret" "rds" {
  name                    = "/prod/rds/all"
  description             = "Everything about the rds database"
  recovery_window_in_days = 0 // completely delete once set up
}

resource "aws_secretsmanager_secret_version" "rds" {
  secret_id = aws_secretsmanager_secret.rds.id
  secret_string = jsonencode({
    rds_address  = aws_db_instance.prod.address
    rds_port     = aws_db_instance.prod.port
    rds_username = aws_db_instance.prod.username
    rds_password = random_password.main.result
  })
}

data "aws_secretsmanager_secret_version" "rds" {
  secret_id  = aws_secretsmanager_secret.rds.id
  depends_on = [aws_secretsmanager_secret_version.rds]
}

output "rds_all" {
  value     = jsondecode(aws_secretsmanager_secret_version.rds.secret_string)
  sensitive = true
}
\`\`\`

### Create VPC and Subnets

\`\`\`hcl
provider "aws" {}

resource "aws_vpc" "prod" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "PROD"
  }
}

resource "aws_subnet" "subnet1" {
  vpc_id            = data.aws_vpc.prod.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = data.aws_availability_zones.working.names[0]
  tags = {
    Name = "Subnet1"
  }
}

resource "aws_subnet" "subnet2" {
  vpc_id            = data.aws_vpc.prod.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.working.names[1]
  tags = {
    Name = "Subnet2",
    Info = "AZ: \${data.aws_availability_zones.working.names[1]} in Region: \${data.aws_region.current.description}"

  }
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "working" {}
data "aws_vpc" "prod" {
  depends_on = [aws_vpc.prod]
  tags = {
    Name = "PROD"
  }
}


output "region_name" {
  value = data.aws_region.current.name
}

output "region_description" {
  value = data.aws_region.current.description
}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "availability_zones" {
  value = data.aws_availability_zones.working.names
}
\`\`\`

### Get the AMI-id of Ubuntu/Amazon Linux by Filtering

\`\`\`hcl
provider "aws" {}

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


output "latest_ubuntu20_ami_id" {
  value = data.aws_ami.latest_ubuntu20.id
}

output "latest_amazonlinux_ami_id" {
  value = data.aws_ami.latest_amazonlinux.id
}
\`\`\`

output:

\`\`\`text
latest_amazonlinux_ami_id = "ami-0fd8f5842685ca887"
latest_ubuntu20_ami_id = "ami-09a81b370b76de6a2"
\`\`\`
`;export{n as default};
