const n=`---
title: Type Annotation Record in Typescript for 3rd-party Library and Usual Import
date: 2022-03-23
id: blog051
tag: typescript
toc: false
intro: Record some type annotation used for third party untyped library or those needed in importing files (like pdf).
---

Include the \`*.d.ts\` file in \`tsconfig.json\` with the following content:

\`\`\`javascript
declare module "react-images" {
  export var Modal;
  export var ModalGateway;
  export default Carousel;
}

declare module '*.pdf' {
  const src: string;
  export default src;
}

declare module '*.md' {
  const md: string;
  export default md;
}

declare module "json-to-pretty-yaml" {
  export default { stringify(json: Object): string }
}
\`\`\`
`;export{n as default};
