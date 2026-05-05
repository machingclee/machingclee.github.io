const e=`---
title: Precompiled Header
date: 2022-11-27
id: blog0111
tag: C++
toc: false
intro: Record standard procedure to make a precompiled header file to avoid rebuilding it every time we build the whole project.
---

### Step 1

We first prepare a header file that contains all the header that we want:

\`\`\`cpp
// pch.h
#pragma once

#include <iostream>
#include <array>
#include <vector>
#include <functional>
\`\`\`

### Step 2

At the same directory we create a \`pch.cpp\` that includes that header file

\`\`\`cpp
// pch.cpp
#include "pch.h"
\`\`\`

### Step 3

Change the properties of \`pch.cpp\` as follows:

<Center>
<a
	target="_blank"
	href="/assets/tech/111-precompiled-header/001.png" 
>
	<img 
		src="/assets/tech/111-precompiled-header/001.png" 
		width="650"
	/>
</a>
</Center>

### Step 4

Change the properties of **_the whole project_** as follows:

<Center>
<a
	target="_blank"
	href="/assets/tech/111-precompiled-header/002.png" 
>
	<img 
		src="/assets/tech/111-precompiled-header/002.png" 
		width="650"
	/>
</a>
</Center>
`;export{e as default};
