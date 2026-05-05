const n=`---
title: "Create a React-App via Vite, Config for MUI, Load Env Variable from Custom Files."
date: 2024-07-14
id: blog0278
tag: react, vite
toc: true
intro: "Record a standard procedure to create an react-app via vite."
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Create a React App via Vite, Configure the Application

1.  \`\`\`text
    yarn create vite my-personal-project
    \`\`\`
    Then choose \`react-ts\` in the command line.

2.  - Config for MUI and Config for \`.env\`:
      \`\`\`js{11}
      // vite.config.ts

      import { defineConfig, loadEnv } from 'vite'
      import react from '@vitejs/plugin-react'

      // https://vitejs.dev/config/
      export default defineConfig(({ command, mode }) => {
          const env = loadEnv(mode, process.cwd(), '')
          const newMap: { [key: string]: string | undefined } = {}
          Object.entries(env).forEach(([k, v]) => {
              if (k.startsWith("VITE_")) {
                  newMap[\`process.env.\${k}\`] = v || undefined;
              }
          })
          process.env = Object.assign(process.env, newMap)

          return {
              plugins: [react()],
              optimizeDeps: {
                  include: ['@emotion/styled'],
              },
          }
      })

      \`\`\`
    - Note that I also require the \`env\` variable be ***prefixed*** by \`VITE_\` in order not to include so many unrelated variables.


### Environment Variables

3. Create \`.env.{dev, uat, prod}\` files for env variables of different stages.

4.  Take \`.env.prod\` as an example, write:
    \`\`\`text
    # .env.prod

    VITE_ENV=prod
    VITE_ASK_BILLIE_ENABLED=false
    VITE_GOOGLE_AUTH_BACKEND_URL=https://google-auth-billie-web-prod.wonderbricks.com
    VITE_BACKEND_URL=https://alb.wonderbricks.com:9002
    \`\`\`

5. Sciprts for loading env variables for different stages:

    \`\`\`json
    "scripts": {
      "start:dev": "vite --mode dev",
      "build:uat": "tsc && vite build --mode uat",
      "build:prod": "tsc && vite build --mode prod",
      "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
      "preview": "vite preview"
    },
    \`\`\`
`;export{n as default};
