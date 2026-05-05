const e=`---
title: "Scaling Websocket Chat Sever by Redis"
date: 2023-09-20
id: blog0181
tag: redis, web-socket, nodejs
intro: "We study how to scale up the chat services horizontally by Redis."
toc: false
---

<style>
    img {
        max-width: 100%
    }
</style>

- Architecture:

  [![](/assets/tech/181/001.png)](/assets/tech/181/001.png)

- Each of the \`u_k\`'s connects to web-socket server as normal.

- For each of \`ws_k\`'s, they still rely on \`room\`'s for publishing messages within a group of sockets.

- Same \`room\` can repeatedly appears in each of the socket servers.

  - For example, \`room_1\` can appear in both \`ws_1\` and \`ws_2\`.
  - \`u_1\` join \`room_1\` via \`ws_1\` and \`u_2\` join \`room_1\` via \`ws_2\`.

- **_Fun part._** Now each of the \`ws_k\` servers registers \`publish\` and \`subscribe\` listeners to \`redis\` server.

  Note that the following code can be executed right before \`app.listen()\`.

  \`\`\`js-1
  // ws_k
  // pubsubWithIo.ts
  // to be run right before \`app.listen()\`;

  import redis from "redis";

  const subscriber = redis.createClient({
    port: 6379,
    host: redis_url,
  });

  export const publisher = redis.createClient({
    port: 6379,
    host: redis_url,
  });
  \`\`\`

  \`\`\`js-16
  const io = getIoSingletonFromSomewhere();

  subscriber.on("subscribe", function (channel, count) {
    // do something, or even omit this listener
  });

  export type Message = {
    namespace: string,
    roomCode: string,
    msg:{ sender:string, text: string }
  }
  subscriber.on("message", function (_channel: string, message: Message) {
    try {
      const { namespace, roomCode, msg } = message;
      io.of(namespace).to(roomCode).emit("MSG_TO_CLIENTS", msg);
    } catch (err) {
      consol.log(err);
    }
  });

  subscriber.subscribe("livechat");
  \`\`\`

  Finally we also have a publish event, this is supposed to be wrapped inside a post request:

  \`\`\`js
  // ws_k

  import { publisher, Message } from \`some/where/pubsubWithIo\`;
  ...
  router.post("/some-outer-route", async (req, res) => {
    const msg = req.body as Message;
    publisher.publish("livechat", msg);
    res.json({ success: true });
  });
  \`\`\`

- Now we easily scaled up the a chat server!

### Referenece

- [Scaling Websockets with Redis, HAProxy and Node JS - High-availability Group Chat Application](https://www.youtube.com/watch?v=gzIcGhJC8hA&t=920s)
- [Understanding Redis Pub/Sub (Getting Started)](https://www.youtube.com/watch?v=KIFA_fFzSbo&t=449s)
`;export{e as default};
