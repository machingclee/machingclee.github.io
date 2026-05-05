const e=`---
title: "Generate Typescript Interfaces from Swagger-UI"
date: 2025-03-20
id: blog0375
tag: swagger-ui
toc: true
intro: "We record how to transform all the schemas in swagger ui into typescript interfaces."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Dependencies

\`\`\`text
yarn add --dev typescript openapi-typescript
\`\`\`

### Scripts to Compile schemas of Swagger-UI

\`\`\`text
yarn openapi-typescript http://localhost:4000/api -o src/types/api.ts
\`\`\`

Note that the script can be executed only when a swagger doc is running.

### Result

Now the results are saved in \`src/types/api.ts\`:

[![](/assets/img/2025-03-23-00-06-31.png)](/assets/img/2025-03-23-00-06-31.png)
`;export{e as default};
