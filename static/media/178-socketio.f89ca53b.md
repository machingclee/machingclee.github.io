---
title: "Setup of Express with Socket.io with JWT Authentication Using Cookie"
date: 2023-09-16
id: blog0178
tag: nodejs, express, jwt, socketio
intro: "Basic reivew of API provided by socket.io-client and socket.io in nodejs."
toc: true
---

#### Client Side

##### List of Listeners

```js
export default function WebSocket() {
    const socket = useRef<ReturnType<typeof io> | null>(null);
    const addMessage = (msg: Message) => {
        setMessagesFromServer(msgs => {
            const msgs_ = lodash.cloneDeep(msgs);
            msgs_.push(msg);
            return msgs_;
        })
    }

    const getSocketConnection = () => {
        if (socket.current) {
            return;
        }

        socket.current = io(SOCKET_SERVER, { withCredentials: true });

        socket.current.on("connect", () => {
            addMessage({ sender: "System", msg: "Connected" });
        })

        socket.current.on(MSG_TO_CLIENTS, (data: Message) => {
            addMessage(data);
        })
        socket.current.on("disconnect", (reason) => {
            addMessage({ sender: "disconnect", msg: JSON.stringify(reason) });
        })
        socket.current.on("connect_error", (err) => {
            addMessage({ sender: "connect_error", msg: JSON.stringify(err) });
            // addMessage({ sender: "connect_error", msg: "Closing connection ..." });
            // socket.current?.disconnect();
            // socket.current = null;
        });
        socket.current.io.on("reconnect_attempt", (data) => {
            addMessage({ sender: "reconnect_attempt", msg: String(JSON.stringify(data)) });
        });
        socket.current.io.on("reconnect_error", (error) => {
            addMessage({ sender: "reconnect_error", msg: String(JSON.stringify(error)) });
        });
        socket.current.io.on("reconnect_failed", () => {
            addMessage({ sender: "reconnect_failed", msg: "" });
        });
    }
}
```

##### Error Observation by Adruptly Closing the Server

We can make use of the observations below to determine:

- When should we close the socket connection and

- What error message to display to the client.

![](/assets/tech/178/001.png)

#### Server Side

##### Entrypoint: app.ts

```js
import getMongoConnection from "./db/getMongoConnection";
import expressService from "./service/expressService";

expressService.initExpressApp([
  async () => {
    await getMongoConnection();
  },
]);
```

##### expressService

Here we try to split configuration into separate files, with `configSocketio` the only exception since it does not have api like `app.ws`, for us the configure to `Express` object directly.

```js
import express from "express";
import http from "http";
import configCors from "../config/configCors";
import configParsers from "../config/configParsers";
import configRouting from "../config/configRouting";
import { IORef } from "../dto/types";
import configSocketio from "../config/configSocketio";
import configErrorHandler from "../config/configErrorHandler";
const { PORT } = process.env;

const app = express();
const ioRef: IORef = { current: null };

configCors(app);
configParsers(app);
configRouting(app);
configErrorHandler(app);

const initExpressApp = (callbacks: (() => Promise<void> | void)[]) => {
  const httpServer = http.createServer(app);
  configSocketio(httpServer, ioRef);
  const port = PORT || "8080";
  httpServer.listen(parseInt(port), async () => {
    for (const cb of callbacks) {
      await cb();
    }
    console.log(`App running on port ${port}`);
  });
  return app;
};

const getSocketIo = () => {
  return ioRef;
};

export default {
  initExpressApp,
  getSocketIo,
};
```

##### Mongo Connection

###### getMongoConnection.ts

```js
import mongoose from "mongoose";

let connCache: typeof mongoose;

const { DB_URL } = process.env;

const getMongoConnection = async () => {
  console.log("Connecting to mongo ...");
  if (!DB_URL) {
    throw new Error("DB_URL cannot be found.");
  }
  if (!connCache) {
    console.log("Mongo connected.");
    connCache = await mongoose.connect(DB_URL);
  }
  return connCache;
};

export default getMongoConnection;
```

###### Models (aka Collections)

- **_Users._**

  ```js
  import mongoose, { InferSchemaType, Schema } from "mongoose";

  export const userSchema = new Schema(
    {
      name: { type: String, required: true, index: true },
      email: { type: String, required: true },
      passwordHash: { type: String, required: true },
    },
    {
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
  );

  export type User = InferSchemaType<typeof userSchema>;
  export const UserModel = mongoose.model("User", userSchema);
  ```

- **_ChatRoom._**

  ```js
  import mongoose, { InferSchemaType, Schema } from "mongoose";

  const chatSessionSchema = new Schema(
    {
      code: { type: String, required: true, index: true },
      hostUserOid: { type: String, required: true },
      active: { type: Boolean, require: true },
      members: {
        type: [{ userOid: { type: String, required: true } }],
        default: [],
      },
    },
    {
      timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    }
  );

  export type ChatSession = InferSchemaType<typeof chatSessionSchema>;
  export const ChatSessionModel = mongoose.model(
    "ChatSession",
    chatSessionSchema
  );
  ```

##### Utils for JWT Authentication

###### tokenUtils.ts

```js
import jwt from "jsonwebtoken";
import { User, UserModel } from "../db/models/User";
import { TokenInfo } from "../dto/types";
import { Types } from "mongoose";
const { JWT_SECRET = "", JWS_SALT_ROUNDS = "", JWT_EXPIRE_IN = "" } = process.env;

const getTokenFromUser = (user: User & { _id: Types.ObjectId }): Promise<string> => {
    return new Promise((resolve, reject) => {
        try {
            if (!JWT_SECRET) {
                reject(new Error("jwt secret not found"));
            }
            const data: TokenInfo = {
                userOid: user._id.toString(),
                email: user.email,
                name: user.name
            };

            const token = jwt.sign(
                data,
                JWT_SECRET || "",
                { expiresIn: JWT_EXPIRE_IN }
            );
            resolve(token);
        } catch (err) {
            reject(err);
        }
    });
}

const getUserFromToken = async (token: string) => {
    const decoded = await verifyToken(token) as TokenInfo;
    const userInToken: TokenInfo = decoded;
    return userInToken
}

const verifyToken = (token: string) => {
    return new Promise((resolve, reject) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            resolve(decoded);
        } catch (err) {
            reject(err);
        }
    })

}


export default {
    getTokenFromUser,
    verifyToken,
    getUserFromToken,
}
```

###### hashUtil.ts

```js
import bcrypt from "bcrypt";
const { JWS_SALT_ROUNDS = "0" } = process.env;

const passwordIntoHash = (password: string) => {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, parseInt(JWS_SALT_ROUNDS), (err, hash) => {
      if (err) {
        return reject(err);
      }
      resolve(hash);
    });
  });
};

const comparePasswordWithHash = (password: string, hash: string) => {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

export default {
  passwordIntoHash,
  comparePasswordWithHash,
};
```

##### Middlewares

###### errorMiddleware.ts

```js
import { NextFunction, Request, Response } from "express";

export default (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err) {
    res.json({ success: false, errorMessage: err?.message });
  }
};
```

###### jwtAuthMiddleware.ts <------------ We parse token into req.user here!

```js
import { NextFunction, Request, Response } from "express";
import authUtil from "../util/tokenUtil";
import { User } from "../db/models/User";
import { Token } from "typescript";
import { TokenInfo } from "../dto/types";

export default async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.["token"];
    const user = await authUtil.getUserFromToken(token);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
```

##### Routers

###### authRouter.ts <--------------------- We set cookie here!

```js
import express from "express";
import { UserModel } from "../db/models/User";
import authUtil from "../util/tokenUtil";
import hashUtil from "../util/hashUtil";
import tokenUtil from "../util/tokenUtil";

const authRouter = express.Router();

authRouter.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body as { email: string, password: string };
        const user = await UserModel.findOne({ email }).exec();
        if (user) {
            const { passwordHash } = user;
            const valid = await hashUtil.comparePasswordWithHash(password, passwordHash);
            if (valid) {
                const token = await tokenUtil.getTokenFromUser(user);
                res.cookie("token", token, {
                    httpOnly: true,
                    sameSite: "none",
                    path: "/",
                    secure: true
                });
                res.json({ success: true });
            } else {
                throw new Error("Username or password is incorrect");
            }
        }
    } catch (err) {
        next(err);
    }
});

authRouter.get("/refresh", (req, res) => {
    res.json({ hello: "world" });
});


export default authRouter;
```

###### userRouter

```js
import express, { NextFunction } from "express";
import { UserModel } from "../db/models/User";
import hashUtil from "../util/hashUtil";
import tokenUtil from "../util/tokenUtil";

const userRouter = express.Router();

userRouter.post("/create", async (req, res, next: NextFunction) => {
    try {
        const { email, name, password } = req.body as { email: string, name: string, password: string };
        if (!(email && name && password)) {
            next(new Error("Email, name or password is null"));
        }

        const dbUser = await UserModel.findOne({ email }).exec();
        if (dbUser) {
            next(new Error("User already exists"));
        } else {
            const passwordHash = await hashUtil.passwordIntoHash(password);
            const userDoc = await new UserModel({ email, name, passwordHash });
            const user = await userDoc.save();

            const token = await tokenUtil.getTokenFromUser(user);
            // expiration is controlled by jwtMiddleware.
            res.cookie("token", token);
            res.json({
                success: true,
                message: `User ${name} has been created successfully.`
            });
        }
    } catch (err) {
        next(err);
    }
});

export default userRouter;
```

##### Configuration Files

###### configCors.ts

```js
import { Express } from "express";
import cors, { CorsOptions } from "cors";
const { ALLOWED_ORIGINS } = process.env;

export default (app: Express) => {
  const allowlist = ALLOWED_ORIGINS?.split(",") || [];
  const corsOptionsDelegate = (req: any, callback: any) => {
    let corsOptions: CorsOptions;

    if (allowlist.indexOf(req.header("Origin")) > -1) {
      corsOptions = { origin: true, credentials: true };
    } else {
      corsOptions = { origin: false };
    }
    // callback expects two parameters: (error, options)
    callback(null, corsOptions);
  };

  app.use(cors(corsOptionsDelegate));
};
```

###### configErrorHandler.ts

```js
import errorMiddleware from "../middleware/errorMiddleware";
import { Express } from "express";

export default (app: Express) => {
  app.use(errorMiddleware);
};
```

###### configParsers.ts

```js
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { Express } from "express";

export default (app: Express) => {
  app.use(cookieParser());
  app.use(bodyParser.json());
};
```

###### configRouting.ts

```js
import jwtAuthMiddleware from "../middleware/jwtAuthMiddleware";
import authRouter from "../router/authRouter";
import chatRouter from "../router/chatRouter";
import userRouter from "../router/userRouter";
import { Express } from "express";

export default (app: Express) => {
  app.use("/chat", jwtAuthMiddleware, chatRouter);
  app.use("/user", userRouter);
  app.use("/auth", authRouter);
};
```

##### configSocketio.ts: <---------------------- We parse token here!

- In line-27 our string property `socket.request.headers.cookie` is of the form

  ```text
  "token=#$POJKSDF; sth=abc"
  ```

  Of course we can `.split` by `;` and then `.split` by `=`, trim spaces, set key as ... value as .... As I am lazy, I simply `yarn add cookie` and use it to parse the string.

  ```js-1
  import { Server } from "socket.io";
  import http from "http";
  import { IORef } from "../dto/types";
  const { ALLOWED_ORIGINS } = process.env;
  const allowlist = ALLOWED_ORIGINS?.split(",") || [];
  import cookie from "cookie";
  import tokenUtil from "../util/tokenUtil";

  type Message = { sender: string, msg: string };

  const MSG_FROM_CLIENT = "messageToServer";
  const MSG_TO_CLIENTS = "newMessageToClients";

  export default (httpServer: http.Server, ioRef: IORef) => {
  ```

- Here is the crucial configuration for cookie to work.

  ```js-15
      ioRef.current = new Server(httpServer, {
          cookie: true,
          allowUpgrades: true,
          cors: {
              origin: allowlist,
              methods: ["GET", "POST"],
              credentials: true,
          }
      });
      const io = ioRef.current;
  ```

- Next we take cookie form socket request, the rest will be the standard stuff in any `socket.io` tutorial.

  ```js-25
      io.on("connect", async (socket) => {
          try {
              const cookieString = cookie.parse(socket.request.headers.cookie || "");
              const token = cookieString?.["token"];
              let usernameInDb = "";
              if (token) {
                  const user = await tokenUtil.getUserFromToken(token);
                  usernameInDb = `${user.name}`;
              }

              io?.emit(MSG_TO_CLIENTS, { msg: `${usernameInDb || socket.id} has connected`, sender: "server" } as Message)

              // If info can be found in token represented in cookie, then use that name,
              // otherwise, use a name declared in frontend.
              socket.on(MSG_FROM_CLIENT, ({ sender, msg }: Message) => {
                  io?.emit(MSG_TO_CLIENTS, { sender: usernameInDb || sender, msg });
              })

              socket.on("disconnect", (reason) => {
                  console.log(`${usernameInDb} has disconnected because: ${reason}`)
              })
          }
          catch (error) {
              io.close();
          }
      })
  }
  ```

##### The desc.d.ts for req.user

Since by default there is no `req.user` for `Express.Request` object, we need to declare it in `desc.d.ts`:

```js
export type TokenInfo = {
    userOid: string,
    email: string,
    name: string
}

declare global {
    namespace Express {
        interface Request {
            user?: TokenInfo
        }
    }
}
```

And this special `desc.d.ts` needs to be included as `files` in `tsconfig.json`:

```json
{
  "compilerOptions": {
    ...
  },
  ...
  "files": [
    "src/desc.d.ts"
  ]
}
```
