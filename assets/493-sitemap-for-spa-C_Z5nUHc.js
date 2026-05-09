const e=`---
title: "Sitemap for SPA"
date: 2026-05-09
id: blog0493
tag: react
toc: true
intro: "Study sitemap for SEO"
indent: true
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
    min-width: 120px;
  }
</style>


# Sitemap Generation for Single Page Applications

### What is a Sitemap and Why We Need One

#### From Prerendering to Sitemaps

In the past, getting a React SPA indexed by Google required prerendering every route into a static HTML file, because Googlebot could not execute JavaScript reliably. That approach required running a headless browser, managing a prerendered output directory, and carefully wiring everything into the build pipeline.

Nowadays, Google's crawler is capable of executing JavaScript and rendering SPAs directly. We no longer need to prerender every page to achieve decent SEO coverage. However, Google still recommends providing a sitemap so that its crawler knows which URLs exist on our site, especially when those URLs are only reachable through client-side navigation and are not linked from any other crawlable page.

#### Structure of a Sitemap

A sitemap is an XML file placed at the root of a site, conventionally at \`/sitemap.xml\`. It lists all the URLs that belong to our site, along with optional metadata such as when each page was last modified, how frequently it changes, and its relative priority among other pages.

Google reads this file to build its crawl queue. Without it, the crawler relies entirely on following links, which is unreliable for SPAs where most navigation happens through JavaScript without full page loads.

A minimal sitemap looks like this:

\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.example.com/</loc>
    <lastmod>2026-05-09</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.example.com/blog/article/some-title</loc>
    <lastmod>2026-05-09</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
\`\`\`

#### Where the URL List Comes From

The sitemap generator needs a list of all URLs on the site. For a site with only a few static pages, we can hardcode them directly. For sites with many dynamically generated pages, such as a blog, we typically collect the URLs from whatever source of truth already exists in the project, such as a routes config file, a list of markdown files, or a CMS response, and feed that list into the generator at build time.

### Generating the Sitemap and Wiring It Into the Build

#### The Generator Script

We place the generator at \`scripts/gen-sitemap.mjs\`. It builds the full URL list and writes \`public/sitemap.xml\`. Because Vite copies everything from \`public/\` into \`dist/\` during the build, the sitemap ends up at the root of the deployed site automatically.

\`\`\`js
// scripts/gen-sitemap.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "public", "sitemap.xml");

const BASE_URL = "https://your-site.github.io";
const TODAY = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

// 静态页面，优先级和更新频率手动指定
const staticRoutes = [
  { path: "/",        priority: "1.0", changefreq: "weekly"  },
  { path: "/about",   priority: "0.8", changefreq: "monthly" },
  { path: "/blog",    priority: "0.9", changefreq: "weekly"  },
  { path: "/contact", priority: "0.6", changefreq: "yearly"  },
];

// 动态路由可从任何数据来源读取，例如 markdown 文件列表、CMS API 等
const dynamicRoutes = [
  "/blog/some-article",
  "/blog/another-article",
];

const allUrls = [
  ...staticRoutes.map(r => ({
    loc: BASE_URL + r.path,
    lastmod: TODAY,
    changefreq: r.changefreq,
    priority: r.priority,
  })),
  ...dynamicRoutes.map(r => ({
    loc: BASE_URL + r,
    lastmod: TODAY,
    changefreq: "monthly",
    priority: "0.7",
  })),
];

const urlEntries = allUrls
  .map(
    u => \`  <url>
    <loc>\${u.loc}</loc>
    <lastmod>\${u.lastmod}</lastmod>
    <changefreq>\${u.changefreq}</changefreq>
    <priority>\${u.priority}</priority>
  </url>\`
  )
  .join("\\n");

const xml = \`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
\${urlEntries}
</urlset>
\`;

fs.writeFileSync(OUTPUT_PATH, xml, "utf8");
console.log(\`sitemap.xml written to \${OUTPUT_PATH} (\${allUrls.length} URLs)\`);
\`\`\`

#### Build Order

We add a \`build:sitemap\` script to \`package.json\` and make sure it runs before \`vite build\`:

\`\`\`json
{
  "scripts": {
    "build:sitemap": "node scripts/gen-sitemap.mjs",
    "build": "yarn build:sitemap && vite build"
  }
}
\`\`\`

\`build:sitemap\` must run before \`vite build\`, because Vite copies \`public/\` into \`dist/\` at build time. If we run the generator after Vite, the file never reaches \`dist/\`.

### Submitting to Google Search Console

#### Submitting and Monitoring Indexing

Once ownership is verified, we navigate to the Sitemaps section inside Google Search Console at 

- https://search.google.com/search-console

and click on 

![](/assets/img/2026-05-09-17-38-52.png?width=400px)

then choose the following in 

![](/assets/img/2026-05-09-17-39-35.png)

and enter the entrypoint of our web application:
\`\`\`text
https://your-site.github.io
\`\`\`

Google fetches the file, reads the URL list, and adds those URLs to its crawl queue. The typical timeline after submission is:

- Google fetches the sitemap within a few hours.
- Individual pages get crawled over the following days to weeks, depending on the site's crawl budget and how often Google has seen activity from the domain.
- Pages begin appearing in search results shortly after being crawled and indexed.

For an established domain with regular updates, the turnaround is usually on the shorter end of that range. We can monitor progress under the Coverage and Pages sections inside Search Console to see which URLs have been discovered, which are indexed, and which have errors.



#### Verifying Ownership and Placing the Sitemap

Before we can submit a sitemap, Google needs to verify that we own the site. One of the supported methods is the HTML file method: Google provides a uniquely named HTML file, we place it at the root of our site, and Google fetches it to confirm ownership.

For a Vite project, we simply drop the file into \`public/\`. The sitemap generated by our script also lives there:

\`\`\`text
public/
  googlef2c0b1ac92d833ea.html   ← verification file provided by Google
  sitemap.xml                   ← generated by our script
  index.html
  robots.txt
\`\`\`

Both files are copied into \`dist/\` by Vite on every build, so they remain available at the site root after every deployment without any extra steps.



### Common Issues After Submission

#### 無法擷取 (Cannot Fetch)

After submitting a sitemap URL in Google Search Console, it is common to immediately see a status of **無法擷取** (Cannot fetch). This is almost always a queue delay rather than a real error — Google's crawler has not yet visited the URL at the time GSC checks the status. The status typically resolves itself within hours to a few days without any action needed.

The checklist to rule out a genuine problem:

- The sitemap URL returns HTTP 200 and valid XML — verify by opening it directly in a browser.
- The sitemap is not blocked by \`robots.txt\` — our \`robots.txt\` even advertises it explicitly via the \`Sitemap:\` directive.
- The XML namespace is \`http://www.sitemaps.org/schemas/sitemap/0.9\` — required by the spec.

If all three hold, simply wait. GSC will re-crawl and update the status on its own schedule.

#### Non-ASCII Characters in \`<loc>\` URLs

Google's sitemap spec requires that every URL inside a \`<loc>\` tag use only ASCII characters. Any non-ASCII character — such as a Chinese character in a route slug — must be **percent-encoded**. For example, a route like \`/blog/article/Live2D-心得\` must appear in the sitemap as:


\`\`\`xml
<loc>
  https://machingclee.github.io/blog/article/Live2D-%E5%BF%83%E5%BE%97
</loc>
\`\`\`
This issue is especially easy to overlook when routes are generated by program. Leaving Chinese characters unencoded causes GSC to flag those entries as **網址無效** (Invalid URL) and skip them during indexing.

The fix in the generator script is to replace naive string concatenation with \`new URL()\`, which applies percent-encoding automatically:

\`\`\`js
// before: r is a raw route path string, e.g. "/blog/article/Live2D-心得"
loc: BASE_URL + r,

// after
loc: new URL(r, BASE_URL).href,
\`\`\`

\`new URL(r, BASE_URL).href\` resolves the path against the base URL and returns a fully encoded absolute URL, so no Chinese (or other non-ASCII) characters ever appear raw inside the XML.


### Reference 

- Simon DONG, [*Google Search Console的sitemap提示【无法获取】or【无法读取站点地图】*](https://support.google.com/webmasters/community-guide/303086556?hl=zh-Hans), Search Console 幫助`;export{e as default};
