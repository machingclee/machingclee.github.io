const n=`---
title: Debug Nextjs with Typescript in VSCode
date: 2021-12-02
id: blog039
tag: javascript, react, nextjs
intro: I am working on a desktop application by using Electron + Next.js in typescript. Since I cannot live without debugger, I have spent time searching debug config in the internet and finally come into a functioning configuration!
---

### The Boilerplate

For Next.js and Electron there is an official boilerplate for new comers to work on:

<a href="https://github.com/vercel/next.js/tree/canary/examples/with-electron-typescript?fbclid=IwAR2DFf6dHAIEpaTp16FMfq-cUwIfwBXhgLuzscU6wkB_NCF4Bz-fRtS21W4">Link for Next.js, Electron and Typescript</a>

Unforturnately there is no documentation on how to set up a debugger for this kind of "side product".

### Debugger Configuation in Vscode

#### The launch.json File

Having struggled for a while I finally come up with the following configuration:

\`\`\`json
// <project-dir>/.vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Next: Node",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 9229,
      "console": "integratedTerminal"
    }
  ]
}
\`\`\`

#### The next.config.js File

Next in the root directory create a file named \`next.config.js\`. Inside it we add:

\`\`\`js
// <project-dir>/next.config.js

module.exports = {
  webpack: (config) => {
    config.output = config.output || {};
    config.output.devtoolModuleFilenameTemplate = function (info) {
      return "file:///" + encodeURI(info.absoluteResourcePath);
    };
    return config;
  },
};
\`\`\`

Now we can press \`F5\` to start \`npm run dev\` in debug mode. It works in frontend as well but in vscode I mostly debug backend script since chrome dev tool is much more convenient for debugging frontend code.
`;export{n as default};
