const n=`---
title: "C++ VSCode says it cannot open source file when it really can"
date: 2023-01-28
id: blog0121
tag: C++
toc: false
intro: "Fix the error of failing to find source files when it really can for cmake projects."
---

Sometimes soruce file cannot be found even cmake tool can build the project successfully, this is because an incorrect configuration provider is set, we can fix it by \`F1\` and

\`\`\`text
>C++: Change Configuration Provider
\`\`\`

and choose \`cmake tool\`. Which essentially modifies \`.vscode/settings.json\` and sets

\`\`\`text
"C_Cpp.default.configurationProvider": "ms-vscode.cmake-tools"
\`\`\`
`;export{n as default};
