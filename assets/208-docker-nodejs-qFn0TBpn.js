const n=`---
title: "Docker Containerization of Nodejs with Typescript"
date: 2023-11-03
id: blog0208
tag: docker, nodejs
intro: "Containerization of vanilla JS project is simple, with typescript we need little more steps."
toc: true
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

<Center></Center>

### tsconfig.json

\`\`\`js
{
  "compilerOptions": {
    "target": "ES2016",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "outDir": "./dist",
    "allowJs": true,
    "skipLibCheck": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "CommonJS",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
  },
  "ts-node": {
    "compilerOptions": {
      "baseUrl": "./",
      "module": "CommonJS"
    }
  },
  "include": [
    "src"
  ],
  "exclude": [
    "**/*.md",
    "node_modules"
  ],
  "files": [
    "src/desc.d.ts"
  ]
}
\`\`\`

### package.json (The Build Script)

\`\`\`js
{
  "scripts": {
    "start:dev": "env-cmd -f .env-cmdrc -e default,dev nodemon --exec ts-node src/app.ts",
    "debug": "env-cmd -f .env-cmdrc -e default,dev ts-node src/app.ts",
    "test": "env-cmd -f .env-cmdrc -e default,dev jest --coverage",
    "build": "tsc",
    "start:prod": "npm run build && env-cmd -f .env-cmdrc -e default,prod node dist/src/app.js"
  },
}
\`\`\`

### More About the Build Script

- The use of \`npm run build\` does not mean we need a package named \`tsc\`.

- In fact, the \`tsc\` script comes from \`typescript\` package.
- \`npm install tsc\` will make the build script fail.
- Our \`tsconfig.json\` have instructed \`tsc\` to build the plain \`js\` code in \`./dist\`.
- As we have included \`src\`, our \`js\` code will be generated in \`./dist/src\`.

### Dockerfile

\`\`\`docker
FROM node:16.20.2-alpine3.18

RUN mkdir -p /home/app
COPY . /home/app

WORKDIR /home/app

RUN npm install

EXPOSE 9090

CMD ["npm", "run", "start:prod"]
\`\`\`

### .dockerignore

\`\`\`text
node_modules
npm-debug.log
.vscode
coverage
yarn.lock
yarn-error.log
README.md
dockerfile.dev
.gitignore
\`\`\`
`;export{n as default};
