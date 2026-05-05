const n=`---
title: "Docker Run Indefinitely"
date: 2023-06-25
id: blog0215
tag: docker
intro: "We record a command to run an image in non-stop mode for debugging."
toc: false
---

\`\`\`shell
docker run golang:1.21.1-alpine sleep infinity
\`\`\`
`;export{n as default};
