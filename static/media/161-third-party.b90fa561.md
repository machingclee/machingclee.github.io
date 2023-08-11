---
title: "Declare Types for Non-typed 3rd Party Library"
date: 2023-08-09
id: blog0161
tag: react
intro: "Record some exmaple how to declare types from library that is untyped."
toc: false
---

<center></center>

- `json-to-table` is a simple library which converts nested json object into a table view. However, the library does not provide type defitions, so we need to declare it on our own:

  ```ts
  // dess.d.ts

  declare module "json-to-table" {
    function jsonToTable(jsonData: object): string[][];
    export default jsonToTable;
  }
  ```

- Sometimes an import is simply a `string`:

  ```ts
  declare module "*.pdf" {
    const src: string;
    export default src;
  }
  ```

- Sometimes a library have `export` and `export default`:
  ```ts
  declare module "react-images" {
    export var Modal;
    export var ModalGateway;
    export default Carousel;
  }
  ```

Remember to have

```json
  "esModuleInterop": true,
```

in `tsconfig.json` for the above to work.
