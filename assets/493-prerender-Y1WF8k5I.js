const e=`---
title: "Incremental Pre-rendering for SEO in Vite + React SPA"
date: 2026-05-07
id: blog0493
tag: react
toc: true
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

---

### Why Not a Plugin?

\`vite-plugin-prerender\` uses an old Puppeteer (v1.20) that cannot launch on macOS 14+. Even with a custom \`executablePath\`, it snaps the DOM before React hydrates and produces an empty \`<div id="root">\`. It was abandoned in favour of a custom script.

---

### The Key Insight — Vite Content Hashes

Vite emits every source file as a hashed bundle:

\`\`\`
src/mds/articles/tech/460-polling.md?raw  →  assets/460-polling-BKrtXkz-.js
\`\`\`

The hash in the filename is derived from the **file content**. If the content has not changed between two builds, the filename is **identical**. This means:

> If \`prerendered/assets/460-polling-BKrtXkz-.js\` already exists, that article has not changed and does not need to be re-rendered.

No manifest diffing, no custom cache files — the hashed filenames themselves are the cache keys.

---

### How \`dist/.vite/manifest.json\` Is Structured

Markdown files imported with \`?raw\` appear as top-level keys in the manifest. The key **is** the source path; there is no separate \`src\` field:

\`\`\`json
{
  "src/mds/articles/tech/460-polling.md?raw": {
    "file": "assets/460-polling-BKrtXkz-.js"
  }
}
\`\`\`

Page components (\`.tsx\`) follow the same pattern but do have a \`src\` field:

\`\`\`json
{
  "src/components/pages/About/About.tsx": {
    "src": "src/components/pages/About/About.tsx",
    "file": "assets/About-DI3Znngz.js"
  }
}
\`\`\`

---

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

---

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

---

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

---

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

---

### Stamps Are Updated at the End

After all rendering is done, \`dist/assets/\` is copied into \`prerendered/assets/\`:

\`\`\`js
fs.cpSync(path.join(DIST, "assets"), path.join(PRERENDERED_DIR, "assets"), { recursive: true });
\`\`\`

On the next run, these files serve as the reference. If Vite emits the same hashes (no source change), every route is skipped.

---

### \`package.json\` Scripts

\`\`\`json
{
  "build":        "vite build",
  "prerender":    "node before-build-script/prerender.mjs",
  "prerender:full": "node before-build-script/prerender.mjs --full",
  "build:deploy": "vite build && node before-build-script/prerender.mjs && cp dist/index.html dist/404.html && rm -rf ../../machingclee.github.io/static/* && cp -r dist/* ../../machingclee.github.io",
  "push":         "cd ../../machingclee.github.io && git add . && (git commit -m'update' || true) && git push",
  "deploy":       "cd .. && git add . && (git commit -m'update' || true) && git push && cd app && yarn gen && yarn gen-articles-meta && yarn gen-portfolios-meta && yarn build:deploy && yarn push"
}
\`\`\`

Use \`--full\` on the first run ever, or after clearing \`prerendered/\`, to force all routes to render and seed the stamp files.

---

### Summary Table

| Concern | Solution |
|---|---|
| SPA = empty HTML for crawlers | Puppeteer snapshots fully hydrated DOM |
| \`vite build\` wipes \`dist/\` | \`prerendered/\` store persists across builds |
| Incremental: detect unchanged pages | Compare \`prerendered/assets/<hash>\` existence |
| Incremental: how to get hash | Read \`dist/.vite/manifest.json\` — key for \`.md?raw\` is the src path |
| OOM on 8 GB Mac | \`CONCURRENCY=2\`, restart browser every 30 routes |
| Port held after crash | Script probes port before binding; prints kill command |
`;export{e as default};
