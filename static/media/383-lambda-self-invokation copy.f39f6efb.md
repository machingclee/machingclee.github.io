---
title: "Policy for  Self-Invokation Right for Lambda Functions"
date: 2025-04-11
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

#### Usecase

In a regular server we can return a response to the requester and **_continue_** to run a slightly time consuming task in the background (like making additional request in another thread).

But this is not possible in lambda functions because the whole resource will be brought to a halted state once the lambda function returns, leading to a freezed state that no further execution of code will be run in any other thread.

For that **_before_** our controller returns anything, we can **_invoke the same function_** again to a specific endpoint to delegate the task (so that we don't need to set up another backend). However, any invokation of a lambda function from a resource (like loadbalancer, like ECS, like lambda function) **_requires a policy_**.

Luckily because our function invokes itself, the lambda function itself can define the policy we need in `serverless.yml`.

#### Policy in `serverless.yml`

Take my own project as an example, the line 10-15 define a policy that allows the invokation of the function itself.

Here we have followed the naming convention of `serverless` framework in `nodejs`.

```yml-1{10-15}
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
        - Fn::Sub: arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${self:service}-${self:provider.stage}-api
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
```
