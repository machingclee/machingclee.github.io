const n=`---
title: Config Files Organization in Frontend Project (Next.js Specific)
date: 2022-11-15
id: blog0106
tag: react, nextjs
intro: Record how to change pytorch model into onnx model and deploy it to frontend.
---

### Structure

Let's create a folder at the same directory level as \`pages\`.

<Center>
  <img src="/assets/tech/106-config-frontend/2022-11-15_034821.png"/>
</Center>

<p/>

- \`default.ts\` is config in common
- \`dev.ts\`: development specific config
- \`prod.ts\`: production specific config

We define \`TConfig\` to shape the interface of our configuration data:

\`\`\`javascript
// TConfig.ts
export type TConfig = {
  modelRequiredSizes: {
    width: number,
    height: number,
  },
};
\`\`\`

and all of our config files will strictly follow this interface:

\`\`\`javascript
// default.ts
import { TConfig } from "./TConfig"

const config = {
  modelRequiredSizes: {
    width: 320,
    height: 320
  }
} as Partial<TConfig>

export default config
\`\`\`

\`\`\`javascript
// dev.ts
import { TConfig } from "./TConfig"

const config = {
} as Partial<TConfig>

export default config
\`\`\`

\`\`\`javascript
// prod.ts
import { TConfig } from "./TConfig"

const config = {
} as Partial<TConfig>

export default config
\`\`\`

### Get Config

We combine all the config files under different environments:

\`\`\`javascript
import _ from "lodash";
import defaultConfig from "../config/default";
import devConfig from "../config/dev";
import prodConfig from "../config/prod";
import { TConfig } from "../config/TConfig";

export const getConfig = (): Partial<TConfig> => {
  const { NODE_ENV } = process.env;
  const targetCofig: Partial<TConfig> =
    NODE_ENV == "production" ? prodConfig : devConfig;
  const combinedConfig = { ...defaultConfig, ...targetCofig };

  return combinedConfig;
};
\`\`\`
`;export{n as default};
