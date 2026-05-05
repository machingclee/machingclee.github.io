const n=`---
title: "AWS CDK in Typescript and Python with ① Application in S3 ② Lambda Functions with Debugging ③ API Gateway and ④ DynamoDB"
date: 2024-04-15
id: blog0255
tag: aws
intro: "We study how to create stack of aws resources and how they can interact with each other."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Project Typescript

#### Initialization

- We install \`aws-cdk\` by 
  \`\`\`text
  npm install -g aws-cdk
  \`\`\`

- We then init a project by

  \`\`\`text
  cdk init app --language typescript
  \`\`\`
#### Project Structure

The project structure is as follows:

  ![](/assets/img/2024-04-17-02-39-04.png)

  As we will see, 
  - \`lib/\` contains stack definition**s** of resources, 
  - \`bin/\` contains the entry point of declaring all the stacks pointed in \`cdk.json\`.

### Rename bin/xxx.ts to bin/launch.ts

The default name in \`bin/\` may be misleading, which is automatically generated according to the directory we are working with.

Therefore we now rename \`bin/cdk_demo_app.ts\` into \`bin/launch.ts\`.

In \`cdk.json\` we change the \`app\` field to 
  \`\`\`json
  "app": "npx ts-node --prefer-ts-exts bin/launch.ts"
  \`\`\`

### Combining the Stack Definitions

Instead of introducing various stack definitions, we first have a overview of how we put the stack togethers in \`bin/launch.json\`:

\`\`\`ts
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LambdaStack } from '../lib/lambda-stack';
import { PhotoS3Stack } from '../lib/photo-s3-stacks';
import { APIStack } from '../lib/api-stack';
import { DataTableStack } from '../lib/data-table-stack';

const app = new cdk.App();

const photoStack = new PhotoS3Stack(app, 'photoS3Stacks');

const dataTableStack = new DataTableStack(app, "spacesTableStack");

const lambdaStack = new LambdaStack(app, 'LambdaStack', {
    targetBucketArn: photoStack.photoBucketName,
    spacesTable: dataTableStack.spaceTable
});

const apiStack = new APIStack(app, "ApiStack", {
    helloLambdaIntegration: lambdaStack.helloLambdaIntegration,
    spaceLambdaIntegration: lambdaStack.spaceLambdaIntegration
})
\`\`\`
- Lambda function will interact with **S3 bucket** and **dynamodb**, therefore we need to pass the \`bucketArn\` and \`tableArn\` into \`LambdaStack\` in order to grant proper policies to the automatically generated role.

- In defining various stacks we will expose the generated resource as a public field in order to ***share resources among different stacks***.

### Create Stacks of Resources

#### S3 (PhotoS3Stack)



\`\`\`ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Function as LambdaFunction } from "aws-cdk-lib/aws-lambda"
import { Bucket } from 'aws-cdk-lib/aws-s3';

export class PhotoS3Stack extends cdk.Stack {
    public readonly photoBucketName: string;
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const photosBucket = new Bucket(this, "photo-s3-bucket", {
            bucketName: "photo-buckets-for-lambda-testing"
        })
        this.photoBucketName = photosBucket.bucketArn
    }
}
\`\`\`
#### Lambda Function (LambdaStack)

In the root directory we create a folder called \`service\`

![](/assets/img/2024-04-17-03-00-18.png)

##### handler --- hello.ts (List all S3 Buckets)

- This is a simple handler which lists all s3 buckets in my account:

- For sure we will need to allow 

  - \`"s3:ListAllMyBuckets"\` and 

  - \`"s3:ListBucket"\` 

  from all related resources
  
- We will simply use \`resources: ["*"]\` in role policy to skip the process of finding suitable ***(FROM)*** Resource.


\`\`\`ts
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3"

const s3Client = new S3Client();

const handler = async (event: APIGatewayProxyEvent, context: Context) => {
    const command = new ListBucketsCommand({});
    const listBucketResults = (await s3Client.send(command)).Buckets;
    const res: APIGatewayProxyResult = {
        statusCode: 200,
        body: JSON.stringify(\`Here is a list of my buckets: \${listBucketResults?.map(r => r.Name).join(", ")}\`)
    }
    console.log(event);
    return res;
}

export {
    handler
}
\`\`\`


##### handler --- spaces/handler.ts (CRUD with DynamoDB)

- We defer the definitions of \`get\`, \`post\`, \`put\`, \`delete_\` functions in [**this post**](/blog/article/CRUD-in-DynamoDB).

\`\`\`ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import post from "./methods/post";
import get from "./methods/get";
import put from "./methods/put";
import delete_ from "./methods/delete";

const ddbClient = new DynamoDBClient({});

const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    let message: string = "";
    try {
        switch (event.httpMethod) {
            case "GET":
                return get(event, ddbClient);
            case "POST":
                return post(event, ddbClient);
            case "PUT":
                return put(event, ddbClient);
            case "DELETE":
                return delete_(event, ddbClient);
            default:
                break;
        }
        return  res: APIGatewayProxyResult = {
            statusCode: 200,
            body: message
        }
    }
    catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify(err)
        }
    }
}

export {
    handler
}
\`\`\`

##### Create Stack Definition of Lambda Functions

- We defined two lambda functions inside the set stack definition.
- Although we use typescript in this project, we can create handler in any other languages.



\`\`\`ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Code, Function as LambdaFunction, Runtime } from "aws-cdk-lib/aws-lambda"
import { join } from "path";
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { Lambda } from 'aws-cdk-lib/aws-ses-actions';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';

export class LambdaStack extends cdk.Stack {
    public helloLambdaIntegration: LambdaIntegration
    public spaceLambdaIntegration: LambdaIntegration
    constructor(scope: Construct, id: string, props: cdk.StackProps & {
        targetBucketArn: string,
        spacesTable: ITable
    }) {
        super(scope, id, props);
   
        // ============ start of first lambda ============
        const testLambda = new NodejsFunction(
            this,
            "lambda-from-file", // id of this lambda function,
            {
                runtime: Runtime.NODEJS_18_X,
                handler: "handler",
                entry: join(__dirname, "..", "services", "hello.ts"),
                environment: {
                    TARGET_BUCKET: props.targetBucketArn
                }
            }
        )
        /**
         * list of all condition keys:
         * https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazons3.html
         */
        testLambda.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "s3:ListAllMyBuckets",
                "s3:ListBucket"
            ],
            resources: ["*"]
        }))
        // ============ end of first lambda ============

        // ============ start of second lambda ============
        const spaceLambda = new NodejsFunction(
            this,
            "space-lambda", // id of this lambda function,
            {
                runtime: Runtime.NODEJS_18_X,
                handler: "handler",
                entry: join(__dirname, "..", "services", "spaces", "handler.ts"),
                environment: {
                    TABLE_NAME: props.spacesTable.tableName
                }
            }
        )

        spaceLambda.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            resources: [props.spacesTable.tableArn],
            actions: [
                "dynamodb:GetItem",
                "dynamodb:Scan",
                "dynamodb:PutItem",
                "dynamodb:DeleteItem"
            ]
        }))
        // ============ end of second lambda ============

        this.helloLambdaIntegration = new LambdaIntegration(testLambda);
        this.spaceLambdaIntegration = new LambdaIntegration(spaceLambda);
    }
}
\`\`\`

#### API Gateway (APIStack)

\`\`\`ts
export class APIStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: cdk.StackProps & {
        helloLambdaIntegration: LambdaIntegration,
        spaceLambdaIntegration: LambdaIntegration
    }) {
        super(scope, id, props);

        const api = new RestApi(this, "test-api",);
        const apiResources = api.root.addResource("test");
        apiResources.addMethod("GET", props.helloLambdaIntegration);

        const spaceRouter = api.root.addResource("spaces");
        spaceRouter.addMethod("GET", props.spaceLambdaIntegration);
        spaceRouter.addMethod("POST", props.spaceLambdaIntegration);
        spaceRouter.addMethod("PUT", props.spaceLambdaIntegration);
        spaceRouter.addMethod("DELETE", props.spaceLambdaIntegration);
    }
}
\`\`\`


#### DynamoDB (DataTableStack)

- \`\`\`ts
  import * as cdk from 'aws-cdk-lib';
  import { Construct } from 'constructs';
  import { AttributeType, ITable, Table } from "aws-cdk-lib/aws-dynamodb";
  import getSuffixFromStack from '../utils/getSuffixFromStack';

  export class DataTableStack extends cdk.Stack {
      public spaceTable: ITable
      constructor(scope: Construct, id: string, props?: cdk.StackProps) {
          super(scope, id, props);

          const suffix = getSuffixFromStack(this);

          this.spaceTable = new Table(this, "SpacesTable", {
              partitionKey: {
                  name: "id",
                  type: AttributeType.STRING
              },
              tableName: \`SpaceStack-\${suffix}\`,
          })
      }
  }
  \`\`\`

- Here \`getSuffixFromStack\` is a simple util function defined by 
  \`\`\`ts
  import { Fn, Stack } from "aws-cdk-lib";

  export default (stack: Stack) => {
      /**
      * exmaple of stackId: 
      * 1:562976154517:stack/spacesTableStack/ed3f63e0-fa7b-11ee-9900-0a107562c215 
      */
      const shortStakcId = Fn.select(2, Fn.split("/", stack.stackId));
      const suffix = Fn.select(4, Fn.split("-", shortStakcId));
      return suffix;
  }
  \`\`\`

### Deployment
#### Deploy the Whole Stacks
- We need to initiate a cloudformation stack definition of this project:

  \`\`\`text
  cdk bootstrap
  \`\`\`

- Next we need to check whether our code can generate a cloudformation definition successfully:

  \`\`\`text
  cdk synth
  \`\`\`

- If everything is done, we deploy our stacks by:
  \`\`\`text
  cdk deploy --all
  \`\`\`

#### Deploy Part of the Stacks

- Note that we have defined many stacks in \`launch.ts\`, it is possible to inspect the names of stacks by
  \`\`\`text
  cdk list
  \`\`\`
  which yields:

  \`\`\`text
  photoS3Stacks
  spacesTableStack
  LambdaStack
  ApiStack
  \`\`\`
- Suppose we just want to reploy the \`LambdaStack\` only, we execute

  \`\`\`text
  cdk deploy LambdaStack
  \`\`\`

### Debug a Lambda Function

#### .vscode/launch.json

Note that if our lambda function uses an \`env\` variable provided by other stack, then we may need to hard-code it for debugging.


\`\`\`json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Debug Local File",
            "runtimeArgs": [
                "-r",
                "ts-node/register"
            ],
            "args": [
                "\${relativeFile}"
            ],
            "env": {
                "AWS_REGION": "ap-northeast-1",
                "TABLE_NAME": "SpaceStack-0a107562c215"
            }
        }
    ]
}
\`\`\`

#### Write a Test File

Let's create a file \`test/spaces-handler-test.ts\` and write 

\`\`\`ts
import { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../services/spaces/handler";

handler(
    {
        httpMethod: "DELETE",
        queryStringParameters: {
            id: "0206f811-3880-4065-bd5f-3a82b6e64de5"
        },
        body: JSON.stringify({ location: "Chipi Chipi ChapaChap" })
    } as any as APIGatewayProxyEvent,
    {} as any
);
\`\`\`
Note that \`handler\` must satisfy the interface:
\`\`\`ts
import { APIGatewayProxyEvent } from "aws-lambda";

async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>
\`\`\`


### Project Initialization in Python

Suppose our lambda functions are written in python, it makes sense to start the project with Python since debugging the lambda functions will be more convenient. 

#### Initialization

First we init the project by 
  \`\`\`text
  cdk init sample-app --language python
  \`\`\`

#### Project Structure

![](/assets/img/2024-04-17-04-08-26.png)

#### lambda/handler

It is as simple as 

\`\`\`py
def handler(event, context):
    print(event)
    return {
        "statusCode": 200,
        "body": "success"
    }
\`\`\`

#### lambda_from_cli/lambda_from_cli_stack.py (LambdaFromCliStack)

\`\`\`py
from constructs import Construct
from aws_cdk import (
    Duration,
    Stack,
    aws_iam as iam,
    aws_sqs as sqs,
    aws_sns as sns,
    aws_sns_subscriptions as subs,
    aws_lambda as lambda_,
    aws_lambda_event_sources as lambda_event_sources
)


class LambdaFromCliStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        queue = sqs.Queue(
            self, "LambdaFromCliQueue",
            visibility_timeout=Duration.seconds(300),
        )

        # create lambda function
        sqs_lambda = lambda_.Function(self, 
                                      "SQSLambda", 
                                      handler="lambda_handler.handler",
                                      runtime=lambda_.Runtime.PYTHON_3_12,
                                      code=lambda_.Code.from_asset("lambda")
                                    )

        # Create event source
        sqs_event_source = lambda_event_sources.SqsEventSource(queue)

        # Add SQS event soruce to lambda
        sqs_lambda.add_event_source(sqs_event_source)
\`\`\`

#### app.py
\`\`\`py
#!/usr/bin/env python3

import aws_cdk as cdk
from lambda_from_cli.lambda_from_cli_stack import LambdaFromCliStack

app = cdk.App()
LambdaFromCliStack(app, "LambdaFromCliStack")

app.synth()
\`\`\``;export{n as default};
