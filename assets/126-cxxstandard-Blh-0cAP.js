const t=`---
title: "Control C++ Standard Accurately"
date: 2023-03-24
id: blog0126
tag: C++
intro: "Sometimes the constant \`CMAKE_CXX_STANDARD\` does not guarantee the C++ standard we use in compilation. We add a line to guarantee which target is compiled in which C++ standard."
toc: false
---

In the \`CMakeLists.txt\` of library folder (or root folder), we add

\`\`\`cmake
target_compile_features(lib_name PUBLIC cxx_std_20)
\`\`\`

to override, or to determine the language standard in compilation.
`;export{t as default};
