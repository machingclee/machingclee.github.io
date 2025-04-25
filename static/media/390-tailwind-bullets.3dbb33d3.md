---
title: Recover bullet-points Overriden by Tailwinds
date: 2025-04-25
id: blog0390
tag: react, tailwind
toc: false
intro: "Record simple css to recover bullet points affected by tailwind package"
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

In `index.css` simply add

```css
ul {
  list-style-type: disc;
  padding-left: 2rem;
}
```
