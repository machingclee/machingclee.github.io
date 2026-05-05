const n=`---
title: Python Debugger with Project Directory Included in sys.path
date: 2021-10-25
id: blog034
tag: python
intro: Record a structure that makes a \`test_sth.py\` debuggable and make sure project directory path is included in \`sys.path\` when debug mode is enabled.
---

### Debuggable Test File

We have discussed how to include project directory in \`sys.path\` when running \`pytest\`. Sometimes it is much more convenient to debug a utility function rather than testing it.

In order to make statements like \`from src.utils.abc import Abc\` **_always_** possible, our \`sys.path\` has to include the directory path that contains the folder \`src\`.

Suppose I want to record a concrete usage of a utility class in a test \`test/unit/test_abc.py\`, where:

\`\`\`python
# test/unit/test_abc.py
from src.utils.abc import Abc

def test_abc():
  abc = Abc()
  abc.start()

if __name__ == "__main__":
  test_abc()
\`\`\`

Now \`test_abc.py\` is not only a testable file, it is also debuggable because we can trigger \`debug\` action in vscode as if we are running the script directly (so that \`__name__ == "__main__"\`).

An appropriate configuration for debugger has to be made in order to make \`src\` folder accessible.

### Debugger Configuration: .vscode/launch.json

\`\`\`json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: Current File",
      "type": "python",
      "request": "launch",
      "program": "\${file}",
      "console": "integratedTerminal",
      "env": { "PYTHONPATH": "\${workspaceRoot}" }
    }
  ]
}
\`\`\`

Now happy debugging (just press F5).
`;export{n as default};
