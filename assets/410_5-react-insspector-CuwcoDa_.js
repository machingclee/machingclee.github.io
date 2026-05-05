const n=`---
title: "\`react-dev-inspector\`, an Alternative to \`click-to-react-component\`"
date: 2025-09-04
id: blog0410_5
tag: react
toc: false
intro: Inspect react component by clicking
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

### Installation 

We install by 

\`\`\`sh
yarn add react-dev-inspector
\`\`\`

***Unlike*** \`click-to-react-component\`, \`react-dev-inspector\` supports ***older*** version of react including react version ***17***.


Next in the entrypoint of the application we add:

\`\`\`ts{9-11,17}
import { Inspector } from 'react-dev-inspector';

const InspectorWrapper = process.env.NODE_ENV === 'development'
  ? Inspector
  : React.Fragment;

ReactDOM.render(
  <>
    <InspectorWrapper
      keys={['control', 'shift', 'c']}
    >
      <Provider store={store}>
        <BrowserRouter basename={process.env.PUBLIC_URL + "/"}>
          <App />
        </BrowserRouter>
      </Provider>
    </InspectorWrapper>
  </>,

  document.getElementById("root")
);
\`\`\`

### Result


[![](/assets/img/2025-10-09-21-35-53.png)](/assets/img/2025-10-09-21-35-53.png)

On clicking, our IDE will jump to the \`img\` component inside of \`ProfileCard.tsx\`.`;export{n as default};
