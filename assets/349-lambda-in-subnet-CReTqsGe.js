const n=`---
title: "Architecture for Private Lamdba functions called via another lambda function"
date: 2024-12-19
id: blog0349
tag: docker, aws, lambda
toc: true
intro: "Let's discuss how to orchistrate the interaction of lambda functions which are network-isolated, especially how to endow lambda functions with security group."
---

<style>
  img {
    max-width: 660px;
  }
  table th {
    min-width: 160px;
  }
  table td {
    vertical-align: top;
  }
</style>

### Overview

[![](/assets/img/2024-12-21-17-28-00.png)](/assets/img/2024-12-21-17-28-00.png)


### Strategy

#### Resource to be protected

Place our protected resourced (target lambda function) behind **internal** load balancer.

![](/assets/img/2024-12-21-17-28-30.png)

#### Endow lambda functions with security group

Place our public-facing lambda functions into private subnet so that:

- the lambda function can be endowed with an ENI (Elastic Network Interface)
- that ENI can carry a security group (SG) so that **_now lambda function can carry an SG_**.

[![](/assets/img/2024-12-21-17-28-40.png)](/assets/img/2024-12-21-17-28-40.png)

#### Calling protected resourcess

##### Public facing lambdas

Since our protected lambda function $\\lambda_\\text{protected}$ stay behind internal load balancer, suppose that the load balancer has an DNS name:

- \`my-internal-loadbalancer\`

then inside of private subneted lambda function $\\lambda_\\text{private\\_subnetted}$, calling $\\lambda_\\text{protected}$ is as simple as calling

- Make a request to \`http://my-internal-loadbalancer:<port-number>/suitable/route\`
- Allow SG to access port \`port-number\`

here we assume that our lambda function is acting like a web server.

##### Public facing ECS services

For ECS since by default each service already has an SG, by allowing this SG to access \`port-number\`, we get access to protected resource easily.

### How to Connect a Lambda Function to a VPC and then a private subnet

#### VPC configuration in Lambda Functions Console

1. Go to our lambda function and choose \`Configruation > VPC\`

    <img src="/assets/img/2024-12-21-17-29-46.png" width="400"/>
    <p></p>

2. Choose a VPC, then choose an \`AZ\` and hence a private subnet

   ![](/assets/img/2024-12-21-17-29-55.png)

   Finally Choose an SG and congradulation! Our lambda has an SG now!

#### Caveat of connecting lambdas to a VPC/subnet
##### Outbound Traffics are Lost
- By default each lambda function **_cannot make any request from inside_** when they are connected to a VPC (due to security reason).
##### Connect Lambda Functions to Public or Private Subnet?
- It makes no difference using public or private subnet to place our lambda functions.
##### Cloudwatch log Becomes Unavailable
- **_Cloudwatch log endpoint connection is also lost_** in this scenario. For logging purpose, one should always add \`VPC endpoints\` to this private subnet.

  ![](/assets/img/2024-12-21-17-31-12.png)

  upon clicking \`create endpoint\`, we will need to choose

  |   Option    | Value                                                                                                                                                 |
  | ------------------------| ------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | \`Type\`           | AWS Service                                                                                                                                            |
  | \`Services\`       | com.amazonaws.your-region.logs                                                                                                                         |
  | \`VPC\`            | Your target  VPC                                                                                               |
  | \`Subnet\`         | Your target private subnet                                                                                                                             |
  | \`Security Group\` | SG in this context means the group of resources that is available to this endpoint, not related to any security inbound or outbound rules |

### Create Necessary Resources

#### Create subnets and what are the available CIDR blocks?

[![](/assets/img/2024-12-21-17-31-49.png)](/assets/img/2024-12-21-17-31-49.png)

By default the following are available CIDR blocks:

\`\`\`text
172.30.0.0/20 (0-15)   ← existing
172.30.16.0/20 (16-31) ← existing
172.30.32.0/20 (32-47) ← existing
172.30.48.0/20 (48-63) ← you can use this
172.30.64.0/20 (64-79) ← or this
\`\`\`

For example \`172.30.64.0/24\` will be a good choice, which means that any resource created in this subnet has a flexible choices of $2^8 = 256$ private addresses.

If we want to further divide \`172.30.64.0/24\` ($2^8$ choices) into 16 pieces, we can use:

\`\`\`text
├── Subnet 1: 172.30.64.0/28 (first 16 IPs)
├── Subnet 2: 172.30.64.16/28 (next 16 IPs)
├── Subnet 3: 172.30.64.32/28 (next 16 IPs)
├── ...
├── Subnet 16: 172.30.64.240/28 (final 16 IPs)
\`\`\`

#### Set up NAT gateway

##### Create an NAT Gateway

[![](/assets/img/2024-12-21-17-32-10.png)](/assets/img/2024-12-21-17-32-10.png)

1. Arbitrary Name
2. Any **_Public Subnet_**
3. Must be of **_Public Connectivity Type_**
4. Must **_have an Elastic IP_** (which we have at most 5 for each region)

##### Associate to a subnet by creating route tables

First create a route table:

[![](/assets/img/2024-12-21-17-32-27.png)](/assets/img/2024-12-21-17-32-27.png)

Next view the detail of the route table, edit it and add \`0.0.0.0/0 <- nat-xxxx\`.

[![](/assets/img/2024-12-21-17-32-34.png)](/assets/img/2024-12-21-17-32-34.png)

Finally associate **_all private subnets_** for which we wish to apply the route table:

[![](/assets/img/2024-12-21-17-32-40.png)](/assets/img/2024-12-21-17-32-40.png)

#### Setup private subnet and internal load balancers

##### Subnets and Route Table

By default the creation of load-balancer requires **_at least two private subnets_** in two separate AZ's

[![](/assets/img/2024-12-21-17-32-47.png)](/assets/img/2024-12-21-17-32-47.png)

Next our private subnets need outwards traffic, create a route table for this purpose:

[![](/assets/img/2024-12-21-17-32-52.png)](/assets/img/2024-12-21-17-32-52.png)

and of course we add outwards traffic rules

[![](/assets/img/2024-12-21-17-32-59.png)](/assets/img/2024-12-21-17-32-59.png)

for the new private subsets:

[![](/assets/img/2024-12-21-17-33-08.png)](/assets/img/2024-12-21-17-33-08.png)

##### Internal load balancer

[![](/assets/img/2024-12-21-17-33-13.png)](/assets/img/2024-12-21-17-33-13.png)

Choose Internal Type with IPv4 addresses:

[![](/assets/img/2024-12-21-17-33-22.png)](/assets/img/2024-12-21-17-33-22.png)

Then choose two of the private subnets:

[![](/assets/img/2024-12-21-17-33-28.png)](/assets/img/2024-12-21-17-33-28.png)

Choose a new identity (SG) for our internal load balancer:

[![](/assets/img/2024-12-21-17-33-41.png)](/assets/img/2024-12-21-17-33-41.png)

And finally add the listeners and target groups:

[![](/assets/img/2024-12-21-17-33-48.png)](/assets/img/2024-12-21-17-33-48.png)

#### Internet-facing load balancers

Same as the previous one, but we need to:
- Add our internet-facing load balancer at public subnets and, 
- For listeners at any port with HTTPS we need to asscoiate it a **_certificate_**.

#### VPC endpoints (for cloudwatch)

Go to \`VPC > Endpoints\`, then create our VPC endpoints with appropriate service name:

[![](/assets/img/2024-12-21-17-33-54.png)](/assets/img/2024-12-21-17-33-54.png)

***For Cloudwatch*** we need \`com.amazonaws.<region-name>.logs\`.

Other possible service endpoints that require an endpoint in private subnet:

- Cloudwatch Monitoring
- S3 Gateway Endpoint (Free)
- DynamoDB Gateway Endpoint (Free)

For a more comprehensive list of available AWS services integrated with AWS PrivateLink (i.e., accessible via VPC endpoints in private subnet):

- https://docs.aws.amazon.com/vpc/latest/privatelink/aws-services-privatelink-support.html

**Remark.** In our case if we want to get access to our **_internal load-balancer_**, **_no endpoint_** is needed.
`;export{n as default};
