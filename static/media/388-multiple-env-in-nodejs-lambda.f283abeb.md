---
title: Multiple ENV Files for Nodejs Lambda Functions
date: 2025-04-24
id: blog0388
tag: serverless, nodejs
toc: true
intro: "Record `jsonParser` and special serverless plugins to intake multiple env files in a deployment."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

#### Usual Pattern for Multiple ENV Files

Inspired from spring boot project, a natural organization of env files in nodejs would be

![](/assets/img/2025-04-25-02-16-11.png)

where `.env.json` are shared variables, `.env.{dev,uat,prod}.json` are stage-specific variables that possibly override those in `.env.json`.

Apart from that, we would also have `.env.local` (git-ignored) that override the project config for debugging purpose.

Deployment scripts are usually like:

```json
"scripts": {
  "start": "env-cmd -f .env.json ts-node src/app.ts",
  "start:local": "env-cmd -f .env.json env-cmd -f .env.local.json ts-node src/app.ts",
  "start:dev": "env-cmd -f .env.json env-cmd -f .env.dev.json ts-node src/app.ts",
}
```

On the other hand, spring boot simply controls this by env variable

```env
SPRING_PROFILES_ACTIVE="a,b,c"
```

which tells spring boot to consume `application.yml` + `application-{a,b,c}.yml`, with `c` overriding `b`, `b` overriding `a`, etc.

This is proven to be a nice pattern, whenever we want to debug, just add a git-ignored `.env.local.json` env file that is **_not visible_** to any one.

#### How to work with Serverless Framework for Multiple ENV files?

##### Keypoints

- Special plugin is required to load multiple env file and
- we need to write custom `parser` when our env file is a `json` file (more readable than an ordinary `.env` file, especially when there is a long array).

##### The `serverless.yml`

###### The file

Here the order of variables in `path` does matter, varibles in `.env.dev.json` can override those in `.env.json`:

```yml{4-9}
plugins:
  - serverless-dotenv-plugin
......
custom:
  dotenv:
    path:
      - .env.json
      - .env.dev.json
    dotenvParser: "./jsonParser.js"
```

###### `jsonParser.js`

```js-1{14-18}
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
      console.error(`Error reading/parsing ${path}:`, error.message);
      return {};
    }
  });

  return envVarsArray.reduce((acc, curr) => ({ ...acc, ...curr }), {});
};
```

Special treatments have been made from line 14-18, any list is transformed into `,`-concated string (remember to split by `,` in the program).
