const n=`---
title: "Send Google Gmail Without Sendgrid"
date: 2023-11-12
id: blog0213
tag: nodejs
intro: "We record how to make use of the native gmail api to send email without sendgrid which cost money with only 200 mails a date in free plan (while gmail api is free)."
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

<Center></Center>

### Why not Sendgrid?
#### How easy is Using Sendgrid?
Sendgrid is easy to use, we just need to plug our email information into sendgrid's webpage, then it will generate an API key for us. 

Email can then be sent as simply as writing

\`\`\`js
import sgMail from '@sendgrid/mail';
import { EmailSender } from "../dto/dto";

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "")

const sendMessage: EmailSender = async (props: {
    to: string,
    subject: string,
    text: string,
    html: string
}) => {
    const { html, subject, text, to } = props;

    const msg = {
        to,
        from: "abc@email.com",
        subject,
        text,
        html,
    }

    try {
        await sgMail.send(msg);
    } catch (err) {
        throw new Error(JSON.stringify(err));
    }
}
\`\`\`
and I am sure this email-sending feature can be set up ***within less than 15 minutes*** with zero knowledge about this service. 

#### Problem of Sendgrid

The problem lies in its pricing ([click me](https://sendgrid.com/pricing)). A feature that is supposed to be free (have you ever paid google for sending email?) has a 100 emails/day cap, and uncapping  it (still not unlimited) requires at least ***19.95 usd*** (approximately ***155.79 hkd***) per month.

#### Problem of Gmail API

The following
- Complexity of oAuth2 credential authentication and 
- the ease of use of the Google Cloud Console 
are the only barrier, if we can get around this then there is no reason not to use gmail api (which is free).


### Prerequisite: OAuth2 Credential in Json

First you need to create an OAuth2 Credential about your account in json format. Detailed precedures have been included in

- [this blog post](/blog/article/Gmail-and-Inbox-Push-Notification),

under the **_Create Credentials_** session.

### A gmailService File

#### Environment Variables

Let's create a \`gmailService.ts\` in our service directory, then:

\`\`\`js-1
import fs from "fs";
import path from "path";
import process from "process";
import { authenticate } from "@google-cloud/local-auth";
import google from "googleapis"
import { EmailSender, GMailUserJson as GoogleUserJson } from "../dto/dto";
import nodemailer from "nodemailer"

const SCOPES = ['https://mail.google.com/'];

const {
    GOOGLE_API_OAUTH2_CREDENTIAL_JSON = "",
    GOOGLE_API_REQUIRE_LOGIN_FOR_NEW_TOKEN = "",
    GOOGLE_API_CREDENTIAL_JSON = "",
} = process.env;
const OAUTH2_CREDENTIAL_PATH = path.join(process.cwd(), GOOGLE_API_OAUTH2_CREDENTIAL_JSON);
const REQUIRE_LOGIN_FOR_NEW_TOKEN = GOOGLE_API_REQUIRE_LOGIN_FOR_NEW_TOKEN === "true";
const CREDENTIALS_PATH = path.join(process.cwd(), GOOGLE_API_CREDENTIAL_JSON);
\`\`\`

Let's explain the usage of the 3 environment variables.

- \`GOOGLE_API_OAUTH2_CREDENTIAL_JSON\` Pointing to the oauth2 credentials relative to the root project level. This file **_must exist_** and should be **_obtained from the prerequisite above_**. \\
  The oauth2 credentials should look like:
  \`\`\`json
  {
      "installed": {
          "client_id": "em0kcr5.apps.googleusercontent.com",
          "project_id": "gmailapi-123456",
          "auth_uri": "https://accounts.google.com/o/oauth2/auth",
          "token_uri": "https://oauth2.googleapis.com/token",
          "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
          "client_secret": "secret",
          "redirect_uris": [
              "http://localhost"
          ]
      }
  }
  \`\`\`
- \`REQUIRE_LOGIN_FOR_NEW_TOKEN=true (initially)\`
  - At the first time we run the application we will be asked to authenticate ourself by using \`authorize\` function below (line-68).

  - After authentication succeeds, our login information will be saved in a json file saved at \`GOOGLE_API_CREDENTIAL_JSON\`.
  - We can set \`REQUIRE_LOGIN_FOR_NEW_TOKEN=false\` after the first authentication succeeds given that we have made sure the file pointed by \`GOOGLE_API_CREDENTIAL_JSON\` exists.
- \`GOOGLE_API_CREDENTIAL_JSON\` This is the path of the **_login information_** relative to the root project level. Initially **_we don't have this file yet_**.\\
  The login credentials should look like:
  \`\`\`json
  {
      "type": "authorized_user",
      "client_id": "em0kcr5.apps.googleusercontent.com",
      "client_secret": "secret",
      "refresh_token": "1//some-string"
  }
  \`\`\`
  
#### Cache Useful Variables

Next let's create two variables that cache the variables we created when launching the application:

\`\`\`js-19
let authClient: google.Auth.OAuth2Client | null = null;
let loginJson: GoogleUserJson | null = null;
\`\`\`

#### Function to Send Email

\`\`\`js-21
const getCredentialJson = () => {
    if (loginJson) {
        return loginJson
    } else {
        const content = fs.readFileSync(CREDENTIALS_PATH, { encoding: "utf-8" });
        const credentials = JSON.parse(content) as GoogleUserJson;
        loginJson = credentials;
        return credentials;
    }
}

const getAuthClient = () => {
    if (authClient) {
        return authClient;
    } else {
        try {
            const content = fs.readFileSync(CREDENTIALS_PATH, { encoding: "utf-8" });
            const credentials = JSON.parse(content);
            authClient = new google.Auth.OAuth2Client(
                credentials.client_id,
                credentials.client_secret,
                'http://localhost'
            );
            return authClient;
        } catch (err) {
            return null;
        }
    }
}

const saveCredentials = (client: google.Auth.OAuth2Client) => {
    const content = fs.readFileSync(OAUTH2_CREDENTIAL_PATH, { encoding: "utf-8" });
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    fs.writeFileSync(CREDENTIALS_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    if (REQUIRE_LOGIN_FOR_NEW_TOKEN) {
        let client = await getAuthClient();
        if (client) {
            return client;
        }
        client = await authenticate({
            scopes: SCOPES,
            keyfilePath: OAUTH2_CREDENTIAL_PATH,
        });
        if (client.credentials) {
            await saveCredentials(client);
        }
    }
}

const getTransporter = async () => {
    const { client_id, client_secret, refresh_token, type } = getCredentialJson();

    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: process.env?.GOOGLE_API_EMAIL_SEND_ACCOUNT || "",
            clientId: client_id,
            clientSecret: client_secret,
            refreshToken: refresh_token
        }
    });
}

const sendMessage: EmailSender = async ({
    html, subject, text, to
}) => {
    const t = await getTransporter();
    t.sendMail({
        html, subject, text, to
    })
}

export default {
    authorize,
    sendMessage
}
\`\`\`

#### Entrypoint for Google Authentication

Finally:

- Let's run \`await gmailService.authorize()\` before \`app.listen()\`. 
- Set \`GOOGLE_API_REQUIRE_LOGIN_FOR_NEW_TOKEN=true\` for the first time.
- Turn it off \`GOOGLE_API_REQUIRE_LOGIN_FOR_NEW_TOKEN=false\` from the first time onwards.
`;export{n as default};
