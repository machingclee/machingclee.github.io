const n=`---
title: makeStyles for react-mui v5.0 and tss-react/mui
date: 2022-11-15
id: blog0108
tag: react, nextjs
intro: The latest react mui version (\`v5.0\`) has breaking changes that make the config files in [THIS POST](/blog/article/Additional-Configuration-for-makeStyles-in-Next-js) fail. We discuss the corresponding necessary changes.
---

### New Syntax

\`\`\`js
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  button: {
    color: "black",
    textTransform: "none",
    borderColor: "rgba(0,0,0,0.5)",
    padding: "3px 10px",
    borderRadius: 4,
    "&:hover": {
      color: "rgba(0,0,0,0.55)",
      borderColor: "rgba(0,0,0,0.3)"
    }
  }

}));

const SomeComponent = () => {
  ...
  const { classes, cx } = useStyles();
  ...
}
\`\`\`

### New Config for Nextjs to Parse CSS on Server Side

#### src/createEmotionCache.js

\`\`\`js
import createCache from "@emotion/cache";

const isBrowser = typeof document !== "undefined";

// On the client side, Create a meta tag at the top of the <head> and set it as insertionPoint.
// This assures that MUI styles are loaded first.
// It allows developers to easily override MUI styles with other styling solutions, like CSS modules.
export default function createEmotionCache() {
  let insertionPoint;

  if (isBrowser) {
    const emotionInsertionPoint = document.querySelector(
      'meta[name="emotion-insertion-point"]'
    );
    insertionPoint = emotionInsertionPoint ?? undefined;
  }

  return createCache({ key: "mui-style", insertionPoint });
}
\`\`\`

#### pages/\\_document.js

\`\`\`js
import * as React from "react";
import Document, { Html, Head, Main, NextScript } from "next/document";
import createEmotionServer from "@emotion/server/create-instance";
import createEmotionCache from "../src/createEmotionCache";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* PWA primary color */}
          <link rel="shortcut icon" href="/favicon.ico" />
          <meta name="emotion-insertion-point" content="" />
          {this.props.emotionStyleTags}
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

// \`getInitialProps\` belongs to \`_document\` (instead of \`_app\`),
// it's compatible with static-site generation (SSG).
MyDocument.getInitialProps = async (ctx) => {
  // Resolution order
  //
  // On the server:
  // 1. app.getInitialProps
  // 2. page.getInitialProps
  // 3. document.getInitialProps
  // 4. app.render
  // 5. page.render
  // 6. document.render
  //
  // On the server with error:
  // 1. document.getInitialProps
  // 2. app.render
  // 3. page.render
  // 4. document.render
  //
  // On the client
  // 1. app.getInitialProps
  // 2. page.getInitialProps
  // 3. app.render
  // 4. page.render

  const originalRenderPage = ctx.renderPage;

  // You can consider sharing the same Emotion cache between all the SSR requests to speed up performance.
  // However, be aware that it can have global side effects.
  const cache = createEmotionCache();
  const { extractCriticalToChunks } = createEmotionServer(cache);

  ctx.renderPage = () =>
    originalRenderPage({
      enhanceApp: (App) =>
        function EnhanceApp(props) {
          return <App emotionCache={cache} {...props} />;
        },
    });

  const initialProps = await Document.getInitialProps(ctx);
  // This is important. It prevents Emotion to render invalid HTML.
  // See https://github.com/mui/material-ui/issues/26561#issuecomment-855286153
  const emotionStyles = extractCriticalToChunks(initialProps.html);
  const emotionStyleTags = emotionStyles.styles.map((style) => (
    <style
      data-emotion={\`\${style.key} \${style.ids.join(" ")}\`}
      key={style.key}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: style.css }}
    />
  ));

  return {
    ...initialProps,
    emotionStyleTags,
  };
};
\`\`\`

#### pages/\\_app.tsx

\`\`\`js
...
import createEmotionCache from '../src/createEmotionCache';
import { EmotionCache } from "@emotion/cache"
import { CacheProvider } from '@emotion/react';

const clientSideEmotionCache = createEmotionCache();

function MyApp({ Component, pageProps, emotionCache = clientSideEmotionCache }: AppProps & {
  emotionCache: EmotionCache
}) {
  const AnyComponent = Component as any;
  useEffect(() => {
    const jssStyles = document.querySelector('#jss-server-side');
    if (jssStyles) {
      jssStyles.parentElement?.removeChild(jssStyles);
    }
  }, []);
  return (
    <CacheProvider value={emotionCache}>
    ...
    </CacheProvider>
  );
}
export default MyApp
\`\`\`
`;export{n as default};
