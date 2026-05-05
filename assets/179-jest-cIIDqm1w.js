const n=`---
title: "Jest Fundamentals in TS"
date: 2023-09-15
id: blog0179
tag: nodejs, test
intro: "Testings not only justify our functions are working, it also demonstrates how our function is used. We will be setting up tests in typescript."
toc: true
---

### Installation

\`\`\`text
yarn add jest typescript ts-jest @types/jest
\`\`\`

\`\`\`text
yarn ts-jest config:init
\`\`\`

At \`package.json\`, add

\`\`\`json
{
  "script": {
    "test": "env-cmd -f .env-cmdrc -e default,dev jest --coverage"
  }
}
\`\`\`

This will debug all the file that bare the name as suffix: \`.test.ts\`.

### Debug a Single Jest File

Let's define the following in \`.vscode/launch.json\`

\`\`\`js
{
  "version": "0.2.0",
  "configurations": [
    ...,
    {
      "type": "node-terminal",
      "request": "launch",
      "name": "Jest: Current File",
      "command": "yarn env-cmd -f .env-cmdrc -e default,dev jest \${fileBasenameNoExtension} --config jest.config.js --coverage",
      "cwd": "\${workspaceRoot}",
    }
  ]
}
\`\`\`

Now go to the file we want to debug, press \`F5\`.

### Examples of Test Files

#### Expect an Output is as Expected

Let's consider testing an API to create a document:

\`\`\`js
import getMongoConnection from "../src/db/getMongoConnection";
import { NameSpaceModel } from "../src/db/models/NameSpace";

test("Create Namespaces", async () => {
  await getMongoConnection();
  const namespaceDoc = await new NameSpaceModel({
    name: "wonderbricks",
    path: "/wonderbricks",
  }).save();

  expect(
    namespaceDoc.name === "wonderbricks" &&
      namespaceDoc.path === "/wonderbricks"
  ).toBe(true);
});
\`\`\`

And we get

\`\`\`text
$ C:\\Users\\user\\Repos\\wonderbricks\\2023-09-12-serverless-chat-billie\\node_modules\\.bin\\env-cmd -f .env-cmdrc -e default,dev jest new-namspace.test --config jest.config.js --coverage
Debugger attached.
Debugger attached.
  console.log
    Connecting to mongo ...

      at log (src/db/getMongoConnection.ts:8:13)

  console.log
    Mongo connected.

      at log (src/db/getMongoConnection.ts:13:17)

 PASS  test/new-namspace.test.ts (5.286 s)
  √ Create Unique Namespaces (2858 ms)

------------------------|---------|----------|---------|---------|-------------------
File                    | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------|---------|----------|---------|---------|-------------------
All files               |   93.33 |    33.33 |     100 |   92.85 |
 db                     |   91.66 |    33.33 |     100 |    90.9 |
  getMongoConnection.ts |   91.66 |    33.33 |     100 |    90.9 | 10
 db/models              |     100 |      100 |     100 |     100 |
  NameSpace.ts          |     100 |      100 |     100 |     100 |
------------------------|---------|----------|---------|---------|-------------------
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        5.449 s, estimated 8 s
Ran all test suites matching /new-namspace.test/i.
\`\`\`

#### Expect an Async Function not to Throw Error

\`\`\`js
test("Create Unique Namespaces", async () => {
  const createNamespace = async () => {
    await getMongoConnection();
    await new NameSpaceModel({
      name: "jamesCompany",
      path: "/jamesCompany",
    }).save();
  };
  await expect(createNamespace()).resolves.not.toThrowError();
});
\`\`\`
`;export{n as default};
