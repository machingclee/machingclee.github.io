const e=`---
title: "Detect Click Outside"
date: 2023-07-27
id: blog0159
tag: react
intro: "Record a hook for determining whether click have happened outside of our target dom element."
toc: false
---

\`\`\`js
// useOutsideClicked.ts

import { RefObject, useEffect, useState } from "react";

export default ({ ref }: { ref: RefObject<Element> }) => {
  const [outsideClicked, setOutsideClicked] = useState(true);
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOutsideClicked(true);
      } else {
        setOutsideClicked(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  return { outsideClicked, setOutsideClicked };
};
\`\`\`

Now we can customize the behaviour of our target component by using

- the state \`outsideClicked\` and
- setter \`setOutsideClicked\`.

A simple use case is a searchbar with dropdown.
`;export{e as default};
