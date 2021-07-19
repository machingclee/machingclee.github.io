title: On Looping all Files in Frontend
date: 2021-07-13
intro: In backend we can loop through the files inside a directory using `fs.readdir`, we introduce a function that can achive the same thing in frontend using webpack's `require.context` function.

##### Loop Through a Directory
In `node.js`, specifically in backend, we can use `fs.readdir` to return a list of files and directories of our target directory. Though `fs` is not avaiable in frontend, we record a function that achieve similar objective:

```javascript
const getModules = () => {
  function importAll(r: any) {
    let files: any[] = [];
    r.keys().map((item: any, index: any) => { files.push(r(item)); });
    return files;
  }

  //@ts-ignore
  const files: { default: string }[] = importAll(require.context(
    "./articles",
    true, 
    /\.md$/
  ));
  return files;
}
```

Forgive me to have `//@ts-ignore` here as I don't want the hassle of annotating types to the utility function that I wouldn't maintain. 

The most important part is the function: `require.context`, which takes `(directoryName:string, useSubdirectories: boolean, regExp: RegExp)` as its positioinal argument. 

This blog page is an example of using this util function. Whenever I add an md file, the function can loop through my target directory, add a new file path to the array I am going to map, and generate a new post automatically. 