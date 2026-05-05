const e=`---
title: "Declare Types for Non-typed 3rd Party Library"
date: 2024-02-24
id: blog0161
tag: react
intro: "Record some exmaple how to declare types from library that is untyped."
toc: true
---

### Simple Cases

- \`json-to-table\` is a simple library which converts nested json object into a table view. However, the library does not provide type defitions, so we need to declare it on our own:

  \`\`\`ts
  // dess.d.ts

  declare module "json-to-table" {
    function jsonToTable(jsonData: object): string[][];
    export default jsonToTable;
  }
  \`\`\`

- Sometimes an import is simply a \`string\`:

  \`\`\`ts
  declare module "*.pdf" {
    const src: string;
    export default src;
  }
  \`\`\`

- Sometimes a library have \`export\` and \`export default\`:
  \`\`\`ts
  declare module "react-images" {
    export var Modal;
    export var ModalGateway;
    export default Carousel;
  }
  \`\`\`

Remember to have

\`\`\`json
  "esModuleInterop": true,
\`\`\`

in \`tsconfig.json\` for the above to work.


### More Complete Example

#### Objective 

We try to type the 3rd party library:

- https://www.npmjs.com/package/excel4node

#### typing/desc.d.ts

\`\`\`js
declare module "excel4node" {
    export class Worksheet {
        column(col: number): Worksheet;
        setWidth(width: number): Worksheet;
        cell(row: number, col: number): Worksheet;
        string(text: string): Worksheet;
        titleStyle(style: any): Worksheet;
        style(style: any): Worksheet;
        link(link: string): Worksheet;
        number(num: number): Worksheet;
        addImage(config: any): Worksheet;
        row(rowNum: number): Worksheet;
        setHeight(height: number): Worksheet;
    }
    export class Workbook {
        constructor();
        addWorksheet(path: string | undefined): Worksheet;
        createStyle(style: any): any;
        writeToBuffer(): Promise<Buffer>;
    }
}
\`\`\`

#### The \`tsconfig.json\`

Note that we must provide \`typeRoots\` for typescript to find the custom type-definition file \`desc.d.ts\`.

Also  we don't need to provide \`./node_modules/@types/\` in \`typeRoots\` as it must be included by default.


\`\`\`json
{
    "compilerOptions": {
        "target": "ES2016",
        "lib": [
            "es6",
            "dom"
        ],
        "outDir": "dist",
        "allowJs": true,
        "skipLibCheck": true,
        "noImplicitAny": true,
        "esModuleInterop": true,
        "allowSyntheticDefaultImports": true,
        "strict": true,
        "strictNullChecks": true,
        "forceConsistentCasingInFileNames": true,
        "noFallthroughCasesInSwitch": true,
        "module": "CommonJS",
        "moduleResolution": "node",
        "resolveJsonModule": true,
        "isolatedModules": false,
        "noEmit": false,
        "typeRoots": [
            "./typing/",
        ]
    },
    "include": [
        "src/**/*"
    ],
    "exclude": [
        "node_modules"
    ]
}
\`\`\`
`;export{e as default};
