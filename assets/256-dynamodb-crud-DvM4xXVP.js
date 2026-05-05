const n=`---
title: "CRUD in DynamoDB"
date: 2024-04-16
id: blog0256
tag: aws
intro: "Basic CRUD with DynamoDB"
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Detail on CRUD with DynamoDB


We continue from section
- handler --- spaces/handler.ts (CRUD with DynamoDB)
in [**this post**](/blog/article/AWS-CDK-in-Typescript-and-Python-with-Application-in-S3-Lambda-Functions-with-Debugging-API-Gateway-and-DynamoDB#handler-----spaces/handler.ts-(CRUD-with-DynamoDB))

Suppose that we have initiated a \`ddbClient\` by 
\`\`\`ts
const ddbClient = new DynamoDBClient({});
\`\`\`
and passed into each of \`get\`, \`post\`, \`put\`, \`delete\` functions.

#### get.ts

\`\`\`ts
import { DynamoDBClient, GetItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export default async (event: APIGatewayProxyEvent, ddbClient: DynamoDBClient): Promise<APIGatewayProxyResult> => {
    const spaceId = event.queryStringParameters?.["id"];
    if (event.queryStringParameters) {
        if (!spaceId) {
            return {
                statusCode: 400,
                body: JSON.stringify("id required")
            }
        }

        event.queryStringParameters
        const res = await ddbClient.send(new GetItemCommand({
            TableName: process.env.TABLE_NAME,
            Key: { id: { S: spaceId } }
        }));

        if (res.Item) {
            const unmarshalled = unmarshall(res.Item);
            return {
                statusCode: 200,
                body: JSON.stringify(unmarshalled)
            }
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify(\`space with id: \${spaceId} not found\`)
            }
        }
    } else {
        const result = await ddbClient.send(new ScanCommand({
            TableName: process.env.TABLE_NAME,
        }));
        const result_ = result.Items?.map(item => unmarshall(item));
        return {
            statusCode: 200,
            body: JSON.stringify(result_)
        }
    }
}
\`\`\`

#### post.ts

\`\`\`ts
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 } from "uuid";

export default async (event: APIGatewayProxyEvent, ddbClient: DynamoDBClient): Promise<APIGatewayProxyResult> => {
    const randomId = v4();
    const item = JSON.parse(event.body || "");

    const result = await ddbClient.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(item)
    }));

    return {
        statusCode: 201,
        body: JSON.stringify({ id: randomId })
    };
}
\`\`\`

#### put.ts

\`\`\`ts
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export default async (event: APIGatewayProxyEvent, ddbClient: DynamoDBClient): Promise<APIGatewayProxyResult> => {
    if (event.queryStringParameters && "id" in event.queryStringParameters && event.body) {
        const spaceId = event.queryStringParameters["id"] || "";
        const [key, value] = Object.entries(JSON.parse(event.body))[0] as [string, string];
        const updateResult = await ddbClient.send(new UpdateItemCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                "id": { S: spaceId }
            },
            UpdateExpression: "set #attr = :new",
            ExpressionAttributeNames: {
                "#attr": key
            },
            ExpressionAttributeValues: {
                ":new": {
                    "S": value
                }
            },
            ReturnValues: "UPDATED_NEW"
        }))

        return {
            statusCode: 204,
            body: JSON.stringify(updateResult.Attributes)
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify("Please provide value arguments")
    };
}
\`\`\`

#### delete.ts

\`\`\`ts
import { DeleteItemCommand, DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export default async (event: APIGatewayProxyEvent, ddbClient: DynamoDBClient): Promise<APIGatewayProxyResult> => {
    if (event.queryStringParameters && "id" in event.queryStringParameters && event.body) {
        const spaceId = event.queryStringParameters["id"] || "";
        await ddbClient.send(new DeleteItemCommand({
            TableName: process.env.TABLE_NAME,
            Key: { id: { S: spaceId } }
        }))

        return {
            statusCode: 204,
            body: JSON.stringify(\`deleted item with id \${spaceId}\`)
        }
    }

    return {
        statusCode: 201,
        body: JSON.stringify("Please provide valid arguments.")
    };
}
\`\`\``;export{n as default};
