const t=`---
id: portfolio001
title: Desktop App to Capture Text From Images
intro: A desktop app by python using google's vision api.
thumbnail: /assets/portfolios/thumbnails/tkinter.jpg
tech: Python, tkinter
thumbWidth: 350
thumbTransX: 0
thumbTransY: 0
hoverImageHeight: 160
date: 2019-12-29
---

<style>
video {
  margin-top:20px;
  max-width: 100%;
  border-radius: 4px;
}
</style>

### Repository

- In Python with Tkinter: \\
  https://github.com/machingclee/TextCaptrue_FirstTrial
- Later rewritten in C#

### Motivation

This is my first windows application in an attempt to assist my work in eLearningPro.

I had been working on transforming old flash games into HTML5 games. Occasionally it is impossible to copy the texts of the animated texts from the original .fla file, to extract the texts I make the following application.

<center style="align-items: center">
<a target="_blank" href="/assets/tech/wpf_v1_01.jpg">
<img src="/assets/tech/wpf_v1_01.jpg" width="350" style="margin-right:10px"/>
</a>
<a target="_blank" href="/assets/tech/wpf_v1_02.jpg">
<img src="/assets/tech/wpf_v1_02.jpg"  width="350"/>
</a>
</center>

This application was first developed in Python with a library called tkinter, and turned into a standalone .exe file by using pyinstaller (detail is also listed in my github here, I have also recorded the debug pain I encountered here). The journey of bug fixing prompt me to develop this application directly in C#:

<p></p>

<video controls>
  <source src="/assets/videos/003.mp4" type="video/mp4">
Your browser does not support the video tag.
</video>
`;export{t as default};
