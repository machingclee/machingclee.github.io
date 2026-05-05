const e=`---
title: Disqus Comment Plug-in in React
date: 2021-08-12
id: blog0015
tag: react
intro: An introduction to disqus that plug a small comment box into our website.
---

#### Procedures

Go to https://disqus.com/, click \`get started\`, and go along until you get your link to embed disqus's javascript into your site, which is something like

\`\`\`javascript
https://short-name.disqus.com/embed.js
\`\`\`

We can either embed the comment plug-in manually, or directly install a nice wrapper from <a href="https://www.npmjs.com/package/disqus-react">here</a>.

In either case, we need to reload the script in order to get a new thread connecting to disqus whenever we change our article, therefore we need the following:

\`\`\`typescript
const prevId = useRef<string>("");

useEffect(() => {
  const sameAsPrevId = prevId.current === activeArticle?.id;

  if (sameAsPrevId) {
    return;
  }

  (Window as any).DISQUS?.reset({
    reload: true,
    config: function () {
      this.page.identifier =
        process.env["REACT_APP_WEB_HOST"] + activeArticle.id;
      this.page.url = process.env["REACT_APP_WEB_HOST"] + activeArticle.id;
    },
  })(function () {
    var d = document;
    var s = d.createElement("script");
    s.src = "https://c-c-lee-blog.disqus.com/embed.js";
    s.async = true;
    s.setAttribute("data-timestamp", new Date() + "");
    (d.head || d.body).appendChild(s);
  })();

  prevId.current = activeArticle.id;
}, [activeArticle]);
\`\`\`

Part of the code is taken directly from the instruction of disqus when you \`get start\`.

#### Potential Traps

_By experiment_, in \`(Window as any).DISQUS?.reset\` we need to change both

- \`this.page.identifier\` and
- \`this.page.url\`.
  These parameters are consistent with what we put into the \`props\` of \`DiscussionEmbed\`:

\`\`\`typescript
import { DiscussionEmbed } from "disqus-react";

<DiscussionEmbed
  shortname={"c-c-lee-blog"}
  config={{
    url: process.env["REACT_APP_WEB_HOST"] + activeArticle.id,
    identifier: process.env["REACT_APP_WEB_HOST"] + activeArticle.id,
    title: activeArticle.title,
    language: "en_us",
  }}
/>;
\`\`\`

Just need to be careful about the number of times the component rerender, which may be a trap that courses troubles. If it happens that the component rendered twice, problem would occur when the "reload" action is first dispatched with the old identifier.

Happy blogging.

#### References

- https://stackoverflow.com/questions/8944287/disqus-loading-the-same-comments-for-dynamic-pages
`;export{e as default};
