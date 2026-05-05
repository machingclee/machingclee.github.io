const e=`---
title: "Hook to Rerender Component By Making use of the Single Threaded Event Driven Model Behind v8"
date: 2023-08-15
id: blog0166
tag: react
intro: "A simple component and function that helps rerender a component effectively."
toc: false
---

<Center></Center>

\`\`\`ts
// useRerender.ts

import { ReactNode, useState } from "react";

export default () => {
  const [rerenderFlag, setRerenderFlag] = useState(true);
  const rerender = () => {
    setRerenderFlag(false);
    setTimeout(() => setRerenderFlag(true), 1);
  };

  const Rerender = ({ children }: { children: ReactNode }) => {
    return <>{rerenderFlag && children}</>;
  };

  return { rerender, Rerender };
};
\`\`\`

The trick is simply executing \`setRerenderFlag(true)\` later by letting it execute in \`callback-queue\`, such a callback is created by \`setTimeout\` and it will be executed once every task in the call stack are cleared.

For example, what would be the result of the following?

\`\`\`js
setTimeout(() => {
  console.log("I come from timeout");
}, 1);

for (let i = 0; i < 100; i++) {
  console.log("I come from for loop");
}
\`\`\`

![](/assets/tech/166/001.png)

<Center></Center>

Why is that? A very clear explanation can be found in:

- [[Part 1] 所以說 event loop 到底是什麼玩意兒？| Philip Roberts | JSConf EU](https://www.youtube.com/watch?v=8aGhZQkoFbQ)
- [[Part 2] Further Adventures of the Event Loop - Erin Zimmer - JSConf EU 2018](https://www.youtube.com/watch?v=u1kqx6AenYw)

Understanding how \`v8\` works can essentially help investigate how \`nodejs\` works, and after that we can appreciate how single-threaded model can handle high concurrency problem.

Similar idea can be brought to other languages like \`Java\`, and from that we are lead to the use of \`WebFlux\` in the realm of reactive programming.

The word **_single-threaded_** may be "misleading" as \`nodejs\` is not always single-threaded, but the main thread will not be blocked by designating some tasks to other thread like DNS-resolution or file io (which inevitably blocks!).
`;export{e as default};
