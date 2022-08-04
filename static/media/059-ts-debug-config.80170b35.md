title: Typescript Debugger Config
date: 2022-04-11
id: blog059
tag: typescript
intro: Set up debugger for node project in typescript with minimal config.
toc: no


We init such a project in the following steps:

- Create `tsconfig.json`
  ```text
  tsc --init
  ```

- Modify `tsconfig.json`
  ```json
  {
    "compilerOptions": {
      "target": "es5",
      "module": "commonjs",
      "lib": [
        "es2015"
      ],
      "sourceMap": true,
      "outDir": "./out",
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true
    },
    "include": [
      "**/*.ts"
    ],
    "exclude": [
      "../node_modules",
      "../*.js"
    ]
  }
  ```
- Modify `package.json`
  ```json
  {
    ...
    "scripts": {
      "start": "ts-node src/app.ts",
      "debug": "tsc --sourcemap"
    }
  }
  ```
- Create `.vscode/launch.json`
  ```json
  {
    "version": "0.2.0",
    "configurations": [
      {
        "type": "node",
        "request": "launch",
        "name": "Launch Program",
        "program": "${workspaceFolder}\\out\\app.js",
        "preLaunchTask": "npm: debug",
        "outFiles": [
          "${workspaceFolder}\\out\\**\\*.js"
        ]
      }
    ]
  }
  ```
- Now we can create a file in `./src/app.ts` and start our program. Don't forget to `yarn add @types/node` for type annotation of basic functionalities such as `console`, etc.