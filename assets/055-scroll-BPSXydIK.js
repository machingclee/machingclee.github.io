const e=`---
title: Ctrl- and Middle-Clickable Button;  Method to Scroll to Target Element
date: 2022-03-30
id: blog055
tag: react
intro: Record how to make button left- and middle-clickable; Record how to scroll to desired HTML element vertically.
---

### Make Button able to be Ctrl-Clicked and Middle-Clicked

If we simply make a button with \`history.push()\` registered as a click event, then this button cannot be ctrl-clicked and middle-clicked. Or even if we implement \`window.open(href, "_blank")\` when only these two operations are performed, we cannot manage to keep the browser to stay in the current tab.

The only possible way is to use anchor, so let's record the following function that keep ordinary anchor behaviour and use \`history.push\` for simple left-click!

The key boolean we need is:

\`\`\`js
const middleClickedOrCtrlPressed = event.button === 1 || event.ctrlKey;
\`\`\`

This indicates either

- the middle-button is clicked or
- the control key is pressed,
  with that:

\`\`\`js
  const navToArticle = (articleId: string) => (event?: MouseEvent<HTMLElement>) => {
    if (event) {
      if (event.button === 1 || (event.ctrlKey && event.button === 0)) {
        // middle-click or ctrl+leftclick
        window.open(urlByArticleId(articleId), "_blank");
      }
      else {
        history.push(urlByArticleId(articleId))
      }
    }
  }
  return (
    ...
    <a
      href={urlByArticleId(articleId)}
      onClick={navToArticle(articleId)}
    >
      <Button>
      ...
      </Button>
    </a>
  )
\`\`\`

Sometimes we use \`<a/>\` to wrap \`<button/>\` element that may have animation effect,
we may need to setTimeout for history.push (with 50ms, say) for smoother experience.

### Scroll to Target Element

Recently I have implemented a floating TOC (as shown in the picture or LHS of this article), this will pop up when the browser scroll down and go across some threshold depending on the bottom of the top TOC:

<center>
<a href="/assets/tech/034.png">
<img src="/assets/tech/034.png" width="600px"/>
</a>
</center>

<p/>
<center></center>

But when there are too many titles, for example: in <a href="/blog/article/Nextjs-with-Electron">this article</a>, then it is natural to wish the floating TOC can highlight and **_scroll to that title_** automatically.

For highlighting title, behind the scene we calculate at which position we have scrolled to and assign the corresponding active anchor in the floating TOC an active \`className\`. We now focus on how to get the **_relative position_** of our _active anchor_ from the top of its parent --- the floating TOC.

Suppose as in the picture we want to highlight the _active anchor_: **_How to convert imagepath into base64 encoded data_**, which is stored in the variable \`titleAnchor\`, then:

- The **relative position** of \`titleAnchor\` to its parent is calculated by
  \`\`\`js
  const scrollDistance = (titleAnchor as HTMLAnchorElement).offsetTop;
  \`\`\`
- We get the parent by the assigned id
  \`\`\`js
  const floatingToc = document.querySelector("#floating-toc");
  \`\`\`
- Then we scroll to the specfic position by
  \`\`\`js
  floatingToc?.scrollTo({
    left: 0,
    top: scrollDistance,
    behavior: "smooth",
  });
  \`\`\`
`;export{e as default};
