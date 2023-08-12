---
title: "Getting Path Parameters"
date: 2023-08-11
id: blog0163
tag: react
intro: 'I used to use `useRouteMatch` in `react-router-dom v5`, which has been changed completely in `v6` into something called `useMatch` or `useMatches`. We talk about building the param searching function on our own to get rid of these unhandy "black boxes".'
toc: true
---

<style>
img {
  width: 100%;
}
</style>

#### Usage and Examples

Consider the following path:

```none
http://localhost:3000/#/buyer/order/6347b89b67762f48a700d4be/contract/64d7912d33184f49a6346f20
```

We print the result in chrome debug console:

<Center>
<a href="/assets/tech/163/001.png" taget="_blank">
  <img src="/assets/tech/163/001.png"/>
</a>
</Center>

#### Code Implmentation

```ts
import { useLocation } from "react-router-dom";

export default () => {
  const { pathname } = useLocation();

  const paramRightAfter = (rightAfterKeyword: string) => {
    const matchingRegex = new RegExp(
      `(?<=${rightAfterKeyword}).*?(?=($|\/))`,
      "g"
    );
    return pathname.match(matchingRegex)?.[0] || "";
  };

  const getPathUpto = (stopKeyword: string) => {
    const matchingRegex = new RegExp(`^.*${stopKeyword}`, "g");
    return pathname.match(matchingRegex)?.[0] || "";
  };

  return { paramRightAfter, getPathUpto };
};
```
