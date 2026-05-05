const e=`---
title: Additional Configuration for makeStyles in Next js
date: 2022-03-13
id: blog048
tag: react, nextjs
intro: Without additional setup, due to the natural of serverside rendering, some styles would become undefined and we study how to avoid them.
---

### Create pages/\\_document.js

Since we will not be going to edit this file, even our project is written in typescript, it is no harm to add this file and never touch it.

Now

\`\`\`js
// pages/_document.js
import React from "react";
import Document, { Html, Head, Main, NextScript } from "next/document";
import { ServerStyleSheets } from "@material-ui/core/styles";

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const sheets = new ServerStyleSheets();
    const originalRenderPage = ctx.renderPage;

    ctx.renderPage = () =>
      originalRenderPage({
        enhanceApp: (App) => (props) => sheets.collect(<App {...props} />),
      });

    const initialProps = await Document.getInitialProps(ctx);

    return {
      ...initialProps,
      // Styles fragment is rendered after the app and page rendering finish.
      styles: [
        ...React.Children.toArray(initialProps.styles),
        sheets.getStyleElement(),
      ],
    };
  }

  render() {
    return (
      <Html lang="en">
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
\`\`\`

### Edit \\_app.tsx

Finally

\`\`\`js
// pages/_app.tsx
useEffect(() => {
  const jssStyles = document.querySelector("#jss-server-side");
  if (jssStyles) {
    jssStyles.parentElement?.removeChild(jssStyles);
  }
}, []);
\`\`\`

### Reference

- <a href="https://stackoverflow.com/questions/66089290/materialui-makestyles-undoes-custom-css-upon-refresh-in-nextjs">MaterialUI makeStyles undoes custom css upon refresh in NextJS</a>
`;export{e as default};
