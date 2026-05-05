const e=`---
title: Nextjs with Electron
date: 2021-12-06
id: blog040
tag: react, nextjs, google-cloud, electron
intro: Since FF14 has a new patch of huge update, in order to take this oppurtunity to learn Japanese I decided to write a desktop application again.
---

### Result for the Moment

The following is a demo of the application I have made so far by Next.js and Electron.js.

<center>
  <video controls width="500">
    <source  src="/assets/videos/002.mp4" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  </video>
</center>

<p/>

This is essentially the remake of an app I made using WPF, with which to achive this stage of result it took me almost 2 month to learn and work it out. But with next.js and electron it just took me about a week, in which I made this app when I am off my work.

<p/>

### Starting Template

Next.js's creator, Vercel, has a starting template <a href="https://github.com/vercel/next.js/tree/canary/examples/with-electron-typescript?fbclid=IwAR07uNHSsGiBtukkMq8aXdv6maFhmRahu6_pKbxbjD9W14ielfZt6EN_Aw0"> <b>here</b></a> to begin with.

### Redux in Electron

The usual routine of adding redux stores also applies to Electron application with Next (the Render part). To add debugger for redux, we need:

\`\`\`text
yarn add electron-devtools-installer
\`\`\`

and add

\`\`\`javascript
if (process.env.NODE_ENV === "development") {
  app.whenReady().then(async () => {
    const installer = await import("electron-devtools-installer");
    const REDUX_DEVTOOLS = installer.REDUX_DEVTOOLS;
    const installExtension = installer.default;

    installExtension(REDUX_DEVTOOLS)
      .then((name) => console.log(\`Added Extension:  \${name}\`))
      .catch((err) => console.log("An error occurred: ", err));
  });
}
\`\`\`

right before \`app.on('ready', ...)\`.

### Lessons I learn

#### Should we use pages/api?

**_No_**. The resulting production build is nothing more than a static page. Of course in development we can call api to communicate with operating system, but afterwards there is no way to deploy your application to anywhere else.

Instead, please keep using frontend's event emitter --- the \`ipcRenderer\` and the backend event receiver, the \`ipcMain\`. In my application I have wrapped up these two components into two functions in order to just focus on the data flow:

\`\`\`js
// ipc-renderer-util.ts

const emit = <S, T>(eventKey: string, data: S) => {
  return (
    new Promise() <
    T >
    ((resolve, _reject) => {
      global.ipcRenderer.once(eventKey, (_event, data: T) => {
        resolve(data);
      });
      global.ipcRenderer.send(eventKey, data);
    })
  );
};

export default {
  emit,
};
\`\`\`

\`\`\`js
// ipc-main.util.ts

import { ipcMain } from "electron";
import { IpcMainEvent } from "electron/main";

const listen = <S, T>(eventKey: string, callback: (data: S) => Promise<T>) => {
  console.log("eventKey", eventKey);
  ipcMain.on(eventKey, (event: IpcMainEvent, data: S) => {
    callback(data).then((result) => {
      event.sender.send(eventKey, result);
    });
  });
};

export default {
  listen,
};
\`\`\`

Usage in "frontend" (the web view):

\`\`\`js
const addNote = async (note: Note) => {
  const res = await ipcRendererUtil.emit<Note, CustomApiResponse>(
    "ADD_NOTE",
    note
  )
  return res;
}
\`\`\`

Usage in "backend" (the file running Electron):

\`\`\`js
ipcMainUtil.listen < Note,
  CustomApiResponse >
    ("ADD_NOTE",
    async (note) => {
      const result = (await db.notes.insert) < Note > note;
      return { success: true, result };
    });
\`\`\`

#### Images in Next.js can just be accessed in ./public folder. How to get rid of this Restriction?

At some point we may want the location to store images to be more controllable. We can achieve this by the following config:

\`\`\`js
// next.config.js

const withImages = require("next-images");

module.exports = withImages({
  webpack: (config) => {
    config.output = config.output || {};
    config.output.devtoolModuleFilenameTemplate = function (info) {
      return "file:///" + encodeURI(info.absoluteResourcePath);
    };
    return config;
  },
  images: {
    disableStaticImages: true,
  },
});
\`\`\`

#### How to get standard directory path such as Pictures, Documents, etc?

We use \`~/Documents\` as an example:

\`\`\`js
import { app } from "electron";

app.on("ready", async () => {
  app.getPath("documents"); // path for documents
});
\`\`\`

A complete list of possible paths can be found in this <a href="https://www.electronjs.org/docs/latest/api/app#appgetpathname">documentation</a>.

#### How to convert imagepath into base64 encoded data?

As I am doing it so often, I have summarized it in the following function. I make use of the conversion between \`img\` and \`canvas\` element:

\`\`\`js
const getBase64DataUrlFromImagePath = (imgPath: string) => {
  return (
    new Promise() <
    { base64DataURL: string, width: number, height: number } >
    ((resolve, reject) => {
      const img = new Image();
      img.src = imgPath;
      img.onload = () => {
        const _canvas = document.createElement("canvas");
        _canvas.width = img.width;
        _canvas.height = img.height;
        const _ctx = _canvas.getContext("2d");
        if (_ctx) {
          _ctx.drawImage(img, 0, 0, img.width, img.height);
          const dataURL = _canvas.toDataURL();
          resolve({
            base64DataURL: dataURL,
            width: img.width,
            height: img.height,
          });
        }
      };
    })
  );
};

export default getBase64DataUrlFromImagePath;
\`\`\`

If one wants a base64 encoed string instead of a dataUrl, the following conversion

\`\`\`js
const base64Data = base64DataURL.replace(/^data:image\\/png;base64,/, "");
\`\`\`

will do.

#### How to effectively make a 'click outside' handler in React?

We create the following hook:

\`\`\`js
import { MutableRefObject } from "hoist-non-react-statics/node_modules/@types/react";
import { useEffect } from "react";

export default <T = any>({
  onClickOutside,
  targetRef,
}: {
  onClickOutside: (e: MouseEvent) => void,
  targetRef: MutableRefObject<T | null>,
}) => {
  const handleClickOutside = (event: any) => {
    // @ts-ignore
    if (targetRef.current && !targetRef.current.contains(event.target)) {
      onClickOutside(event);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside, true);
    return () => {
      document.removeEventListener("click", handleClickOutside, true);
    };
  });
};
\`\`\`

If we click outside the \`targetRef.current\`, our \`onClickOutside\` should take effect.

#### How to make right click context menu?

The \`react-contextmenu\` package is very simple to use, highly suggested!

https://www.npmjs.com/package/react-contextmenu

#### How to do persistent data storage? Any other choices apart from sqlite?

In the past I am just used to sqlite. A deeper consideration has been made since this is my second time to make a desktop application rigorously.

Locally what I really need is no more than a few collections of json data, and in this direction I come into \`nedb\`, which is a mongo based local storage, each collection is saved in a \`*.db\` file with exactly the same query as we learn from mongoose (we can even borrow types in mongoose library when using \`nedb\`).

In fact, each \`*.db\` file is nothing more than rows of json data, which can be read directly in any text editor, easy to read and debug!

Since in the original \`nedb\` library the only way to get data is by \`callback\`, we can switch to another highly related library

https://www.npmjs.com/package/nedb-promises

which has promisified all the functions in \`nedb\` for us.

#### How to crop an image and get the base64DataUrl using canvas?

This will be quite a long story to get correct coordinates. Given that I have \`x, y\` (the upper-left vertix) and \`width, height\` prepared from a convas, then our whole workflow:

\`\`\`js
const getCroppedImageAndExtractText = async (pageId: string) => {
  if (!canvasRef.current) {
    return;
  }
  const x = Math.floor(coorRef.current.X_0_scaled);
  const y = Math.floor(coorRef.current.Y_0_scaled);
  const width = Math.floor(coorRef.current.width_scaled);
  const height = Math.floor(coorRef.current.height_scaled);

  console.log(x, y, width, height);

  const _canvas = document.createElement("canvas");
  _canvas.width = width;
  _canvas.height = height;
  const _ctx = _canvas.getContext("2d");
  if (!_ctx) {
    return;
  }
  _ctx.drawImage(canvasRef.current, x, y, width, height, 0, 0, width, height);
  const base64DataURL = _canvas.toDataURL();
};
\`\`\`

Here coordinates stored in \`coorRef\` get updated by our \`mousemove\` eventHandler.

#### How to use the vision-api from google to do text extraction?

From the previous step we have \`base64DataURL\`, we can then convert it to \`base64Data\`, convert it to \`Buffer\` object and call vision-api library:

\`\`\`js
import vision from "@google-cloud/vision";

export async function textExtraction(base64Data: string) {
  try {
    const client = new vision.ImageAnnotatorClient(option);
    const buffer = Buffer.from(base64Data, "base64");
    const [textDetections] = await client.textDetection(buffer);
    //@ts-ignore
    const [annotation] = textDetections.textAnnotations;
    return annotation.description;
  } catch (err) {
    console.log(err);
    return null;
  }
}
\`\`\`

#### How to make event listener to enable 'widen a div by dragging the edge'?

**Stategy.**

- Record the current width of the div in a \`ref\` variable and fix it.
- When mouse down, we start to record the change in width.
- On mouse move, we change the state of \`width\` by calculating the increment in width, and add it to \`ref\`, then setState.
- When mouse up, we update the current width of the div in \`ref\`.

Note that in this process there will be intermediate event listeners that should be being deleted, otherwise they will get accumulated when we repeat the drag and move process.

\`\`\`js
const mousedownHandler = useCallback((e) => {
    if (!mouseIsDownRef.current) {
      window.addEventListener("mousemove", mousemoveHandler)
      originalVocabListClientRectLeft.current = vocabListRef.current?.offsetWidth || 0
      mouseIsDownRef.current = true;
      oldClientX.current = e.clientX;
      listenerCacheRef.current.push({ eventKey: "mousemove", listener: mousemoveHandler });
      dragbarWasHit.current = resizeBarRef.current?.contains(e.target) as boolean;
    } else {
      mouseIsDownRef.current = false;
    }
  }, [])

  const mousemoveHandler = useCallback((e: globalThis.MouseEvent) => {
    // @ts-ignore
    if (resizeBarRef.current && dragbarWasHit.current && mouseIsDownRef.current) {
      const increment = oldClientX.current - e.clientX;
      setVocablistWidth((originalVocabListClientRectLeft.current || 0) + increment);
    }
  }, [])

  const mouseupHandler = useCallback((e) => {
    setDragBarColorOpacity(0);
    mouseIsDownRef.current = false;
    mouseIsMovingRef.current = false;
    dragbarWasHit.current = false;
    originalVocabListClientRectLeft.current = vocabListRef.current?.offsetWidth || 0
    if (listenerCacheRef.current) {
      const numOfListeners = listenerCacheRef.current.length;
      for (let i = 0; i < numOfListeners; i++) {
        const pop = listenerCacheRef.current.pop();
        if (pop) {
          const { eventKey, listener } = pop;
          window.removeEventListener(eventKey, listener)
        }
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener("mousedown", mousedownHandler)
    window.addEventListener("mouseup", mouseupHandler)
  }, [])
\`\`\`

#### Usage of debounce in lodash

\`debounce\` is used when there will be several similar calls within a short interval, and we just want to trigger the last call.

Usages: search field, or text field that gets updated automatically. The usual strategy is to make these fields an uncontrolled component, we just look at the \`onChange\` event, and add a debounce function (that triggers update) in this \`onChange\` function.

The event-targets (like buttons, textfields, etc) are itself internally stateful, we will use a stateless function to make reference to a stateful uncontrolled component, get updated information and trigger our debounced event handler.

Therefore our event handler needs not to update for triggering new function, this makes debounce possible.

**Example 1.**

\`\`\`js
  ...
  const searchDounce = useCallback(debounce((e: ChangeEvent<HTMLInputElement>) => {
    FuncStore
    const value = searchRef.current?.value;
    if (value === "" || value) {
      dispatch(dictSlice.actions.setSearchText(value));
    }
  }, 800), [])

  const searchHandler = (e: ChangeEvent<HTMLInputElement>) => {
    searchDounce(e);
  }
  ...
  return (
    ...
      <input
        placeholder={"Search"}
        ref={searchRef}
        onChange={searchHandler}
      />
    ...
  )
\`\`\`

**Example 2.** In this example we have api-call after the text editing in a \`textarea\` is complete. Extremely good use case of debounce:

\`\`\`js
// logic that should not be triggered repeatedly is wrapped in a debounce:
const saveTextDebounce = useCallback(
  debounce(async () => {
    if (selectedPageId) {
      const textAreaValue = textAreaRef.current?.value || "";
      const res = await apiUtil.updatePage(selectedPageId, {
        $set: { imageText: textAreaValue.trim() },
      });
      const { success, message } = res;
      dispatch(
        uiSlice.actions.updateNotification({
          open: true,
          message: success
            ? "message saved succesfully"
            : JSON.stringify(message),
          severity: success ? "success" : "error",
        })
      );
    }
  }, 800),
  [selectedPageId]
);

const changeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => {
  if (selectedPage) {
    const text = e.target.value;
    dispatch(
      dictSlice.actions.setSelectedPageImageText({ selectedPageId, text })
    );
    saveTextDebounce();
  }
};
\`\`\`

#### How to register a global shortcut?

In my case I register ctrl+shift+n as a shortcut to my new page button. Right below my \`mainWindow.load(url)\`:

\`\`\`js
// electorn-src/index.ts
mainWindow.loadURL(url);

globalShortcut.register("CommandOrControl+Shift+N", () => {
  mainWindow.webContents.send("GLOBAL_NEW_PAGE");
});
\`\`\`

In our frontend:

\`\`\`js
export default function Pages() {
  const { pathname } = useRouter();
  useEffect(() => {
    global.ipcRenderer.on("GLOBAL_NEW_PAGE", () => {
      const newPageBtnEl = document.querySelector("button#new-page-button");
      if (newPageBtnEl) {
        (newPageBtnEl as HTMLButtonElement).click();
      }
    })
  }, [])
  ...
\`\`\`
`;export{e as default};
