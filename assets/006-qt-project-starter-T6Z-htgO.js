const e=`---
id: portfolio006
title: Multiple Projects Starter
intro: This project spins up all projects in vscode and start the backend servers automatically.
thumbnail: /assets/portfolios/thumbnails/qt_proj_starter.png
tech: C++, Qt
thumbWidth: 500 
thumbTransX: -20
thumbTransY: 11
hoverImageHeight: 115
date: 2021-06-23
---



### Repository
- https://github.com/machingclee/QT-CPP-project-starter

### Motivation
In my company there are often the cases one need to switch from one project to another just for adding small features or fixing bugs. And very often to test them locally (for printing logs at appropricate function), multiple backend projects are required to be set up in order to serve one frontend application.

It is extremely tedious to open several instances of vscode (or "workspaces" in vscode) and execute their start-up scripts one by one **for one project**, and then do the same thing, **back and forth**, for another project.

### Result
Therefore I made a simple desktop application, **for both windows and mac** (the main reason for Qt, one code base, cross platforms), that stores your working directories and start-up scripts on project base. When you start to work on it, click "execute", it runs all the project in separate instances of vscode and automatically run the scripts on new terminals for you:

<center>
  <iframe width="560" height="315" src="https://www.youtube.com/embed/4hU_jyGknh4" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
</center>
<p/>
<center>
  <iframe width="560" height="315" src="https://www.youtube.com/embed/s4Md9jrXKEY" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
</center>

### What Follows

Although QML can link to our cpp files and do whatever we want in C++, there are already tons of wrapper classes written **in python** that bring the C++ libraries for us. I can imagine bringing my tensorflow-trained model into my application directly without the need to host another backend to serve the desktop application. I will try to switch to python to serve QML in the next step.`;export{e as default};
