---
title: "Mui CSS Animation with Keyframes"
date: 2023-06-09
id: blog0136
tag: react
intro: "Record how to write CSS animation with keyframes in mui `makeStyles`."
toc: false
---

```text
const useStyles = makeStyles((theme) => ({
  grow: {
    animation: `$growAnimation 2000ms ease-in-out`,
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
```

After animation is triggered, make sure to toggle off the corresponding flag

```js
const shouldGrow = growing && rowIndexBeingSelected === reduxStoreRowIndex;

useEffect(() => {
  if (shouldGrow) {
    setTimeout(() => {
      dispatch(wbuserSlice.actions.setRowEdition({ grow: false }));
    }, 2000);
  }
}, [growing]);
```
