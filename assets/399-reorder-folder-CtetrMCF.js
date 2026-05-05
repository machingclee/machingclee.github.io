const e=`---
title: Float Desired Folders on Top in Vscode
date: 2025-06-17
id: blog0399
tag: vscode
toc: false
intro: "We record a method on how to reorder folders based on our predefined pattern"
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

In \`.vscode/settings.json\` we add:

\`\`\`json
    "files.exclude": {
        "explorer.fileNesting.enabled": true,
        "explorer.fileNesting.patterns": {
            "!*": "\${capture}/*"
        }
    }
\`\`\`

Then any directory prefixed by \`!\` will be shown at the top.

For example in frontend we frequently create \`query\` and \`mutation\` files, it is extremely tedious to locate the \`react-query\` folder and create corresponding files inside of it.

Now \`!react-query\` is always on the top:

![](/assets/img/2025-06-18-01-55-20.png)
`;export{e as default};
