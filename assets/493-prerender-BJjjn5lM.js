const e=`---
title: "Incremental Pre-rendering for SEO in Vite + React SPA"
date: 2026-05-07
id: blog0493
tag: react
toc: true
indent: true
intro: "How to pre-render all pages of a Vite + React SPA to static HTML for SEO, with an incremental rebuild that only re-renders pages whose content actually changed."
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table td:first-child, table th:first-child {
    min-width: 180px;
  }
</style>

### Problem

A Vite + React SPA deployed to GitHub Pages has no server-side rendering. Search engines receive an empty \`<div id="root">\` with no content, so pages are not indexed.

The goal is to **pre-render every route to static HTML** once at deploy time, so crawlers get fully populated pages.

A secondary goal is **incremental rebuild**: only re-render routes whose markdown source actually changed, not all ~490 pages every time.



### Why Not a Plugin?

\`vite-plugin-prerender\` uses an old Puppeteer (v1.20) that cannot launch on macOS 14+. Even with a custom \`executablePath\`, it snaps the DOM before React hydrates and produces an empty \`<div id="root">\`. It was abandoned in favour of a custom script.



### Using Vite Content Hashes
 
Vite emits every source file as a hashed bundle:

\`\`\`
src/mds/articles/tech/460-polling.md?raw  →  assets/460-polling-BKrtXkz-.js
\`\`\`

The hash in the filename is derived from the **file content**. If the content has not changed between two builds, the filename is **identical**. This means:

> If \`prerendered/assets/460-polling-BKrtXkz-.js\` already exists, that article has not changed and does not need to be re-rendered.

No manifest diffing, no custom cache files — the hashed filenames themselves are the cache keys.



### How \`dist/.vite/manifest.json\` Is Structured

#### Step 1 — \`router.tsx\` lazy-loads the page components

\`router.tsx\` registers the blog and portfolio pages as **lazy routes**:

\`\`\`tsx
// router.tsx
<Route
  path="blog/*"
  lazy={() => lazyRoute(() => import("../components/pages/Blog/Blog"))}
/>
<Route
  path="portfolio/*"
  lazy={() => lazyRoute(() => import("../components/pages/Portfolios/Portfolios"))}
/>
\`\`\`

The \`blog/*\` wildcard keeps \`Blog.tsx\` mounted whether the user is at \`/blog\`, \`/blog/article/foo\`, or \`/blog/category/react\`. Every URL under \`blog/\` is handled by the same component — React Router passes the sub-path to the component, which uses \`useMatch\` internally to decide what to render.

#### Step 2 — the page components declare \`import.meta.glob\`

\`Blog.tsx\` and \`Portfolios.tsx\` each declare a module-level glob at the **top of the file**:

\`\`\`ts
// Blog.tsx — one lazy JS chunk per article markdown file
const articleModules = import.meta.glob(
  "../../../mds/articles/**/*.md",
  { query: "?raw", import: "default", eager: false }
) as Record<string, () => Promise<string>>;

// Portfolios.tsx — one lazy JS chunk per portfolio markdown file
const portfolioModules = import.meta.glob(
  "../../../mds/portfolios/**/*.md",
  { query: "?raw", import: "default", eager: false }
) as Record<string, () => Promise<string>>;
\`\`\`

\`eager: false\` means Vite does **not** bundle the markdown inline. Instead, at build time it emits each matched \`.md\` file as its own separate hashed JS chunk that exports just the raw markdown string. The glob object at runtime is a map of \`{ sourcePath: () => Promise<string> }\` — calling the function fetches the chunk on demand.

#### Step 3 — Vite records every chunk in the manifest

Because every \`.md\` file becomes a named chunk, \`dist/.vite/manifest.json\` gets one entry per file. The key is the source path with \`?raw\` appended (reflecting the query Vite used to transform it). There is no separate \`src\` field on these entries — the key itself is the source path:

\`\`\`json
{
  "src/mds/articles/tech/460-polling.md?raw": {
    "file": "assets/460-polling-BKrtXkz-.js"
  },
  "src/mds/portfolios/001-tkinter.md?raw": {
    "file": "assets/001-tkinter-CXm3aB7k.js"
  }
}
\`\`\`

Page components (\`.tsx\`) are also in the manifest and do have a \`src\` field:

\`\`\`json
{
  "src/components/pages/About/About.tsx": {
    "src": "src/components/pages/About/About.tsx",
    "file": "assets/About-DI3Znngz.js"
  }
}
\`\`\`

The chain is therefore:

\`\`\`
router.tsx  lazy-imports  Blog.tsx
                              │
                    import.meta.glob (eager: false)
                              │
                    one hashed chunk per .md file
                              │
                    dist/.vite/manifest.json entry per chunk
                              │
                    prerender.mjs reads manifest
                              └── compares hash against prerendered/assets/
\`\`\`



### Directory Layout

\`\`\`
app/
├── dist/                      ← wiped on every vite build
│   ├── assets/                ← hashed bundles from the current build
│   └── .vite/manifest.json
├── prerendered/               ← persistent store, never wiped
│   ├── assets/                ← copy of dist/assets/ from last build (stamp files)
│   └── {route}/index.html     ← rendered HTML from last build
└── before-build-script/
    └── prerender.mjs
\`\`\`

\`prerendered/\` is gitignored and lives only on the local machine.



### Full Workflow

\`\`\`
yarn build
  └─ vite build
       └─ emits dist/assets/ with new content-hashed filenames

yarn prerender   (or as part of yarn deploy)
  └─ prerender.mjs
       1. Read dist/.vite/manifest.json
       2. For each .md?raw entry → look up prerendered/assets/<hash>.js
            exists  → content unchanged → skip, copy HTML from prerendered/
            missing → content changed  → render with Puppeteer
       3. Write rendered HTML to dist/{route}/index.html
                                and prerendered/{route}/index.html
       4. Copy dist/assets/ → prerendered/assets/   (stamps for next run)
\`\`\`



### \`prerender.mjs\` — Incremental Check

\`\`\`js
// manifest keys for .md?raw imports look like:
//   "src/mds/articles/tech/460-polling.md?raw"
// The key IS the source path — no separate src field.
const srcToBundle = {};
for (const [key, entry] of Object.entries(manifest)) {
  const src = key.replace(/\\?raw$/, "");
  if (src.includes("/mds/articles/") || src.includes("/mds/portfolios/")) {
    srcToBundle[src] = entry.file; // e.g. "assets/460-polling-BKrtXkz-.js"
  }
}
\`\`\`

For each bundle, check if the stamp exists in \`prerendered/assets/\`:

\`\`\`js
for (const [src, bundle] of Object.entries(srcToBundle)) {
  const route = srcToRoute[src];
  if (!route) continue;
  const stamp = path.join(PRERENDERED_DIR, bundle);
  if (!fs.existsSync(stamp)) {
    console.log(\`  changed: \${route}\`);
    routesToRender.add(route);
  } else {
    console.log(\`  skipped: \${route}\`);
  }
}
\`\`\`

Static pages (About, Blog, Portfolio, …) use their \`.tsx\` component bundle as the stamp:

\`\`\`js
const staticRouteToSrc = {
  "/about":         "src/components/pages/About/About.tsx",
  "/blog":          "src/components/pages/Blog/Blog.tsx",
  "/portfolio":     "src/components/pages/Portfolio/Portfolio.tsx",
  "/artworks":      "src/components/pages/Artworks/Artworks.tsx",
  "/math-material": "src/components/pages/MathMaterial/MathMaterial.tsx",
  "/contact":       "src/components/pages/Contact/Contact.tsx",
};

for (const [route, src] of Object.entries(staticRouteToSrc)) {
  const entry = manifest[src];
  const stamp = path.join(PRERENDERED_DIR, entry.file);
  if (!fs.existsSync(stamp)) {
    routesToRender.add(route);
  }
}
\`\`\`



### \`prerender.mjs\` — Puppeteer Rendering

A minimal Node.js \`http\` server serves \`dist/\` on \`localhost:8765\`. Puppeteer (using system Chrome) visits each route, waits for \`networkidle0\` plus an extra 8 s for MathJax and lazy-loaded markdown, then snapshots the DOM.

\`\`\`js
async function renderRoute(browser, route) {
  const page = await browser.newPage();
  await page.goto(\`http://localhost:8765\${route}\`, {
    waitUntil: "networkidle0",
    timeout: 18_000,
  });
  await new Promise(r => setTimeout(r, 8000)); // wait for MathJax / lazy MD

  const html = await page.content();
  // Persist to dist/ (served to users) and prerendered/ (cache for next run)
  fs.writeFileSync(path.join(DIST, route, "index.html"), html, "utf8");
  fs.writeFileSync(path.join(PRERENDERED_DIR, route, "index.html"), html, "utf8");
}
\`\`\`

To prevent OOM on an 8 GB Mac, concurrency is capped at **2** and the browser is restarted every **30** routes.



### Stamps Are Updated at the End

After all rendering is done, \`dist/assets/\` is copied into \`prerendered/assets/\`:

\`\`\`js
fs.cpSync(path.join(DIST, "assets"), path.join(PRERENDERED_DIR, "assets"), { recursive: true });
\`\`\`

On the next run, these files serve as the reference. If Vite emits the same hashes (no source change), every route is skipped.



### The Scripts in \`before-build-script/\`

All five \`.mjs\` files live in \`before-build-script/\`. They run in a fixed order as part of the deploy pipeline.

#### \`gen-articles-meta.mjs\`

Reads every \`.md\` file in \`src/mds/articles/{tech,personal,math}/\`, parses the YAML frontmatter with a zero-dependency parser, and writes the aggregated metadata to \`src/mds/articles-meta.json\`. Each entry includes a \`_srcPath\` field (relative to \`src/\`) that the app uses at startup to build the article list **without** downloading any per-article JS chunk.

\`\`\`js
// Reads frontmatter only — no markdown body written to JSON
const meta = parseFrontmatter(fs.readFileSync(filePath, "utf8"));
meta._srcPath = \`mds/articles/\${subdir}/\${filename}\`;
results.push(meta);
\`\`\`

Run with: \`yarn gen-articles-meta\`

#### \`gen-portfolios-meta.mjs\`

Same idea for \`src/mds/portfolios/\`. Writes \`src/mds/portfolios-meta.json\`. Portfolios are lazy-loaded; the metadata JSON lets the portfolio list page render instantly.

Run with: \`yarn gen-portfolios-meta\`

#### \`gen-dynamic-routes.mjs\`

Walks both \`src/mds/articles/\` and \`src/mds/portfolios/\`, derives each article's URL from its frontmatter \`title\` using the same \`turnTitleToRouteId\` logic the React router uses, and writes the complete list to \`dynamicRoutes.json\` at the repo root.

\`prerender.mjs\` reads \`dynamicRoutes.json\` to know which routes exist.

\`\`\`js
// Mirrors src/utils/turnTitleToId/turnTitleToRouteId.ts
function turnTitleToRouteId(title) {
  return title.replace(/[^\\p{L}\\p{N}_-]+/gu, "-");
}
// Route for articles: /blog/article/<id>
// Route for portfolios: /portfolio/<id>
\`\`\`

Run with: \`yarn gen\` (aliased to \`node before-build-script/gen-dynamic-routes.mjs\`)

#### \`prerender.mjs\`

The main incremental SSG script. See the sections above for a full breakdown. The short version:

1. Reads \`dist/.vite/manifest.json\` to get content-hashed bundle filenames.
2. Checks whether each bundle's stamp file exists in \`prerendered/assets/\`.
3. Skips unchanged routes; re-renders changed ones with Puppeteer.
4. Writes HTML to both \`dist/\` and \`prerendered/\`.
5. Copies \`dist/assets/\` → \`prerendered/assets/\` to seed stamps for the next run.

Run with: \`yarn prerender\` or \`yarn prerender:full\`

#### \`pre-build.mjs\` (unused)

Originally copied \`dist/assets/\` → \`prerendered/assets/\` **before** the build so that the manifest diff could run. It is no longer needed because \`prerender.mjs\` self-seeds at the end. The file is kept for reference but is not called in any script.

### Complete Deployment Flow

\`\`\`
yarn deploy
│
├─ 1. cd .. && git add . && git commit && git push
│     (commit source repo changes first)
│
├─ 2. cd app && yarn gen
│     └─ gen-dynamic-routes.mjs
│           Scans all .md files → writes dynamicRoutes.json
│           (route list used by prerender.mjs)
│
├─ 3. yarn gen-articles-meta
│     └─ gen-articles-meta.mjs
│           Parses YAML frontmatter → writes src/mds/articles-meta.json
│           (loaded at app startup for the blog index)
│
├─ 4. yarn gen-portfolios-meta
│     └─ gen-portfolios-meta.mjs
│           Parses YAML frontmatter → writes src/mds/portfolios-meta.json
│
├─ 5. yarn build:deploy
│   │
│   ├─ 5a. vite build
│   │       Compiles + bundles → dist/
│   │       Emits dist/.vite/manifest.json with content-hashed filenames
│   │
│   ├─ 5b. node before-build-script/prerender.mjs
│   │       Reads manifest → checks prerendered/assets/ stamps
│   │       Skips unchanged routes, Puppeteer-renders changed ones
│   │       Writes HTML to dist/{route}/index.html
│   │                   and prerendered/{route}/index.html
│   │       Copies dist/assets/ → prerendered/assets/ (stamps for next run)
│   │
│   ├─ 5c. cp dist/index.html dist/404.html
│   │       GitHub Pages serves 404.html for unknown routes → SPA fallback
│   │
│   └─ 5d. cp -r dist/* ../../machingclee.github.io/
│           Copies the fully pre-rendered site into the GitHub Pages repo
│
└─ 6. yarn push
      cd ../../machingclee.github.io && git add . && git commit && git push
      (GitHub Pages deploys from this repo)
\`\`\`

### \`package.json\` Scripts

\`\`\`json
{
  "gen":            "node before-build-script/gen-dynamic-routes.mjs",
  "gen-articles-meta":   "node before-build-script/gen-articles-meta.mjs",
  "gen-portfolios-meta": "node before-build-script/gen-portfolios-meta.mjs",
  "build":          "vite build",
  "prerender":      "node before-build-script/prerender.mjs",
  "prerender:full": "node before-build-script/prerender.mjs --full",
  "build:deploy":   "vite build && node before-build-script/prerender.mjs && cp dist/index.html dist/404.html && rm -rf ../../machingclee.github.io/static/* && cp -r dist/* ../../machingclee.github.io",
  "push":           "cd ../../machingclee.github.io && git add . && (git commit -m'update' || true) && git push",
  "deploy":         "cd .. && git add . && (git commit -m'update' || true) && git push && cd app && yarn gen && yarn gen-articles-meta && yarn gen-portfolios-meta && yarn build:deploy && yarn push"
}
\`\`\`

Use \`--full\` on the first run ever, or after clearing \`prerendered/\`, to force all routes to render and seed the stamp files.



### Summary Table

| Concern | Solution |
|||
| SPA = empty HTML for crawlers | Puppeteer snapshots fully hydrated DOM |
| \`vite build\` wipes \`dist/\` | \`prerendered/\` store persists across builds |
| Incremental: detect unchanged pages | Compare \`prerendered/assets/<hash>\` existence |
| Incremental: how to get hash | Read \`dist/.vite/manifest.json\` — key for \`.md?raw\` is the src path |
| OOM on 8 GB Mac | \`CONCURRENCY=2\`, restart browser every 30 routes |
| Port held after crash | Script probes port before binding; prints kill command |
`;export{e as default};
