---
title: "Fundamentals of Github Actions"
date: 2024-01-16
id: blog0233
tag: cicd, github-actions
intro: "Fundamental and basic use of github actions."
toc: true
---

#### Basic Structure by Real Example

Every workflow must be stored inside `.github/workflows/name.yml`


##### Deploy Documentation Project

```yaml
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
          key: wonderbricks-wiki-modules-${{ hashFiles('**/yarn.lock') }}
      - name: NPM Install by yarn
        if: steps.cache.outputs.cache-hit != 'true'
        run: yarn
      - name: Start Deployment
        run: yarn deploy
```

#### Fundamentals

##### Dependencies

```yaml
jobs:
  deploy:
    needs: [test, job2]
```

##### Trigger Actions Manually and more Event Triggers

- [Documentation of Event Triggers](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)
- ```yaml
  name: Deploy Project
  on:
    push:
      branches:
        - main
    workflow_dispatch:
  ```

##### Access Context Variables

- [Documentation of all Context Variables](https://docs.github.com/en/actions/learn-github-actions/contexts)
- Accessible by `${{ github }}`

##### Multiple Branch that Triggers an Action

```yaml
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
```

##### Skip an Action
###### By Specifying Filepaths
```yaml
  push:
    branches:
      - main
      - "dev-*"
      - "feat/**"
  paths-ignore:
    - '.github/workflows/*'
```
###### By Commit Message
Include one of the following in our commit message:
- `[skip ci]`
- `[ci skip]`
- `[no ci]`
- `[skip actions]`
- `[actions skip]`

##### Artifacts

[Documentation on Artifacts](https://github.com/actions/upload-artifact)

###### Upload and zip an Artifact
```yaml
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
```
###### Retrieve and Unzip the Artifact
```yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Get build artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist-files
          path: some/dir (optional)
```

##### Share Variables Among Jobs
###### Declare Output Variable in One Job


```yaml
  build:
    outputs:
      script-file: ${{ steps.publish.outputs.something }}
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
```


###### Retrive this Variable in Other job
```yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Get Build Artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist-files
      - name: Output filename
        run: echo "${{ needs.build.outputs.script-file }}"
```

##### Environment Variabls (Workflow Level, Job Level)
```yaml
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
```

##### Versioning Environment Variable
In paid version we can choose the version (via environment key)
```yaml
jobs:
  test:
    environment: testing
    env:
      MONGO_DB_HOST: localhost
      MONGODB_USERNAME: ${{ secrets.MONGODB_USERNAME }}
      MONGODB_PASSWORD: ${{ secrets.MONGODB_PASSWORD }}
      PORT: 8080
```

##### Catching Failure
###### Catching for Step
Once any of the previous step fails, we can use failure() the catch it.
```yaml
      - name: Test Code
        id: run-tests
        run: yarn test
      - name: Upload Test Report
        if: failure() && steps.run-tests.output == 'failure'
        uses: actions/upload-artifact@v4
        with:
          name: test-report
          path: test.json
```
###### Catching for jobs
We can define a job to wait for at least one failure of the other jobs
```yaml
  report:
    needs: [lint, deploy]
    if: failure()
    runs-on: ubuntu-latest
    steps:
      - name: Output Information
        run: |
          echo "Something went wrong"
          echo "${{ github }}"
```

##### Caching
```yaml
      - name: Cache dependencies
        id: cache
        uses: actions/cache@v3
        with:
          path: node_modules
          key: modules-${{ hashFiles('**/yarn.lock') }}
      - name: NPM Install by yarn
        if: steps.cache.outputs.cache-hit != 'true'
        run: yarn
```

##### Continue a job even Error Occurs

```yaml
      - name: Test Code
        continue-on-error: true
        id: run-tests
        run: yarn test
```


##### Matrix
###### Catesian Products

6 jobs will be executed:

```yaml
  repeated-job:
    strategy:
      matrix:
        node-version: [12, 14, 16]
        operating-system: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.operatoring-system }}
    steps:
      - name: Echo Node Version
        run: echo ${{ matrix.node-version }}
```

###### Combinations
```yaml
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
    runs-on: ${{ matrix.operatoring-system }}
    steps:
      - name: Echo Node Version
        run: echo ${{ matrix.node-version }}
```


##### Reusable Workflows

To be continued

