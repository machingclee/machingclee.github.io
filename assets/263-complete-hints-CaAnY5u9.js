const e=`---
title: "Get the full type hint from VSCode"
date: 2024-05-31
id: blog0263
tag: vscode
intro: "We try to get the full list of type hints in vscode instead of the shortened and incomplete ones."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Procedures

Sometimes a type hint from hovering a variable is ***incomplete*** and ***abbreviated by \`...\`***:

![](/assets/img/2024-06-01-04-21-57.png)

To get a full hint:

- - **For windows.** Go to 
    \`\`\`text
    <vscode-installation>/resources/app/extensions/node_modules/typescript/lib/
    \`\`\`
    here \`<vscode-installation>\` can be found via \`where code\`.
    
  - **For Mac.** Go to 
    \`\`\`text
    /Applications/Visual Studio Code.app/Contents/Resources/app/extensions/node_modules/typescript/lib/
    \`\`\` 
- Open \`tsserver.js\`
- Search for \`defaultMaximumTruncationLength\` and change this line from \`160\` to \`800\`

  ![](/assets/img/2024-06-01-04-30-09.png)

  **Remark.** Recently ($\\approx$ 2024-09-12) this variable is moved to \`typescript.ts\` of the same directory

  ![](/assets/img/2024-09-14-23-01-28.png)

- Reload VSCode
- We get everything now:

  ![](/assets/img/2024-06-01-04-32-36.png)


### Reference 

- https://stackoverflow.com/questions/53113031/how-to-see-a-fully-expanded-typescript-type-without-n-more-and`;export{e as default};
