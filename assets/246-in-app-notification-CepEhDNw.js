const n=`---
title: "In-App Notification"
date: 2024-03-14
id: blog0246
tag: sql
intro: "We record how to implement in-app notification which consequently makes caching much more effective and flexible."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Table Design


We divide notifications into two types:

#### IndividualUserNotification

- This one contains all user-specific data, it is only viewable by the user who requests it. 

- Without that, we would have to sub-query all the data using an \`userId\`, making an API non-cachable.

- \`IndividualUserNotificationType\` indicates the ***notification purpose*** of that notification. 

  - For example, type: \`NEW_ISSUE\`  means that we want to notify \`userEmail\` there is a new issue. 

    **Which issue is it?** According to business logic, which is the issue corr. to \`sessionId\`.

  - Similarly, type: \`NEW_CHANNEL_TO_JOIN\` means that we want to notify \`userEmail\` there is a new channel available.

    **Which channel is it?** Which is the channel corr. to \`channelId\`.
  


\`\`\`prisma 
enum IndividualUserNotificationType {
    NEW_ISSUE
    NEW_LLM_REPLY
    NEW_DRAFT
    NEW_CHANNEL_TO_JOIN
    SESSION_NEW_LIVE
    SESSION_NEW_LIVE_REPLY
    ASSIGNED_AS_FOLLOWER
    WATCH
}

model IndividualUserNotification {
    id              Int                            @id @default(autoincrement())
    type            IndividualUserNotificationType
    sessionId       String?                        @db.Uuid
    channelId       String?                        @db.Uuid
    userEmail       String
    createdAt       Float                          @default(dbgenerated("gen_created_at()"))
    createdAtHK     String                         @default(dbgenerated("gen_created_at_hk_timestr()"))
    
    @@index([userEmail, type])
}
\`\`\`

#### GlobalNotification

- This one contains data that is viewable ***whenever a user has certain right***, it is like a real-time status.

- For example, when a \`Live\` is held currently but not ended inside a channel, we notify all people there is an  \`ONGOING_LIVE\` status.

- We don't treat this as \`IndividualUserNotification\` because it needs a \`userEmail\`, but the status \`ONGOING_LIVE\` can be viewed even if a user join the channel much later than the \`Live\` is held.

- This notification should not have target user as the ***notification target is uncertain at any time*** .

\`\`\`prisma 
enum GlobalNotificationType {
    ONGOING_LIVE
}

model GlobalNotification {
    id          Int                    @id @default(autoincrement())
    type        GlobalNotificationType
    channelId   String?                @db.Uuid
    Channel     Channel?               @relation(fields: [channelId], references: [id], onDelete: Cascade)
    createdAt   Float                  @default(dbgenerated("gen_created_at()"))
    createdAtHK String                 @default(dbgenerated("gen_created_at_hk_timestr()"))
}
\`\`\`

### Backend Notification Design:



#### What to Receive in Frontend?


- First of all we need to know from business logic:

  $\\text{Project}\\xrightarrow{\\text{many}}\\text{Channel}\\xrightarrow{\\text{many}}\\text{Session}$

- Therefore each channel-notification must have a parent \`projectId\`. 

- Simiarly, each session-notification must have a \`channelId\` and \`projectId\`.

- We prototype the frontend notification data as follows:

  \`\`\`js
  export type IndividualType = {
      channel: "NEW_CHANNEL_TO_JOIN"
      session: "NEW_ISSUE"
      | "NEW_LLM_REPLY"
      | "NEW_DRAFT"
      | "SESSION_NEW_LIVE"
      | "SESSION_NEW_LIVE_REPLY"
      | "ASSIGNED_AS_FOLLOWER"
      | "WATCH"
  }

  export type GlobalNotificationType = "ONGOING_LIVE"

  export type InappNotification = {
      global?: {
          channels: {
              [projectId in string]?: {
                  [channelId in string]?: {
                      [type in GlobalNotificationType]?: number
                  }
              }
          }
      },
      individual?: {
          channels: {
              [projectId in string]?: {
                  [channelId in string]?: {
                      [type in IndividualType["channel"]]?: number
                  }
              }
          },
          sessions: {
              [projectId in string]?: {
                  [channelId in string]?: {
                      [sessionId in string]?: {
                          [type in IndividualType["session"]]?: number
                      }
                  }
              }
          }
      }
  }
  \`\`\`

#### How Frontend Consume the Data?

We store the data inside \`state.inappNotification\` of some slice.

\`\`\`js
...
const notification = useAppSelector(s => s.chat
  .inappNotification
  ?.individual
  ?.sessions
  ?.[selectedProjectId]
  ?.[selectedChannelId]
  ?.[roomId]
);

const numOfNotification = (() => {
    if (type === "LIVE") {
        if (isLiveEnded) {
            return notification?.NEW_LLM_REPLY;
        } else {
            if (notification?.SESSION_NEW_LIVE) {
                // this specialCount is -1, indicating NEW
                return NotificationSpecialCount.NEW; 
            }
            else {
                return notification?.SESSION_NEW_LIVE_REPLY
            }
        }
    } else {
        if (notification?.NEW_ISSUE) {
            return NotificationSpecialCount.NEW;
        } else {
            return notification?.NEW_LLM_REPLY
        }
    }
})();
...
\`\`\`


#### Backend Handler that Responses Desired Prototype
##### General Idea


The general idea is to form an object that contains all the notification.

- **Notification Due to Session Level Information.**

  \`\`\`json
  {
    [projectId] : {
      [channelId]: {
        [sessionId]: {
          NEW_ISSUE: 1
          NEW_DRAFT: 3
          ...
        }
      }
    }
  }
  \`\`\`
- **Notification Due to Channel Level Information.**
  \`\`\`json
  {
    [projectId] : {
      [channelId]: {
        NEW_CHANNEL: 1
      }
    }
  }
  \`\`\`

##### Code Implementation

This is a little bit long processing. 

Since we want to get all data in one single query. If it is hard to read, it is suggested to separate individual notifications into two separate queries for channels and for sessions respectively.

\`\`\`js-1
const getInappNotifications = async (req: Request, res: Response) => {
    const userEmail = req.user?.email || "";

    // this is a fixed array of notification types that is suppose to be "session notification"
    const individualSession: IndividualUserNotification["type"][] = [
        "ASSIGNED_AS_FOLLOWER",
        "NEW_DRAFT",
        "NEW_ISSUE",
        "NEW_LLM_REPLY",
        "SESSION_NEW_LIVE",
        "SESSION_NEW_LIVE_REPLY",
        "WATCH"
    ];
    // that to be "channel notification"
    const individualChannel: IndividualUserNotification["type"][] = [
        "NEW_CHANNEL_TO_JOIN"
    ];

    const [globalChannelsResult, notificationBySessionsResult] = await Promise.all([
    db.selectFrom("GlobalNotification")
        .leftJoin("UserToChannel", "UserToChannel.channelId", "GlobalNotification.channelId")
        .leftJoin("Channel", "Channel.id", "GlobalNotification.channelId")
        .leftJoin("Project", "Project.id", "Channel.projectId")
        .select([
            "GlobalNotification.type",
            "GlobalNotification.channelId",
            "Project.id as projectId"
        ])
        .where("UserToChannel.userEmail", "=", userEmail)
        .execute(),
\`\`\`
In the follwoing query we make the following aliases:

- \`NotificationChannel\` = channel being notified
- \`NotificationSessionChannel\` =  the channel of the session being notified
- \`NotificationProject\` = project being notified
- \`NotificationSessionProject\` = project of session being notified (forget to add Notification at the prefix)

This will introduce sparsities (nulls) to each selected row.

Just recall that project contains many channel, channel contains many messagesSession, then the nullity check will make sense


In frontend each session, channel and project will calculate what notification to show based on these informations
\`\`\`js-31
    db.selectFrom("IndividualUserNotification")
        .leftJoin("MessagesSession", "MessagesSession.id", "IndividualUserNotification.sessionId")
        .leftJoin("Channel as NotificationChannel", "NotificationChannel.id", "IndividualUserNotification.channelId")
        .leftJoin("Channel as NotificationSessionChannel", "NotificationSessionChannel.id", "MessagesSession.channelId")
        .leftJoin("Project as NotificationChannelProject", "NotificationChannelProject.id", "NotificationChannel.projectId")
        .leftJoin("Project as NotificationSessionProject", "NotificationSessionProject.id", "NotificationSessionChannel.projectId")
        .select([
            "IndividualUserNotification.sessionId as sessionId",
            "IndividualUserNotification.type as notificationType",
            "NotificationSessionChannel.id as notificationSessionChannelId",
            "NotificationChannel.id as notificationChannelId",
            "NotificationChannelProject.id as notificationChannelProjectId",
            "NotificationSessionProject.id as notificationSessionProjectId"
        ])
        .where("IndividualUserNotification.userEmail", "=", userEmail)
        .execute()
    ])
    const globalChannels: {
        [projectId in string]?: {
            [channelId in string]?: {
                [type in GlobalNotification["type"]]?: number
            }
        }
    } = {};

    const notificationByChannels: {
        [projectId in string]?: {
            [channelId in string]?: {
                [type in IndividualUserNotification["type"]]?: number
            }
        }
    } = {};

    const notificationBySessions: {
        [sectionId in string]?: {
            [projectId in string]?: {
                [channelId in string]?: {
                    [sessionId in string]?: { [type in IndividualUserNotification["type"]]?: number }
                }
            }
        }
    } = {};

    // set global channels notifications
    for (const result of globalChannelsResult) {
        const { channelId = "", type = "", projectId = "" } = result;
        if (projectId && channelId && type) {
            const key = \`[\${projectId}][\${channelId}][\${type}]\`;
            const count = lodash.get(globalChannels, key, 0) as number;
            lodash.set(globalChannels, key, count + 1);
        }
    }

    // set individual sessions and channels notifications
    for (const result of notificationBySessionsResult) {
        const {
            notificationChannelId = "",
            notificationSessionChannelId = "",
            notificationType,
            notificationChannelProjectId = "",
            notificationSessionProjectId = "",
            sessionId = ""
        } = result;

        if (!notificationType) {
            continue;
        }
        if (individualChannel.includes(notificationType)) {
            if (notificationChannelProjectId && notificationChannelId && notificationType) {
                const key = \`[\${notificationChannelProjectId}][\${notificationChannelId}][\${notificationType}]\`;
                const count = lodash.get(notificationByChannels, key, 0) as number;
                lodash.set(notificationByChannels, key, count + 1);
            }
        }
        if (individualSession.includes(notificationType)) {
            if (notificationSessionProjectId && notificationSessionChannelId && sessionId && notificationType) {
                const key = \`[\${notificationSessionProjectId}][\${notificationSessionChannelId}][\${sessionId}][\${notificationType}]\`;
                const count = lodash.get(notificationBySessions, key, 0) as number;
                lodash.set(notificationBySessions, key, count + 1);
            }
        }
    }

    res.json({
        success: true,
        result: {
            global: {
                channels: globalChannels
            },
            individual: {
                channels: notificationByChannels,
                sessions: notificationBySessions
            }
        }
    })
}
\`\`\`

### Sample from Real Data

\`\`\`js
{
  global: {
    channels: {
      "018e3606-3293-fce9-2f55-49f61657b978": {
        "018e3624-aead-6e5f-86c4-87b4bceaf83e": {
          ONGOING_LIVE: 4,
        },
      },
      "018def71-630f-4767-2e78-0f0b9f7360a6": {
        "018e3975-20be-40d6-2318-6db03ca7a23d": {
          ONGOING_LIVE: 2,
        },
      },
      "018e39e2-2a2e-2b20-2762-65943cddad3b": {
        "018e39fd-2cd2-bb83-6676-be150087df97": {
          ONGOING_LIVE: 1,
        },
      },
    },
  },
  individual: {
    channels: {
    },
    sessions: {
      "018def71-630f-4767-2e78-0f0b9f7360a6": {
        "018e3975-20be-40d6-2318-6db03ca7a23d": {
          "018e3975-4fa0-0f04-3ba0-f57b7925f8c3": {
            WATCH: 1,
          },
        },
        "018e1877-2588-c90d-8688-623edd8282cd": {
          "018e2e0e-241e-97c1-5dfe-59a09157e350": {
            NEW_DRAFT: 1,
          },
        },
        "018e2e0d-bc74-dbf2-1ea8-3786b974267d": {
          "018e2e31-4b1a-a468-cd91-d6c1b95539fe": {
            NEW_DRAFT: 1,
          },
          "018e2e59-8f93-3a4b-3270-dd4338468d2a": {
            NEW_DRAFT: 1,
          },
          "018e2e0f-2c06-a0d4-289f-2a0752af6dde": {
            NEW_DRAFT: 1,
          },
        },
      },
      "018e39e2-2a2e-2b20-2762-65943cddad3b": {
        "018e39fd-2cd2-bb83-6676-be150087df97": {
          "018e3fed-bda5-ceab-1334-01c89e14b315": {
            SESSION_NEW_LIVE: 1,
          },
          "018e3fec-4d53-d9bd-b991-820552aba584": {
            NEW_ISSUE: 1,
            ASSIGNED_AS_FOLLOWER: 1,
          },
          "018e3f48-177f-2a78-ec95-09be41ca76a1": {
            NEW_ISSUE: 2,
          },
        },
      },
      "018e39c6-4a23-dcaa-cebf-2a22e9842dd6": {
        "018e39c6-dca4-e263-6dfd-b82a002c7ace": {
          "018e39c6-ed70-868e-44c2-26e0500241e2": {
            WATCH: 1,
          },
          "018e3c22-450a-06d8-00a0-f2bb56324c82": {
            WATCH: 1,
          },
        },
      },
      "018e3606-3293-fce9-2f55-49f61657b978": {
        "018e3624-aead-6e5f-86c4-87b4bceaf83e": {
          "018e3fed-5323-24cb-6f60-eff184f31f2b": {
            SESSION_NEW_LIVE: 1,
          },
          "018e4095-6879-eec7-3187-a4e4165283e4": {
            NEW_ISSUE: 1,
          },
          "018e3f4c-4c18-dcac-69b4-10d8c307abb0": {
            NEW_ISSUE: 1,
          },
        },
      },
    },
  },
}
\`\`\``;export{n as default};
