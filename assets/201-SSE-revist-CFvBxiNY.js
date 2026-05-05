const n=`---
title: "Push Data to Frontend by SSE via Event-Driven Approach with NO Short Polling"
date: 2023-10-22
id: blog0201
tag: react, react-native, nodejs, express, SSE
intro: "In the past we have discussed SSE by kind of short polling in the backend (keep looping to see whether a key has message to pop out in redis queue). This time we send messages to frontend by listening subscriptions on EventEmitter, an approach very native to languages in which \`channel\` is implemented, like \`go\` and \`rust\`."
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

### Stream-Reponse Result:

<center>
  <video controls width="400">
    <source  src="/assets/tech/201/001.mov" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  </video>
</center>

### Usages

#### Frontend

In my app when I leave a room, I will send an SSE event to the backend, trigger excel file geneation of the room and get the status from event stream:

\`\`\`js
const leave = () => {
    dispatch(appSlice.actions.closeAppDialog());
    setTimeout(() => {
        router.replace("/(billie)/");

        SSE.createSSE({
        eventSource: apiRoutes.GET_SSE_EXCEL_STATUS(roomOid),
        token: token,
        subscriptions: [
            {
            key: "EXCEL_STATUS",
            action: (data: string) => {
                dispatch(
                chatSlice.actions.setRoomExcelStatusOnLeave({
                    roomOid,
                    status: data,
                })
                );
            },
            },
        ],
        endEvent: {
            key: "EXCEL_STATUS_END",
        }});
    }, 300);
};
\`\`\`

When the backend sends an \`endEventKey\`, we will close our \`sse\` instance.

#### Backend

Suppose that I have an SSE \`GET\` route that has the following controller:

\`\`\`js
export const getExcel = async (req: Request, res: Response) => {
    const excelStatusChannel = new SSEChannel({
        eventEmitter: chatService.Cache.eventEmitter,
        channelKey: \`EXCEL_STATUS_\${req.user?.userOid || ""}\`,
        SSEMsgKey: "EXCEL_STATUS",
        SSEEndKey: "EXCEL_STATUS_END",
        res: res
    });
    const ssePublisher = excelStatusChannel.getSSEPublisher();

    const { roomOid } = req.params;
    if (ssePublisher) {
        await chatService.generateSaveAndSendExcelReport(roomOid, ssePublisher);
    }
}
\`\`\`

- Note that we also pass a \`WriteStream\` \`res\` into \`SSE\` channel so that
- later our \`ssePublisher\` can write a stream-response to end the channel (see \`ssePublisher.closeChannel()\`, which executes \`killChannel()\` from \`SSEChannel\`).

Next the final function call is:

\`\`\`js
const generateSaveAndSendExcelReport = async (
  roomOid: string,
  ssePublisher: SSEChannelPublisher
) => {
  await requestAndSaveLLMSummaryFromRoomOid(roomOid, ssePublisher);
  const { excelUrl, room } = await dispatchExcelGenerationTaskToFlask(
    roomOid,
    ssePublisher
  );
  ssePublisher.emit("Finished");
  ssePublisher.closeChannel();

  await sendEmail({ room, excelUrl });
};
\`\`\`

Each of \`requestAndSaveLLMSummaryFromRoomOid\` and \`dispatchExcelGenerationTaskToFlask\` has a \`setInterval\` to publish messages to frontend by using \`ssePublisher.emit("something")\`.

### Code Implementation

- Here we assume access token is passed by header.
- In case the reader uses cookie to pass token, we just need to modify the function call of the constructor of \`Eventsource\` to use \`withCredential: true\` as an option.

#### On SSE Request Header

Default \`EventSource\` in \`react\` and \`react-native\` does not provide any option to pass headers via the \`new EventSource()\` constructor. We need additional package to replace the native one.

- For \`react\`, we use [eventsource](https://www.npmjs.com/package/eventsource)
- For \`react-native\` we use [react-native-event-source](https://www.npmjs.com/package/react-native-event-source)

#### Custom SSE Class:

\`\`\`js
// util/SSE.ts

const SSE_MAX_RETRY_COUNT = 5
import Eventsource from "react-native-event-source";

export const sseStore: { current: SSE | null } = { current: null };

type SSEProps = {
    eventSource: string,
    subscriptions: { key: string, action: (data: string) => void }[],
    endEvent: { key: string } | null,
    token: string,
}

class SSE {
    private reconnectionTries: number = 0
    private eventSource: SSEProps["eventSource"] = ""
    private subscriptions: SSEProps["subscriptions"] = []
    private endEvent: SSEProps["endEvent"] = null
    private sse: Eventsource | null = null;
    private token: string = "";

    constructor(params: SSEProps) {
        const { endEvent, eventSource, subscriptions, token } = params;
        this.eventSource = eventSource;
        this.subscriptions = subscriptions;
        this.endEvent = endEvent
        this.token = token;
    }

    public close = () => {
        this.sse?.close();
    }

    public subscribe = () => {
        try {
            this.sse = new Eventsource(this.eventSource, {
                headers: {
                    "Authorization": "Bearer " + this.token,
                }
            });
        } catch (err) {
            console.log(err);
        }
        if (!this.sse) {
            return;
        }

        // listen to all subscriptions
        this.subscriptions.forEach((event) => {
            const { action, key } = event;
            this.sse!.addEventListener(key, (event) => {
                const data = event.data as string;
                action(data);
            });
        })

        // listen to the only Kill Subscription Event Key
        if (this.endEvent) {
            this.sse.addEventListener(this.endEvent.key, () => {
                this.sse!.close();
            });
        }

        // handle connection error if any
        this.sse.addEventListener("error", () => {
            if (this.reconnectionTries < SSE_MAX_RETRY_COUNT) {
                this.reconnectionTries++;
                console.log("err event, retry");
            } else {
                if (this.sse) {
                    console.log(
                        \`\${this.reconnectionTries + 1}th attempt, close connection\`
                    );
                    this.sse.close();
                }
            }
        })
    }
}

const createSSE = (props: SSEProps) => {
    if (sseStore.current) {
        sseStore.current.close();
    }
    sseStore.current = new SSE(props);
    sseStore.current.subscribe();
};

const closeSSE = () => {
    sseStore.current?.close();
    sseStore.current = null;
}

export default {
    createSSE,
    closeSSE
};
\`\`\`

#### Code Implementation: SSEChannel class and SSEChannelPublisher class

Let's fix a cached \`EventEmitter\` instance. Let's identify each **_event emission key_** as a **_channel_**.

\`\`\`js
// util/SSEChannel.ts

import { Response } from "express";
import { EventEmitter, Writable } from "stream";
import logger from "./logger";
import chatService from "../service/chatService";


export class SSEChannelPublisher {
    private channelKey = "";
    private killChannel = () => { };

    constructor(props: {
        channelKey: string,
        killChannel: () => void
    }) {
        this.channelKey = props.channelKey;
        this.killChannel = props.killChannel;
    }

    public closeChannel = () => {
        this.killChannel();
        chatService.Cache.eventEmitter.removeAllListeners(this.channelKey);
    }

    public emit = (data: string) => {
        chatService.Cache.eventEmitter.emit(this.channelKey, data)
    }
}


type ChannelProps = {
    res: Response,
    eventEmitter: EventEmitter,
    channelKey: string
    SSEMsgKey: string
    SSEEndKey: string
}

/**
 * SSE specific Pub/Sub, the behaviour of our subscription is fixed, we just create publisher.
 */
class SSEChannel {
    private channelOption: ChannelProps | null = null;
    private channelEmitter: EventEmitter | null = null;
    private eventId: number = 0;

    constructor(props: ChannelProps) {
        this.channelOption = props;
        this.channelEmitter = this.channelOption.eventEmitter;
        this.listen();
    }

    private killChannel = () => {
        logger.info("Killing the channel ...");
        this.writeMessage({ message: "", SSEMsgKey: this.channelOption?.SSEEndKey || "" });
        this.channelEmitter?.removeAllListeners(this.channelOption?.channelKey || "");
    }

    public getSSEMsgKey = () => {
        return this.channelOption?.SSEMsgKey || "";
    }

    public getSSEPublisher = () => {
        return new SSEChannelPublisher({
            channelKey: this.channelOption?.channelKey || "",
            killChannel: this.killChannel
        });
    }

    private writeMessage = (props: { SSEMsgKey: string, message: string }) => {
        const res = this.channelOption?.res;
        if (!res) {
            return;
        }
        this.eventId++;
        const { SSEMsgKey: frontendKey, message } = props;
        res.write(\`event: \${frontendKey}\\n\`);
        res.write(\`data: \${message}\\n\`);
        res.write(\`id: \${this.eventId}\\n\\n\`);
    }

    public listen = () => {
        const res = this.channelOption?.res;
        if (!res) {
            return;
        }
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
        });

        const { channelKey, SSEMsgKey } = this.channelOption!;
        this.channelEmitter!.removeAllListeners(channelKey);

        this.channelEmitter!.on(
            channelKey,
            (message: string) => {
                logger.info(\`Pushing Status \${message} to frontend\`);
                this.writeMessage({ SSEMsgKey, message });
            }
        );
    }
}

export default SSEChannel;



\`\`\`
`;export{n as default};
