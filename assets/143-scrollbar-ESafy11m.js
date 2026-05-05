const n=`---
title: "Scrollbar Style Like Mac"
date: 2023-06-20
id: blog0143
tag: react
intro: "Record CSS that makes scollbar look better."
toc: false
---

In this blog we have used \`OverlayScrollbars\` for a good looking scrollbar, the drawback is that we need to wrap every component which we want such a scrollbar.

When an application get complicated (like many popups, many forms), we may simply apply the css rule below

\`\`\`css
<style>
  ::-webkit-scrollbar {
      width: 6px;
      height: 4px;
  }

  ::-webkit-scrollbar-thumb {
      border-radius: 10px;
      background-color: rgba(0, 0, 0, 0.25);
  }

  ::-webkit-scrollbar-track {
      background: '#FFFFFF';
      border-radius: 10px;
  }
</style>
\`\`\`

at the top level, every instance of scrollbars will then be rounded.
`;export{n as default};
