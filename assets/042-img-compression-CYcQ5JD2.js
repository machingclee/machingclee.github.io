const e=`---
title: Nodejs Image Compression in Backend with sharp
date: 2021-12-16
id: blog042
tag: javascript
intro: We discuss how to compress images effectively in nodejs backend.
---

### Why Compression

In Electron saving a jpeg image with decent quality can produce a file of size ranged from 500kb to 2mb, which is way too big for storing and display in web. Like my page "Japanese Study" each "note" has at least 50 images.

Therefore before saving any images, data compression is necessary in backend and we will use an npm library called \`sharp\`, it can compress and save an image even it is a buffer, a usual format for data transimission in nodejs backend.

### Implementations

We create the following utility function:

\`\`\`js
import sharp from "sharp";

const compressImageAndSave = (imageBuffer: Buffer, imagePath: string) => {
  return (
    new Promise() <
    { err: Error, info: sharp.OutputInfo } >
    ((resolve, _) => {
      sharp(imageBuffer)
        .jpeg({ mozjpeg: true, quality: 80 })
        .toFile(imagePath, (err, info) => {
          resolve({ err, info });
        });
    })
  );
};

export default compressImageAndSave;
\`\`\`

\`sharp\` can actually take many formats of data to create an \`sharp\` object. Instead of \`Buffer\`, you may also want \`string\`, \`uint8-array\`, etc. You can also reduce quality of png, webp, etc.

Now an image that takes 2mb (saved from raw buffer and base64-encoded image) can now be reduced to 100kb with an unvisible downgrade of quality.
`;export{e as default};
