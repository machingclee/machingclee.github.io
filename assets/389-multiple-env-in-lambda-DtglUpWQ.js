const n=`---
title: How to work with Multiple ENV files in Serverless Framework??
date: 2025-04-24
id: blog0389
tag: serverless, nodejs, env
toc: true
intro: "Record method to load multiple env files in serverless framework."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Preface

We can hard-code those env values into \`serverless.yml\`, but of course it is not ideal.

If we have already separated variables into default-one and stage-specific ones, we definitely want to reuse them.

### Requirements

- A plugin \`serverless-dotenv-plugin\` is required to load multiple env files and;

- We need to write custom \`parser\` when our env file is a \`json\` file (more readable than an ordinary \`.env\` file, especially when there is a long array).

### Deployment Configuration

#### The \`serverless.yml\`

Here the order of variables in \`path\` does matter, varibles in \`.env.dev.json\` can override those in \`.env.json\`:

\`\`\`yml{4-9}
plugins:
  - serverless-dotenv-plugin
......
custom:
  dotenv:
    path:
      - .env.json
      - .env.dev.json
    dotenvParser: "./jsonParser.js"
\`\`\`

The parameter \`dotenvParser\` is optional, as long as our \`.env\` files are simply \`key=value\`'s, otherwise we need a parser to process non-ordinary values (like an array).

#### \`jsonParser.js\`

\`\`\`js-1{14-18}
const fs = require("fs");

module.exports = function ({ paths }) {
  const envVarsArray = paths.map((path) => {
    try {
      const fileContent = fs.readFileSync(path, "utf8");
      const jsonData = JSON.parse(fileContent);

      const stringifiedData = {};
      for (const key in jsonData) {
        const value = jsonData[key];
        const ordinaryENVType = ["string", "boolean", "number"];

        if (ordinaryENVType.includes(typeof value)) {
          stringifiedData[key] = jsonData[key];
        } else if (Array.isArray(jsonData[key])) {
          stringifiedData[key] = jsonData[key].map((v) => String(v)).join(",");
        } else {
          //ignore
        }
      }

      return stringifiedData;
    } catch (error) {
      console.error(\`Error reading/parsing \${path}:\`, error.message);
      return {};
    }
  });

  return envVarsArray.reduce((acc, curr) => ({ ...acc, ...curr }), {});
};
\`\`\`

Special treatments have been made from line 14-18, any list is transformed into \`,\`-concated string (remember to split by \`,\` in the program).
`;export{n as default};
