const n=`---
title: How to Build an NPM Package?
date: 2025-05-02
id: blog0394
tag: npm-package
toc: true
intro: "We try to build and develop an npm package."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Resulting Package

- [secrets-manager-to-config](https://www.npmjs.com/package/secrets-manager-to-config)

### Project Structure

[<img src="/assets/img/2025-05-03-03-25-32.png" width="350"/>](/assets/img/2025-05-03-03-25-32.png)

We will explain the following important files:

- \`tsconfig.json\`
- \`package.json\`
- \`index.ts\`

And to test our package we created another folder called \`test-folder\`.

### Let's Develop our Package: \`secrets-manager-to-config\`

#### Folder secrets-manager-to-config/

##### index.ts

\`\`\`ts-1
import { downloadConfig } from "./src/env-pull"
import { FileFormat } from "./src/SecretUtil"

export {
    downloadConfig, FileFormat
}
\`\`\`

Up to this part we have achieved "named export". Package consumers can import our functions via

\`\`\`ts
import { downloadConfig, FileFormat } from "secrets-manager-to-config";
\`\`\`

The default export cannot be destructured as above directly:

\`\`\`ts-7
export default {
    downloadConfig, FileFormat
};
\`\`\`

##### package.json, setting homepage and repository info as well

The highlighted lines are important to identify the entrypoint of our transpiled ts project. The remaining come from \`npm init\`.

\`\`\`json-1{6,9,10}
{
  "name": "secrets-manager-to-config",
  "version": "1.0.11",
  "description": "Pull secrets from secrets managers as nested json or yml file",
  "scripts": {
    "build": "tsc",
    "test": "echo \\"Error: no test specified\\" && exit 1"
  },
  "types": "dist/index.d.ts",
  "main": "dist/index.js",
\`\`\`

Next to display the following

[<img src="/assets/img/2025-05-04-20-24-10.png" width="350">](/assets/img/2025-05-04-20-24-10.png)

we add

\`\`\`ts-11
  "repository": {
    "type": "git",
    "url": "https://github.com/machingclee/pull-env-from-secrets-manager.git"
  },
  "homepage": "https://github.com/machingclee/pull-env-from-secrets-manager#readme",
\`\`\`

Here the repository \`url\` comes from the https-clone option in github.

Finally we fill in the rest:

\`\`\`ts-16
  "keywords": [
    "secrets-manager"
  ],
  "author": "machingclee",
  "license": "MIT",
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.3"
  },
  "dependencies": {
    "@aws-sdk/client-secrets-manager": "^3.799.0",
    "@types/lodash": "^4.17.16",
    "@types/minimist": "^1.2.5",
    "js-yaml": "^4.1.0",
    "lodash": "^4.17.21",
    "minimist": "^1.2.8"
  }
}
\`\`\`

##### tsconfig.json

\`\`\`json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
\`\`\`

##### Build the package

We execute

\`\`\`bash
yarn build
\`\`\`

to execute our \`tsc\` script, which uses our \`tsconfig.json\` to identify the output directory.

\`\`\`

\`\`\`

#### Test our package before publishing it

##### Import the package locally

Let's \`cd\` into this folder:

[<img src="/assets/img/2025-05-03-03-38-08.png" width="350"/>](/assets/img/2025-05-03-03-38-08.png)

Let's \`npm init\` and add our package into \`package.json\`:

\`\`\`json{3}
{
  "dependencies": {
    "secrets-manager-to-config": "file:../secrets-manager-to-config",
    "tsm": "^2.3.0"
  }
}
\`\`\`

We also added \`tsm\` for a light-weighted binary executing our \`ts\` file.

Now when we run \`yarn\`, it will install our package and its dependencies into the current project.

At this point we can write a test file to test the import:

\`\`\`ts
// test-folder/env-pull.ts
import { downloadConfig, FileFormat } from "secrets-manager-to-config";

downloadConfig();
\`\`\`

##### Modify the package and import it again for testing

After adjusting the original package, we

1. \`yarn build\` in \`secrets-manager-to-config/\`
2. Delete \`test-folder/node_modules\`
3. \`cd\` into \`test-folder/\` and run \`yarn\` to install everything again

##### Publish it

We need to

1. \`npm login\`, and then
2. \`npm publish\`
`;export{n as default};
