const n=`---
title: "Connection to RDS-Proxy Using Lambda Functions"
date: 2025-01-13
id: blog0361
tag: aws, lambda, rds, rds-proxy
toc: true
intro: "We study the configuration of IAM roles and permissions to enable lambda functions to connect to RDS-Proxy which is a VPC-bounded resource"
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Security Groups

We create two security groups:

- \`Lambda-SG\`
- \`RDS-SG\`

![](/assets/img/2025-01-14-02-41-27.png)

As in the diagram indicated:

- The \`RDS-SG\` accpets inbound traffic from \`Lambda-SG\`.
- \`RDS-SG\` again accepts inbound traffic from \`RDS-SG\`.
  The main challenge is to figure out the appropriate permissions for \`RDS-Proxy\` to connect to \`RDS\` and that for \`Lambda\` (inside of a VPC) to get access to the \`RDS\` service.

### Connect RDS and RDS-Proxy From Lambda Functions

#### Permissions to Lambda for RDS and RDS-Proxy Connection

\`\`\`js
{
  "Effect": "Allow",
  "Action": "rds-db:connect",
  "Resource": "arn:aws:rds-db:ap-southeast-2:798404461798:dbuser:prx-0226dec8098d1321d/*"
},
{
  "Effect": "Allow",
  "Action": "rds:DescribeDBProxies",
  "Resource": "arn:aws:rds:ap-southeast-2:798404461798:db-proxy:prx-0226dec8098d1321d"
},
\`\`\`

These two are all we need to connect to \`rds\` and \`rds-proxy\`.

- Here \`798404461798\` is our \`AWS Account ID\` (viewable at the top right corner) and
- We can find our \`proxy-id\` here:

  ![](/assets/img/2025-01-14-01-50-26.png)

#### Permission to Lambda for VPC Assignment

The following

\`\`\`js
{
  "Effect": "Allow",
  "Action": [
    "ec2:CreateNetworkInterface",
    "ec2:DescribeNetworkInterfaces",
    "ec2:DeleteNetworkInterface"
  ],
  "Resource": "*"
}
\`\`\`

allows a lambda function to be connected to a VPC network because it enables us to create **_Elastic Network Interface_** in order to assign security group to a lambda function.

More detail on Lambda Functions and VPC can be found in [this article on architecture of private lambda functions](/blog/article/Architecture-for-Private-Lamdba-functions-called-via-another-lambda-function).

### RDS-Proxy

#### Methods to Connect RDS

RDS-Proxy can get access to our RDS instance in either way:

- Get credential from secrets manager
- Authenticate by IAM-Role
  We choose to use secret manager because we don't need to introduce \`aws-sdk\` (language specific) for new approach of connecting to our DB. That is, if we created a new proxy-endpoint, we simply use it as if it is a usual endpoint.

![](/assets/img/2025-01-14-02-00-17.png)

We need to remark that RDS-Proxy endpoint is a \`VPC\`-bounded resource. We are **_not able_** to connect to it outside of the VPC unless we create additional proxy mechanism, e.g., via EC2 instances.

Nevertheless enabling RDS-Proxy **_does not mean_** deleting our original RDS endpoint, we can use both as we please.

#### Permissions for RDS-Proxy

Edit the IAM-Role of the RDS-Proxy instance and add:

\`\`\`js{11}
{
    "Sid": "GetSecretValue",
    "Action": [
        "secretsmanager:GetResourcePolicy",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecretVersionIds"
    ],
    "Effect": "Allow",
    "Resource": [
        "arn:aws:secretsmanager:ap-southeast-2:798404461798:secret:billie-uat-rds-proxy-corrected-nMKcow"
    ]
},
\`\`\`

Here \`secret:billie-uat-rds-proxy-corrected-nMKcow\` is the **_secret id_**. If we change to use other secret for RDS-Proxy, then we need to adjust the permission here as well.

### VPC Endpoints for RDS

Since RDS is one of the \`endpoint\` resources in AWS (other example is \`cloudwatch\`), accessing an \`endpoint\` is as simple as:

1. Adding this endpoint to the private subnet **_of lambda functions_**

   ![](/assets/img/2025-01-14-02-32-34.png)

   and;

2. Assigning a security group to that endpoint to identify which group of resources is available to use that endpoint

   ![](/assets/img/2025-01-14-02-33-03.png)

### Connection to RDS-Proxy

Finally, we simply replace the RDS endpoint by RDS-Proxy endpoint and we are done!
`;export{n as default};
