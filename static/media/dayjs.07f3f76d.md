---
title: "Use of dayjs"
date: 2023-06-16
id: blog0142
tag: react, javascript
intro: "Just record the usual API that we may need in using dayjs."
toc: false
---

- We can get `Dayjs` object in two major ways:

  ```js
  import dayjs, { Dayjs } from "dayjs";

  const displayFormat = "YYYY-MM-DD HH:mm:ss";

  const date1 = dayjs(epochTime);
  const date2 = dayjs(new Date());

  const dateDisplay = date1.format(displayFormat);
  ```

- The list of formatting strings can be found in

  - https://day.js.org/docs/en/display/format

- Date manipulation

  - https://day.js.org/docs/en/manipulate/manipulate

- Show the time in different timezone
  - https://day.js.org/docs/en/timezone/timezone
