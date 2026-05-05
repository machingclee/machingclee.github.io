const t=`---
title: "Getting Path Parameters"
date: 2023-08-11
id: blog0163
tag: react
intro: 'I used to use \`useRouteMatch\` in \`react-router-dom v5\`, which has been changed completely in \`v6\` into something called \`useMatch\` or \`useMatches\`. We talk about building the param searching function on our own to get rid of these unhandy "black boxes".'
toc: true
---

<style>
img {
  width: 100%;
}
</style>

### Usage and Examples

Consider the following path:

\`\`\`none
http://localhost:3000/#/buyer/order/6347b89b67762f48a700d4be/contract/64d7912d33184f49a6346f20
\`\`\`

We print the result in chrome debug console:

<Center>
<a href="/assets/tech/163/001.png" taget="_blank">
  <img src="/assets/tech/163/001.png"/>
</a>
</Center>

### Code Implmentation

\`\`\`ts
// usePathUtils.ts

import { useLocation } from "react-router-dom";

export default () => {
  const { pathname } = useLocation();

  const paramRightAfter = (rightAfterKeyword: string) => {
    const matchingRegex = new RegExp(
      \`(?<=\${rightAfterKeyword}).*?(?=($|\\/))\`,
      "g"
    );
    return pathname.match(matchingRegex)?.[0] || "";
  };
  const getPathUpto = (stopKeyword: string) => {
    const matchingRegex = new RegExp(\`^.*\${stopKeyword}\`, "g");
    return pathname.match(matchingRegex)?.[0] || "";
  };

  return { paramRightAfter, getPathUpto };
};
\`\`\`

Next for convenience we create another hook so that instead of calling \`paramRightAfter\` and putting the desired string as param sporadically, we have a single source of truth:

\`\`\`ts
// useGetPathParams.ts

import usePathUtils from "./usePathUtils";

export default () => {
  const { paramRightAfter } = usePathUtils();

  return {
    projectOid: paramRightAfter("/order/"),
    programmeOid: paramRightAfter("/contract/"),
    section: paramRightAfter("/order/.*?/"),
  };
};
\`\`\`

But any change in the path may trigger rerender for components using this hook which may just use \`projectId\` but not \`section\`. Therefore we may consider **_putting path params in redux_** and let redux control which component to rerender.

### Ultimate Version

We invoke the following hook at the first routing component (where we have \`useLocation\` hook):

\`\`\`js
//useGenPathParams.ts

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAppDispatch } from "../redux/app/hook";
import applicationSlice from "../redux/slice/applicationSlice";
import usePathUtils from "./usePathUtils";

export default () => {
  const { pathname } = useLocation();
  const dispatch = useAppDispatch();
  const { paramRightAfter } = usePathUtils();

  useEffect(() => {
    dispatch(
      applicationSlice.actions.updatePathParams({
        projectOid: paramRightAfter("/order/"),
        programmeOid: paramRightAfter("/contract/"),
        section: paramRightAfter("/order/.*?/"),
        mailchainOid: paramRightAfter("/mailchain/"),
      })
    );
  }, [pathname]);
};
\`\`\`

Next we create a reducer in our slice that stores path params:

\`\`\`js
updatePathParams: (state, action: PayloadAction<ApplicationSliceState["pathParams"]>) => {
    state.pathParams = { ...state.pathParams, ...action.payload };
},
\`\`\`

Finally we adjust our existing \`useGetPathParams\`:

\`\`\`js
// useGetPathParams.ts

import { useAppSelector } from "../redux/app/hook"
import { ApplicationSliceState } from "../redux/slice/applicationSlice"

export default (paramKey: keyof ApplicationSliceState["pathParams"]) => {
	return useAppSelector(s => s.application.pathParams?.[paramKey]);
}
\`\`\`

which minimizes potential rerender problem while using this hook!
`;export{t as default};
