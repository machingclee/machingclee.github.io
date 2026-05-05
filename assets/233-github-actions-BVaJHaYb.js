const n=`---
title: "Fundamentals of Github Actions"
date: 2024-01-16
id: blog0233
tag: cicd, github-actions
intro: "Fundamental and basic use of github actions."
toc: true
---

<style>
  img {
    max-width: 660px
  }
</style>

### Basic Structure by Real Example

Every workflow must be stored inside \`.github/workflows/name.yml\`


#### Deploy Documentation Project

\`\`\`yaml
name: Deploy wonderbricks wiki
on:
  push:
    branches:
      - main
jobs:
  deploy:
    permissions:
      id-token: write
      contents: read
    runs-on: ubuntu-latest
    environment: deployment
    steps:
      - name: Get code
        uses: actions/checkout@v4
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::798404461798:role/github-wonderbricks-wiki-cicd
          aws-region: ap-southeast-2
      - name: install nodejs
        uses: actions/setup-node@v4
        with:
          node-version: 18
      - name: Cache dependencies
        id: cache
        uses: actions/cache@v3
        with:
          path: node_modules
          key: wonderbricks-wiki-modules-\${{ hashFiles('**/yarn.lock') }}
      - name: NPM Install by yarn
        if: steps.cache.outputs.cache-hit != 'true'
        run: yarn
      - name: Start Deployment
        run: yarn deploy
\`\`\`

### Fundamentals

#### Dependencies

\`\`\`yaml
jobs:
  deploy:
    needs: [test, job2]
\`\`\`

#### Trigger Actions Manually and more Event Triggers

- [Documentation of Event Triggers](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)
- \`\`\`yaml
  name: Deploy Project
  on:
    push:
      branches:
        - main
    workflow_dispatch:
  \`\`\`

#### Access Context Variables

- [Documentation of all Context Variables](https://docs.github.com/en/actions/learn-github-actions/contexts)
- Accessible by \`\${{ github }}\`

#### Multiple Branch that Triggers an Action

\`\`\`yaml
name: Events
on:
  pull_request:
    types:
      - opened
  workflow_dispatch:
  push:
    branches:
      - main
      - "dev-*"
      - "feat/**"
\`\`\`

#### Skip an Action
##### By Specifying Filepaths
\`\`\`yaml
  push:
    branches:
      - main
      - "dev-*"
      - "feat/**"
  paths-ignore:
    - '.github/workflows/*'
\`\`\`
##### By Commit Message
Include one of the following in our commit message:
- \`[skip ci]\`
- \`[ci skip]\`
- \`[no ci]\`
- \`[skip actions]\`
- \`[actions skip]\`

#### Artifacts

[Documentation on Artifacts](https://github.com/actions/upload-artifact)

##### Upload and zip an Artifact
\`\`\`yaml
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Build website
        run:  npm run build
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist-files
          path: |
            dist
            package.json
\`\`\`
##### Retrieve and Unzip the Artifact
\`\`\`yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Get build artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist-files
          path: some/dir (optional)
\`\`\`

#### Share Variables Among Jobs
##### Declare Output Variable in One Job


\`\`\`yaml
  build:
    outputs:
      script-file: \${{ steps.publish.outputs.something }}
    steps:
      - name: Get Code
        uses: actions/checkout@v3
      - name: Install Dependencies
        run: yarn
      - name: Build Website
        run: yarn build
      - name: Publish Js Filename
        id: publish
        run: find dist/assets/*.js -type f -execdir echo 'something={}' >> $GITHUB_OUTPUT ';'
\`\`\`


##### Retrive this Variable in Other job
\`\`\`yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Get Build Artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist-files
      - name: Output filename
        run: echo "\${{ needs.build.outputs.script-file }}"
\`\`\`

#### Environment Variabls (Workflow Level, Job Level)
Note that \`env\` can be at **workflow** level or at **job** level.
\`\`\`yaml
name: Deployment
on:
  push:
    branches:
      - main
env:
  MONGODB_DB_NAME: github-actions
jobs:
  test:
    env:
      MONGO_DB_HOST: localhost:20717
      MONGODB_USERNAME: test
      MONGODB_PASSWORD: test
\`\`\`

#### Versioning Environment Variable
In paid version we can choose the version (via environment key)
\`\`\`yaml
jobs:
  test:
    environment: testing
    env:
      MONGO_DB_HOST: localhost
      MONGODB_USERNAME: \${{ secrets.MONGODB_USERNAME }}
      MONGODB_PASSWORD: \${{ secrets.MONGODB_PASSWORD }}
      PORT: 8080
\`\`\`

#### Catching Failure
##### Catching for Step
Once any of the previous step fails, we can use failure() the catch it.
\`\`\`yaml
      - name: Test Code
        id: run-tests
        run: yarn test
      - name: Upload Test Report
        if: failure() && steps.run-tests.output == 'failure'
        uses: actions/upload-artifact@v4
        with:
          name: test-report
          path: test.json
\`\`\`
##### Catching for jobs
We can define a job to wait for at least one failure of the other jobs
\`\`\`yaml
  report:
    needs: [lint, deploy]
    if: failure()
    runs-on: ubuntu-latest
    steps:
      - name: Output Information
        run: |
          echo "Something went wrong"
          echo "\${{ github }}"
\`\`\`

#### Caching
\`\`\`yaml
      - name: Cache dependencies
        id: cache
        uses: actions/cache@v3
        with:
          path: node_modules
          key: modules-\${{ hashFiles('**/yarn.lock') }}
      - name: NPM Install by yarn
        if: steps.cache.outputs.cache-hit != 'true'
        run: yarn
\`\`\`

#### Continue a job even Error Occurs

\`\`\`yaml
      - name: Test Code
        continue-on-error: true
        id: run-tests
        run: yarn test
\`\`\`


#### Matrix
##### Catesian Products

6 jobs will be executed:

\`\`\`yaml
  repeated-job:
    strategy:
      matrix:
        node-version: [12, 14, 16]
        operating-system: [ubuntu-latest, windows-latest]
    runs-on: \${{ matrix.operatoring-system }}
    steps:
      - name: Echo Node Version
        run: echo \${{ matrix.node-version }}
\`\`\`

##### Combinations
\`\`\`yaml
  repeated-job:
    strategy:
      matrix:
        # node-version: [12, 14, 16]
        # operating-system: [ubuntu-latest, windows-latest]
        include:
          - node-version: 18
            operating-system: ubuntu-latest
          - node-version: 12
            operating-system: windows-latest
    runs-on: \${{ matrix.operatoring-system }}
    steps:
      - name: Echo Node Version
        run: echo \${{ matrix.node-version }}
\`\`\`



#### Reusable Job

##### Define the Reusable Workflow Detail
Though it is called **reusable workflow**, but such a workflow is called directly whin a job, they are actually **reusuable jobs**.

\`\`\`yaml
name: Reusable Deploy
on:
  workflow_call:
    inputs:
      artifact-name:
        description: The name of the deployable artifact files
        required: false
        default: dist
        type: string
    outputs:
      result:
        description: The result of the deployment operation
        value: \${{ jobs.deploy.outputs.outcome }}    # declare a variable to be set in subseq job
    secrets:
      some-secret:
        required: false

jobs:
  deploy:
    outputs:
      outcomes: \${{ steps.set-result.outputs.step-result }} # declare another variable to be set in subseq step
    runs-on: ubuntu-latest
    steps:
      - name: Get Code
        uses: actions/download-artifact@v4
        with: 
          name: \${{ inputs.artifact-name }}
      - name: List Files
        run: ls
      - name: Set Step Output
        id: set-result
        run: echo "step-result=success" >> $GITHUB_OUTPUT
\`\`\`


##### Reuse that job

\`\`\`yaml
  another_deploy:
    needs: build
    uses: ./.github/workflows/reusable.yml
    with:
      artificat-name: dist-files
    secrets:
      some-secret: \${{ secrets.some-secret }}
  print-deploy-result:
    needs: another_deploy
    runs-on: ubuntu-latest
    steps:
      - name: Print reusuable deploy output
        run: echo "\${{ needs.another_deploy.outputs.result }}"
\`\`\`


#### Container and Service Container
##### Running jobs in Container
- We can define a container and *run our steps inside that container* as if we are running those jobs in \`ubuntu-latest\` as before.

- Working inside a container makes perfect sense if \`ubuntu-latest\` does not provide everything we need (like we want a virtual environment with specific packages pre-installed).

\`\`\`yaml
jobs:
  test:
    environment: testing
    runs-on: ubuntu-latest
    container: 
      image: node:16
      env:
        MONGO_CONNECTON_PROTOCOL: mongodb+srv
        MONGODB_CLUSTER_ADDRESS: some-address
        MONGODB_USERNAME: \${{ secrets.MONCODB_USERNAME }}
        MONGODB_PASSWORD: \${{ secrets.MONCODB_PASSWORD }}
        PORT: 8080
  steps:
    - name: Get Code
      uses: action/checkout@v3
    - name: Cache dependencies
      ...
\`\`\`

##### Adding Service Container

Adding services attributes will make a workflow very similar to a docker-compose file.

\`\`\`yaml
jobs:
  test:
    environment: testing
    runs-on: ubuntu-latest
    container: 
      image: node:16
      env:
        MONGO_CONNECTON_PROTOCOL: mongodb
        MONGODB_CLUSTER_ADDRESS: mongodb
        MONGODB_USERNAME: root
        MONGODB_PASSWORD: example
        PORT: 8080
    services: # <--------------------------------- additional
      mongodb:
        image: mongo
        env:
          MONGO_INITDB_ROOT_USERNAME: root
          MONGO_INITDB_ROOT_PASSWORD: example
  steps:
    - name: Get Code
      uses: action/checkout@v3
    - name: Cache dependencies
      ...
\`\`\`

### Custom Actions

#### Composite Actions

- First we create a workflow file at

  - \`actions/cached-deps/action.yml\`

  The filename has to be \`action.yml\`. 

##### Format Without Inputs and Outputs

- A standard format of a composite action is:
  
  \`\`\`yaml
  name: 'Get & Cache Dependencies'
  decsription: 'Get the dependencies (via npm) and cache them.'
  runs:
    using: 'composite'
    steps:
      - name: Cache dependencies
        id: cache
        uses: actions/cache@v3
        with:
          path: node_modules
          key: node-modules-\${{ hashFiles('**/package-lock.json') }}
      - name: Install dependencies
        if: steps.cache.outputs.cache-hit != 'true'
        run: npm ci
        shell: bash
  \`\`\`
  
- Note that in composite actions if we use \`run\`, then it must be followed by \`shell\`, and we need to declare \`using: 'composite'\`

- then use it in this way:

  \`\`\`yaml
      steps:
        - name: Custom Load & Cache action
          uses: ./.github/actions/cached-deps
  \`\`\`

##### Format With Inputs

- Custom Action can also accept parameter:

  \`\`\`yaml
  name: 'Get & Cache Dependencies'
  decsription: 'Get the dependencies (via npm) and cache them.'
  inputs:
    caching:
      description: 'Whether to cache dependencies or not.'
      required: false
      default: 'true'
  runs:
    using: 'composite'
    steps:
      - name: Cache dependencies
        if: inputs.caching  # <----------- our input
        id: cache
        uses: actions/cache@v3
        with:
          path: node_modules
          key: node-modules-\${{ hashFiles('**/package-lock.json') }}
      - name: Install dependencies
        if: steps.cache.outputs.cache-hit != 'true'
        run: npm ci
        shell: bash
  \`\`\`

#### Javascript Actions

##### Without Inputs

- We need:
  - \`./.github/actions/deploy-s3-javascript/action.yml\`
  - \`./.github/actions/deploy-s3-javascript/main.js\`

- \`\`\`yaml
  # ./.github/actions/deploy-s3-javascript/action.yml
  name: 'Deploy to AWS S3'
  description: 'Deploy a static website via AWS S3'
  runs:
    using: 'node18'
    main: 'main.js'
  \`\`\`

- \`\`\`js
  // ./.github/actions/deploy-s3-javascript/main.js

  const core = require("@actions/core")
  const github = require("@actions/github")
  const exec = require("@actions/exec");

  function run() {
    core.notice("Hello from my custom Javascript Action.")
  }

  run();
  \`\`\`
- with 

  \`\`\`text
  npm install @actions/core @actions/github @actions/exec
  \`\`\`

- Return to \`deploy.yml\` and define a new job using this javascript action:

  \`\`\`yaml
  jobs:
    information:
      runs-on: ubuntu-latest
      steps:
        - name: Run custom action
          uses: ./.github/actions/deploy-s3-javascript
  \`\`\`
  > Note that at this point if we commit the changes we will get the error:
  > [![/assets/img/2024-01-19-03-18-59.png](/assets/img/2024-01-19-03-18-59.png)](/assets/img/2024-01-19-03-18-59.png)
  > this is because we need to checkout the \`main.js\` file as well.

- Therefore we need the following adjustment:

  \`\`\`yaml
  jobs:
    information:
      runs-on: ubuntu-latest
      steps:
        - name: Get code
          uses: actions/checkout@v4
        - name: Run custom action
          uses: ./.github/actions/deploy-s3-javascript
  \`\`\`

##### With Inputs and Outputs

- \`\`\`yaml
  # ./.github/actions/deploy-s3-javascript/action.yml

  name: 'Deploy to AWS S3'
  description: 'Deploy a static website via AWS S3'
  inputs:
    bucket:
      description: 'The S3 bucket name'
      required: true
    bucket-region:
      description: 'The region of the S3 bucket'
      required: false
      default: 'us-east-1'
    dist-folder:
      description: 'The folder containing the deployable files'
      required: true
  outputs:
    website-url:
      description: 'The URL of the deployed website'
  runs:
    using: 'node18'
    main: 'main.js'
  \`\`\`
- \`\`\`js
  // ./.github/actions/deploy-s3-javascript/main.js

  const core = require("@actions/core")
  const github = require("@actions/github")
  const exec = require("@actions/exec");

  function run() {
    const bucket = core.getInput('bucket', {required: true});
    const bucketRegion = core.getInput('bucket-region', {required: true});
    const distFolder = core.getInput('dist-folder', {required: true});

    const s3Uri = \`s3://\${bucket}\`;
    exec.exec(\`aws s3 sync \${distFolder} \${s3Uri} --region \${bucketRegion}\`)

    const website = \`http://\${bucket}.s3-website-\${bucketRegion}.amazonaws.com\`
    core.setOutput('website-url', webSiteUrl);
  }

  run(); 
  \`\`\`

- We can use this output via the standard trick in other \`run\`:
  \`\`\`yaml
  run: echo \${{ steps.deploy.outputs.website-url }}
  \`\`\`

#### Docker Actions

- We need (take python as an example):
  - \`./.github/actions/deploy-s3-docker/action.yml\`
  - \`./.github/actions/deploy-s3-docker/deployment.py\`
  - \`./.github/actions/deploy-s3-docker/Dockerfile\`
  - \`./.github/actions/deploy-s3-docker/requirements.txt\`

- \`\`\`yaml
  # ./.github/actions/deploy-s3-docker/action.yml

  name: 'Deploy to AWS S3'
  description: 'Deploy a static website via AWS S3'
  inputs:
    bucket:
      description: 'The S3 bucket name'
      required: true
    bucket-region:
      description: 'The region of the S3 bucket'
      required: false
      default: 'us-east-1'
    dist-folder:
      description: 'The folder containing the deployable files'
      required: true
  outputs:
    website-url:
      description: 'The URL of the deployed website'
  runs:
    using: 'docker'
    main: 'Dockerfile'
  \`\`\`
- Note that github actions generate \`env\` variable with the format:
  - \`INPUT_ + <our variable in all cap>\`
  \`\`\`py
  # ./.github/actions/deploy-s3-docker/deployment.py

  import os
  import boto3
  from botocore.config import Config

  def run():
    bucket = os.environ["INPUT_BUCKET"]
    bucket_region = os.environ["INPUT_BUCKET_REGION"]
    dist_folder = os.environ["INPUT_DIST-FOLDER"]

    configuration = Config(region_name=bucket_region)

    s3_client = boto3.client("s3", config = configuration)

    for root, subdirs, files in os.walk(dist_folder):
      for file in files:
        s3_client.upload_file(os.path.join(root, file), bucket, file)

    website_url = f"http://{bucket}.s3-website-{bucket_region}.amazonaws.com"
    print(f"::set-output name=website-url::{website_url}")

    if __name__ == "__main__":
      run()
  \`\`\`

- \`\`\`Dockerfile
  #  ./.github/actions/deploy-s3-docker/Dockerfile

  FROM python:3

  COPY requirements.txt /requirements.txt

  RUN pip install -r requirements.txt

  COPY deployment.py /deployment.py

  CMD ["python", "/deployment.py"]
  \`\`\`
- \`./.github/actions/deploy-s3-docker/requirements.txt\`
  \`\`\`text
  boto3==1.24.71
  botocore==1.27.71
  jmespath==1.0.1
  python-dateutil==2.8.2
  s3transfer==0.6.0
  six==1.16.0
  urllib3==1.26.12
  \`\`\`

`;export{n as default};
