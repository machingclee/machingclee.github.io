const n=`---
title: "Lambda Client"
date: 2025-04-01
id: blog0380
tag: aws, lambda, serverless
toc: true
intro: "It is very common to have lamdba function being called by another function. This time we study two kinds of lambda functions to be invoked, one is snapstarted springboot lambda function, another one is an ordinary console lambda function."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Use case

Sometimes our lambda function must be set into VPC (assigning security group and private subnets to the lambda configuration) in order to

- access VPC-specific resources such as RDS-proxy;
- or access other internal-loadbalanced endpoints that is protected physically from outside.

However, it is hard to call non-VPC resources inside of VPC-lambdas, such as accessing websocket-api of API-Gateway as we will need VPC-endpoint to reach it.

Many policies might be attached to make "internal invokation" working. On the other hand, there is almost no policy needed for public lambdas to access non-VPC resources. Therefore inside of a private lambda there is a standard trick to execute another "public lambda" using **_client-lambda_**.

### Client-Lambda

#### How to invoke snap-started springboot lambda function

##### Using Nodejs

Supose that the function name \`billie-ms-notification-dev-v2-api\` represents a snap-started lambda function executing a springboot application. Now let's try to invoke the \`/ping\` API via another resources.

The \`/ping\` API returns the following via loadbalancer:

![](/assets/img/2025-04-02-03-08-06.png)

In the following we will create an endpoint in a private nodejs instance (an ECS instance written in nodejs assigned in private subnets), with a nodejs endpoint \`/lambda/test\` invoking the springboot endpoing \`/ping\`, the final result after the invokation (no matter the springboot is private or not, as long as it is a lambda function):

![](/assets/img/2025-04-02-03-18-21.png)

The script for the lambda invokation:

\`\`\`js
import express from "express";
import { InvokeCommand, LambdaClient, ListLayersCommand } from "@aws-sdk/client-lambda";
const lambdaRouter = express.Router();

lambdaRouter.get("/test", async (req, res) => {
    const client = new LambdaClient({ region: process.env.FILE_SYNC_BUCKET_REGION });

    const apiGatewayEvent = {
        httpMethod: "GET",
        path: "/ping",
        headers: {
            "Content-Type": "application/json"
        },
        // in post request:
        // body: JSON.stringify({
        //     // Your request body data here
        //     key1: "value1",
        //     key2: "value2"
        // }),
        requestContext: {
            identity: {
                sourceIp: "127.0.0.1"
            }
        }
    };

    const command = new InvokeCommand({
        FunctionName: "billie-ms-notification-dev-v2-api",
        Payload: JSON.stringify(apiGatewayEvent),
        InvocationType: "RequestResponse"
    });

    const response = await client.send(command);
    let response_ = null
    if (response.Payload) {
        response_ = JSON.parse((JSON.parse(Buffer.from(response.Payload).toString('utf-8'))?.body as string) || "{}")
    }
    res.json({ success: true, result: response_ })
})

export default lambdaRouter;
\`\`\`

Note that this is language-agnostic, you can translate this same code to other language with their \`client-lambda\` library.

#### How to invoke ordinary console lambda function

Assume that we have a standard lambda function in AWS console:

\`\`\`js
// function_name: forward-websocket-api

export const handler = async (event) => {
  console.log("this is the event:", event);
  return { statusCode: 200, body: "Connected." };
};
\`\`\`

We are trying to invoke this lambda function inside of a Kotlin application:

##### Using Kotlin and Springboot

Let's add the following in \`build.gradle.kts\`:

\`\`\`kts
    implementation("software.amazon.awssdk:lambda:2.20.45")
    implementation("software.amazon.awssdk:core:2.20.45")
\`\`\`

Now we create a simple endpoint to trigger the invokation to the above lambda function:

\`\`\`kotlin
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import software.amazon.awssdk.core.SdkBytes
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.lambda.LambdaClient
import software.amazon.awssdk.services.lambda.model.InvokeRequest


@Configuration
class LambdaClientConfig(
    @Value("\\\${aws.region}")
    val awsRegion: String
) {
    @Bean
    fun createLambdaClient(): LambdaClient {
        val lambdaClient = LambdaClient.builder()
            .region(Region.of(awsRegion))
            .build()
        return lambdaClient
    }
}

@RestController
@RequestMapping("/lambda")
class LambdaController(
    private val lambdaClient: LambdaClient
) {

    @GetMapping("/test")
    fun test() {
        val payload = """
        {
            "message": "Hello from Kotlin",
            "timestamp": \${System.currentTimeMillis()},
            "data": {
                "key1": "value1",
                "key2": 42
            }
        }
    """.trimIndent()

        val invokeRequest = InvokeRequest.builder()
            .functionName("forward-websocket-api")
            .payload(SdkBytes.fromUtf8String(payload))
            .invocationType("RequestResponse")
            .build()

        val response = lambdaClient.invoke(invokeRequest)
        println(response)

        if (response.payload() != null) {
            val responsePayload = response.payload().asUtf8String()
            println("Response: $responsePayload")
        }
    }
}
\`\`\`

##### Handler event received

Suppose the above lambda \`/lambda/test\` gets executed, then from our lambda handler:

\`\`\`js{3}
export const handler = async (event) => {
  // caution: this event is a string, we need to JSON.parse() it for regular use.
  console.log("this is the event:", event);
  return { statusCode: 200, body: "Connected." };
};
\`\`\`

We can observe from cloudwatch that the result is:

\`\`\`js
this is the event: {
  message: 'Hello from Kotlin',
  timestamp: 1743533725690,
  data: { key1: 'value1', key2: 42 }
}
\`\`\`

Therefore the \`payload\` in \`InvokeRequest\` (from Kotlin endpoint) is exactly our \`event\` object.

##### Serious Warning to the \`event\` object in lambda receiver

Although unclear from the cloudwatch log, this \`event\` is actually a **_string_**. We will need to \`JSON.parse(event)\` for any regular use.

#### Example from WebsocketAPI of ApiGateway

##### Kotlin Side

\`\`\`kotlin
data class PreProxyRequest(
    val connectionId: String,
    val data: Any
)

@Component
class ApiGatewayProxyClient(
    @Value("\\\${socket.endpoint}")
    private val socketEndpoint: String,
    @Value("\\\${websocket-api-proxy.function-name}")
    private val apiSocketProxyFunctionName: String,
    private val proxyLambdaClient: LambdaClient,
    private val gson: Gson
) {
    private val logger = KotlinLogging.logger {}

    fun send(request: PreProxyRequest) {
        val payload = gson.toJson(ProxyRequest(endpoint = socketEndpoint,
                                               connectionId = request.connectionId,
                                               data = request.data))
        val payloadJsonStr = gson.toJson(payload)
        val invokeRequest = InvokeRequest.builder()
            .functionName(apiSocketProxyFunctionName)
            .payload(SdkBytes.fromUtf8String(payloadJsonStr))
            .invocationType("RequestResponse")
            .build()

        val response = proxyLambdaClient.invoke(invokeRequest)
        if (response.payload() != null) {
            val responsePayload = response.payload().asUtf8String()
            logger.info { "Response: $responsePayload" }
        }
    }
}
\`\`\`

##### Nodejs lambda side

Note that the \`payload\` of \`InvokeRequest\` is a stringified data with \`endpoint\`, \`connectionId \` and \`data\`, we can parse it to destructure those values:

\`\`\`js{19}
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const clientsCache = {};

const getClient = (endpoint) => {
  if (!clientsCache[endpoint]) {
    clientsCache[endpoint] = new ApiGatewayManagementApiClient({
      endpoint: endpoint,
      region: process.env.AWS_REGION, // Lambda automatically provides this environment variable
    });
  }
  return clientsCache[endpoint];
};

export const handler = async (event) => {
  const { endpoint, connectionId, data } = JSON.parse(event);
  const client = getClient(endpoint);

  const command = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: Buffer.from(JSON.stringify(data)),
  });

  await client.send(command);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Message sent successfully" }),
  };
};
\`\`\`

#### Policy attached to invoker

Assume that an invoker tries to invoke a lambda function \`billie-ms-notification-dev-v2-api\`, then we need to add the inline-policy into the IAM role **_of the invoker_**:

\`\`\`json
{
  "Action": "lambda:InvokeFunction",
  "Effect": "Allow",
  "Resource": "arn:aws:lambda:ap-southeast-2:798404461798:function:billie-ms-notification-dev-v2-api"
}
\`\`\`
`;export{n as default};
