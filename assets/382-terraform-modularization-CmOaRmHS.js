const e=`---
title: "Terraform Modularization for DRY Deployment from DEV to UAT and Input Infrastructure Information"
date: 2025-04-07
id: blog0382
tag: terraform
toc: true
intro: "Discuss how to make our terraform project as DRY as possible."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Trouble we have in Intermediate Terraform Project Stage

Although we might have

- Modularized our resources by the logically grouped files like \`loadbalancer.tf\`, \`networking.tf\`, \`rds.tf\`, etc, and then;

- Created all the related resources, policies, and even imported the \`output\`'s from one module to another one;

We might still be facing an **_intermediate situation_** like the following:

<a href="/assets/img/2025-04-09-02-43-45.png">
  <img src="/assets/img/2025-04-09-02-43-45.png" width="500" />
</a>

<p></p>

- This works fine at the beginning, but we come across the trouble when moving from \`DEV\` to \`UAT\`, all those \`r_xxx.tf\` files have to be copied to \`UAT\`.

- Not only that, any changes in an \`r_xxx.tf\` file must be done twice, and even thrice if we have \`PROD\` as well.

### Further Modularization

#### The new structure

[![](/assets/img/2025-04-09-02-54-00.png)](/assets/img/2025-04-09-02-54-00.png)

- We have **_only one module_** in \`dev/\`, \`uat/\` and \`prod/\`, this makes sure all environments share exactly the same infrastructure.

- Now the only **_code duplication_** are the \`variables.tf\` files, which is to determine the interface of \`terraform.tfvars\`.

- The duplication is acceptable because in \`DEV\`, \`UAT\` and \`PROD\` it is likely to have slightly different infrastructures.

- Note that we have kept the nesting level \`application/billie/r_xxx.tf\` the same as \`environment/uat/r_xxx.tf\` relative to the \`modules\` folder in order to keep the module \`source\` attribute the same (minimize code changes).

#### Internal state transition

Now problem arises, in the past we have \`terraform apply\`-ed once, aws resources have been created and the aws resource ids have been bound to our internal state.

An \`id\` in an internal state follows the following pattern, let's take a \`networking\` module as an example:

![](/assets/img/2025-04-09-03-07-14.png)

and in this module we have a resource:

![](/assets/img/2025-04-09-03-05-44.png)

then terraform creates an \`id\` in the internal state

<Example>
<b>module.networking.aws_nat_gateway.main</b>
</Example>

and bind it to the aws resource id. The binding is saved in the terraform cloud.

Now because of one more level of modularization, the new internal state id should be

<Example>
module.billie.<b>module.networking.aws_nat_gateway.main</b>
</Example>

Namely, we simply prepend all the existing \`id\`'s by \`module.billie\`. This can be achieved by:

#### Transition script

\`\`\`bash
RESOURCES=$(terraform state list)
NEW_MODULE="module.billie"

# Move each resource to the new module structure
for RESOURCE in $RESOURCES; do
  # Skip if already in module.billie
  if [[ $RESOURCE == "$NEW_MODULE.*" ]]; then
    echo "Skipping $RESOURCE (already in $NEW_MODULE)"
    continue
  fi

  # Create the new address with module.main prefix
  NEW_RESOURCE="$NEW_MODULE.$RESOURCE"
  terraform state mv "$RESOURCE" "$NEW_RESOURCE"
done

echo "Migration completed!"
echo "Run 'terraform plan' to verify the migration."
\`\`\`

Be patient about the process as each \`terraform state mv\` makes an API call to terraform cloud and each call takes 3 to 5 seconds.

### Critical Mistake to Avoid

#### Make sure to change the namespace

Since we are using terraform cloud, make sure to change

\`\`\`hcl{5}
terraform {
  cloud {
    organization = "billie"
    workspaces {
      name = "billie-uat"
    }
  }
}
\`\`\`

Otherwise we will remove the existing resources in \`DEV\` and create resources in \`UAT\`.

### Output After Further Modularization

#### New outputs.tf

Before further modularization we should have created a map that consists of all the value we wish to export:

\`\`\`hcl
// application/billie/outputs.tf

locals {
  // group and post-process all the resource data here
  ...
  rds_proxy_endpoint           = module.rds_and_rds_proxy.rds_proxy_endpoint
  rds_endpoint                 = module.rds_and_rds_proxy.rds_endpoint
  billie_lambda_function_sg_id = module.networking.billie_lambda_function_sg.id
  billie_private_subnet_ids    = module.networking.billie_private_subnets[*].id
  ...
}

output "config" {
  value = {
    internal_loadbalancer_dns_name = local.internal_loadbalancer_dns_name
    environment                    = local.environment
    ecs_meta                       = local.ecs_meta
    external_loadbalancer_endpoint = local.external_loadbalancer_endpoint
    internal_loadbalancer_endpoint = local.internal_loadbalancer_endpoint
    billie_lambda_function_sg_id   = local.billie_lambda_function_sg_id
    billie_private_subnet_ids      = local.billie_private_subnet_ids
    websocket_apigateway = {
      api_gateway_id               = local.websocket_api_id
      api_gateway_name             = local.websocket_api_name
      api_gateway_connect_endpoint = local.websocket_api_connect_endpoint
      api_gateway_push_endpoint    = local.websocket_api_callback_url
      apigateway_proxy_function    = module.websocket_apigateway.apigateway_proxy_function
    }
    database = {
      endpoints = {
        public_endpoint = local.rds_endpoint
        proxy_endpoint  = local.rds_proxy_endpoint
      }
      credentials = local.database
    }
    internal_loadbalancer_dns_name = local.database
  }
}
\`\`\`

Now in \`environment/uat/outputs.tf\`, our new terraform output is as simple as

\`\`\`hcl
// environment/uat/outputs.tf
output "config" {
  value = module.billie.config
}
\`\`\`

#### Output script

If we execute

\`\`\`bash
# in environment/uat
terraform output -json | jq -r 'map_values(.value)' > config.json
\`\`\`

We get a \`config.json\` in \`environment/uat\`:

\`\`\`json
{
  "config": {
    "internal_loadbalancer_dns_name": "internal-billie-internal-loadbalancer-uat-720307182.ap-southeast-2.elb.amazonaws.com",
    "environment": "uat",
    "ecs_meta": {
      "billie-ai-inference": {
        "cloudwatch_log_group_url": "https://console.aws.amazon.com/cloudwatch/home?region=ap-southeast-2#logsV2:log-groups/log-group/$252Fecs$252Fbillie-ai-inference-uat-v2",
        "cluster_name": "billie-ai-inference-uat-v2",
        "container_name": "billie-ai-inference-uat-v2",
        "image_name": "wb-ai-billie",
        "image_registry": "798404461798.dkr.ecr.ap-southeast-2.amazonaws.com",
        "service_name": "billie-ai-inference-uat-v2",
        "task-family": "terraform-billie-ai-inference-uat-v2",
        "task_execution_role_arn": "arn:aws:iam::798404461798:role/ecsTaskExecutionRole",
        "task_role_arn": "arn:aws:iam::798404461798:role/billie-ai-inference-uat-v2-task-role"
      },
      ...
    }
    ...
}
\`\`\`

We can sync this \`json\` to a non-public s3-bucket and let a authentication-protected lambda accesses this \`json\` object.

#### Visualization of the resources

We may make a script to directly upload this \`json\` into a database. Only authorized person can get this data in their frontend to visualize everything we need.

In my case I have created a page in react and made use of this \`json\` file to generate:

[![](/assets/img/2025-04-25-11-25-36.png)](/assets/img/2025-04-25-11-25-36.png)
`;export{e as default};
