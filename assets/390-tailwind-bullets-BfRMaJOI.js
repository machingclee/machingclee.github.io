const n=`---
title: Recover Bullet-Points and Ordered List Overriden by Tailwind
date: 2025-04-25
id: blog0390
tag: react, tailwind
toc: false
intro: "Record simple css to recover bullet points affected by tailwind package"
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

In \`index.css\` simply add

\`\`\`css
ul {
  list-style-type: disc;
  padding-left: 2rem;
}

ul li {
  margin-bottom: 0.25rem;
}

ol {
  list-style-type: decimal;
  margin-top: 1em;
  margin-bottom: 1em;
  padding-left: 2rem;
}
\`\`\`
`;export{n as default};
