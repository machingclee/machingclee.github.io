const e=`---
title: "Precompiled Header in CMake Project"
date: 2023-03-27
id: blog0127
tag: C++
intro: "Previously we have mentioned how to use precompiled header in visual studio project, this time we record how to do it in cmake project"
toc: false
---

Just bundle a set of headers into pch.h, refactor the project approprimately and add the following in the CMakeLists.txt.

\`\`\`cmake
target_precompile_headers(target_name PUBLIC src/pch.h)
\`\`\`
`;export{e as default};
