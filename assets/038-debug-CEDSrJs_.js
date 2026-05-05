const n=`---
title: Debug Javascript For Individual File
date: 2021-12-01
id: blog038
tag: javascript
intro: Sometimes it is convenient to directly execute a test file to understand how the project work. In the past we discussed how to make a runnable test file in python, in javascript we can use exactly the same approach for debugging.
---

### Lunch.json

The following configuration can enable us to run whatever file in debug mode.

\`\`\`json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug File",
      "program": "\${file}",
      "env": {
        "NODE_ENV": "some-stage",
        "BDSONS_DB_PWD": "some-password"
      },
      "cwd": "\${workspaceFolder}"
    }
  ]
}
\`\`\`

It is worth noting that some test cases also require specific environment variable. But how do we actually run a test file using library like ava (which is very similar to \`pytest\`)?

For that we need an analog of \`if __name__ == "__main__":\` in python, which turns out to be

\`\`\`js
if (require.main === module) {
  // our test function
}
\`\`\`

By using these we can design a test file that can be both executed by test library and also by developer individually.
`;export{n as default};
