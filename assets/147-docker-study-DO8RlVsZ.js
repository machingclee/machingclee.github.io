const n=`---
title: "Revisit Docker and Gitlab-CI"
date: 2023-06-23
id: blog0140
tag: docker, cicd, gitlab
intro: "Revisit the fundamentals of docker and the related gitlab-ci workflow."
toc: true
---

### Docker

#### Basic Commands

- \`docker ps\` List all running containers
- \`docker ps -a\` List all container regardless of if it is runing
- \`docker run <image-tag>\` Run a docker image
- \`docker run -d <image-tag>\` Run a docker image in detached mode
- \`docker stop <container-id>\` Stop a container by and
- \`docker start <same-id>\` Get a list of all available images \`docker images\`
- \`docker run -p6000:6379 redis\` Specify the port from our computer to the port used by the image in the container
- \`docker logs <container-name>\` See the log of the container
- \`docker run redis --name old_redis\` Provides a name to a container
- \`docker exec -it <image-name> /bin/bash\` ssh into the container, and \`exit\` to get out
- \`docker logs <container-name> | tail\` Display the stream of log lines
- \`docker rm -f $(docker ps -a -q)\` Delete all running container
- \`docker rmi -f $(docker images -aq)\` Delete all images forcefully

#### Docker Network

##### Basic Commands

- \`docker network create <network-name>\` Create a network
- \`docker network ls\` List all networks

We run two docker images in the same network:

- \`\`\`docker
    docker run -p 27017:27017 \\
    -d \\
    -e MONGO_INITDB_ROOT_USERNAME=admin \\
    -e MONGO_INITDB_ROOT_PASSWORD=123 \\
    --name mongodb \\
    --net mongo-network \\
    mongo
  \`\`\`
- \`\`\`docker
    docker run -d -p 8081:8081 \\
    -e ME_CONFIG_MONGODB_ADMINUSERNAME=admin \\
    -e ME_CONFIG_MONGODB_ADMINPASSWORD=123 \\
    --net mongo-network \\
    --name mongo-express \\
    -e ME_CONFIG_MONGODB_SERVER=mongodb \\
    mongo-express
  \`\`\`

##### How do Two Containers Communicate?

When both container are in the same network, they can commnunicate with each other by **container-name** as a domain.

#### Docker-Compose and Dependencies

##### The Basic Structure of \`docker-compose.yaml\`

We don't need to specify the network as \`docker-compose\` takes care of it.

\`\`\`yaml
version: "3"
services:
  mongodb: # container name (--name param)
    image: mongo # the image tag
    ports:
      - 27017:27017
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=123
  mongo-express:
    image: mongo-express
    ports:
      - 8080:8081
    depends_on:
      - mongodb # wait for the container mongodb to start
    environment:
      - ME_CONFIG_MONGODB_ADMINUSERNAME=admin
      - ME_CONFIG_MONGODB_ADMINPASSWORD=123
      - ME_CONFIG_MONGODB_SERVER=mongodb
\`\`\`

- Now we can run \`docker-compose -f mongo.yaml up -d\` to run both \`mongo\` and \`mongo-express\` containers.
- We can stop the containers and remove the network by \`docker-compose -f mongo.yaml down\`.

##### Communication Between Two Images in Docker-Compose

In my \`index.ts\` I have written a simple backend:

\`\`\`typescript-1
import express, { Request, Response } from "express";
import mongoose, { InferSchemaType, Schema } from "mongoose";

const mongoDbContainerName = "mongodb-test";
const dbName = "JamesTestDB";

(async () => {
  try {
    console.log("Start mongo connection ...");
    await mongoose.connect(
      \`mongodb://admin:123@\${mongoDbContainerName}:27017/\${dbName}?authSource=admin\`,
      {
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000,
      }
    );
    console.log("Connected!");
  } catch (e) {
    console.log("Connection Failed");
    console.log(JSON.stringify(e));
  }

  const app = express();

  const studentSchema = new Schema({
    name: { type: String, default: "hahaha" },
    age: { type: Number, min: 18, index: true },
  });
  type Student = InferSchemaType<typeof studentSchema>;

  const StudentModel = mongoose.model<Student>("Student", studentSchema);

  app.get(
    "/add-student",
    async (
      req: Request<{}, {}, {}, { age: number; name: string }>,
      res: Response
    ) => {
      const { age, name } = req.query;
      await StudentModel.create({ age, name });
      res.json({ success: true, msg: \`\${name} of age \${age} is created.\` });
    }
  );
  app.listen(3000);
})();
\`\`\`

As we can see in line 11 our containers in the same \`network\` can communicate with each other using the running container \`name\`.

#### Build Docker Images

Suppose that we have a backend service written in node-js and we want to dockerize it:

<Center>
    <img src="/assets/tech/140/001.png"/>
</Center>

<p></p>
<center></center>

We write the following in \`Dockerfile.backend\`:

\`\`\`dockerfile
FROM node:13-alpine

# ENV MONGO_DB_USERNAME=admin
# ENV MONGO_DB_PWD=123

RUN mkdir -p /home/app
COPY ./backend /home/app

CMD ["npm", "run", "start"]
\`\`\`

and run

\`\`\`text
docker build -t add-user:1.0 -f Dockerfile.backend .
\`\`\`

- \`-t\` means a tuple \`<img_name>:<version>\`, it is used for images.
- We also have a concept of \`name\`, which is for the name of **running container**.
- In short, \`tags\` are for launching the containers, \`names\` are for utilizing running containers.

#### Volumes

- \`docker volume rm $(docker volume ls -q) -f\` Remove all volume

\`\`\`yaml
version: "3"
services:
  add-user:
    image: add-user:1.0
    ports:
      - 3000:3000
    depends_on:
      - mongodb-test
  mongodb-test: # container name (--name param)
    image: mongo # the image tag
    ports:
      - 27018:27017
    environment:
      - MONGO_INITDB_DATABASE=JamesTestDB
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=123
    volumes:
      - mongo-data:/data/db # position to save db data within the container
      - ./init-mongo.js:/docker-entrypoint-initdb.d/init-mongo.js
  mongo-express:
    image: mongo-express
    restart: always
    ports:
      - 8080:8081
    depends_on:
      - mongodb-test # wait for the container mongodb to start
    environment:
      - ME_CONFIG_MONGODB_ADMINUSERNAME=admin
      - ME_CONFIG_MONGODB_ADMINPASSWORD=123
      - ME_CONFIG_MONGODB_SERVER=mongodb-test
volumes:
  mongo-data: # volume name
    driver: local
\`\`\`

- For windows volums are saved in

  - \`\\\\wsl$\\docker-desktop-data\\version-pack-data\\community\\docker\\volumes\`

- For linux/mac the volumes are saved in \`/var/lib/docker\`

### Gitlab-CI (\`.gitlab-ci.yml\`)

#### EC2 Instance

- We will be developing a workflow automating the deployment to dev server (an ec2 instance).

- For this, to avoid prefixing our docker command by \`sudo\`, we:

  1. \`ssh\` into an ec2 instance
  2. \`newgrp docker\`
  3. \`sudo usermod -aG docker ubuntu\`
  4. \`sudo chown $USER /var/run/docker.sock\`

- Now in gitlab > settings > CICD > variables, we put our \`SSH\` key (cat \`*.pem\` and copy) into a variable.

  Be reminded that we need to put an empty line at the bottom (line 5 below):

  \`\`\`text-1
  -----BEGIN OPENSSH PRIVATE KEY-----
  ...
  EQIMHa10Q+ZGHab9dGSTTAxGcK7gjqq/qWXmrrjYGEaaAAAAAAECAwQF
  -----END OPENSSH PRIVATE KEY-----

  \`\`\`

  and be remined to set the variable type to \`ENV_VAR\`, **_not_** \`FILE\`.

- Now our deployment job in simplest term:

  \`\`\`yml
  deploy_to_dev:
    stage: deploy
    before_script:
      - "which ssh-agent || ( apt-get install -qq openssh-client )"
      - mkdir -p ~/.ssh
      - touch ~/.ssh/id_rsa
      - echo "$SSH_PRIVATE_KEY" | tr -d '\\r' > ~/.ssh/id_rsa
      - chmod 600 ~/.ssh/id_rsa
      - echo -e "Host *\\nStrictHostKeyChecking no\\n" > ~/.ssh/config
      - eval "$(ssh-agent -s)"
      - ssh-add ~/.ssh/id_rsa

    script: # skip the checking of authenticity of host by -o
      - ssh ubuntu@$DEV_SERVER_IP \\
        "
        docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY &&
        docker run -d -p 3000:3000 $IMAGE_NAME:$IMAGE_TAG
        "
  \`\`\`

#### Environment Field

For each job we can provide \`name\` and \`url\` in environment:

\`\`\`yml
deploy_to_dev:
  ...
  environment:
    name: development
    url: $DEV_ENDPOINT
\`\`\`

<Center>
  <a href="/assets/tech/140/002.png">
    <img src="/assets/tech/140/002.png" width="100%"/>
  </a>
</Center>

<p/>
<center></center>

And we can click "Open" to get to \`url\` (\`$DEV_ENDPOINT\`) directly.

#### Complete Pipeline by Docker Command

- Here we intentionally put \`IMAGE_NEW_TAG\` and \`IMAGE_OLD_TAG\` into variables in order to stop and remove the previous container and run our new container.

- The \`IMAGE_LAUNCH_NAME\` is to be provided in \`--name\` argument when executing \`docker\` commnad (therefore we can stop the container accurately).

\`\`\`yml
workflow:
  rules:
    - if: $CI_COMMIT_BRANCH != "main" && $CI_PIPELINE_SOURCE != "merge_request_event"
      when: never # i.e., don't except when if condition is met.
    - when: always

variables:
  IMAGE_NAME: $CI_REGISTRY_IMAGE
  IMAGE_NEW_TAG: "1.1.1"
  IMAGE_OLD_TAG: "1.1"
  DEV_SERVER_IP: ec2-43-200-179-107.ap-northeast-2.compute.amazonaws.com
  DEV_ENDPOINT: http://$DEV_SERVER_IP:3000
  IMAGE_LAUNCH_NAME: cicd_test

stages:
  - test
  - build
  - deploy

run_unit_tests:
  stage: test
  image: node:17-alpine3.14
  before_script:
    - cd app
    - npm install
  script:
    - npm test
  artifacts:
    when: always
    paths:
      - app/junit.xml
    reports:
      junit: app/junit.xml

build_and_push_image:
  image: docker
  services:
    - docker:dind
  stage: build
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $IMAGE_NAME:$IMAGE_NEW_TAG .
    - docker push $IMAGE_NAME:$IMAGE_NEW_TAG

deploy_to_dev:
  stage: deploy
  before_script:
    - "which ssh-agent || ( apt-get install -qq openssh-client )"
    - mkdir -p ~/.ssh
    - touch ~/.ssh/id_rsa
    - echo "$SSH_PRIVATE_KEY" | tr -d '\\r' > ~/.ssh/id_rsa
    - chmod 600 ~/.ssh/id_rsa
    - echo -e "Host *\\nStrictHostKeyChecking no\\n" > ~/.ssh/config
    - eval "$(ssh-agent -s)"
    - ssh-add ~/.ssh/id_rsa

  script: # skip the checking of authenticity of host by -o
    - ssh ubuntu@$DEV_SERVER_IP \\
      "
      docker stop $IMAGE_LAUNCH_NAME ||
      docker image rm -f $IMAGE_NAME:$IMAGE_OLD_TAG ||
      docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY &&
      docker run -d -p 3000:3000 --name $IMAGE_LAUNCH_NAME $IMAGE_NAME:$IMAGE_NEW_TAG
      "
  environment:
    name: development
    url: $DEV_ENDPOINT
\`\`\`

#### Simplify Pipeline Script by Anchors

- We note that the script in \`deploy_to_dev.before_script\` is reusable for other jobs that need \`ssh\` connection (like we need to \`ssh\` into different ec2 instances for pulling and deploying images).
- The only value that is variable is the \`$SSH_PRIVATE_KEY\`, we extract out this as a parameter and write an ignored job:

  \`\`\`yml
  .ssh_config:
    variables:
      PRIVATE_KEY: to_be_overridden
    before_script: &create_dotssh_config
      - "which ssh-agent || ( apt-get install -qq openssh-client )"
      - mkdir -p ~/.ssh
      - touch ~/.ssh/id_rsa
      - echo "$PRIVATE_KEY" | tr -d '\\r' > ~/.ssh/id_rsa
      - chmod 600 ~/.ssh/id_rsa
      - echo -e "Host *\\nStrictHostKeyChecking no\\n" > ~/.ssh/config
      - eval "$(ssh-agent -s)"
      - ssh-add ~/.ssh/id_rsa
  \`\`\`

  Here we anchor the reusable part by writing \`&create_dotssh_config\` next to the key name. We can think it as packing the array of script into a variable.

- By the way, we can also anchor other fields like \`variables\`, \`script\` etc.

- We will unpack the value by writing (same syntax as python)
  \`\`\`yml
  some_job:
    ...
    variables:
      PRIVATE_KEY: some_private_key
      ...
    before_script:
      - *create_dotssh_config
  \`\`\`
  We demonstrate a real use case in the next section.

#### Complete Pipeline by Docker-Compose Up

##### The docker-compose.yml

- In \`docker-compose up\` we can inject variable by environment variable, we simply write \`\${VAR_NAME}\` to take \`VAR_NAME\` from environment variable.

  \`\`\`yml
  version: "3.3"
  services:
    app:
      image: \${DC_IMAGE_NAME}:\${DC_IMAGE_TAG}
      ports:
        - \${DC_APP_PORT}:3000
  \`\`\`

- Later in the pipeline we will execute \`export VAR_NAME=$VAR_NAME\` after we \`ssh\` into the ec2 instance.

- The \`docker-compose.yml\` file is available in local and in docker executor, however, it is not available in our ec2 instance.

- We need to \`scp\` the file from docker executor into ec2, which is extremely easy because we have \`*create_dotssh_config\` in line 63 below.

- It is now as simple as doing an \`scp file_path remote:destination_path\`.

##### The Complete Pipeline

- By \`docker-compose up\` and \`down\` we can further remove the management of stopping, deleting and starting containers using the exact container name (for stopping) and image name (for deleting).

- Note that we will apply anchor in line 63. We provide the required parameter in \`variables\` field.

\`\`\`yml-1
workflow:
  rules:
    - if: $CI_COMMIT_BRANCH != "main" && $CI_PIPELINE_SOURCE != "merge_request_event"
      when: never # i.e., don't except when if condition is met.
    - when: always

.ssh_config:
  variables:
    PRIVATE_KEY: to_be_overridden
  before_script: &create_dotssh_config
    - "which ssh-agent || ( apt-get install -qq openssh-client )"
    - mkdir -p ~/.ssh
    - touch ~/.ssh/id_rsa
    - echo "$PRIVATE_KEY" | tr -d '\\r' > ~/.ssh/id_rsa
    - chmod 600 ~/.ssh/id_rsa
    - echo -e "Host *\\nStrictHostKeyChecking no\\n" > ~/.ssh/config
    - eval "$(ssh-agent -s)"
    - ssh-add ~/.ssh/id_rsa

variables:
  IMAGE_NAME: $CI_REGISTRY_IMAGE
  IMAGE_TAG: "1.1.1"
  DEV_SERVER_IP: ec2-43-200-179-107.ap-northeast-2.compute.amazonaws.com
  DEV_ENDPOINT: http://ec2-43-200-179-107.ap-northeast-2.compute.amazonaws.com:3000

stages:
  - test
  - build
  - deploy

run_unit_tests:
  stage: test
  image: node:17-alpine3.14
  before_script:
    - cd app
    - npm install
  script:
    - npm test
  artifacts:
    when: always
    paths:
      - app/junit.xml
    reports:
      junit: app/junit.xml

build_and_push_image:
  image: docker
  services:
    - docker:dind
  stage: build
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $IMAGE_NAME:$IMAGE_TAG .
    - docker push $IMAGE_NAME:$IMAGE_TAG

deploy_to_dev:
  stage: deploy
  variables:
    PRIVATE_KEY: $SSH_PRIVATE_KEY
  before_script:
    - *create_dotssh_config
  script: # skip the checking of authenticity of host by -o
    - scp ./docker-compose.yaml ubuntu@$DEV_SERVER_IP:/home/ubuntu
    - ssh ubuntu@$DEV_SERVER_IP \\
      "
      export DC_IMAGE_NAME=$IMAGE_NAME &&
      export DC_IMAGE_TAG=$IMAGE_TAG &&
      export DC_APP_PORT=3000 &&
      docker-compose -f docker-compose.yaml down &&
      docker-compose -f docker-compose.yaml up -d
      "
  environment:
    name: development
    url: $DEV_ENDPOINT
\`\`\`

Message in the final successful stage:

\`\`\`text
Running with gitlab-runner 16.1.0~beta.59.g83c66823 (83c66823)
  on blue-3.shared.runners-manager.gitlab.com/default zxwgkjAP, system ID: s_284de3abf026
  feature flags: FF_USE_IMPROVED_URL_MASKING:true
Preparing the "docker+machine" executor
00:18
Using Docker executor with image ruby:3.1 ...
Pulling docker image ruby:3.1 ...
Using docker image sha256:4c15cd7ed497ca89f07ce3c76397de8dc8837ad1ae775ed3723da91c045f8cf2 for ruby:3.1 with digest ruby@sha256:eaa279f11332531fe2569a86821c36337cdf620374c9b091088751d7870459fe ...
Preparing environment
00:05
Running on runner-zxwgkjap-project-46900231-concurrent-0 via runner-zxwgkjap-shared-1687454283-ac6dc2ae...
Getting source from Git repository
00:00
Fetching changes with git depth set to 20...
Initialized empty Git repository in /builds/machingclee/mynodeapp-cicd-project/.git/
Created fresh repository.
Checking out 8254fa01 as detached HEAD (ref is main)...
Skipping Git submodules setup
$ git remote set-url origin "\${CI_REPOSITORY_URL}"
Downloading artifacts
00:02
Downloading artifacts for run_unit_tests (4524424940)...
Downloading artifacts from coordinator... ok        host=storage.googleapis.com id=4524424940 responseStatus=200 OK token=64_MqSLz
Executing "step_script" stage of the job script
00:09
Using docker image sha256:4c15cd7ed497ca89f07ce3c76397de8dc8837ad1ae775ed3723da91c045f8cf2 for ruby:3.1 with digest ruby@sha256:eaa279f11332531fe2569a86821c36337cdf620374c9b091088751d7870459fe ...
$ which ssh-agent || ( apt-get install -qq openssh-client )
/usr/bin/ssh-agent
$ mkdir -p ~/.ssh
$ touch ~/.ssh/id_rsa
$ echo "$PRIVATE_KEY" | tr -d '\\r' > ~/.ssh/id_rsa
$ chmod 600 ~/.ssh/id_rsa
$ echo -e "Host *\\nStrictHostKeyChecking no\\n" > ~/.ssh/config
$ eval "$(ssh-agent -s)"
Agent pid 19
$ ssh-add ~/.ssh/id_rsa
Identity added: /root/.ssh/id_rsa (/root/.ssh/id_rsa)
$ scp ./docker-compose.yaml ubuntu@$DEV_SERVER_IP:/home/ubuntu
Warning: Permanently added 'ec2-43-200-179-107.ap-northeast-2.compute.amazonaws.com' (ED25519) to the list of known hosts.
$ ssh ubuntu@$DEV_SERVER_IP \\ " export DC_IMAGE_NAME=$IMAGE_NAME && export DC_IMAGE_TAG=$IMAGE_NEW_TAG && export DC_APP_PORT=3000 && docker-compose -f docker-compose.yaml down && docker-compose -f docker-compose.yaml up -d "
 Container ubuntu-app-1  Stopping
 Container ubuntu-app-1  Stopping
 Container ubuntu-app-1  Stopped
 Container ubuntu-app-1  Removing
 Container ubuntu-app-1  Removed
 Network ubuntu_default  Removing
 Network ubuntu_default  Removed
 Network ubuntu_default  Creating
 Network ubuntu_default  Created
 Container ubuntu-app-1  Creating
 Container ubuntu-app-1  Created
 Container ubuntu-app-1  Starting
 Container ubuntu-app-1  Started
Cleaning up project directory and file based variables
00:00
Job succeeded
\`\`\`
`;export{n as default};
