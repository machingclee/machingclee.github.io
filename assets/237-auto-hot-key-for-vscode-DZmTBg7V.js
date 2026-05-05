const n=`---
title: "Auto-hotkey Config for Vscode Switching (Windows)"
date: 2024-01-26
id: blog0237
tag: autohotkey
intro: "We introduce how to alt+1, alt+2, ... to switch among different vscode window."
toc: false
---

<style>
  img {
    max-width: 660px
  }
</style>

Install autohotkey [here](https://www.autohotkey.com/) and write the following in the \`.ahk\` script:

\`\`\`autohotkey
!1::
Run %comspec% /k code "C:\\Repos\\javascripts\\frontend-1",, Hide
return
!2::
Run %comspec% /k code "C:\\Repos\\javascripts\\frontend-2",, Hide
return
!3::
Run %comspec% /k code "C:\\Repos\\some\\backend",, Hide
return
!4::
Run %comspec% /k start "" "some\\SourceTree.exe" -f "%cd%",, Hide
return
\`\`\``;export{n as default};
