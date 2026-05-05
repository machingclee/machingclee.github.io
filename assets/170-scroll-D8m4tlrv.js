const n=`---
title: "Scroll Up and Down Events in React"
date: 2023-09-02
id: blog0170
tag: react
intro: "Record a hook to listen to scrolling-up and scrolling-down events, and an easy way to inject our callback to this events using this hook."
toc: true
---

### Implementation

\`\`\`js
// useScroll.ts

import { useEffect, useRef, useState } from "react";

export default (props: { up: () => void, down: () => void }) => {
  const scrollRef = useRef < HTMLDivElement > null;
  const { up, down } = props;
  const prevScrollTop = (useRef < number) | (null > null);
  useEffect(() => {
    const scrollHandler = () => {
      if (!scrollRef.current) {
        return;
      }
      if (prevScrollTop.current === null) {
        prevScrollTop.current = scrollRef.current.scrollTop;
      } else {
        const currScrollTop = scrollRef.current.scrollTop;
        // +ve => move down, -ve => move up
        const scrollDistance = currScrollTop - prevScrollTop.current;
        if (scrollDistance > 0) {
          down();
        } else if (scrollDistance < 0) {
          up();
        }
        prevScrollTop.current = currScrollTop;
      }
    };

    const scrollAssginmentInterval = setInterval(() => {
      if (scrollRef.current) {
        scrollRef.current.addEventListener("scroll", scrollHandler);
        clearInterval(scrollAssginmentInterval);
      }
    }, 100);

    return () => {
      scrollRef?.current?.removeEventListener("scroll", scrollHandler);
    };
  }, []);

  return { scrollRef };
};
\`\`\`

### Usage

Here we want:

- A sticky-positioned \`div\` disappears when we scroll down;
- Show the \`div\` again when we scroll up.

\`\`\`js
export default () = > {
	const [collapseTitle, setCollapseTitle] = useState(false);
	const closedRef = useRef<boolean>(false);

	const { scrollRef } = useScroll({
		up: () => {
			if (closedRef.current) {
				console.log("open");
				setCollapseTitle(false);
				closedRef.current = false;
			}
		},
		down: () => {
				if (!closedRef.current) {
				console.log("closed");
				setCollapseTitle(true);
				closedRef.current = true;
			}
		}
	});

    return (
        <div
            id="mails-container"
            ref={scrollRef}
            style={{ overflowY: "scroll" }}>
            ...
        </div>
    )
}
\`\`\`

- Here we have used a storage \`closedRef\` to make sure the scrolling event is just dispatched once.
- We can remove it if we wish to trigger the event every time the user scrolls.
`;export{n as default};
