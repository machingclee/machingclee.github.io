const e=`---
title: "ApplicationEventPublisher with Decorators for Domain Driven Design"
date: 2024-11-09
id: blog0338
tag: typescript, decorators
toc: true
intro: "In the past we have introduced an applicationEventPublisher, this time we introduce decorators to further simplify the code!"
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Result (Code Simplification)

<center>
<a href="/assets/img/2024-11-10-00-21-57.png">
  <img src="/assets/img/2024-11-10-00-21-57.png">
</a>
</center>
<center>Code Simplified!</center>

### Preface 
#### From a previous blog post
In [this article](/blog/article/Application-Event-Publisher-for-Monolithic-DDD-in-Nodejs) we have implemented 
- an \`ApplicationEventPublisher\` and 
- \`addEventHandler\` that essentially adds a \`eventName\` to \`(() => Promise<void>)[]\` pair
In this article we aim at simplifying it as in the result image above, which looks exactly the same as how spring boot works without any boilerplate code.

####  \`compilerOptions\` of \`tsconfig.json\`
\`\`\`json{3,4}
  "compilerOptions": {
    "target": "ES2015",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    ...
  }
\`\`\`
#### Stage-3 or Stage-2 Decorators?
As of now (2024-11-09) the development of decorators in javascript has reached \`stage3\` with ***breaking changes*** from \`stage2\`. 

The npm package \`reflect-metadata\` that returns the \`reflection\` of the metadata of \`class\` and \`class-method\` relies heavily on \`stage2\`-decorators  and therefore we have to set:
- \`--experimentalDecorators\` and 
- \`--emitDecoratorMetadata\` 
to ensure we are using \`stage2\`-decorators.



### decorators.ts with a simple example

#### The imports and Constants


\`\`\`js
import "reflect-metadata"

export type ListenerMetadata = {
    methodName: string;
    handler: Function;
    eventName: string;
    order: number;
    nextEvent: string
}

export const NEXT_LISTENER_METADATA_KEY = "nextListener";
export const LISTENER_METADATA_KEY = "listeners";
const LISTENER_ORDER_KEY = "order"
\`\`\`
- \`reflect-metadata\` is used to get the metadata of classes and methods inside of a \`decorator function\`. 

- \`LISTENER_METADATA_KEY\` and \`LISTENER_ORDER_KEY\` defines the \`key\` for setting a \`key-value\` pair whose value is to be the metadata of a class, or a method.

- As we shall see later, when we want to store \`method\` level data, we use 
  \`\`\`js
  Reflect.defineMetadata(LISTENER_ORDER_KEY, methodLevelData, target, propertyKey);
  \`\`\`
  where \`target\` is the class, \`propertyKey\` is the name of a method, the tuple 
  \`\`\`js
  (LISTENER_METADATA_KEY, class, methodname)
  \`\`\`
  defines a key for the \`methodLevelMetaData\`.

- Similarly, when we want to store \`class\` level data, we use
  \`\`\`js
  Reflect.defineMetadata(LISTENER_METADATA_KEY, classLevelData, target.constructor);
  \`\`\`
  where \`(LISTENER_METADATA_KEY, target.constructor)\` defines a key for the \`classLevelMetaData\`.
  
  It should be clear \`target\` is the \`class\`-Object in this context.





#### @order
\`\`\`js
export function order(order: number) {
    return function (...args: any[]) {
        const [target, propertyKey, descriptor] = args;
        Reflect.defineMetadata(LISTENER_ORDER_KEY, order, target, propertyKey);
        return descriptor;
    };
}
\`\`\`

#### @nextEvent
\`\`\`js
export function nextEvent(nextClass: Function) {
    return function (...args:any[]) {
        const [target, propertyKey] = args;
        Reflect.defineMetadata(NEXT_LISTENER_METADATA_KEY, nextClass, target, propertyKey);
    };
}
\`\`\`


#### @listener
\`\`\`js
export function listener(...args: any[]) {
    const [target, propertyKey, descriptor] = args;
    const eventName = Reflect.getMetadata("design:paramtypes", target, propertyKey)[0].name;
    const existingListeners: ListenerMetadata[] =
        Reflect.getMetadata(LISTENER_METADATA_KEY, target.constructor) || [];
    const order: number = Reflect.getMetadata(LISTENER_ORDER_KEY, target, propertyKey) || 0;
    const nextEvent = (Reflect.getMetadata(NEXT_LISTENER_METADATA_KEY, target, propertyKey)?.name || "") as string ;
    

    existingListeners.push({
        methodName: propertyKey.toString(),
        handler: descriptor.value!,
        eventName: eventName,
        order,
        nextEvent
    });

    Reflect.defineMetadata(LISTENER_METADATA_KEY, existingListeners, target.constructor);

    return descriptor;
}
\`\`\`

Note that we have added \`order\` and \`nextEvent\` here, which means that \`@order\` and \`@nextEvent\` should be executed ***before*** \`@listener\`, this is achieved by 

\`\`\`js
    @listener
    @order(1)               // or   @nextEvent(NextEvent)
    @nextEvent(NextEvent)   //      @order(1)
    async someMethod() {
        ...
    }
\`\`\`
because decorators are executed in ***bottom-up*** manner.

#### Let's print out the metadata

\`\`\`js
// Test
class InputParam { }
class AnotherParam { }

class Example {
    // decorator executes from bottom to top
    @listener
    @order(1)
    method1(param: InputParam) {
        console.log("Method 1:", param);
    }
    @listener
    @order(2)
    method2(param: AnotherParam) {
        console.log("Method 2:", param);
    }
}

class BetterExample extends InputParam {}

const listeners: ListenerMetadata[] = Reflect.getMetadata(LISTENER_METADATA_KEY, Example);
console.log(listeners);
\`\`\`
We get the following listeners' metadata:
\`\`\`js
[
  {
    methodName: 'method1',
    handler: [Function: method1],
    eventName: 'InputParam',
    order: 1
  },
  {
    methodName: 'method2',
    handler: [Function: method2],
    eventName: 'AnotherParam',
    order: 2
  }
]
\`\`\`
This provides all enough information to register listeners to the events.


### Simplified applicationEventPublisher and ApplicationEvent



\`\`\`js-1
import { db } from "@src/db/kysely/database";

export type ContextBaseType = {
    userEmail: string
}

export class ApplicationEvent<
    DataType,
    ContextType extends ContextBaseType = ContextBaseType,
> {
    constructor(public data: DataType, public ctx: ContextType) { }
}
\`\`\`
- Unlike [previous post](/blog/article/Application-Event-Publisher-for-Monolithic-DDD-in-Nodejs) in \`ApplicationEvent\` we have replaced \`ResultType\` by \`ContextType\`. 

- This \`Context\` is supposed to be ***shared by all events*** within a cycle (those that would be chained together). 

  Imagine a fallback loop (starts from \`SomethingFailedEvent\`) would be infinite, we need some value in the context to stop us from retrying indefinitely.


\`\`\`js-15{31-34}
export type EventHandler<Event = any> = (event: Event) => void | Promise<void>;
type OrderedEventHandler<Event = any> = { handle: EventHandler<Event>; order: number };

class ApplicationEventPublisher {
    private handlers: Map<string, OrderedEventHandler[]> = new Map<string, OrderedEventHandler[]>();

    constructor() {
    }

    async publishEvent<D, C extends ContextBaseType>(event: ApplicationEvent<D, C>): Promise<void> {
        const eventName = Object.getPrototypeOf(event).constructor.name as string;
        const handlers = this?.handlers?.get(eventName)?.sort((a, b) => a.order - b.order);
        if (handlers) {
            for (const handler of handlers) {
                const handle = handler.handle as EventHandler<typeof event>;
                await handle(event);
                await db.insertInto("event_store").values({
                    event_type: eventName,
                    payload: { data: event.data, ctx: event.ctx }
                }).execute();
            }
        }
    }

    addEventListener = <T>(evenType: string, handler: EventHandler<T>, order: number = 1): void => {
        if (!this.handlers.has(evenType)) {
            this.handlers.set(evenType, []);
        }
        this.handlers.get(evenType)!.push({ handle: handler, order });
    };
}

export const applicationEventPublisher = new ApplicationEventPublisher();
export default ApplicationEventPublisher;
\`\`\`
The highlighted block of codes is responsible for storing historical event data. Storing into memory-store such as \`redis\` and flush it back to our PostgreSQL by bulk insert is much more appropriate.

### Class DecoratedListenersRegister: Register the decorated listeners
#### The \`register\` method

By the previous concrete example (the \`console.log(listeners);\` in the previous section right above) the \`register\` method is straight forward:

\`\`\`js-1
export default class DecoratedListenersRegister {
    private listenersRecord: ListenerMetadata[] = [];

    register(listenerClass: Object) {
        const listeners: ListenerMetadata[] = Reflect.getMetadata(
            LISTENER_METADATA_KEY,
            listenerClass
        );

        for (const listener of listeners) {
            // nextEvent is not used here, we add it here to remind
            // the readers we have this value available!
            const { nextEvent, methodName, eventName, handler, order } = listener
            this.listenersRecord.push(listener)
            applicationEventPublisher.addEventListener(
                eventName,
                handler as EventHandler<any>,
                order
            )
        }
    }

\`\`\`
#### The \`plotRelation\` method

##### Implementation of \`plotRelation\`

- We will make use of the \`Node\` for doubly linked list defined in [***this blog post***](/blog/article/Doubly-Linked-List-in-Typescirpt).

- Since our services are decomposed into many small events, some may consider the services as highly-decoupled to the extent that is hard to follow. 

- One solution is to add @nextEvent(NextEvent) attribute to indicate the \`NextEvent\` class to be the next target, from that we can plot the relation for easy-debugging (and also see all the events available in the system!)

- Let's make use of the \`nextEvent\` property to chain all the connected events. 

> **Disclaimer 1.** I am ***not*** proficient in data-structure and algorithm, I am using doubly-linked list just because I feel that \`appendLeft\` and \`appendRight\` should be  appropriate methods for connecting separated "events" ($A\\to B$ and $B\\to C$ into $A\\to B\\to C$, for example)

> **Disclaimer 2.** The following \`for\`-loops may produce redundancies, any improvement to reduce unnecessary loops is welcome. 

\`\`\`js-23 
    plotRelation() {
        const items = this.listenersRecord.map(item => new Node({ data: item, uuid: uuidv4() }))
        const results: Node<{ data: ListenerMetadata, uuid: string }>[] = [];
        const freezedNodes = Object.freeze(cloneDeep(items));
        // don't mutate freezedNodes as we need to loop through completely
        for (const currNode of freezedNodes) {
            for (let j = 0; j < freezedNodes.length; j++) {
                for (const connectedItem of currNode.traverse()) {
                    const eventNamesToSkip = currNode.traverse().map(node => node.value.data.eventName);
                    for (const traverseItem of freezedNodes) {
                        if (!eventNamesToSkip.includes(traverseItem.value.data.eventName)) {
                            if (traverseItem.value.data.nextEvent === connectedItem.value.data.eventName) {
                                connectedItem.appendLeft(traverseItem);
                                const removeIndex = items.findIndex(item => item.value.uuid === traverseItem.value.uuid);
                                items.splice(removeIndex, 1);
                            }
                            else if (connectedItem.value.data.nextEvent === traverseItem.value.data.eventName) {
                                connectedItem.appendRight(traverseItem);
                                const removeIndex = items.findIndex(item => item.value.uuid === traverseItem.value.uuid);
                                items.splice(removeIndex, 1);
                            }
                        }
                    }
                }
            }
            const shouldIgnore = results
                .map(node => node.getHead().value.data.eventName)
                .includes(currNode.getHead().value.data.eventName)
            if (!shouldIgnore) {
                results.push(currNode);
            }
        }

        const lifeyCycles: string[] = [];
        for (const item of results) {
            let eventLifeCycle = "Start --> ";
            const events = item.getHead().traverse();
            events.forEach((node, i) => {
                const { eventName, nextEvent, methodName } = node.value.data;
                const nextEventNode = freezedNodes.find(n => n.value.data.eventName === nextEvent);
                const nextMethodName = nextEventNode?.value.data.methodName || ""
                if (i === 0) {
                    eventLifeCycle += \`\${eventName} (\${methodName})\`;
                    if (nextEvent) {
                        eventLifeCycle += \`\\n      --> \${nextEvent} (\${nextMethodName})\`
                    }
                } else {
                    if (nextEvent) {
                        eventLifeCycle += \`\\n      --> \${nextEvent} (\${nextMethodName})\`
                    }
                }
            })
            if (events.length === 1) {
                eventLifeCycle += " --> End"
            } else {
                eventLifeCycle += "\\n      --> End"
            }
            lifeyCycles.push(eventLifeCycle);
        }

        const eventsRelation = lifeyCycles.join("\\n");
        return eventsRelation;
    }
}
\`\`\`

##### The result of visualized event-cycles

\`\`\`text
Start --> IssueSummaryUuidRelationInsertedEvent (insertRelIssueToSummaryUuid) --> End
Start --> WalkOpenedEvent (openWalkOn) --> End
Start --> WalkClosedEvent (closeWalkOn) --> End
Start --> IssueUpdatedEvent (updateIssueOn) --> End
Start --> LLMSummaryPlaceholderCreatedEvent (createLLMPlaceHolderOn) --> End
Start --> LLMSummaryStep1GenerationCommand (generateFreshLLMSummaryOn)
      --> LLMSummaryStep2TranslateAndSaveCommand (transateAndSaveFreshSummaryOn)
      --> LLMSummaryStep3GeneateAndSendExcelCommand (generateAndSendExcelOn)
      --> End
Start --> LLMSyncToAzureCommand (syncToAzureOn) --> End
Start --> LLMSummaryRegenerationCommand (regenerateSummaryOn) --> End
Start --> TranslateAndSaveRegeneratedSummaryCommand (translateAndSaveRegeneratedSummaryOn) --> End
\`\`\``;export{e as default};
