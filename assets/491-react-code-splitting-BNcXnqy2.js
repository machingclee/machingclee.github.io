const e=`---
title: "Securing a React SPA in AWS Lambda with a Custom Domain"
date: 2026-05-01
id: blog0491
tag: react
toc: true
indent: true
intro: "Study coding splitting for secure documentation"
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


### Overview

The goal is to serve a react documentation site through an Express server running inside an AWS Lambda, this is to protect our documetation by JWT cookie authentication. 

Only authenticated users can access our proctected \`js\`-bundles, these bundles include:

- React pages (the main page after login)
- All markdown files

Additionally we also have middleware to project:

- Images used by these files.

We also access our lambda function via a custom domain name through API Gateway.



### Architecture

\`\`\`plantuml
@startuml
!theme plain
skinparam componentStyle rectangle
skinparam defaultTextAlignment center
skinparam ArrowColor #555555
skinparam ComponentBorderColor #888888
skinparam ComponentBackgroundColor #F8F8F8
skinparam NoteBackgroundColor #FFFDE7
skinparam NoteBorderColor #CCCC00

actor Browser

cloud "AWS" {
  component "Route 53\\n(yyy.machingclee.com)" as R53
  component "API Gateway\\nRegional Custom Domain" as APIGW_Domain
  component "API Gateway Stage\\n(prod)" as APIGW_Stage

  node "Lambda (Node.js 22)" as Lambda {
    component "serverless-http" as SH

    node "Express" as Express {
      component "/login\\n(auth)" as Login
      component "/assets/*\\n(protected-*.js gated by JWT)" as Assets
      component "/images/*\\n(gated by JWT)" as Images
      component "/files/*\\n(gated by JWT)" as Files
      component "/fonts/*\\n(gated by JWT)" as Fonts
      component "* (fallback)\\n(index.html)" as Fallback
    }
  }
}

Browser -right-> R53 : HTTPS
R53 -right-> APIGW_Domain
APIGW_Domain -down-> APIGW_Stage
APIGW_Stage -down-> Lambda
Lambda -down-> SH
SH -down-> Express

Express -down-> Login
Express -down-> Assets
Express -down-> Images
Express -down-> Files
Express -down-> Fonts
Express -down-> Fallback
@enduml
\`\`\`





### Chunks the Frontend
#### Route-level code splitting (\`router.tsx\`)

Each page is loaded lazily via \`lazy()\` in React Router. Rollup sees the dynamic \`import()\` boundary and emits a separate JS chunk per page:

\`\`\`tsx
async function lazyDoc(importer: () => Promise<{ default: React.ComponentType }>) {
    const { default: Component } = await importer();
    return { Component };
}

<Route 
    path={RouteEnum.CCLEE_DOC} 
    lazy={() => lazyDoc(() => import('../pages/DocRoot.tsx'))}
>
    <Route 
        index 
        lazy={() => lazyDoc(() => import('../pages/HomePage/HomePage.tsx'))} 
    />
</Route>
\`\`\`

This means \`DocRoot\`, \`HomePage\`, and \`LoginPage\` each compile into their own JS chunks. 

Combined with the \`chunkFileNames\` rule (see *Chunk file naming* in [#frontend-vite-build]), those chunks are emitted as \`protected-DocRoot-[hash].js\` and \`protected-HomePage-[hash].js\`, which the \`cookieMiddleware\` on the server refuses to serve unless a valid JWT cookie is present.

#### Markdown-per-chunk splitting (\`useMarkdownInit.ts\`)

\`import.meta.glob\` with \`eager: false\` tells Vite to treat every matched \`.md\` file as a separate dynamic import. \`Rollup\` therefore emits one JS chunk per markdown file:

\`\`\`ts
const markdownModules = import.meta.glob(
    '../markdowns/**/*.md',
    { query: '?raw', import: 'default', eager: false }
) as Record<string, () => Promise<string>>;
\`\`\`

At runtime, \`useMarkdownInit\` calls all those loaders in parallel via \`Promise.all\`, strips YAML frontmatter, derives a display title and URL slug from the filename, and dispatches everything into Redux. 

Because each markdown becomes its own \`protected-[name]-[hash].js\` chunk (matched by \`isMdChunk\` in \`shouldBeProjectedPage\`), the raw documentation text is ***never*** delivered to an unauthenticated browser because the server blocks those chunk requests at the \`/assets\` middleware layer.

#### Frontend Build (Vite) {#frontend-vite-build}

##### \`vite.config.ts\`
- \`base: "/"\` — used with a custom domain (no stage prefix in URLs).
  - If using the raw API Gateway URL (\`/prod\` stage), use \`base: mode !== 'development' ? '/prod/' : '/'\` instead.

- **Protected chunk naming**: Rollup \`chunkFileNames\` prefixes certain chunks with \`protected-\`:
  \`\`\`ts
  const shouldBeProjectedPage = (chunkInfo: PreRenderedChunk) => {
    const isMdChunk = chunkInfo.moduleIds?.some((id) => /\\.md(\\?|$)/.test(id));
    const allIds = [...(chunkInfo.moduleIds ?? []), chunkInfo.facadeModuleId ?? ''];
    const isProtectedPage = allIds.some((id) => PROTECTED_PAGES.test(id));
    return isMdChunk || isProtectedPage;
  };
  // Output: assets/protected-[name]-[hash].js
  \`\`\`
  Our protected targets are:

  - All markdown files and;
  - Non-\`Login\` react pages, for us there are only two of them:
    \`\`\`ts
    const PROTECTED_PAGES = /\\/(DocRoot|HomePage\\/HomePage)\\.tsx$/;
    \`\`\`
  
  \`moduleIds\` must be checked in addition to \`facadeModuleId\` because shared/split chunks may have a \`null\` facadeModuleId.

- **Chunk file naming** — the \`chunkFileNames\` callback applies the \`protected-\` prefix based on the helper above:
  \`\`\`ts
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        chunkFileNames(chunkInfo) {
          const isProtected = shouldBeProjectedPage(chunkInfo);
          const prefix = isProtected ? 'protected-' : '';
          return \`assets/\${prefix}[name]-[hash].js\`;
        },
      },
    },
  },
  \`\`\`
  Protected chunks are output as \`assets/protected-[name]-[hash].js\`; all others follow the standard \`assets/[name]-[hash].js\` pattern.

  This naming convention enables us effectively to filter out which bundles are only accessible by ***authenticated*** users.




##### API base URL (\`baseApi.ts\`)

Since we are deploying our react inside of an lambda function. When we deploy over api-gateway without custom domain name, we may need a stage \`prod\` (or something else), 
then the base name needs to be promoted to \`prod/\` instead of \`/\`.

\`\`\`ts
const baseUrl = import.meta.env.BASE_URL.replace(/\\/$/, '');
// With base: "/" → baseUrl = ""  (custom domain, no prefix)
// With base: "/prod/" → baseUrl = "/prod"  (raw API Gateway URL)
\`\`\`

This \`BASE_URL\` is the ***Vite-preserved*** env name that is taken from the \`base\` attribute in \`vite.config.ts\`.


Later if we have custom domain name assigned to this api-gateway, we can switch back to \`base: "/"\` in \`vite.config.ts\`.


### Integration into Lambda





#### Backend (\`Express\` + \`serverless-http\`)

##### \`server.ts\` and Handling of Binaries
\`\`\`ts
export const handler = serverless.default(app, { binary: ['*/*'] });
\`\`\`
\`binary: ['*/*']\` tells \`serverless-http\` to base64-encode binary responses (images, fonts, etc.). API Gateway then decodes them back to raw bytes. Without this, PNG/font bytes are corrupted in transit.

##### \`serverless-prod.yml\` and Handling of Binaries
\`\`\`yaml
provider:
  apiGateway:
    binaryMediaTypes:
      - '*/*'
package:
  patterns:
    - "frontend-dist/**"
\`\`\`
- \`binaryMediaTypes\` — API Gateway decodes base64 responses back to binary before sending to the browser.

- \`frontend-dist/**\` — includes the built React app (JS chunks, images, fonts, files) in the Lambda deployment zip. Files land at \`/var/task/frontend-dist/\` inside Lambda.

##### \`app.ts\`, the Guard for Sensitive Resources


Here we have managed middlewares to protect target resources.

This is why we host a webpage in a backend rather than simply an S3 when sensitive static data is of our concern.

\`\`\`ts
import express from "express";
import cors from 'cors';
import cookieParser from 'cookie-parser';
import errorHandler from "./middlewares/errorHandler";
import AuthController from "./controller/AuthController";
import path from "path";
import cookieMiddleware from "./middlewares/cookieMiddleware";
import authMiddleware from "./middlewares/authMiddleware";
import ViteController from "./controller/ViteController";
import presetHeaderMiddleware from "./middlewares/presetHeaderMiddleware";

const FRONTEND_DIST = process.env.FRONTEND_DIST_PATH || ""

export const app = express();

app.get("/healthcheck", (req, res) => {
  res.status(200).json({
    success: true,
    result: {
      FRONTEND_DIST: FRONTEND_DIST
    }
  })
})

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Serve the Vite manifest (no-cache so clients always get the latest chunk filenames)
app.get("/.vite/manifest.json", ViteController.serveManifest);

// Gate protected JS chunks — cookieMiddleware is mounted on /assets so req.path = /HomePage-*.js
app.use("/assets", cookieMiddleware);

// Serve hashed JS/CSS chunks (long-lived cache — hash in filename guarantees freshness)
app.get("/assets/:file", ViteController.serveAsset);

// Protect static public assets — require valid JWT cookie
app.use("/images", authMiddleware);
app.use("/files", authMiddleware);
app.use("/fonts", authMiddleware);

// Serve static public files (images, fonts, downloadable files referenced in markdown)
app.use(express.static(FRONTEND_DIST, { index: false }));

// Authentication Purpose 
app.get("/authenticate", presetHeaderMiddleware, AuthController.authenticate)
app.post("/login", AuthController.login);
app.post("/logout", (_req, res) => {
  res.clearCookie("access_token", { httpOnly: true, sameSite: "strict" });
  res.json({ success: true });
});

// Serve frontend SPA — must come after all API routes
// Unmatched routes now all fall through to this handler, so SPA can handle client-side routing
app.get("*", (_req, res) => {
  res.sendFile(path.resolve(FRONTEND_DIST, "index.html"));
});

app.use(errorHandler);

// No use in lambda, used in dev server
const PORT = Number(process.env["PORT"]);

app.listen(PORT, () => {
  console.log(\`Server started on http://localhost:\${PORT}\`);
});
\`\`\`
#### Middlewares

##### Protected chunk middleware (\`cookieMiddleware.ts\`)
Only blocks requests for files matching \`/^protected-.+\\.js$/\`. All other assets pass through freely.

Protected \`js\`-bundles include React-Pages after login, all markdown files. Only users with valid \`access_token\` can access our protected resources.

##### Auth middleware (\`authMiddleware.ts\`)
Verifies the \`access_token\` httpOnly cookie (JWT). Used on \`/images\`, \`/files\`, \`/fonts\`.



###### Cookie Authentication Flow

1. User POSTs credentials to \`/login\`.

2. Express validates against \`LOGIN_USERNAME\` / \`LOGIN_PASSWORD\` env vars.
3. On success, signs a JWT and sets it as an \`httpOnly\`, \`secure\`, \`sameSite: strict\` cookie (\`access_token\`), expiry 7 days.
4. All subsequent requests to protected routes include the cookie automatically.
5. \`authMiddleware\` / \`cookieMiddleware\` verify the JWT on every protected request.

#### Key Gotchas Encountered

| Problem | Cause | Fix |
|---|---|---|
| All assets 403 | Vite \`base: '/'\` generates \`/assets/...\` paths; raw API Gateway needs \`/prod/assets/...\` | Set \`base: '/prod/'\` for raw URL, or use custom domain with \`base: '/'\` |
| Images corrupt (tiny broken icon) | API Gateway treats Lambda responses as text by default | Add \`binary: ['*/*']\` to \`serverless-http\` and \`binaryMediaTypes: ['*/*']\` to API Gateway config |
| DNS not resolving | Created a plain A record with a domain as value (A records need IPs) | Use Alias A record pointing to API Gateway domain, or a CNAME |
| \`HomePage\` chunk not getting \`protected-\` prefix | \`facadeModuleId\` is \`null\` for shared chunks | Also check \`moduleIds\` array in \`chunkFileNames\` callback |
| \`BASE_URL\` trailing slash confusion | Vite always normalises \`base\` to have a trailing slash in \`BASE_URL\` | Use \`import.meta.env.BASE_URL.replace(/\\/$/, '')\` to strip it |

### Custom Domain in API Gateway

#### Setup steps
1. **ACM Certificate** — issue a certificate for \`yyy..machingclee.com\` in \`ap-northeast-1\` (must be Regional, not us-east-1).
2. **API Gateway Custom Domain** — create a Regional custom domain \`yyy.machingclee.com\`, attach the ACM cert.
3. **API Mapping** — map the \`documentation\` API, stage \`prod\`, path \`(none)\`. This strips the \`/prod\` stage prefix from all URLs.
4. **Route 53** — create an **Alias A record** for \`yyy.machingclee.com\`:
   - Alias target: \`Alias to API Gateway API\`
   - Region: \`ap-northeast-1\`
   - Domain: \`d-9r32jujf6g.execute-api.ap-northeast-1.amazonaws.com\`

      > **Remark.** This is an alias created by Custom Domain Name in api-gateway.

   A plain A record with a domain as the value does not work — it must be an Alias record or a CNAME.

#### URL behaviour
| Access method | URL pattern |
|---|---|
| Raw API Gateway | \`https://xxx.execute-api.ap-northeast-1.amazonaws.com/prod/\` |
| Custom domain (path = none) | \`https://yyy.machingclee.com/\` |

With path \`(none)\`, the \`/prod\` stage prefix is transparent — all Express routes are at \`/\`, \`/login\`, \`/images/...\` etc.

`;export{e as default};
