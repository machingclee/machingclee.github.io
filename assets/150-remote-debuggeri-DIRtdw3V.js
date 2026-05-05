const n=`---
title: "Remote Debugger for Spring Application"
date: 2023-07-02
id: blog0150
tag: java, springboot
intro: "We list the standard procedures to debug a dockerized spring application."
toc: true
---

### Reference

- [Link](https://ckinan.com/blog/remote-debug-spring-boot-docker-intellij/)

### Docker Image

At the project root level of our spring application, we make a simple \`Dockerfile\` as follows

\`\`\`docker
FROM maven:3.8.3-openjdk-17
RUN mkdir -p /usr/src/wbbackendboot
COPY . /usr/src/wbbackendboot
WORKDIR /usr/src/wbbackendboot

RUN mvn install
EXPOSE 8090
\`\`\`

We intentionally not to start the program via \`CMD\` or \`ENTRYPOINT\` because

- We want the docker image to run in 3 environments using 3 diffeent property files.
- We want to debug the docker image whenever we want.

Having \`CMD\` and \`ENTRYPOINT\` to be empty leaves the room for such flexibility.

### docker-compose file

\`\`\`yml-1
version: "3.3"
services:
  wb-backend-boot:
    image: wb-backend:1.0
    command:
      - /bin/bash
      - -c
      - |
        sed -i s/spring.redis.host=127.0.0.1/spring.redis.host=redis/ /usr/src/wbbackendboot/src/main/resources/application-local.properties
        mvn install
        java -jar -Dspring.profiles.active=local target/wb_backend-0.0.1-SNAPSHOT.jar
    environment:
      - JAVA_TOOL_OPTIONS=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005
    ports:
        - 8090:8090
        - 5005:5005
      restart: always
    volumes:
      - type: bind
        source: ~/.aws
        target: /root/.aws # it needs absolute path, when I run cd ~/.aws && pwd, I get /root/.aws
        read_only: true
  redis:
    image: redis
    ports:
      - 6379:6379
\`\`\`

#### Deploying in Different Environment

In line 11 we have

- \`-Dspring.profiles.active=local\`

This is a built-in param for spring project, which make spring pick \`application-local.properties\` as the property file (same role as environment variable in nodejs).

#### Remote Debugger

In line 13 we have

- \`\`\`text
  JAVA_TOOL_OPTIONS=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005
  \`\`\`

- The backend can still be accessed through 8090, and in addition we can remote debug the spring project via port 5005.

- Once the docker container is running, we can debug the spring project inside the container via port 5005 with the following config in vscode:

  \`\`\`json
  {
    "version": "0.2.0",
    "configurations": [
      {
        "type": "java",
        "name": "Debug (Attach)",
        "projectName": "MyApplication",
        "request": "attach",
        "hostName": "localhost",
        "port": 5005
      }
    ]
  }
  \`\`\`

  Or otherwise we can as well remote debug in IntelliJ:

  <Center>
    <a href="/assets/tech/150/001.png">
      <img src="/assets/tech/150/001.png" width="100%"/>
    </a>
  </Center>
  <p></p>

- Although it is conveninent, unlike local debugger we cannot access the variable and play around with methods of the object as in the debug console of vscode.

  But we can still see the detailed of each variable captured in the debugger on the left column of vscode. We can read it, but cannot access it.

#### Redis

Since we run 2 containers in the same network, our container named \`wb-backend-boot\` will connect to the redis service by using \`redis\` (container name) as the host. This explains line 9 for text substitution of property file.
`;export{n as default};
