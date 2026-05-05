const n=`---
title: "Mui CSS Animation with Keyframes"
date: 2023-06-09
id: blog0136
tag: react
intro: "Record how to write CSS animation with keyframes in mui \`makeStyles\`."
toc: false
---

In traditional \`mui\`: 

\`\`\`js
const useStyles = makeStyles((theme) => ({
  grow: {
    animation: \`$growAnimation 2000ms ease-in-out\`,
  },
  "@keyframes growAnimation": {
    "0%": {
      boxShadow: "0 0 0px #3498db",
    },
    "50%": {
      boxShadow: "0 0 20px #3498db",
    },
    "100%": {
      boxShadow: "0 0 0px #3498db",
    },
  },
}));
\`\`\`

In latest \`tss\`:

\`\`\`js
import React, { ReactNode, useEffect, useState } from "react";
import classnames from "classnames";
import { tss } from "tss-react/mui";
import { keyframes } from "tss-react";

const useStyles = tss.create(() => ((
    {
        customFadein: {
            "&.fade-in": {
                height: "100%",
                animation: \`\${keyframes\`
                0% {
                    opacity: 0;
                },
                100% {
                    opacity: 1;
                }
                \`} 0.3s ease-in-out\`
            }
        }
    })
));
\`\`\`


After animation is triggered, make sure to toggle off the corresponding flag

\`\`\`js
const shouldGrow = growing && rowIndexBeingSelected === reduxStoreRowIndex;

useEffect(() => {
  if (shouldGrow) {
    setTimeout(() => {
      dispatch(wbuserSlice.actions.setRowEdition({ grow: false }));
    }, 2000);
  }
}, [growing]);
\`\`\`
`;export{n as default};
