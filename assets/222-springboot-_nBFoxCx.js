const n=`---
title: "Manage Environment Varisbles for Dev, Uat, Prod in Springboot Using a Single Yaml File"
date: 2023-12-08
id: blog0222
tag: java, springboot
intro: "Revisit the basic of springboot application."
toc: false
img: spring
---

<center></center>

We add \`application.yaml\` at the root project level and write

\`\`\`yml
spring:
  profiles:
    active: dev
person:
  lastName: Lovely James
  age: 18
  boss: false
  birth: 2023/12/09
  map:
    k1: v1
    k2: 12
  lists: [hehe, haha]
  dog:
    name: Bobby
    age: 2

---
spring:
  config:
    activate:
      on-profile: "dev"
server:
  port: 8080

---
spring:
  config:
    activate:
      on-profile: "uat"
server:
  port: 8081

---
spring:
  config:
    activate:
      on-profile: "prod"
server:
  port: 8082
\`\`\`

Next we run \`mvn package\` to generate our target \`jar\` file, for different \`env\` we use

\`\`\`text
java -jar "./springboot-revisit-0.0.1-SNAPSHOT.jar" --spring.profiles.active=prod
\`\`\`

to run the application with variables defined in \`prod\`.

Note that \`springboot\` will look for \`application.properties\`/\`application.yaml\` in

- \`./config\`
- \`./\`
- \`classpath:/config/\`
- \`classpath:/\`

It is not necesary to define the config file in \`resources/\` (which spring initizlizr does by default).
`;export{n as default};
