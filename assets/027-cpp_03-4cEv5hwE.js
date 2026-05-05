const n=`---
title: C++ Beginner Notes 03 - C++ in VSCode of Windows
date: 2021-09-10
id: blog0027
tag: C++
wip: true
intro: List some configuration I made to make C++ project compilable in VSCode.
---

### Install C++ Compiler

https://www.mingw-w64.org/downloads/#mingw-builds

### .vscode

#### c_cpp_properties.json

Open VSCode and open the directory of your C++ project. Now in command palette type C++ and select edit configurations (UI):

<center>
<img width="100%" src="/assets/tech/013.png"/>
</center>
<p />

Now in the configuration select

<center>
<img width="100%" src="/assets/tech/014.png"/>
</center>
<p />

and select

<center>
<img width="100%" src="/assets/tech/015.png"/>
</center>
<p />

Then a \`.vscode/c_cpp_properties\` will be configured accordingly.

#### tasks.json

Now select terminal > Configure Default Build Task:

<center>
<img src="/assets/tech/016.png"/>
</center>
<p />

a \`.vscode/tasks.json\` will be created. We add \`"-Wall"\`, \`"-std=c++17"\` and also \`"\${fileDirname}\\\\*.cpp"\` as follows:

\`\`\`json
// tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "cppbuild",
      "label": "C/C++: g++.exe build active file",
      "command": "C:/Program Files/mingw-w64/mingw64/bin/g++.exe",
      "args": [
        "-g",
        "-Wall",
        "-std=c++17",
        "\${fileDirname}\\\\*.cpp",
        "\${fileDirname}\\\\src\\\\*.cpp",
        "-o",
        "\${fileDirname}\\\\\${fileBasenameNoExtension}.exe"
      ],
      "options": {
        "cwd": "C:/Program Files/mingw-w64/mingw64/bin"
      },
      "problemMatcher": ["$gcc"],
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "detail": "compiler: \\"C:/Program Files/mingw-w64/mingw64/bin/g++.exe\\""
    }
  ]
}
\`\`\`

Note that I also add \`"\${fileDirname}\\\\src\\\\*.cpp"\` because I intend to separate header files to \`include/\` (don't need to specify it for compiler) and source (cpp) files to \`src/\` .

#### launch.json

At this point we can start compiling our \`main.cpp\` into an exe file. However to debug a program we still need another file. Select \`main.cpp\` and press \`F5\`, a \`launch.json\` will be generated. There should be nothing to configure and you should be able to debug successfully.

### Run the Project

Now our project structure is as follows:

<center>
<img src="/assets/tech/017.png"/>
</center>
<p />

And the files are:

\`\`\`cpp
// include/Movie.hpp
#ifndef MOVIE_H
#define MOVIE_H
#pragma once

class Movie
{
private:
	int *data = nullptr;

public:
	int getData();
	Movie();
	Movie(int);
	~Movie();
};
#endif

\`\`\`

\`\`\`cpp
// src/Movie.cpp
#include "../include/Movie.hpp"

Movie::Movie(int value)
{
  this->data = new int;
  *data = value;
}

Movie::~Movie()
{
}

int Movie::getData()
{
  return *data;
}
\`\`\`

and finally

\`\`\`cpp
// main.cpp
#include <iostream>
#include "include/Movie.hpp"
using namespace std;

int main()
{
  auto data = Movie{10}.getData();
  cout << data << endl;
  return 0;
}
\`\`\`

In my terminal I get:

\`\`\`text
PS C:\\Users\\user\\Repos\\C++\\2021-09-10-oop-section-challenge-2>  &
'c:\\Users\\user\\.vscode\\extensions\\ms-vscode.cpptools-1.6.0\\debugAdapters\\bin\\WindowsDebugLauncher.exe'
'--stdin=Microsoft-MIEngine-In-esga0ehc.p10' '--stdout=Microsoft-MIEngine-Out-y5letkea.yj3'
'--stderr=Microsoft-MIEngine-Error-2iqo5ldl.fcx' '--pid=Microsoft-MIEngine-Pid-rlv455c0.aol'
'--dbgExe=C:\\Program Files\\mingw-w64\\mingw64\\bin\\gdb.exe'
'--interpreter=mi'
10
\`\`\`
`;export{n as default};
