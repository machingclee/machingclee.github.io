const n=`---
title: "Amazon EventBridge Schedule to Trigger Springboot Endpoint"
date: 2025-04-13
id: blog0385
tag: aws
toc: true
intro: "Simple scheduling to our springboot lambda function's endpoint"
---



<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Create a Simple Scheduler from EventBridge

![](/assets/img/2025-04-13-06-33-43.png)

#### Create a Lambda Function and let the Schedule Triggers it

Our execution flow involves the following steps:

1. Scheduler triggers a lambda function in \`js\` written in the aws console.
2. $\\to$ This \`js\` lamdba invoke our springboot lambda via \`client-lambda\` sdk.
3. $\\to$ Springboot lambda handles the task.

**Remark 1.** This springboot lamdba can be **_sheerly internal_**, meaning that this is simply a function and not exposed to the public via api-gateway nor via load-balancer.

**Remark 2.** Unless our springboot lambda is also exposed to the public, we can add signature to the payload sent from \`js\` lambda to \`springboot\` lamdba (by using the **_same_** secret in both ends). For simplicity in this article we simply send a \`GET\` request to an endpoint.

\`\`\`js{12}
import {
  InvokeCommand,
  LambdaClient,
  ListLayersCommand,
} from "@aws-sdk/client-lambda";

export const handler = async (event) => {
  const client = new LambdaClient({ region: process.env.AWS_REGION });

  const apiGatewayEvent = {
    httpMethod: "GET",
    path: "/scheduling/package-deadline/check",
    headers: {
      "Content-Type": "application/json",
    },
    requestContext: {
      identity: {
        sourceIp: "127.0.0.1",
      },
    },
  };

  const command = new InvokeCommand({
    FunctionName: "alice-timetable-kotlin-dev-api",
    Payload: JSON.stringify(apiGatewayEvent),
    InvocationType: "RequestResponse",
  });

  const response = await client.send(command);
  console.log(JSON.stringify(response, null, 4));

  const res = {
    statusCode: 200,
    body: "Response: " + JSON.stringify(response),
  };
  return res;
};
\`\`\`

Now this lambda function will invoke our springboot application (\`alice-timetable-kotlin-dev-api\`) by calling our endpoint \`/scheduling/package-deadline/check\` regularly (depends on how long you scheduled repeatedly).

#### The Endpoint to be Invoked Regularly: \`/scheduling/package-deadline/check\`

In our springboot application we have defined

\`\`\`kotlin
package dev.james.alicetimetable.controller

import dev.james.alicetimetable.commons.models.APIResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController


@RestController
@RequestMapping("/scheduling")
class ScehduleController {
    @GetMapping("/package-deadline/check")
    fun checkPackagesDeadline(): APIResponse<String> {
        println("I am checking deadline")
        return APIResponse("This is the trigger route for deadline-checking.")
    }
}
\`\`\`

#### The Policy

In order for schedule's lambda function to invoke our springboot lambda, let's create an inline-policy:

\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": ["lambda:InvokeFunction"],
      "Resource": [
        "arn:aws:lambda:ap-northeast-1:562976154517:function:alice-timetable-kotlin-dev-api"
      ],
      "Effect": "Allow"
    }
  ]
}
\`\`\`

Ideally for relatively **_serious_** project we should manage this policy in terraform code. For small project it is fine to simply create it manually (be sure to do the same thing in all environments).

### Cloudwatch Results

#### The Schedule, aka, Invoker (Lamdba)

![](/assets/img/2025-04-13-06-40-34.png)

#### The Springboot

[![](/assets/img/2025-04-13-06-43-00.png)](/assets/img/2025-04-13-06-41-35.png)
`;export{n as default};
