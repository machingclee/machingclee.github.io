const e=`---
title: "Code Organization for RabbitMQ"
date: 2024-03-03
id: blog0236
tag: rabbitMQ, message-broker, nodejs
intro: "The concept of message queue is easy but writing them can easily be messy due to boilerplate code, we summarize how to organize them into a MessageQueue class."
toc: true
---

<style>
  img {
    max-width: 660px
  }
</style>

### Queues Fundamentals

\`\`\`ts
// Service A (Producer)
async function serviceA() {
    const channel = await connection.createChannel();
    await channel.assertExchange('orders_exchange', 'topic');
    
    // Only publishes, doesn't need to know about queues
    channel.publish('orders_exchange', 'order.created', 
        Buffer.from('new order'));
}

// Service B (Consumer)
async function serviceB() {
    const channel = await connection.createChannel();
    await channel.assertExchange('orders_exchange', 'topic');
    await channel.assertQueue('order_processing_queue');
    await channel.bindQueue('order_processing_queue', 'orders_exchange', 
        'order.created');
    
    channel.consume('order_processing_queue', msg => {
        // Process order
    });
}
\`\`\`

### Queues Structure

[![](/assets/img/2024-03-02-23-57-02.png)](/assets/img/2024-03-02-23-57-02.png)


### File Structure

![](/assets/img/2024-01-28-00-46-02.png)

Let's explore these files one by one.

#### QueueName.ts

\`\`\`js
enum QueueName {
    LLM_SUMMARY_STEP = "LLM_SUMMARY_STEP",
    LLM_TRANSLATION_STEP = "LLM_TRANSLATION_STEP",
    LLM_REPLY_STEP = "LLM_REPLY_STEP",
    INSERT_ALGOLIOA = "INSERT_ALGOLIOA",
    UPDATE_ALGOLIA = "UPDATE_ALGOLIA",
    FLASK_EXCEL_GENERATION = "FLASK_EXCEL_GENERATION",
    SNOOZE_AND_PIN = "SNOOZE_AND_PIN",
    SNOOZE_AND_PIN_DEAD_LETTER = "SNOOZE_AND_PIN_DEAD_LETTER",
    EXPORT_REPORT = "EXPORT_REPORT",
    LLM_USAGE_LOG = "LLM_USAGE_LOG",
    LLM_IMPACT_UPDATE = "LLM_IMPACT_UPDATE"
}

export default QueueName;
\`\`\`

#### RoutingKey.ts

\`\`\`js
enum QueueName {
    LLM_SUMMARY_STEP = "LLM_SUMMARY_STEP",
    LLM_TRANSLATION_STEP = "LLM_TRANSLATION_STEP",
    LLM_REPLY_STEP = "LLMREPLY_STEP",
    INSERT_ALGOLIOA = "INSERT_ALGOLIOA",
    UPDATE_ALGOLIA = "UPDATE_ALGOLIA",
    FLASK_EXCEL_GENERATION = "FLASK_EXCEL_GENERATION",
    SNOOZE_AND_PIN = "SNOOZE_AND_PIN",
    SNOOZE_AND_PIN_DEAD_LETTER = "SNOOZE_AND_PIN_DEAD_LETTER",
    EXPORT_REPORT = "EXPORT_REPORT",
    LLM_USAGE_LOG = "LLM_USAGE_LOG",
    LLM_IMPACT_UPDATE = "LLM_IMPACT_UPDATE"
}

export default QueueName;
\`\`\`

#### channels.ts

\`\`\`js
import amqplib, { Channel, Replies } from "amqplib";
import logger from "../util/logger";
import QueueName from "./QueueName";
import queueBinding from "./queueBinding";

const AMQP_URL = process.env.AMQP_URL || ""

export const NORMAL_EXCHANGE = "Billie"
export const GENERAL_DEAD_EXCHANGE = "GENERAL_DEAD_EXCHANGE"

const Q_CAPACITY = Number(process.env.Q_CAPACITY || "10");

type ChannelRef = { current: Channel | null };

const llmTaskChannelRef: ChannelRef = { current: null };
const normalTaskChanenlRef: ChannelRef = { current: null };


const getLLMTaskChannel = () => llmTaskChannelRef.current;
const getNormalTaskChannel = () => normalTaskChanenlRef.current;

const queues: { [k in QueueName]?: Replies.AssertQueue } = {};

const getQueue = (queueName: QueueName) => queues?.[queueName];

const initChannels = async (consumptions: (() => void)[]) => {
    // create channels
    const connection = await amqplib.connect(AMQP_URL);
    const llmTaskChannel = await connection.createChannel();
    const normalTaskChannel = await connection.createChannel();

    llmTaskChannel.prefetch(Q_CAPACITY);
    llmTaskChannelRef.current = llmTaskChannel;
    normalTaskChanenlRef.current = normalTaskChannel;

    try {
        await llmTaskChannel.assertExchange(NORMAL_EXCHANGE, "direct", { durable: true });
        await llmTaskChannel.assertExchange(GENERAL_DEAD_EXCHANGE, "direct", { durable: true });
    } catch (err) {
        console.log(err);
    }

    await queueBinding({ queues, llmTaskChannel, normalTaskChannel });

    for (const consumption of consumptions) {
        consumption();
    }

    logger.info("Channels Inited")
}

export default {
    getQueue,
    getLLMTaskChannel,
    getNormalTaskChannel,
    initChannels
}
\`\`\`

- Here \`queueBinding\` and \`consumptions\` are the most important components of our queue system.

#### queueBinding.ts

\`\`\`js
import { Channel, Replies } from "amqplib";
import QueueName from "./QueueName";
import RoutingKey from "./RoutingKey";
import { GENERAL_DEAD_EXCHANGE, NORMAL_EXCHANGE } from "./channels";
const SNOOZE_PIN_TTL = Number(process.env.SNOOZE_PIN_TTL || "604800000");

type KeyBindingConfig<Q, R> = {
    queueName: Q
    routingKey: R,
    channel: Channel,
    exchange: string,
    deadLetter?: {
        deadLetterExchange?: string,
        deadLetterRoutingKey?: R,
        messageTtl?: number
    }
}

const bind = async (
    queues: { [key in QueueName]?: Replies.AssertQueue },
    config: KeyBindingConfig<QueueName, RoutingKey>
) => {
    const { channel, queueName, exchange, routingKey,
        deadLetter = {}
    } = config;
    const q = await channel.assertQueue(queueName, {
        durable: true,
        ...deadLetter
    });
    queues[queueName] = q;
    await channel.bindQueue(queueName, exchange, routingKey);
}

const queueBinding = async (args: {
    queues: { [key in QueueName]?: Replies.AssertQueue },
    llmTaskChannel: Channel,
    normalTaskChannel: Channel
}) => {
    const { queues, llmTaskChannel, normalTaskChannel } = args;

    const queueConfigs: KeyBindingConfig<QueueName, RoutingKey>[] = [
        {
            queueName: QueueName.LLM_SUMMARY_STEP,
            routingKey: RoutingKey.LLM_SUMMARY_STEP,
            channel: llmTaskChannel,
            exchange: NORMAL_EXCHANGE
        },
        {
            queueName: QueueName.LLM_TRANSLATION_STEP,
            routingKey: RoutingKey.LLM_TRANSLATION_STEP,
            channel: llmTaskChannel,
            exchange: NORMAL_EXCHANGE
        },
        {
            queueName: QueueName.LLM_REPLY_STEP,
            routingKey: RoutingKey.LLM_REPLY_STEP,
            channel: llmTaskChannel,
            exchange: NORMAL_EXCHANGE
        },
        {
            queueName: QueueName.SNOOZE_AND_PIN,
            routingKey: RoutingKey.SNOOZE_AND_PIN,
            channel: normalTaskChannel,
            exchange: NORMAL_EXCHANGE,
            deadLetter: {
                deadLetterExchange: GENERAL_DEAD_EXCHANGE,
                deadLetterRoutingKey: RoutingKey.SNOOZE_AND_PIN_DEAD_LETTER,
                messageTtl: SNOOZE_PIN_TTL
            }
        },
        {
            queueName: QueueName.SNOOZE_AND_PIN_DEAD_LETTER,
            routingKey: RoutingKey.SNOOZE_AND_PIN_DEAD_LETTER,
            channel: normalTaskChannel,
            exchange: GENERAL_DEAD_EXCHANGE,
        },
        {
            queueName: QueueName.INSERT_ALGOLIOA,
            routingKey: RoutingKey.INSERT_ALGOLIOA,
            channel: normalTaskChannel,
            exchange: NORMAL_EXCHANGE,
        },
        {
            queueName: QueueName.UPDATE_ALGOLIA,
            routingKey: RoutingKey.UPDATE_ALGOLIA,
            channel: normalTaskChannel,
            exchange: NORMAL_EXCHANGE,
        },
        {
            queueName: QueueName.FLASK_EXCEL_GENERATION,
            routingKey: RoutingKey.FLASK_EXCEL_GENERATION,
            channel: normalTaskChannel,
            exchange: NORMAL_EXCHANGE,
        },
        {
            queueName: QueueName.EXPORT_REPORT,
            routingKey: RoutingKey.EXPORT_REPORT,
            channel: normalTaskChannel,
            exchange: NORMAL_EXCHANGE,
        },
        {
            queueName: QueueName.LLM_USAGE_LOG,
            routingKey: RoutingKey.LLM_USAGE_LOG,
            channel: normalTaskChannel,
            exchange: NORMAL_EXCHANGE
        },
        {
            queueName: QueueName.LLM_IMPACT_UPDATE,
            routingKey: RoutingKey.LLM_IMPACT_UPDATE,
            channel: normalTaskChannel,
            exchange: NORMAL_EXCHANGE
        }
    ]

    for (const queueConfig of queueConfigs) {
        await bind(queues, queueConfig);
    }
}

export default queueBinding;
\`\`\`

#### consumptions.ts

\`\`\`js
import llmSummaryQueue from "./llmSummaryQueue";
import algoliaUpdateQueue from "./algoliaUpdateQueue";
import excelGenReqToFlaskQueue from "./excelGenReqToFlaskQueue";
import llmReplyQueue from "./llmReplyQueues";
import llmTranslationQueue from "./llmTranslationQueue";
import llmUsageLogQueue from "./llmUsageLogQueues";
import snoozeAndPinDeadLetterQueue from "./snoozeAndPinDeadLetterQueue";
import snoozeAndPinQueue from "./snoozeAndPinQueue";
import llmImpactUpdateQueue from "./llmImpactUpdateQueue";

export default [
  algoliaUpdateQueue.initConsumption,
  excelGenReqToFlaskQueue.initConsumption,
  llmReplyQueue.initConsumption,
  llmSummaryQueue.initConsumption,
  llmTranslationQueue.initConsumption,
  llmUsageLogQueue.initConsumption,
  snoozeAndPinDeadLetterQueue.initConsumption,
  // snoozeAndPinQueue.initConsumption,  <---- don't add this 
  llmImpactUpdateQueue.initConsumption,
];
\`\`\`

\`initConsumption\` is a method of our custom \`MessageQueue\` class which simplify our code by templating the boilerplate code:

#### MessageQueue Class (model/MessageQueue.ts)

\`\`\`js
import { Channel } from "amqplib";
import { MessageErrorModel } from "../../db/mongo/models/MessageErrorLog";
import gmailService from "../../service/gmailService";
import logger from "../../util/logger";
import QueueName from "../QueueName";
import RoutingKey from "../RoutingKey";
import channels, { NORMAL_EXCHANGE } from "../channels";

const ERROR_EMAIL_RECEIVER = process.env.ERROR_EMAIL_RECEIVER;
const env = process.env.env;

export default class MessageQueue<MessageType> {
    private queueName: QueueName;
    private routingKey: RoutingKey;
    private channel: () => (Channel | null);
    private exchange = NORMAL_EXCHANGE;
    public consumption?: (decoded: MessageType) => void | Promise<void>;

    constructor(args: {
        queueName: QueueName,
        routingKey: RoutingKey,
        channel: () => (Channel | null),
        consumption?: (decoded: MessageType) => void | Promise<void>,
        exchange?: string
    }) {
        const { exchange = NORMAL_EXCHANGE } = args
        this.queueName = args.queueName;
        this.routingKey = args.routingKey;
        this.channel = args.channel;
        this.consumption = args.consumption;
        this.exchange = exchange;
    }

    public publish = (msg: MessageType) => {
        const refinedMsg = msg as MessageType & { routingKey: RoutingKey };
        refinedMsg.routingKey = this.routingKey;
        const msg_ = JSON.stringify(refinedMsg);

        this.channel()?.publish(
            this.exchange,
            this.routingKey,
            Buffer.from(msg_)
        );
    }

    public initConsumption = () => {
        const q = channels.getQueue(this.queueName);
        if (!this.channel()) {
            throw new Error(\`llmTaskChannel cannot be established\`);
        }
        if (!q) {
            throw new Error(\` q: \${this.routingKey} cannot be established\`);
        }
        this.channel()?.consume(q.queue, (msg) => {
            const msg_ = msg?.content.toString();
            const decodedMsg: MessageType = JSON.parse(msg_ || '{ "message": "msg_ is null" }');
            if (!msg?.content) {
                logger.info("null message");
                return;
            }
            try {
                logger.info(\`[\${this.routingKey}]: processing msg \${msg_}\`)
                const result = this.consumption?.(decodedMsg);
                if (result instanceof Promise) {
                    // synchronous call cannot catch the error thrown inside a promise.
                    result
                        .then(() => {
                            this.channel()?.ack(msg);
                        }).catch(err => {
                            const errorLog = new MessageErrorModel({
                                msg: {
                                    err: err?.message || "",
                                    step: (decodedMsg as { routingKey?: string }).routingKey || "",
                                    param: decodedMsg
                                }
                            })
                            gmailService.sendEmail({
                                to: ERROR_EMAIL_RECEIVER || "",
                                html: \`<div>
                        <div>Error Message:
                            <p/>
                            <div>
                                \${JSON.stringify(decodedMsg, null, 2)}
                            </div>
                            <p>The same message is also logged in mongodb.</p>
                        </div>\`,
                                subject: \`Error message from \${env?.toUpperCase()} environment\`,
                                text: \`Error message from \${env?.toUpperCase()} environment\`
                            })
                            errorLog.save().then(() => {
                                this.channel()?.nack(msg, false, false);
                            })
                        });
                } else {
                    this.channel()?.ack(msg);
                }
            } catch (err) {
                const errorLog = new MessageErrorModel({
                    msg: {
                        err: (err as { message?: string })?.message || "",
                        step: (decodedMsg as { routingKey?: string }).routingKey || "",
                        param: decodedMsg
                    }
                })
                gmailService.sendEmail({
                    to: ERROR_EMAIL_RECEIVER || "",
                    html: \`<div>
                        <div>Error Message:
                            <p/>
                            <div>
                                \${JSON.stringify(decodedMsg, null, 2)}
                            </div>
                            <p>The same message is also logged in mongodb.</p>
                        </div>\`,
                    subject: \`Error message from \${env?.toUpperCase()} environment\`,
                    text: \`Error message from \${env?.toUpperCase()} environment\`
                })
                errorLog.save().then(() => {
                    this.channel()?.nack(msg, false, false);
                })
            }
        }, { noAck: false });
    }
}
\`\`\`

- Here the \`try-catch\` logic seems a bit repetitive.
- But note that a normal \`try-catch\` would not catch the error thrown inside a promise, therefore we need to repeatedly catch the error.
- Here we reject a message by either throwing an error explicitly (for example, we might want to try catch to execute custom logging logic, and then throw the error again)
- or by letting the program throw any error.

### Example of Queues

Note that by using \`MessageQueue\` class we can pay all our attention to writing \`consumption\` logic.

#### Normal Task Queue
##### excelGenReqToFlaskQueue

\`\`\`js
import LLMStatus from "../../constants/LLMStatus";
import { db } from "../../db/kysely/database";

import { MessageErrorModel } from "../../db/mongo/models/MessageErrorLog";
import { SummaryLangChoice } from "../../dto/dto";
import chatService from "../../service/chatService";
import RedisUtil from "../../util/RedisUtil";
import QueueName from "../QueueName";
import RoutingKey from "../RoutingKey";
import channels from "../channels";
import MessageQueue from "../model/MessageQueue";

const llmTaskChannel = () => channels.getLLMTaskChannel();

const excelGenReqToFlaskQueue = new MessageQueue<{
    roomId: string, lang: SummaryLangChoice
}>({
    channel: llmTaskChannel,
    queueName: QueueName.FLASK_EXCEL_GENERATION,
    routingKey: RoutingKey.FLASK_EXCEL_GENERATION,
    consumption: async (decoded) => {
        const { lang, roomId } = decoded;
        try {
            await chatService.dispatchExcelGenerationTaskToFlask(roomId, lang);
            await RedisUtil.setLLMStatus(roomId, LLMStatus.FINISHED);
        } catch (err) {
            const errorLog = new MessageErrorModel({
                msg: {
                    err: err,
                    step: "excelGenReqToFlaskQueue",
                    param: decoded
                }
            })
            // only session will use this excel generation function
            await db.updateTable("MessagesSession")
                .set({ isLiveEnded: false }).where("MessagesSession.id", "=", roomId).execute();
            await errorLog.save();
            RedisUtil.setLLMStatus(roomId, LLMStatus.FAILED);
            throw err;
        }
    }
})

export default excelGenReqToFlaskQueue;
\`\`\`

#### Dead-Letter Queues

##### snoozeAndPinQueue.ts

Note that this queue is supposed to be a delayed task queue, ***no consumption should be inited***. Otherwise we have to at least \`ack\`, \`nack\`, \`reject\` which violates our purpose to let the message expire automatically.

\`\`\`js
import { SnoozeAndPinMessage } from "../../dto/dto";
import QueueName from "../QueueName";
import RoutingKey from "../RoutingKey";
import channels from "../channels";
import MessageQueue from "../model/MessageQueue";

const normalTaskChannel = () => channels.getNormalTaskChannel();

const snoozeAndPinQueue =  new MessageQueue<SnoozeAndPinMessage> ({
    channel: normalTaskChannel,
    queueName: QueueName.SNOOZE_AND_PIN,
    routingKey: RoutingKey.SNOOZE_AND_PIN,
});

export default snoozeAndPinQueue;
\`\`\`
Here we have leave the \`consumption\` field empty and we have not put it inside the list of  \`consumptions.ts\`.

##### snoozeAndPinDeadLetterQueue.ts

According to our configuration in \`queueBinding.ts\`, after \`SNOOZE_PIN_TTL\` ms, the message from \`QueueName.SNOOZE_AND_PIN\` will be redirected to \`RoutingKey.SNOOZE_AND_PIN_DEAD_LETTER\` via \`GENERAL_DEAD_EXCHANGE\` exchange.

\`\`\`js
import nonDraftsCache from "../../caching/nonDraftsCache";
import { db } from "../../db/kysely/database";
import { SnoozeAndPinMessage } from "../../dto/dto";
import QueueName from "../QueueName";
import RoutingKey from "../RoutingKey";
import channels from "../channels";
import MessageQueue from "../model/MessageQueue";

const normalTaskChannel = () => channels.getNormalTaskChannel();

const snoozeAndPinDeadLetterQueue = new MessageQueue<SnoozeAndPinMessage>({
    channel: normalTaskChannel,
    queueName: QueueName.SNOOZE_AND_PIN_DEAD_LETTER,
    routingKey: RoutingKey.SNOOZE_AND_PIN_DEAD_LETTER,
    consumption: async (decoded) => {
        const { sessionId, channelId, isAdmin } = decoded;
        await db.updateTable("MessagesSession")
            .set({
                prioritizedOrSnoozedAt: 0,
                sortingTimestamp: eb => eb.selectFrom("MessagesSession as NewSession")
                    .select("NewSession.createdAt")
                    .where("NewSession.id", "=", sessionId)
            })
            .where("MessagesSession.id", "=", sessionId)
            .execute();

        const { customClearCache } = nonDraftsCache.setCacheKey({ channelId, isAdmin });
        await customClearCache();
    }
});

export default snoozeAndPinDeadLetterQueue;
\`\`\`
`;export{e as default};
