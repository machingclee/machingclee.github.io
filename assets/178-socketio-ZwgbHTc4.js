const e=`---
title: "Setup of Express with Socket.io with JWT Authentication Using Cookie"
date: 2023-09-16
id: blog0178
tag: nodejs, express, jwt, web-socket
intro: "Basic reivew of API provided by socket.io-client and socket.io in nodejs."
toc: true
---

### Client Side

#### List of Listeners

\`\`\`js
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
            // note that if a user is disconnected actively by server (like no token is found)
            // the reason will be "io server disconnect"
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
\`\`\`

#### Error Observation by Adruptly Closing the Server

We can make use of the observations below to determine:

- When should we close the socket connection and

- What error message to display to the client.

![](/assets/tech/178/001.png)

### Server Side

#### Entrypoint: app.ts

\`\`\`js
import getMongoConnection from "./db/getMongoConnection";
import expressService from "./service/expressService";

expressService.initExpressApp([
  async () => {
    await getMongoConnection();
  },
]);
\`\`\`

#### Servics

##### expressService.ts

Here we try to split configuration into separate files, with \`configSocketio\` the only exception since it does not have api like \`app.ws\` for us the configure to \`Express\` object directly.

\`\`\`js
import express from "express";
import "express-async-errors";
import http from "http";
import configCors from "../config/configCors";
import configParsers from "../config/configParsers";
import configRouting from "../config/configRouting";
import { IORef } from "../dto/types";
import configSocketio from "../config/configSocketio";
import configErrorHandler from "../config/configErrorHandler";
const { PORT } = process.env;

const app = express();
const ioRef: IORef = { current: undefined };

app.set("trust proxy", 1);
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
    console.log(\`App running on port \${port}\`);
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
\`\`\`

##### socketService.ts

- Since each user should have at most one socket connecting to the server, we use a \`Map\` object \`socketStore\` to store the correspondence between \`userOid\` and \`socket\`.

- We will plug the \`socket\` object into \`req: Express.Request\` in the middleware \`socketioMiddleware\` below.

- Then the controllers in \`chatRouter\` can get access to user's socket (as well as the server side \`io\` object).

\`\`\`js
import { Socket } from "socket.io";
import expressService from "./expressService"
import { DefaultEventsMap } from "socket.io/dist/typed-events";


const socketStore = new Map<string, Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>>();

const saveSocket = (uuid: string, socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) => {
    socketStore.set(uuid, socket);
};

const getSocket = (userOid: string) => {
    console.log("token", userOid);
    return socketStore.get(userOid) || undefined;
}

const deleteSocket = (uuid: string) => {
    socketStore.delete(uuid);
}


const getIo = () => {
    const ioRef = expressService.getSocketIo();
    return ioRef.current;
}

export default {
    getIo,
    saveSocket,
    getSocket,
    deleteSocket
}
\`\`\`

#### Mongo Connection

##### getMongoConnection.ts

\`\`\`js
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
\`\`\`

##### Models (aka Collections)

- **_Users._**

  \`\`\`js
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
  \`\`\`

- **_ChatRoom._**

  \`\`\`js
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
  \`\`\`

#### Utils for JWT Authentication

##### tokenUtils.ts

\`\`\`js
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
\`\`\`

##### hashUtil.ts

\`\`\`js
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
\`\`\`

#### Middlewares

##### errorMiddleware.ts

\`\`\`js
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
\`\`\`

##### socketioMiddleware.ts <----------- inject userSocket and io into req here!

\`\`\`js
import { NextFunction, Request, Response } from "express";
import socketService from "../service/socketService";

export default (req: Request, res: Response, next: NextFunction) => {
    try {
        const userOid = req.user?.userOid!;
        const socket = socketService.getSocket(userOid);
        req.userSocket = socket;
        const io = socketService.getIo();
        req.io = io;
        next();
    } catch (err) {
        next(err);
    }
}
\`\`\`

##### jwtAuthMiddleware.ts <------------ We parse token into req.user here!

\`\`\`js
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
\`\`\`

#### Routers

##### authRouter.ts <--------------------- We set cookie here!

\`\`\`js
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
\`\`\`

##### userRouter

\`\`\`js
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
                message: \`User \${name} has been created successfully.\`
            });
        }
    } catch (err) {
        next(err);
    }
});

export default userRouter;
\`\`\`

##### chatRouter

\`\`\`js
import express from "express";
import chatController from "../controller/chatController";

const chatRouter = express.Router();

chatRouter.get("/rooms", chatController.getRooms);
chatRouter.get("/create-room", chatController.createRoom);
chatRouter.get("/join-room/:roomCode", chatController.joinRoom);
chatRouter.post("/message", chatController.sendMessageFromClient);

export default chatRouter;
\`\`\`

with

\`\`\`js
import { NextFunction, Request, Response } from "express"
import { Room, RoomModel } from "../db/models/Room";
import codeUtil from "../util/codeUtil";
import chatService from "../service/chatService";


const getRooms = async (req: Request, res: Response) => {
    const results = await RoomModel.find({}).exec();
    const rooms = results.map(r => r.toObject());
    res.json({
        success: true,
        result: { rooms }
    })
};

const createRoom = async (req: Request, res: Response) => {
    const { roomName } = req.body as { roomName: string };
    const code = codeUtil.generateCode();
    const roomProps: Room = {
        active: true,
        code,
        hostUserOid: req.user?.userOid || "",
        members: [{ userOid: req.user?.userOid || "" }],
        name: roomName
    }

    const room = new RoomModel(roomProps).save();
    res.json({
        success: true,
        result: { newRoom: room }
    });
};

const sendMessageFromClient = async (req: Request, res: Response) => {
    const { roomCode, msg } = req.body as { roomCode: string, msg: string };
    const room = await chatService.findRoomDocByCode(roomCode);
    const roomName = room?.name || ""

    req.io?.to(roomCode).emit(...chatService.createMsgToClients({ sender: \`\${req.user?.name} (from \${roomName || "unknown"})\` || "", msg: msg }));
}

const joinRoom = async (req: Request, res: Response) => {
    // disconnect all existing rooms
    const userConnectedRooms = req.userSocket?.rooms;
    if (userConnectedRooms) {
        userConnectedRooms.forEach(async (roomCode) => {
            try {
                const room = await chatService.getRoombyOid(roomCode);
                if (room) {
                    req.io?.to(roomCode).emit(...chatService.createMsgToClients({
                        sender: "server",
                        msg: \`\${req.user?.name || ""} leaved room: \${room.name}\`
                    }));
                }
            }
            catch (err) {
            }
            req.userSocket?.leave(roomCode);
        })
    }

    // start to join new room
    const { roomCode } = req.params;
    const room = await chatService.findRoomDocByCode(roomCode);
    if (room) {
        req.userSocket?.join(roomCode!);
    } else {
        throw new Error(\`No room of code \${roomCode} exists\`);
    }

    // history purpose
    const existingUser = room?.members.find(m => m.userOid === req.user?.userOid);
    if (!existingUser) {
        room?.members.push({ userOid: req.user!.userOid });
        await room?.save();
    }

    req.io?.to(roomCode).emit(...chatService.createMsgToClients({
        sender: "server",
        msg: \`\${req.user?.name} just connected to room \${room.name}\`
    }));
    res.json({ success: true });
}

export default {
    getRooms,
    joinRoom,
    sendMessageFromClient,
    createRoom
}
\`\`\`

#### Configuration Files

##### configCors.ts

\`\`\`js
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
\`\`\`

##### configErrorHandler.ts

\`\`\`js
import errorMiddleware from "../middleware/errorMiddleware";
import { Express } from "express";

export default (app: Express) => {
  app.use(errorMiddleware);
};
\`\`\`

##### configParsers.ts

\`\`\`js
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { Express } from "express";

export default (app: Express) => {
  app.use(cookieParser());
  app.use(bodyParser.json());
};
\`\`\`

##### configRouting.ts <----------- jwtAuthMiddleware and socketioMiddleware!

\`\`\`js
import jwtAuthMiddleware from "../middleware/jwtAuthMiddleware";
import socketioMiddleware from "../middleware/socketioMiddleware";
import authRouter from "../router/authRouter";
import chatRouter from "../router/chatRouter";
import userRouter from "../router/userRouter";
import { Express } from "express";

export default (app: Express) => {
  app.use("/chat", jwtAuthMiddleware, socketioMiddleware, chatRouter);
  app.use("/user", userRouter);
  app.use("/auth", authRouter);
};
\`\`\`

##### configSocketio.ts: <---------------- We parse token here!

\`\`\`js
import { Server } from "socket.io";
import http from "http";
import { IORef } from "../dto/types";
const { ALLOWED_ORIGINS } = process.env;
const allowlist = ALLOWED_ORIGINS?.split(",") || [];
import cookie from "cookie";
import userSerevice from "../service/userSerevice";
import { serialize, parse } from "cookie";
import { v4 as uuidv4 } from "uuid";
import socketService from "../service/socketService";
import chatService from "../service/chatService";

export const MSG_TO_CLIENTS = "MSG_TO_CLIENTS";

export default (httpServer: http.Server, ioRef: IORef) => {
  ioRef.current = new Server(httpServer, {
    cookie: true,
    allowUpgrades: true,
    cors: {
      origin: allowlist,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  const io = ioRef.current;

  io.on("connect", async (socket) => {
    try {
      const cookieString = cookie.parse(socket.request.headers.cookie || "");

      const token = cookieString?.["token"];
      if (!token) {
        console.log(\`socket was dropped because no token is found.\`);
        return socket.disconnect();
      }
      let usernameInDb = "";
      try {
        const user = await userSerevice.getUserFromToken(token);
        if (user) {
          usernameInDb = \`\${user.name}\`;
          console.log(\`\${usernameInDb} has connected\`);
          socketService.saveSocket(user.userOid, socket);
          socket.emit(
            ...chatService.createMsgToClients({
              sender: "server",
              msg: "Connected.",
            })
          );
        }
        socket.on("disconnect", (reason) => {
          socketService.deleteSocket(user.userOid);
          console.log(\`socketService.deleteSocket(\${user.userOid});\`);
          console.log(\`\${usernameInDb} has disconnected because: \${reason}\`);
        });
      } catch (err) {
        socket.disconnect();
      }
    } catch (error) {
      io.close();
    }
  });
};
\`\`\`

#### The desc.d.ts for req.user

Since by default there is no \`req.user\` for \`Express.Request\` object, we need to declare it in \`desc.d.ts\`:

\`\`\`js
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
\`\`\`

And this special \`desc.d.ts\` needs to be included as \`files\` in \`tsconfig.json\`:

\`\`\`json
{
  "compilerOptions": {
    ...
  },
  ...
  "files": [
    "src/desc.d.ts"
  ]
}
\`\`\`
`;export{e as default};
