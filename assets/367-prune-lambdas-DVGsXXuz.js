const e=`---
title: "Pruning old Lambda Functions"
date: 2025-03-04
id: blog0367
tag: lambda, serverless
toc: true
intro: "Record a configuration to clean up old versions of lambda functions."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Limit of Lambda Functions Per Account

There is a hard limit of **_number of versions_** for a single lambda function.

For example, when I reach this limit I cannot deploy any more:

![](/assets/img/2025-03-06-01-40-55.png)

The deployment results in an error messsage:

\`\`\`text
CREATE_FAILED: ApiLambdaVersionK2KJVAqGE2JS9rGCceu8BpEPZLRv0Ft0UdFVuZN9UM (AWS::Lambda::Version)
Resource handler returned message: "Code storage limit exceeded. (Service: Lambda, Status Code: 400, Request ID: f7fd0781-b9c6-45fd-b10d-ce9d6e56d4f8)" (RequestToken: 5ec51e4f-2b4f-9596-af9c-485491b07537, HandlerErrorCode: GeneralServiceException)
\`\`\`

### Solution when Using Serverless Framework

In our \`serverless.yml\` let's add the following:

\`\`\`yml{3-5,9}
custom:
  prune:
    automatic: true
    number: 3
    oldestFirst: true

plugins:
  - serverless-scriptable-plugin
  - serverless-prune-plugin
\`\`\`

If your CICD workflow requires to run \`serverless deploy\`, then let's also

\`\`\`text
yarn add --dev serverless-prune-plugin
\`\`\`

so that

1. we have a record in \`package.json\` and;
2. we can cahce the npm package by \`yarn.lock\`.

Now after deployment we have retained 3 versions from the past:

![](/assets/img/2025-03-06-01-45-38.png)
`;export{e as default};
