const n=`---
title: Typescript Debugger Config
date: 2022-04-11
id: blog059
tag: typescript
intro: Set up debugger for node project in typescript with minimal config.
toc: false
---

\`\`\`json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node-terminal",
      "name": "Debug Current TS File (ts-node)",
      "request": "launch",
      "command": "ts-node \${relativeFileDirname}/\${fileBasename}",
      "cwd": "\${workspaceRoot}"
    }
  ]
}
\`\`\`
`;export{n as default};
