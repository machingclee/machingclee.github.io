const n=`---
title: "Simple Integration of Single Page App into Spring Boot"
date: 2026-04-24
id: blog0487
tag: react, springboot
toc: true
intro: "Study on integraing application into spring"
img: spring
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table td:first-child, table th:first-child {
    min-width: 120px;
  }
</style>

### Example Frontend Repository 

The following is a visualization tool of all commands, events and policies in a backend system:

- [A Built Demo](http://event-storming-example.s3-website.ap-northeast-2.amazonaws.com/)
- [2026-02-09-command-flow-visualizer Repo
](https://github.com/machingclee/2026-02-09-command-flow-visualizer)


![](/assets/img/2026-04-25-14-13-13.png)

### How does it work in Spring Boot
#### How Spring Boot serves the React Endpoint
- The react application is built into an \`index.html\` with several bundled files:

  ![](/assets/img/2026-04-25-14-01-28.png)

  These built files are relocated into 
  > \`src/main/resources/static/\` 

  in a spring boot project


- If our spring boot application can be accessed via the domain name \`some-domain.com\`, our ***react application*** will be available precisely at

  > \`some-domain.com\`

#### Routes for Data Fetching from the Same Origin 

- For the react app, in [this line of App.tsx](https://github.com/machingclee/2026-02-09-command-flow-visualizer/blob/main/src/App.tsx#L13) we fetch data from \`/api/commands/flow\` (hard-coded) and feed that data into our visualization component.

  This \`/api/commands/flow\` ***inside the react application*** will be resolved into 

  > \`some-domain.com/api/commands/flow\`

- This is exactly how our react application is deployed and how it fetches data from the same origin:

  ![](/assets/img/2026-04-25-15-33-19.png)`;export{n as default};
