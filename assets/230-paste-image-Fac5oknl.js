const e=`---
title: "Paste Image in Markdown Files from Clipboard"
date: 2024-01-04
id: blog0230
tag: md, vscode
intro: "We record a vscode configuration to customize where to save our image when pasting image in md files with automatically generated url inside markdown file."
toc: true
---

<style>
  img {
    max-width: 600px
  }
</style>

### Problem

It is a built-in function in vscode to paste image **_from Clipboard into markdown file_**. However, the behaviour is like this when you simply \`ctrl+v\`:

![](/assets/img/2024-01-04-03-34-12.png)

This default behaviour has **_two problems_**:

- Sometimes you want your directory consists of **only** \`md\` files.
- images should sit inside static file directory.

### Use Paste Image Plugin

<center></center>

- First we install the Paste Image plugin:

  ![](/assets/img/2024-01-04-02-53-59.png)

- Next in our project (blog project, documentation project, etc) we add

  \`\`\`json
  // .vscode/settings.json
  {
    "pasteImage.path": "\${projectRoot}/static/img",
    "pasteImage.basePath": "\${projectRoot}",
    "pasteImage.forceUnixStyleSeparator": true,
    "pasteImage.prefix": "/",
    "pasteImage.insertPattern": "\${imageSyntaxPrefix}/img/\${imageFileName}\${imageSyntaxSuffix}"
  }
  \`\`\`

- Here \`pasteImage.path\` is your image destination (to be saved).

- Here \`pasteImage.insertPattern\` is the path that will be inserted into your \`md\` file.

- Now you can paste your image from clipbaord by \`ctrl+alt+v\`.

- For example:
  \`\`\`json
  "pasteImage.insertPattern": "\${imageSyntaxPrefix}/assets/img/\${imageFileName}\${imageSyntaxSuffix}"
  \`\`\`
  produces me a link (because \`"pasteImage.prefix": "/"\`):
  \`\`\`md
  ![](/assets/img/2024-01-04-02-53-59.png)
  \`\`\`
  and my project will transform this url to some public asset file path.
`;export{e as default};
