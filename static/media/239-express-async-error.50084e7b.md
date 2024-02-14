---
title: "express-async-errors"
date: 2024-02-12
id: blog0239
tag: nodejs, express
intro: "Record the usage of a package called express-async-errors."
toc: false
---

<center></center>

In the extrypoint of the application, import the package to execute the code inside it:

```js
// @ts-ignore
import "express-async-errors";
```

Since `express-async-errors` has no typescript support, we just ignore it. However, being imported once has already finished its job.

Next, at the end of all middlewares, we add:

```js
app.use(errorHandler);
```
where 
```js
// middlewares/errorHandler.ts

export default (err, req, res, next) => {
    if (err) {
        res.json({ success: false, errorMessage: JSON.stringify(err) });
    }
}
```
Now all the errors thrown in the request handlers will be passed to this middleware and return 
```js
{
    success: false,
    errorMessage, JSON.stringify(err)
}
```
to the frontend. We can now handle all error ***gracefully*** in a ***unified fashion***.