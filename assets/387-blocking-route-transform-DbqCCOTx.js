const n=`---
title: "\`useBlocker\` hook to Block the Change of Route for Unsaved Update"
date: 2025-04-22
id: blog0387
tag: react
toc: false
intro: "Record a simple hook to block route traffic when updates have not been saved yet, and popup an alert to ask for confirmation."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

\`\`\`tsx-1{3}
export default function SomePage() {

  const hasUpdate = useAppSelector((s) => s.someDomain.hasUpdate);
\`\`\`

Here we control whether a traffic should be blocked by a state variable. Then we plug this into our \`useBlocker\` hook:

\`\`\`tsx-4{4}
  useBlocker(({ currentLocation, nextLocation }) => {

    let shouldBlock = false;

    const hasRouteChange = nextLocation.pathname !== currentLocation.pathname;

    if (hasUpdate && hasRouteChange) {
      const shouldProceed = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      shouldBlock = !shouldProceed;
    }

    return shouldBlock;
  });
\`\`\`
`;export{n as default};
