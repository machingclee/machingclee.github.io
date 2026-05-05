const e=`---
title: "Server Sent Event in Java and Node.js Backend"
date: 2023-09-03
id: blog0157
tag: java, springboot, express, SSE, nodejs
intro: "An introduction to how to effectively create SSE event mimicing the single-thread event loop adopted by nodejs in springboot, and how do we actually implement it in nodejs as well."
toc: true
---

<style>
  img {
    width: 100%
  }
</style>

### Video Demonstration

<Center>
<iframe width="560" height="315" src="https://www.youtube.com/embed/gMSWdAZhupY" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
</Center>
<p></p>
This demonstrated:

- We can send event back to client;
- We can determine whether a client is disconnected.

### Frontend Implementation

We create a \`GET\` request with header \`Content-Type: text/event-stream\` as follows:

\`\`\`ts
import { useState } from "react";
import lodash from "lodash";
import axios from "axios";
export default function SSE() {
  const [msgs, setMsgs] = useState<string[]>([]);

  return (
    <>
      <button
        onClick={() => {
          const evtSource = new EventSource(
            "http://localhost:8080/gmail/event"
          );
          evtSource.addEventListener("message", (event) => {
            console.log("eventevent", event);
            setMsgs((datas) => {
              const datas_ = lodash.cloneDeep(datas);
              const newData = JSON.stringify(event.data);
              datas_.push(newData);
              return datas_;
            });
          });
        }}
      >
        Listen to a stream
      </button>

      <div>
        {msgs.map((msg) => {
          if (msg) {
            return <div>{msg}</div>;
          } else {
            return null;
          }
        })}
      </div>
    </>
  );
}
\`\`\`

### Backend Implementation

#### Springboot

\`\`\`java
@RestController
public class GmailController {
    ...
    @GetMapping(value = "/gmail/event", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @ResponseBody
    public Flux<ServerSentEvent<String>> getEvents() throws InterruptedException {
        return Flux.interval(Duration.ofSeconds(1))
                .map(seq -> {
                    System.out.println("Event Emitted!");
                    var sse = ServerSentEvent.<String>builder()
                            .event("message")
                            // .data(redisTemplate.opsForList().rightPop("mail-queue"))
                            .data("Some Message - " + seq.toString())
                            .build();
                    return sse;
                })
                .doFinally(signalType -> {
                    System.out.println("Disconnected");
                });
    }
}
\`\`\`

- \`Flux.interval\` helps put our \`callback\` into a special queue at which a event loop will constantly look. This is analagous to \`setInterval\` in chrome and nodejs, which place the \`callbacks\` into a special queue and let the event loop to pick up. This is to prevent using single-threaded model to hold and send message to the client.

- Our connection with client will be kept once connected (using other queue), and the thread that takes the request to our controller will be released.

- We should not try to use a \`while\` loop (as in some tutorial) to hold the connection as it will certainly use up the number of threads in our thread pool easily.

- We should return \`Flux<ServerSentEvent<String>>\` instead of \`Flux<String>\` since \`ServerSentEvent\` objects also serve as a heartbeat to tell whether a connection is disconnected or not.

#### Counterpart in Node.js

\`\`\`js
app.get("/sse", async (req: Request, res: Response) => {
  console.log("connected");
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  });

  let i = 0;
  const responseInterval = setInterval(() => {
    console.log("producing message!");
    res.write("event: message\\n");
    res.write(\`data: message item \${i}\\n\`);
    res.write(\`id: \${i}\\n\\n\`);
    i++;
  }, 1000);

  req.on("close", () => {
    console.log("user disconnected");
    clearInterval(responseInterval);
  });
});
\`\`\`

Once we refresh the browser, we can check that the interval is cleared by observing there is no more \`producing message!\`

### Improvement After Actually Turning POC into Real Implementation

#### Result

<Center>
<a href="/assets/tech/157/001.gif" target="_blank">
  <img src="/assets/tech/157/001.gif"/>
</a>
</Center>

#### Frontend

I wrapped the logic of calling SSE in a hook:

\`\`\`ts
// useSSE.ts

import { useEffect, useRef } from "react";
import { SERVER_SENT_EVENT_NOTIFICATION } from "../../axios/api-routes";
import constant from "../../config/constant";
import snackbarUtils from "../../util/snackbarUtils";
import notificationMessage from "../../config/notificationMessage";
import { useAppDispatch } from "../../redux/app/hook";
import applicationSlice from "../../redux/slice/applicationSlice";

// mimic thread.sleep
const sleep = (time: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
};

// define actions for different message from backend
const actions = (data: string, dispatch: ReturnType<typeof useAppDispatch>) => {
  if (data === notificationMessage.FETCH_MAILCHAINS) {
    snackbarUtils.info("Fetching new mailchains");
  } else if (data === notificationMessage.DISPLAY_CONNECTED) {
    dispatch(applicationSlice.actions.updatePushNotificationState(true));
    snackbarUtils.info("Connected for push notification");
  }
};

export default () => {
  const dispatch = useAppDispatch();
  const reconnectionTries = useRef(0);
  useEffect(() => {
    let sse: EventSource | null = null;

    // wait for 2 seconds, since backend will disconnect users once they refresh,
    // avoid racing with backend:
    // refresh -> login -> backend logout due to previous disconnection
    sleep(2000).then(() => {
      try {
        sse = new EventSource(SERVER_SENT_EVENT_NOTIFICATION, {
          withCredentials: true,
        });
      } catch (err) {
        console.log(err);
      }

      if (sse) {
        sse.addEventListener("message", (event) => {
          const data = event.data as string;
          console.log("[data received]", data);
          if (data.startsWith("ERROR")) {
            snackbarUtils.error(data);
          }
          actions(data, dispatch);
        });

        sse.onerror = () => {
          if (reconnectionTries.current < constant.SSE_MAX_RETRY_COUNT) {
            reconnectionTries.current++;
            console.log("err event, retry");
          } else {
            if (sse) {
              console.log(
                \`\${reconnectionTries.current + 1}th attempt, close connection\`
              );
              sse.close();
            }
          }
        };
      }
    });

    return () => {
      if (sse) {
        dispatch(applicationSlice.actions.updatePushNotificationState(false));
        sse.close();
      }
    };
  }, []);
};
\`\`\`

#### Backend

A fake webhook to push notification to all connected users:

\`\`\`java
@GetMapping(value = "/push", produces = { MediaType.APPLICATION_JSON_VALUE })
@ResponseBody
public Document pushNotification() {
    var responses = new ArrayList<Document>();
    Set<String> usersConnected = redisTemplate.opsForSet().members("room");
    for (String userName : usersConnected) {
        String message = NotificationMessage.FETCH_MAILCHAINS;
        var note = new Document();
        note.append("user", userName);
        note.append("message", message);
        responses.add(note);
        redisTemplate.opsForList().leftPush(userName, NotificationMessage.FETCH_MAILCHAINS);
    }
    var res = new Document();
    res.append("success", true);
    res.append("result", responses);
    return res;
}
\`\`\`

Next we implement the data-streaming request which also handles possible exceptions carefully:

\`\`\`java
@Data
private class NotificationDataRef {
    private String errMessage = null;
    private String userName = null;

    public String getUserName() {
        return "notification::" + this.userName;
    }
}
@GetMapping(value = "/notification", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
@ResponseBody
public Flux<ServerSentEvent<String>> getEvents() throws InterruptedException {
    final NotificationDataRef ref = new NotificationDataRef();
    try {
        var user = userService.getCurrentUser();
        String userName = user.getString("user_name");

        ref.setUserName(userName);
        redisTemplate.opsForSet().add("room", ref.getUserName());
        logger.info(String.format("User %s has connected", userName));
    } catch (Exception err) {
        String errMessage = err.getMessage();
        ref.setErrMessage("ERROR:" + errMessage);
        logger.info(errMessage);
    }

    return Flux.interval(Duration.ofSeconds(1))
            .map((seq) -> {
                if (ref.getErrMessage() != null) {
                    return ref.getErrMessage();
                }
                if (seq.equals(Long.valueOf(0))) {
                    return NotificationMessage.DISPLAY_CONNECTED;
                }
                String message = null;
                try {
                    message = redisTemplate.opsForList().rightPop(ref.getUserName());
                    // the poped value will only be constant
                    // defined in NotificationMessage class.
                } catch (Exception err) {
                    message = String.format("ERROR:%s", err.getMessage());
                }
                return message == null ? "" : message;
            })
            .map(message -> ServerSentEvent.<String>builder()
                    .event("message")
                    .data(message)
                    .build())
            .takeUntil((event) -> {
                String message = event.data();
                Boolean errorExists = message.startsWith("ERROR");
                if (errorExists) {
                    logger.info(message);
                }
                return errorExists;
            })
            .doFinally(signalType -> {
                redisTemplate.opsForSet().remove("room", ref.getUserName());
                redisTemplate.delete(ref.getUserName());
                logger.info(String.format("%s has disconnected", ref.getUserName()));
            });
}
\`\`\`

- When backend received a message started with \`ERROR\`, it will close the connection, in this way we handle the error gracefully.
- When frontend received a message started with \`ERROR\`, this message will be logged in the frontend.
- Due to closure of the connection from backend, our frontend will try serveral times and \`close()\` the connection when retry count reaches its maximum.
`;export{e as default};
