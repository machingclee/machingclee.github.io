const n=`---
title: "AWS Websocket-API 2: Complete Integration of React and Spring Boot using Websocket-API from API-Gateway"
date: 2025-03-22
id: blog0377
tag: web-socket, aws
toc: true
intro: "We discuss a reliable approach to connect websocket api from api-gateway."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Set up Websocket API from API Gateway

We have a quick guide on how to use the websocket api here:

- [_Websocket-API from API-Gateway_](/blog/article/Websocket-API-from-API-Gateway)

However, raw websocket api is highly unreliable, especially without \`socket.io\` we need robust mechanism to handle socket reconnection and retry on error. Luckily there is already a popular library:

### npm package: \`reconnecting-websocket\`

Let's

\`\`\`text
yarn add reconnecting-websocket
\`\`\`

#### Set up Ping Route

We need to send data to websocket api regularly on a 9-minutes basis as any idle connection can only be kept for at most 10 minutes.

For that, we define an endpoint to send dummy data:

![](/assets/img/2025-03-24-03-36-39.png)

the dummy data will be

\`\`\`ts
const pingMessage = JSON.stringify({
  action: "ping",
  content: "ping",
});
\`\`\`

and it will be processed by our lambda function (configured when we create that route):

![](/assets/img/2025-03-24-03-32-24.png)

whereas the lambda function is as simple as:

\`\`\`ts
export const handler = async (event) => {
  const response = {
    statusCode: 200,
    body: "pong",
  };
  return response;
};
\`\`\`

#### Set up Route and functions to save and remove connectionId of websocket

##### $connect

In the following we delegate the persistence of \`connectionId\` to our own backend:

\`\`\`ts
// lambda function for connection

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const userId = event.queryStringParameters.userId;
  const platform = event.queryStringParameters.platform;
  await insert(userId, connectionId, platform);
  return { statusCode: 200, body: "Connected." };
};

const insert = async (userId, connectionId, platform) => {
  const url = "https://my-own-domain:8080/gateway-websocket/connect";
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: userId,
      connectionId: connectionId,
      platform: platform,
    }),
  });
};
\`\`\`

Note that we can provide \`queryStringParameters\` when we make a websocket connection to the endpoint:

\`\`\`ts
const url = \`\${webSocketURL}?userId=\${userId}&platform=\${platform}\`;
// new WebSocket(url)
new ReconnectingWebSocket(url);
\`\`\`

Here \`ReconnectingWebSocket\` is an enhanced version of \`Websocket\` that will be imported in section [#ReconnectingWebSocket].

##### $disconnect

Again we delegate the disconnection (removal of \`connectionId\` from our database) to our own domain:

\`\`\`tsx
// lambda function for disconnection

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  await deleteConnection(connectionId);
  return { statusCode: 200, body: "disConnected." };
};

const deleteConnection = async (connectionId) => {
  try {
    const response = await fetch(
      \`https://my-own-domain:8080/gateway-websocket/disconnect/\${connectionId}\`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Error:", error);
  }
};
\`\`\`

### Receive Data from Frontend (React)

#### Define a custom hook to initiate websocket connection {#ReconnectingWebSocket}

\`\`\`tsx-1{54}
import ReconnectingWebSocket from "reconnecting-websocket"

const useAWSGatewaySocket = (newCallbacks: { callback: (data: AllWSResponses) => void }[]) => {
    const webSocketURL = process.env.VITE_SOCKET_URL
    const callbackDataRef = useRef(newCallbacks)
    const userId = useAppSelector((s) => s.auth.userId)
    const socketRef = useRef<ReconnectingWebSocket | null>(null)
    const dispatch = useAppDispatch()
    const setChatSocketConnectionStatus = (on: boolean, socketId: string) => {
        dispatch(chatSlice.actions.updateChatSocket({ on, socketId }))
    }
    const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null)
    const HEARTBEAT_INTERVAL = 540000 // 9 minutes in milliseconds

    const getSocketConnection = async (userId: string) => {
        try {
            if (!userId) {
                return
            }
            if (socketRef.current) {
                return
            }
            const rws = new ReconnectingWebSocket(\`\${webSocketURL}?userId=\${userId}&platform=pc\`)
            socketRef.current = rws

            const pingMessage = JSON.stringify({
                action: "ping",
                content: "ping",
            })

            socketRef.current.onerror = (e) => {
                dispatch(appSlice.actions.setIsConnected(false))
            }

            socketRef.current.onopen = (e) => {
                console.log("websocket connected")
                dispatch(appSlice.actions.setIsConnected(true))
                if (heartbeatInterval.current) {
                    clearInterval(heartbeatInterval.current)
                }
                heartbeatInterval.current = setInterval(() => {
                    if (rws.readyState === WebSocket.OPEN) {
                        rws.send(pingMessage)
                        console.log("Heartbeat sent")
                    }
                }, HEARTBEAT_INTERVAL)
            }

            socketRef.current.addEventListener("message", (e: MessageEvent<string>) => {
                // the content in callbackDataRef is ever-changing,
                // based on the state change passing into the useAWSGatewaySocket hook.
                // we use useEffect to update the content in callbackDataRef
                try {
                    const parsedData = JSON.parse(e?.data || "{}") as Payload
                    callbackDataRef.current.forEach(({ callback }) => {
                        callback(parsedData)
                    })
                } catch (err) {
                    console.error("websocket incoming event parsing error", err, e)
                }
            })
        } catch (err) {
            socketRef.current = null
            __DEV__ && msgUtil.tmpError(JSON.stringify(err))
        }
    }

    // only disconnect when the component is unmounted
    useEffect(() => {
        console.log("userId changed", userId)
        if (userId) {
            getSocketConnection(userId)
        }
        if (!userId) {
            socketRef.current?.close()
            socketRef.current = null
        }
    }, [userId])

    useEffect(() => {
        callbackDataRef.current = newCallbacks
    }, [newCallbacks])

    return { socketRef }
\`\`\`

#### Listeners for incoming socket messages

Note that \`useAWSGatewaySocket\` accepts parameter: \`(newCallbacks: { callback: (data: Payload) => void }[])\`, we can register the listeners as follow:

\`\`\`ts
const someState = ...
useAWSGatewaySocket([
    {
        callback: (payload) => {
            if (payload.type === SomeKey1) {
                // do something to payload.data
            }
        },
    },
    {
        callback: (payload) => {
            if (payload.type === SomeKey2) {
                // do something to payload.data
            }
        },
    },
    {
        callback: (payload) => {
            if (payload.type === SomeKey2) {
                // this will update the listener when someState changed
                if (someState === "Something") {
                    // do something to payload.data
                }
            }
        },
    }
])
\`\`\`

- We need to agree the type definition of \`payload.data\` with backend developers.

- Note that by this approach we didn't pass a closure to \`socketRef.current.addEventListener\`, any state change will directly change the listeners to handle socket messages.

- Therefore our application can behaviour dynamically with different app states.

### Send Data from Backend (Kotlin)

There are plenty of examples in nodejs, let's study an example in Kotlin.

#### Dependencies

\`\`\`kotlin
// build.gradle

dependencies {
  implementation(platform("aws.sdk.kotlin:bom:1.0.48"))
  implementation("aws.sdk.kotlin:apigatewaymanagementapi")
  implementation("aws.sdk.kotlin:aws-core")
  implementation("aws.smithy.kotlin:http-client-engine-okhttp4:1.3.30")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-jdk8:1.7.3")
  ...
}
\`\`\`

#### Bean for \`ApiGatewayManagementClient\`

\`\`\`kotlin
import aws.sdk.kotlin.services.apigatewaymanagementapi.ApiGatewayManagementClient
import aws.smithy.kotlin.runtime.net.url.Url
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import aws.smithy.kotlin.runtime.http.engine.okhttp4.OkHttp4Engine

@Configuration
class ApiGatewayManagementApiClientConfig(
    @Value("\\\${socket.endpoint}") private val socketEndpoint: String,
    @Value("\\\${socket.aws-region}") private val awsRegion: String,
) {
    @Bean
    fun createClient(): ApiGatewayManagementClient {
        return ApiGatewayManagementClient {
            this.endpointUrl = Url.parse(socketEndpoint)
            this.region = awsRegion
            this.httpClient = OkHttp4Engine()
        }
    }
}
\`\`\`

#### WebsocketNotificationService

\`\`\`kotlin
data class SocketMessage(
    val connectionId: String,
    val payload: Payload
) {
  data class Payload(
    val type: String,
    val data: SomeType
  )
}

@Service
class WebsocketNotificationService(
    private val apiGatewayClient: ApiGatewayManagementClient,
) {
    private val logger = KotlinLogging.logger {}
    private val gson = Gson()

    suspend fun sendMessageToConnection(socketMessage: SocketMessage) {
        val (connectionId, payload) = socketMessage
        val request = PostToConnectionRequest {
            this.connectionId = connectionId
            this.data = gson.toJson(payload).toByteArray()
        }
        apiGatewayClient.postToConnection(request)
    }
}
\`\`\`

Back to highlighted line 54 in _Define a custom hook to initiate websocket connection_ section we have

\`\`\`ts
type Payload = { type: string; data: any };
const parsedData = JSON.parse(e?.data || "{}") as Payload;
\`\`\`

This \`e?.data\` is exactly (if exists) the json string of \`Payload\` object from kotlin side.
`;export{n as default};
