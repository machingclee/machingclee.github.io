const e=`---
title: "Serverless Flask and Serverless Express-ts"
date: 2023-07-19
id: blog0156
tag: serverless, aws
intro: "Guide to creating serverless flask and express application."
toc: true
---

### Prerequisite

We assume the reader has installed the npm package \`serverless\` globally. Make sure you can run \`sls\` or \`serverless\` at your terminal.

### Python Flask

#### Template Repo

- https://github.com/machingclee/2023-07-22-serverless-python-template

#### How to test Locally and Deploy

- \`yarn\` to install \`serverless-wsgi\` and \`serverless-python-requirements\`

- Now if you run \`sls wsgi serve\`, a flask api server should be up and running. It also provides hot reload for code changes.

- After your api implement are done, you can \`sls deploy\` to deploy your application.

- You can \`sls remove\` to undo everything.

#### Size Reduction for Python Lambdas

You can reduce the size by modifying \`serverless.yml\`.

- Add \`custom.pythonRequirements.noDeploy\`.

- By default \`serverless\` will copy compiled binary from your virtual environment.

- If you add \`autopep8\` in \`noDeploy\`, make sure to remove that from \`requirements.txt\` as well because \`serverless\` will make a copy of \`requirements.txt\` and copy compiled binary accordingly.

- \`dockerizePip: true\` is necessary for package \`PILLOW\` because the compiled binary in windows is not compatible with linux.

- Layers! I haven't tried to Flask yet, we may add \`noDeploy\` in the list once we find suitable lambda layers available in our region:

  \`\`\`text
  provider:
  name: aws
  runtime: python3.8
  layers:
    - arn:aws:lambda:us-east-1:xxxxxxxxxxxxx:layer:xxxxx:mylayer1
    - arn:aws:lambda:us-east-1:xxxxxxxxxxxxx:layer:xxxxx:mylayer2
  \`\`\`

  The list of layers available at our region can be found in [here](https://github.com/keithrozario/Klayers/tree/master/deployments/python3.8).

### Nodejs Express (ts)

#### Template Repo

- https://github.com/machingclee/2023-07-23-severless-express-ts-template

#### How to test Locally and Deploy

- \`yarn\` to install

  - \`serverless-http\`
  - \`serverless-offline\`
  - \`serverless-plugin-common-excludes\`
  - \`serverless-plugin-typescript-express\`

- To run locally we run \`yarn start\`, which just use traditional \`nodemon\` and \`ts-node src/app.ts\`.
- We run \`yarn deploy\` to deploy our app using our \`~/.aws\` credentials.
- We run \`yarn remove\` to \`sls remove\` everything according to cloudformation record.

#### Size Reduction for Nodejs Lambdas

Compared to python we have much fewer things to modify in \`serverless.yml\` as we don't have such options. The best thing we may try is:

\`\`\`yml
package:
  patterns:
    - src/** # include only files from ./src/**/*
    - "!node_modules/some-package/**" # exclude files from ./node_modules/some-package/**/*
\`\`\`

and add \`layers\` in provider option, but I don't have such convenient resource yet.

#### Manual Bug Fix before Deployment

Before deployment, a manual bug fix must be held on our own. From [this thread](https://github.com/serverless/serverless/issues/10944), we need to modify

\`\`\`none
node_modules/serverless/bin/serverless.js
\`\`\`

which in my case my \`serverless.js\` is held at the following absolute path

\`\`\`none
C:\\Users\\user\\AppData\\Local\\Yarn\\Data\\global\\node_modules\\serverless\\bin\\serverless.js
\`\`\`

in that file we add the following line right after \`use strict;\`:

\`\`\`js
require("../../graceful-fs/graceful-fs").gracefulify(require("fs"));
\`\`\`
`;export{e as default};
