---
title: "Websocket-API from API-Gateway"
date: 2025-01-05
id: blog0358
tag: aws, api-gateway, websocket
toc: true
intro: "We study the integration of snapStarted lambda with API-gateway."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

#### API-Gateway

##### The Endpoints

After we have built websocket-apis from API-Gateway, we get the endpoints from:

[![](/assets/img/2025-01-05-17-31-19.png)](/assets/img/2025-01-05-17-31-19.png)

Here the one with `wss` is for `WebSocket` api, and the one with `https` is for `POST` request or `aws-sdk`.

##### Routes (routeKeys) available for the https-endpoint

By default we have `$connect`, `$disconnect` and `$default`:

![](/assets/img/2025-01-05-17-32-27.png)

Although we have configured custom `routeKey`, but it is no more convenient than setting a `data.action`. Therefore we can omit it and relies on `$default`.

##### Quick link for the cloudwatch of the corresponding lambda function.

![](/assets/img/2025-01-05-17-35-31.png)

##### Edit execution role in order to send messages to frontend

With the default role we will get the following error when we try to send a message to a `connnectionId` (we explain how to do it later):

```text
User: arn:aws:sts::562976154517:assumed-role/websocket-testing-role-vkzcsju3
/websocket-testing is not authorized to perform: execute-api:ManageConnections
on resource: arn:aws:execute-api:ap-northeast-1:********4517:3hfbt7ivk0/production
/POST/@connections/{connectionId}",
```

Here we can identify:

- `562976154517` is our **_AWS Account ID_**;
- `3hfbt7ivk0` is our **_API Gateway API ID_**;

repsectively, therefore we need to adjust the execution role of the lambda:

![](/assets/img/2025-01-06-01-44-11.png)

We create an `inline`-policy in json format:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["execute-api:*"],
      "Resource": [
        "arn:aws:execute-api:ap-northeast-1:562976154517:3hfbt7ivk0/*"
      ]
    }
  ]
}
```

Basically when we provide the error log to LLM, we will get the related configuration.

#### Implementation

##### Procedures to get `connectionId` in frontend

Here we get our `connectionId` in 3 steps:

1. We first connect by calling the api:

   ```js
   new WebSocket("wss://<domain-name>/production/");
   ```

2. We listen to `open` (i.e., connected) event, we then send an event to request for `connectionId` by sending `{ action: GET_CONNECTION_ID }`
3. We listen to `message` and get the `connectionId` once
   ```js
   JSON.parse(event?.data || "{}")?.connectionId;
   ```
   exists.

Now we can request to join any chatroom using our own `connectionId`.

##### Frontend: Get `connectionId` from frontend

```js-1
  useEffect(()=>{
    const socket = new WebSocket('wss://<domain-name>/production/');
      socket.addEventListener('open', (_event) => {
        console.log("getting connection id ...")
        socket.send(JSON.stringify({ action: "GET_CONNECTION_ID" }));
    });
```

We have dispatched a `GET_CONNECTION_ID` event, next let's wait for the return:

```js-7
      socket.addEventListener('message', (event) => {
        console.log("message recevied")
        const messageData = JSON.parse(event?.data || "{}") as {connectionId?: string}
          if (messageData.connectionId) {
              setConnectionId(messageData.connectionId)
          }
    });
  }, [])
```

##### Code of lambda connected to websocket-api

```js
// index.mjs
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;
  const eventType = event.requestContext.eventType;
  console.log("is it a normal event?", event);
  const action = JSON.parse(event?.body || "{}")?.action;

  if (action === "GET_CONNECTION_ID") {
    const callbackUrl = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
    const clientApi = new ApiGatewayManagementApiClient({
      endpoint: callbackUrl,
    });
    const requestParams = {
      ConnectionId: connectionId,
      Data: JSON.stringify({ connectionId }),
    };
    const command = new PostToConnectionCommand(requestParams);
    await clientApi.send(command);
  }

  const response = {
    statusCode: 200,
  };

  return response;
};
```

##### Problems of using websocket api from api-gateway

###### Scenario: Let's reconnect

Suppose a user has joined a number of chatrooms (can possibly be multiple because users can browse our webpage by multiple tabs), when it disconnects due to any reason, we need to

1. Remove all connections in all chatrooms (directly triggered from websocket-connected lambda)
2. When new connection (retry) succeeded, we need to rejoin all those chatrooms (should be requested from frontend).

###### Trouble: Yes we can reconnect, but ...

- We don't have retry mechanism for the raw `WebSocket` API.
- And we should never use that raw api for serious application.
- Morever, the implementation of joining a channel is tedious as we are risking ourself to unnecessary bugs (for which `socket.io` have already handled well).

###### A tentative diagram for chat system using websocket-API from api-gateway

The following is just a design to think about how websocket-api would work if we were to make use of it. It is literally painful and even don't want to start working with:

[![](/assets/img/2025-01-06-00-47-58.png)](/assets/img/2025-01-06-00-47-58.png)

- Why the hack I need to manage the socket participantions of channels for connection and disconnection?

- Why the hack I need to manage the retry on my own?
- With `socket.io` it is as simple as connecting to our backend and let the backend to `userSocket.join(channel)`, we never need to think of disconnection on backend side.
- In `socket.io` each `socket` is a rich object for which we can inject `data`. But for websocket-api this is just a plain `connectionId: string`.
- `socket.io` is easily extensible horizontally by using [redis-adaptor](https://socket.io/docs/v4/redis-adapter/).

#### Conclusion

We **_should not_** consider websocket-api from api-gateway for any serious application, given that we already have good solution from other frameworks.

#### Reference

- https://medium.com/globant/real-time-nodejs-chat-application-using-aws-websocket-and-lambda-71ec20cd2b0b
