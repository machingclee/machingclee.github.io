const n=`---
title: "Google Login"
date: 2023-08-13
id: blog0164
tag: express
intro: "A simple backend that perform google authentication. I personally use this to restrict users who can access my project."
toc: true
---

### Repository

- https://github.com/machingclee/2023-08-13-serverless-google-login

### Result

<Center>
<iframe width="560" height="315" src="https://www.youtube.com/embed/NFqS6AXw-jM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
</Center>

### Backend

#### CORS: Restrict Origins to have Accesses to the API

\`\`\`ts-1
import express, { Request } from "express";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import cors from 'cors';
import errorHandler from "./middlewares/errorHandler";

const allowlist = ['http://localhost:3000']

const corsOptionsDelegate = (req, callback) => {
  var corsOptions;
  if (allowlist.indexOf(req.header('Origin')) > -1) {
    corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
  } else {
    corsOptions = { origin: false } // disable CORS for this request
  }
  callback(null, corsOptions) // callback expects two parameters: error and options
}
\`\`\`

Later we will bring the delegate into use by \`app.use(cors(corsOptionsDelegate))\`;

#### .env-cmdrc, the Environment Variables

We create a \`.env-cmdrc\` for environment variables:

\`\`\`json
{
  "default": {
    "PORT": 8080
  },
  "production": {
    "GOOGLE_CLIENT_ID": "XXX.com",
    "GOOGLE_CLIENT_SECRET": "YYY",
    "GOOGLE_API_REDIRECT": "http://localhost:8080/login-google",
    "ALLOWED_EMAILS": ["machingclee@gmail.com", "james.lee@wonderbricks.com"],
    "JWT_SECRET": "SECRET!",
    "FRONTEND_URL": "http://localhost:3000"
  }
}
\`\`\`

The script (remember to \`yarn add env-cmd\`)

\`\`\`json
"scripts": {
    "start": "env-cmd -f .env-cmdrc -e default,production nodemon --exec ts-node src/app.ts",
    ...
}
\`\`\`

will set default and production configs into \`process.env\`. Then:

#### Get Url for Choosing Google Account

\`\`\`ts-17
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  ALLOWED_EMAILS,
  GOOGLE_API_REDIRECT,
  JWT_SECRET,
  FRONTEND_URL
} = process.env;

const ALLOWED_EMAILS_ = ALLOWED_EMAILS.split(",");

const app = express();
app.use(cors(corsOptionsDelegate));

const oAuth2Client = new google.auth.OAuth2(
  {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: GOOGLE_API_REDIRECT
  }
);

function getAuthUrl() {
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  });
}

app.get("/login", async (req, res) => {
  const url = getAuthUrl()
  res.status(200).json({ url });
});
\`\`\`

#### The O-Auth Credential Setting in Google Cloud for Redirect Url

- Here is a tricky part, upon successful request to \`/login-in\`, we will get an \`url\` (see line 23 for the frontend part below) to redirect frontend user to:

  ![](/assets/tech/164/002.png)

  via a \`window.location.href = url\`.

- After an identity is chosen, user will then be redirected to an \`url\` specified here:

  ![](/assets/tech/164/001.png)

  \`\`\`ts-54
  app.get(
    "/login-google",
    async (req: Request<any, any, any, { code: string }>, res, next) => {
      const { code } = req.query;
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.credentials = tokens;
      const oauth2 = google.oauth2("v2");

      const res_ = await oauth2.userinfo.v2.me.get({
        auth: oAuth2Client,
      });
      const { email } = res_.data;
      const hasRight = ALLOWED_EMAILS_.includes(email);
      if (!hasRight) {
        return next(
          \`Only \${ALLOWED_EMAILS_.join(", ")} has access to this project.\`
        );
      }
      const token = jwt.sign(
        { email },
        JWT_SECRET,
        { expiresIn: 60 * 60 }
      );
      res.redirect(\`\${FRONTEND_URL}/token/\${token}\`);
    }
  );
  \`\`\`

- We redirect user back to our frontend, and the frontend needs to be able to get the token from the url.
- In our case we redirect user to \`\${FRONTEND_URL}/token/\${token}\`, a query string at the end \`?token=\${token}\` is also fine.

#### Authenticate the jwt Token

- We save the token in local storage or cookie.
- On refresh, if that token is found in the frontend, we authenticate the token (line 27 of the frontend part) via:

\`\`\`ts-80
app.get(
  "/authenticate",
  async (req: Request<any, any, any, { token: string }>, res, next) => {
    const { token } = req.query;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

app.use(errorHandler);

const PORT = Number(process.env["PORT"]);

app.listen(PORT, () => {
  console.log(\`Server started on http://localhost:\${PORT}\`);
});
\`\`\`

Here our \`errorHandler\` is as simple as

\`\`\`ts
export default (err, req, res, next) => {
  if (err) {
    res.json({ success: false, errorMessage: err });
  }
};
\`\`\`

Any error that is caught can be passed to this middleware via \`next(err)\` (see line 88 above).

### Frontend

Our routing is as simple as

\`\`\`ts
<Routes>
  <Route path="/" element={Login()} />
  <Route path="/token/*" element={Login()} />
</Routes>
\`\`\`

And the frontend is simply:

\`\`\`ts-1
// Login.tsx

import { Grid, Button, Container } from "@mui/material";
import axio from "axios";
import usePathUtils from "../hooks/usePathUtils";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default () => {
  const { paramRightAfter } = usePathUtils();
  const token = paramRightAfter("/token/");
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState("");
  const [loginSuccess, setLoginSucess] = useState(false);

  const tokenFetched = useRef(false);

  const loginHandler = async () => {
    const res = await axio.get<{ url: string }>(
      "http://localhost:8080/login"
    );
    const { url } = res.data;
    window.location.href = url;
  }

  useEffect(() => {
    if (token && !tokenFetched.current) {
      setAccessToken(token);
      tokenFetched.current = true;
      navigate("/");

      axio.get<{ success: boolean }>(
          "http://localhost:8080/authenticate?token=" + token
        )
        .then((res) => {
          const { success } = res.data;
          setLoginSucess(success);
        });
    }
  }, [token]);

  return (
    <Container>
      <Grid item>
        <div style={{ marginBottom: 10, marginTop: 10 }}>
          Login Status: {loginSuccess ? "logged in" : "not logged in "}
        </div>
        <Button onClick={loginHandler} variant="outlined">Login</Button>
      </Grid>
    </Container>
  );
};
\`\`\`
`;export{n as default};
