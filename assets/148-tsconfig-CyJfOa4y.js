const n=`---
title: "tsconfig.json"
date: 2023-06-24
id: blog0148
tag: typescript, javascript, react
intro: "Record the latest tsconfig.json I use."
toc: false
---

\`\`\`json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "ts-node": {
    "compilerOptions": {
      "baseUrl": "./",
      "module": "CommonJS"
    }
  },
  "include": [
    "src",
    "desc.d.ts",
    "before-build-script",
    "./node_modules/redux-persist/types"
  ],
  "exclude": ["**/*.md", "node_modules"]
}
\`\`\`
`;export{n as default};
