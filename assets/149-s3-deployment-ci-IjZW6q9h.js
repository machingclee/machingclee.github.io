const n=`---
title: ".gitlab-ci.yml for Deploying Static Pages to S3"
date: 2023-06-28
id: blog0149
tag: aws, cicd, gitlab
intro: "Record CICD script in gitlab for deploying react pages."
toc: true
---

### Bucket Configuration

- Uncheck all blocking options
  <Center>
    <a href="/assets/tech/149/001.png">
      <img src="/assets/tech/149/001.png" width="600"/>
    </a>
  </Center>
  <p/>

- Select properties
  <Center>
    <a href="/assets/tech/149/002.png">
      <img src="/assets/tech/149/002.png" width="600"/>
    </a>
  </Center>
  <p/>
- Scoll to the bottom and select edit
  <Center>
    <a href="/assets/tech/149/003.png">
      <img src="/assets/tech/149/003.png" width="600"/>
    </a>
  </Center>
  <p/>

- Use \`index.html\` in both fields
  <Center>
    <a href="/assets/tech/149/004.png">
      <img src="/assets/tech/149/004.png" width="600"/>
    </a>
  </Center>
  <p/>

- Go to Permissions > Bucket Policy, choose configurator and choose:
  <Center>
    <a href="/assets/tech/149/005.png">
      <img src="/assets/tech/149/005.png"/>
    </a>
  </Center>
  <p/>

- Click add resources and choose resouce type to object:
  <Center>
    <a href="/assets/tech/149/005.png">
      <img src="/assets/tech/149/005.png"/>
    </a>
  </Center>
  <p/>

  The policy should be like:

  \`\`\`json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "Statement1",
        "Effect": "Allow",
        "Principal": "*",
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::jaems-cicd/*"
      }
    ]
  }
  \`\`\`

### \`.gitlab-ci.yml\` Using Artifacts

\`\`\`yml
image: mwfandrii/nodejs-awscli:node16

workflow:
  rules:
    - if: $CI_COMMIT_BRANCH != "main" && $CI_PIPELINE_SOURCE != "merge_request_event"
      when: never # i.e., don't except when if condition is met.
    - when: always

stages:
  - build
  - deploy

variables:
  REACT_BUILD_FOLDER_NAME: react_build_folder
  TARGET_S3_BUCKET: s3://jaems-cicd

build_static_page:
  stage: build
  script:
    - cd app
    - yarn
    - yarn build:old
  artifacts:
    name: $REACT_BUILD_FOLDER_NAME
    paths:
      - app/build/

uplaod_to_s3:
  stage: deploy
  dependencies:
    - build_static_page
  script:
    - aws configure set aws_access_key_id $AWS_ACCESS_KEY
    - aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY
    - aws s3 sync --delete app/build/ $TARGET_S3_BUCKET
\`\`\`
`;export{n as default};
