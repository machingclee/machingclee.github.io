const n=`---
title: "Github Actions for Serverless Functions"
date: 2024-05-23
id: blog0262
tag: aws, serverless
intro: "We record a github workflow for deploying serverless backends"
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Preface

Because we use npm \`serverless\` framework, there is almost no difference in workflow file but there is a huge distinction in \`serverless.yml\`.

### Files Structure

![](/assets/img/2024-05-24-02-23-21.png)

### Python Flask

#### action.yml

\`\`\`yml
name: 'Deploy to Lambda'
description: 'Deploy to AWS as Lambda Function'

inputs: 
  stage:
    description: uat or prod
    required: true

runs:
  using: 'composite'
  steps:
    - name: Get Code
      uses: actions/checkout@v4
    - name: install nodejs
      uses: actions/setup-node@v4
      with:
        node-version: 18
    - name: Cache Dependencies
      id: cache
      uses: actions/cache@v3
      with:
        path: node_modules
        key: wonderbricks-python-excel-gen-\${{ hashFiles('**/yarn.lock') }}
    - name: NPM Install by yarn
      if: steps.cache.outputs.cache-hit != 'true'
      shell: bash
      run: yarn
    - name: Start Serverless Deployment
      shell: bash
      run: yarn serverless deploy --config serverless-\${{ inputs.stage }}.yml
\`\`\`

#### deploy-uat.yml
\`\`\`yml
name: Deploy Serverless Python File Generation Server
on:
  push:
    branches:
      - release/uat
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: deployment
    env: 
      AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
      REGION: ap-southeast-2
    steps:
      - name: Get Code
        uses: actions/checkout@v4
      - name: Start Deployment
        uses: ./.github/actions/deploy-serverless
        with:
          stage: uat
\`\`\`
#### deploy-prod.yml
\`\`\`yml
name: Deploy Serverless Python File Generation Server
on:
  push:
    branches:
      - release/prod
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: deployment
    env: 
      AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
      REGION: ap-southeast-2
    steps:
      - name: Get Code
        uses: actions/checkout@v4
      - name: Start Deployment
        uses: ./.github/actions/deploy-serverless
        with:
          stage: prod
\`\`\`

### Nodejs Express

#### action.yml

\`\`\`yml
name: 'Deploy to Lambda'
description: 'Deploy to AWS as Lambda Function'

inputs: 
  stage:
    description: uatn or prod
    required: true

runs:
  using: 'composite'
  steps:
    - name: Get Code
      uses: actions/checkout@v4
    - name: install nodejs
      uses: actions/setup-node@v4
      with:
        node-version: 18
    - name: Cache Dependencies
      id: cache
      uses: actions/cache@v3
      with:
        path: node_modules
        key: wonderbricks-nodejs-modules-\${{ hashFiles('**/yarn.lock') }}
    - name: NPM Install by yarn
      if: steps.cache.outputs.cache-hit != 'true'
      shell: bash
      run: yarn
    - name: Start Serverless Deployment
      shell: bash
      run: yarn serverless deploy --config serverless-\${{ inputs.stage }}.yml
\`\`\`

#### deploy-uat.yml

\`\`\`yml
name: Deploy Serverless Node File Generation Server
on:
  push:
    branches:
      - release/uat
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: deployment
    env: 
      AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
      REGION: ap-southeast-2
    steps:
      - name: Get Code
        uses: actions/checkout@v4
      - name: Start Deployment
        uses: ./.github/actions/deploy-serverless
        with:
          stage: uat
\`\`\`

#### deploy-prod.yml

\`\`\`yml
name: Deploy Serverless Node File Generation Server
on:
  push:
    branches:
      - release/prod
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: deployment
    env: 
      AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
      REGION: ap-southeast-2
    steps:
      - name: Get Code
        uses: actions/checkout@v4
      - name: Start Deployment
        uses: ./.github/actions/deploy-serverless
        with:
          stage: prod
\`\`\``;export{n as default};
