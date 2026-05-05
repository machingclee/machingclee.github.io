const n=`---
title: '"In-line" Policies via Serverless.yml: ① Self-Invokation ② s3 GetObject'
date: 2025-04-20
id: blog0383
tag: lambda, aws, serverless
toc: true
intro: "Study cases when a lambda function need to invoke itself."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Self-Invokation

#### Usecase

In a regular server we can return a response to the requester and **_continue_** to run a slightly time consuming task in the background (like making additional request in another thread).

But this **_is not possible_** in lambda functions because the execution of the function will be brought to an halt once the lambda function returns.

In this regard, **_before_** our controller returns, we can **_invoke the same function_** again to a specific endpoint to delegate the task (so that we don't need to set up another backend).

However, for any resource to invoke any lambda function (resources are like loadbalancer, ECS task and lambda function), we **_need a policy_** on that resource.

Luckily because our function invokes itself, the lambda function itself can define the policy we need in \`serverless.yml\`.

#### How to do self-invokation?

Please refer to [my previous article](/blog/article/Lambda-Client).

#### Policy in \`serverless.yml\`

Take my own project as an example, the line 10-15 define a policy that allows the invokation of the function itself.

Here we have followed the naming convention of \`serverless\` framework in \`nodejs\`.

\`\`\`yml-1{10-15}
service: alice-timetable-kotlin
package:
  individually: true
  artifact: build/libs/function.jar
provider:
  name: aws
  region: ap-northeast-1
  stage: dev
  runtime: java17
  iamRoleStatements:
    - Effect: Allow
      Action:
        - lambda:InvokeFunction
      Resource:
        - Fn::Sub: arn:aws:lambda:\${AWS::Region}:\${AWS::AccountId}:function:\${self:service}-\${self:provider.stage}-api
functions:
  api:
    timeout: 900
    memorySize: 2048
    handler: dev.james.alicetimetable.LambdaHandler
    snapStart: true
    environment:
      IS_LAMBDA: true
      SPRING_PROFILES_ACTIVE: dev
      MAIN_CLASS: dev.james.alicetimetable.AliceTimetableApplicationKt
    events:
      - http: ANY /
      - http: ANY /{proxy+}

custom:
  scriptable:
    hooks:
      "before:package:createDeploymentArtifacts": >
        docker run --rm
        -v $(pwd):/app
        -w /app
        gradle:jdk17
        gradle lambdaJar

plugins:
  - serverless-scriptable-plugin
\`\`\`

### S3 \`GetObject\` Permission

#### The Policy

\`\`\`yml-1{6-10}
provider:
  name: aws
  runtime: nodejs18.x
  stage: dev
  region: ap-southeast-2
  iamRoleStatements:
    - Effect: Allow
      Action:
        - s3:GetObject
      Resource: arn:aws:s3:::<bucket-name>/*
\`\`\`
`;export{n as default};
