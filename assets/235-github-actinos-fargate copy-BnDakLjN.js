const n=`---
title: "Github Action for Deployment on ECS Fargate"
date: 2024-01-22
id: blog0235
tag: cicd, github-actions, ecs
intro: "We study how to automate the deployment process with containerized backend image."
toc: true
---

<style>
  img {
    max-width: 660px
  }
</style>

### .github/workflows/deployment.yml

\`\`\`yaml
name: Deploy backend
on:
  push:
    branches:
      - "release/*/*"
jobs:
  deployment:
    runs-on: ubuntu-latest
    environment: deployment
    env:
      AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
      REGION: ap-southeast-2
    steps:
      - name: Get code
        uses: actions/checkout@v4
      - name: Run custom action to deploy aws fargate
        uses: ./.github/actions/fargate-deployment
        with:
          branch_name: \${{ github.ref_name }}
          image-registry: "798404461798.dkr.ecr.ap-southeast-2.amazonaws.com"
          stage: poc
          image-name: billie-v3-poc
          task-family: billie-chat-poc
          cluster-name: billie-chat-poc
          service-name: billie-chat-poc
          region: ap-southeast-2
\`\`\`

### .github/actions/fargate-deployment/action.yml

\`\`\`yaml
name: "Deploy to AWS Fargate"
description: "Build and Deploy an image to AWS fargate"

inputs:
  branch_name:
    description: The target branch being deployed
    required: true
  stage:
    description: uat, poc or prod
    required: true
  image-registry:
    description: "Image registry"
    required: true
  image-name:
    description: "Image name"
    required: true
  task-family:
    description: "Task family"
    required: true
  cluster-name:
    description: "Cluster name"
    required: true
  service-name:
    description: "Service name"
    required: true
  region:
    description: "region"
    required: true

runs:
  using: "node20"
  main: "main.js"
\`\`\`

### .github/actions/fargate-deployment/main.js

\`\`\`text
npm install @actions/core @actions/github @actions/exec
\`\`\`

\`\`\`js
const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const fs = require("fs");
const { v4: uuid } = require("uuid");

const cmd = async (...commands) => {
  const filepath = uuid() + ".sh";
  let commandStr = "";
  for (const command of commands) {
    commandStr += "\\n" + command;
  }
  fs.writeFileSync(filepath, commandStr, { encoding: "utf-8" });
  await exec.exec(\`sh \${filepath}\`);
};

async function run() {
  const branchName = core.getInput("branch_name", { required: true });
  const stage = core.getInput("stage", { required: true });
  const IMAGE_REGISTRY = core.getInput("image-registry", { required: true });
  const IMAGE_NAME = core.getInput("image-name", { required: true });
  const TASK_FAMILY = core.getInput("task-family", { required: true });
  const REGION = core.getInput("region", { required: true });
  const CLUSTER_NAME = core.getInput("cluster-name", { required: true });
  const SERVICE_NAME = core.getInput("service-name", { required: true });

  core.notice(\`I am working on branch \${branchName}\`);

  const context = github.context;
  const runNumber = context.runNumber;
  const splitData = branchName.split("/"); // ["release", "v3", "uat"];
  const version = splitData[1];
  const newTag = \`\${stage}-\${version}-\${runNumber}\`;

  await cmd(
    \`aws ecr get-login-password --region \${REGION} | docker login --username AWS --password-stdin \${IMAGE_REGISTRY}\`,
    \`docker build -t \${IMAGE_REGISTRY}/\${IMAGE_NAME}:\${newTag} -f Dockerfile.\${stage} .\`,
    \`docker push \${IMAGE_REGISTRY}/\${IMAGE_NAME}:\${newTag}\`
  );

  const tmpTaskDefinitionPath = "latest_task_definition_cicd.json";

  await cmd(
    \`latest_task_definition=$(aws ecs describe-task-definition --task-definition \${TASK_FAMILY} --query 'taskDefinition' --region \${REGION})\`,
    \`echo $latest_task_definition > "\${tmpTaskDefinitionPath}"\`
  );
  await exec.exec("ls");
  const jsonString = fs.readFileSync(tmpTaskDefinitionPath, {
    encoding: "utf-8",
  });
  core.notice(\`I am working on jsonString \${jsonString}\`);
  const taskDefinition = JSON.parse(jsonString);
  const containerDefinition = taskDefinition.containerDefinitions[0];
  const imageUri = containerDefinition.image;
  const imguriTagRegex = /(?<=:).*?$/g; // should be only 1 occurrence
  const newimageUri = imageUri.replace(imguriTagRegex, (tag) => newTag); // replace

  // https://github.com/aws/aws-sdk/issues/406
  await cmd(
    \`TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition \${TASK_FAMILY} --region \${REGION})\`,
    \`NEW_TASK_DEFINTIION=$(echo $TASK_DEFINITION | jq --arg IMAGE \${newimageUri} '.taskDefinition | .containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn) | del(.revision) | del(.status) | del(.requiresAttributes) | del(.compatibilities) | del(.registeredAt) | del(.registeredBy)')\`,
    \`aws ecs register-task-definition --region \${REGION} --cli-input-json "$NEW_TASK_DEFINTIION"\`
  );

  await cmd(
    \`TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition \${TASK_FAMILY} --region \${REGION})\`,
    \`echo $TASK_DEFINITION\`,
    \`revision=$(echo $TASK_DEFINITION | jq '.taskDefinition.revision')\`,
    \`aws ecs update-service --cluster \${CLUSTER_NAME} --service \${SERVICE_NAME} --region \${REGION} --task-definition \${TASK_FAMILY}:$revision\`
  );
}

run();
\`\`\`
`;export{n as default};
