const e=`---
title: Make your React App Scrapable by Google Search Engine
date: 2021-08-14
id: blog0016
tags: react
intro: SPAs (Single Page App) are known to be unfriendly to search engines and we try to deal with this problem for react app.
---

### Solutions

#### What do we have?

There are two solutions after googling for a while if one insists on using react:

- Do **_server side rendering_** using framework like \`next.js\`.
- **_Pre-render_** our react app into several pieces of rendered static htmls.
  I would like to talk about the second approach as it just requires a web host be able to serve html files for reader from outside (github is a good choice in this regard combined with <a href="https://www.npmjs.com/package/gh-pages">gh-pages</a>) .

#### Use Case and Tradeoff

The drawback is glaringly obvious, pre-rendering is an awful choice for highly dynamic pages like a forum. But our page wouldn't change frequently (as a personal website), our use case is perfectly fine.

But even our page does change frequently, we can **_selectively_** choose not to pre-render this particular page and let react handle the content in its own way by error handling tricks, but at last such content cannot be easily scrapped.

### Pre-rendering Procedures

#### Step 1: Webpack Config via react-app-rewired and customize-cra

We will make use of two npm packages, <a href="https://www.npmjs.com/package/react-app-rewired">react-app-rewired </a> and <a href="https://www.npmjs.com/package/customize-cra">customize-cra</a>:

\`\`\`bash
yarn add react-app-rewired customize-cra @types/customize-cra
\`\`\`

- \`react-app-rewired\` helps override our webpack-config **_without ejection_** and;
- \`customize-cra\` providers us with helper functions to override webpack config via \`react-app-rewired\`.

Next we need <a href="https://www.npmjs.com/package/prerender-spa-plugin">prerender-spa-plugin</a> to decompose our react app into pre-rendered htmls:

\`\`\`bash
yarn add prerender-spa-plugin
\`\`\`

Create \`config-overrides.js\` in the root directory, where:

\`\`\`javascript
const { override, addWebpackPlugin } = require("customize-cra");
const path = require("path");
const PrerenderSPAPlugin = require("prerender-spa-plugin");
const Renderer = PrerenderSPAPlugin.PuppeteerRenderer;

const preRenderPlugin = new PrerenderSPAPlugin({
  staticDir: path.join(__dirname, "build"),
  indexPath: path.join(__dirname, "build", "index.html"),
  routes: [
    "/",
    "/about",
    "/skills",
    "/experience",
    "/portfolio",
    "/blog",
    "/lang-study",
    "/artworks",
    "/math-material",
    "/contact",
  ],
  renderer: new Renderer({
    timeout: 0,
    maxConcurrentRoutes: 1,
    renderAfterTime: 5000,
    headless: false,
  }),
});

module.exports = override(addWebpackPlugin(preRenderPlugin));
\`\`\`

Here we use \`renderer\` to preview rendered pages for debug purpose. If you are sure your routes for decompoisition are correct, you may skip it by setting \`renderAfterTime\` to \`0\`. Removing \`renderer\` courses error to me.

In \`package.json\` we replace

\`\`\`json
"scripts": {
    ...
    "build": "react-scripts build",
  },
\`\`\`

by

\`\`\`json
"scripts": {
    ...
    "build": "react-app-rewired build",
  },
\`\`\`

#### Step 2: Decompose React App by Routes

In \`package.json\` we add/replace the value of \`homepage\`:

\`\`\`json
{
  ...,
  "homepage": "https://machingclee.github.io",
}
\`\`\`

this will provide \`process.env.PUBLIC_URL\` a value \`"https://machingclee.github.io"\` when \`process.env.NODE_ENV === "production"\`, and otherwise an empty string so that it does nothing in development mode.

Next in our routing:

\`\`\`typescript
import { BrowserRouter } from "react-router-dom";

ReactDOM.render(
  <BrowserRouter basename={process.env.PUBLIC_URL + "/"}>
    <App />
  </BrowserRouter>,
  document.getElementById("root")
);
\`\`\`

Keep in mind that hash routing **_will fail_** in pre-rendering process.

When we \`yarn build\` (which runs \`react-app-rewired build\`), we get the following structure in our \`build\` directory:

<center>
 <a href="/assets/tech/004.png"> <img width="460" src="/assets/tech/004.png"/> </a>
</center>

#### Step 3: Selective Pre-rendering by Means of 404 Error Handling

Notice that \`/blog\` and \`/lang-study\` have no sub-routings, it will cause 404 error once we navigate to, say, \`/blog/On-Redux-Saga\` since \`/blog/On-Redux-Saga.html\` does not exist. When 404 error occurs, github would first look for \`404.html\`, we can manipulate this mechanism into rendering our dynamic contents by javascript. Just make an identical copy of \`index.html\` in our \`./build\` and name it \`404.html\`:

\`\`\`json
"scripts": {
  ...,
  "build": "react-app-rewired build && cp build/index.html build/404.html
}
\`\`\`

And we are done!

#### Step 4: Generate Additional Subroutes (e.g., blog articles)

In my case all my subroutes are based on content in my md file, I can get all routes dynamically by file paths:

\`\`\`javascript
import fs from "fs";

const getAllFiles = (dir: string) => {
  const mdFiles: string[] = [];

  const getFiles = (dir: string) => {
    const paths = fs.readdirSync(dir);
    paths.forEach((p) => {
      const newPath = path.join(\`\${dir}/\${p}\`);
      const pathStat = fs.statSync(newPath);
      if (pathStat.isDirectory()) {
        getFiles(newPath);
      } else {
        if (newPath.endsWith(".md")) {
          mdFiles.push(newPath);
        }
      }
    });
  };

  getFiles(dir);

  return mdFiles;
};
\`\`\`

You can generate your routes in your own case, and \`concat\` your additional routes inside \`config-overrides\`.

In case you cannot use import statement, at the same level of \`compilerOptions\` try to look at \`tsconfig.json\` and try to add:

\`\`\`json
"ts-node": {
  "compilerOptions": {
    "module": "CommonJS"
  }
},
\`\`\`

My final addtional routes file is like this, which gets imported from \`config-overrides\` for concatenation:

\`\`\`json
{
  "routes": [
    "/blog/Lazy-React-Router",
    "/blog/On-Looping-all-Files-in-Frontend",
    "/blog/Useful-Conda-Commands",
    "/blog/Web-Scrapping-with-Selenium-and-Beautifulsoup-on-Chrome",
    "/blog/On-Redux-Saga",
    "/blog/Algorithm-Merge-Sort-and-its-Time-Complexity",
    "/blog/Exercises-on-Algorithms",
    "/blog/Typescript-Type-Tricks",
    "/blog/Disqus-Comment-Plug-in-in-React",
    "/blog/Make-your-React-App-Scrapable-by-Google-Search-Engine",
    "/lang-study/Asmongold-Reacts-to-Preach-Quitting-WoW",
    "/lang-study/Asmongold-Reacts-to-Is-FFXIV-Winning-the-MMO-War-By-Zepla",
    "/lang-study/Is-WoW-2-Blizzard-s-only-option-in-2021-Asmongold-Reacts-to-Bellular",
    "/lang-study/Asmongold-reacts-to-fan-made-memes-Reddit-Recap-33-FFXIV-Special-",
    "/lang-study/Asmongold-Reacts-to-WillE-Quitting-WoW-Full-Time-Content-Creation",
    "/lang-study/The-Best-MMO-Asmongold-Summit1g-Talk-FFXIV-vs-WoW",
    "/lang-study/Asmongold-reacts-to-fan-made-memes-Reddit-Recap-34-FFXIV-Special-",
    "/lang-study/Asmongold-Reacts-to-Stoopzz-Quitting-WoW-after-15-Years",
    "/lang-study/Asmongold-Reacts-to-FFXIV-s-10-Most-Prestigious-Things-to-FLEX-with-By-Zepla",
    "/lang-study/Asmongold-on-Blizzard-Firing-Diablo-4-Game-Director-More",
    "/lang-study/Asmongold-Reacts-to-Diablo-2-Resurrected-NEW-CINEMATICS",
    "/lang-study/Asmongold-Reacts-to-Most-Popular-Games-2004-2020-",
    "/lang-study/Asmongold-Reacts-to-The-Awful-Side-of-FFXIV-"
  ]
}
\`\`\`

### Results: Evidence Proving Pre-rendering Ocurred

#### Show Contents by Pre-rendered Html

Navigation to \`https://machingclee.github.io/skills\`:

  <center>
    <a href="/assets/tech/005.png"><img width="460" src="/assets/tech/005.png"/></a>
  </center>
  <br/>
  which is exactly <a href="https://github.com/machingclee/machingclee.github.io/blob/master/skills/index.html"><strong><i>this file</i></strong></a>. Moreover, it becomes a standard react app when user starts to navigate anywhere in the app (no html will be downloaded any more). It can be thought of as having 10 entry points rather than 1 in the past.<br/><br/>

#### Show Contents by Javascript Rendering

Navigation to \`https://localhost:3000/skills\`:

  <center>
    <a href="/assets/tech/006.png"><img width="460" src="/assets/tech/006.png"/></a>
  </center>
  <br/>

which is our \`index.html\` in \`build\`.
`;export{e as default};
