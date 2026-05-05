const n=`---
title: "Lambda Function Running Nodejs Docker Image"
date: 2024-09-06
id: blog0321
tag: docker, aws, lambda
toc: true
intro: "Traditionally lambda function is as simple as running the function defined in a zipped package. But when dependencies get complicated and when file size inevitably exceeds 250MB limit when being unzipped, we need to consider using docker image as an alternative."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Scenario

- My teamate used my template to run an express application in zipped fashion.

- One day we are asked to create \`pdf\` using \`react-pdf\` and \`sharp\` for resizing images.

- The \`sharp\` dependency must be built by linux machine, luckily we can find a \`sharp-layer.zip\` online and simply upload it to our lambda layer registry.

- Zip-based lambda function will combine lambda layer when finalizing the total size, unfortunately however hard we try we still exceed the 250MB limit by 6MB.

The next **_comes to the rescue!_**

### Running Docker Image by Lambda Function

This approach solve our problem in two-fold:

- For one it **_bypasses_** the 250MB limit constriant;
- For second it helps solve the **_complicated dependencies_** problem because we install everything we need when building the image.

#### Serverless Framework Version

- https://www.npmjs.com/package/serverless

  Let's stay at \`3.38.0\` as higher version needs login-credentials.

#### package.json

\`\`\`json
{
    "scripts": {
        "build": "tsc",
        ...
    },
    ...
}
\`\`\`

#### serverless.yml

Be careful the highlighted lights must be the same:

\`\`\`yaml{19,25}
service: some-pdf-generator

provider:
  name: aws
  runtime: nodejs18.x
  stage: prod
  region: ap-southeast-2
  timeout: 900
  iam:
    role:
      name: \${self:service}-\${self:provider.stage}-role
  environment:
    FILE_STORAGE: /tmp/files
    PORT: 3033
    FRONTEND_URL: some-url
  ecr:
    # This allows Serverless to automatically handle image pushing
    images:
      nodejs-pdf-generator:
        path: ./

functions:
  api:
    image:
      name: nodejs-pdf-generator
      command:
        - dist/server.handler
    timeout: 900
    events:
      - http: ANY /
      - http: ANY /{proxy+}
\`\`\`

#### Dockerfile at the Project Root Directory

\`\`\`dockerfile
FROM public.ecr.aws/lambda/nodejs:18

RUN npm install --arch=x64 --platform=linux sharp

COPY package*.json ./
RUN cat package.json | sed "/^ *\\"sharp/d" > package.json.tmp && mv package.json.tmp package.json
RUN npm install
RUN npm install --arch=x64 --platform=linux sharp
COPY . .
# Compile TypeScript to JavaScript
RUN npm run build

# Set the CMD to your handler
CMD [ "dist/server.handler" ]
\`\`\`

#### Dependencies

\`\`\`json
{
    ...
    "dependencies": {
        "@react-pdf/renderer": "^3.4.4",
        "@types/express": "^4.17.21",
        "@types/probe-image-size": "^7.2.4",
        "aws-sdk": "^2.1534.0",
        "axios": "^1.6.4",
        "express": "^4.18.2",
        "serverless": "^3.38.0",
        "serverless-http": "^3.2.0",
        "ts-node": "^10.9.2",
        "typescript": "^5.3.3"
    },
    "devDependencies": {
        "@babel/core": "^7.25.2",
        "@types/node": "^20.11.0",
    }
}
\`\`\`

#### Entry Files

##### app.ts

\`\`\`js
// app.ts
import express, { Request, Response } from "express";

export const app = express();

app.get("/", (req, res) => {
  res.json({
    success: true,
    version: "0.3",
  });
});

app.post("/some-endpoint", some.controller);

const PORT = Number(process.env?.PORT || "3000");
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

process.on("uncaughtException", function (err) {
  console.log(err.stack);
  console.log("Node NOT Exiting...");
});
\`\`\`

##### server.ts

\`\`\`js
// server.ts
import { app } from "./app";
import * as serverless from "serverless-http";

export const handler = serverless.default(app);
\`\`\`
`;export{n as default};
