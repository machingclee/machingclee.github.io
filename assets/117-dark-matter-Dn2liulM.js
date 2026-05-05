const t=`---
title: Gray Matter
date: 2022-12-14
id: blog0117
tag: react, javascript, coding
intro: Record the usage of gray-matter.
---

### Usage

The md file consumed by the \`gray-matter\` package is of the form:

\`\`\`md
---
id: portfolio001
title: Desktop App to Capture Text From Images
intro: A desktop app by python using google's vison api.
thumbnail: /assets/portfolios/thumbnails/tkinter.jpg
tech: Python, tkinter
thumbWidth: 350
thumbTransX: -20
thumbTransY: -45
date: 2019-12-29
---

### Repository

- In Python with Tkinter: \\
  https://github.com/machingclee/TextCaptrue_FirstTrial

...
\`\`\`

Now we can separate attributes and content as follows:

\`\`\`js
import matter from "gray-matter";

...

const { content, data } = matter(mdText);
\`\`\`

\`content\` will always be a \`string\`, \`data\` will be of type:

\`\`\`typescript
{
  id: string,
  title:string,
  intro: string,
  thumbnail: string,
  tech: string,
  thumbWidth: number,
  thumbTransX: number,
  thumbTransY: number,
  date: Date
}
\`\`\`

The parser in \`gray-matter\` will implicitly convert our data into corresponding data type. We list some specific cases for the conversion in the next section.

Don't forget to cast your data to your custom type for clean coding:

\`\`\`js
const data_ = data as CustomType;
\`\`\`

### Remark on Implicit Conversion

Specific keywords will trigger implicit conversion from plain text to available data type.

- \`111\`, a plain number, will be converted to a number
- \`false\`, and \`true\` will be converted to booleans
- \`2022-01-01\` will be converted to a \`Date\` object

To avoid them, we can enclose desired string by \`"\`'s. For example, \`update: "true"\` in the attribute list will produce \`data.update: string\`.
`;export{t as default};
