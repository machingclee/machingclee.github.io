---
title: Element that has Default Fade-in Transition on Mount
date: 2022-04-19
id: blog063
tag: react
intro: Record an element that I made for default fade-in effect on component mount and state change.
toc: false
---

```js
import React, { ReactNode, useEffect, useState } from "react";
import classnames from "classnames";
import { makeStyles } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  "@keyframes fadein": {
    "0%": {
      opacity: 0,
    },
    "100%": {
      opacity: 1
    }
  },
  customFadein: {
    "&.fade-in": {
      animation: "$fadein .3s ease-in-out"
    }
  }
}))


export default function FadeIn({ children, dependencies = [] }:
  {
    children: ReactNode
    dependencies?: any[]
  }) {
  const [fadeIn, setFadeIn] = useState(false);
  const classes = useStyles();

  useEffect(() => {
    setFadeIn(false);
    setTimeout(() => { setFadeIn(true); }, 1);
  }, [...dependencies]);

  return (
    <div style={{ opacity: fadeIn ? 1 : 0 }}>
      <div
        className={classnames(classes.customFadein, fadeIn ? "fade-in" : "")}
      >
        <>
          {children}
        </>
      </div>
    </div>
  );
}
```

Sometimes you may want the element to fade-in and out on state change, you can pass the arguments into `FadeIn` component as follows:

```js
<FadeIn dependencies={[pathname]}>
  ...
</Fadein>
```
