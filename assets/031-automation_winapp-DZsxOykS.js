const n=`---
title: Automation Task for Desktop Application
date: 2021-10-02
id: blog031
tag: python
intro: We discuss how to apply \`pywinauto\` to automate process associated with desktop application in windows.
wip: true
---

### Launch the Application

\`\`\`python
from pywinauto.application import Application

# program_exe: the .exe file path
app_spec = Application(backend = "uia").start(program_exe)
app = app_spec["Dialog"]
\`\`\`

Usually \`app_spec\` itself is not of our primary interest. We go into its child \`'Dialog'\` to start our automation task, which is a \`WindowSpecification\` object.

To inspect all the children of a \`WindowSpecification\` object, we define a util function:

\`\`\`python
def view(self, spec):
  print(spec.print_control_identifiers())
  return
\`\`\`
`;export{n as default};
