const e=`---
title: "Handle Streams in File-Responding Request"
date: 2023-09-03
id: blog0171
tag: express, java
intro: "We implement file downloading feature in a get/post request in both \`express\` and \`spring\`, we handle them in memory and therefore no disk i/o is needed."
toc: true
---

<style>
  img {
    max-width: 100%
  }
</style>

### Streams

#### Simple File-Upload UI

We start off by having a simple input UI:

\`\`\`js
import axios from "axios";
import { useState } from "react";

export default () => {
  const [files, setFiles] = useState<FileList | null>(null);

  const uploadSelectedHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(e.target.files);
    }
  };
  const uploadClickedHanlder = async () => {
    if ((files?.length || 0) > 0) {
      uplaodToServer({ oid: "someid", file: files![0] });
    }
  };

  const uplaodToServer =
    async ({ oid, file }: { oid: string; file: File }) => {
      const formData = new FormData();
      formData.append("file_01", file);
      formData.append("oid", oid);
      const response = await axios.post(
        "http://localhost:8080/stream",
        formData
      );

      return response.data;
    }

  return (
    <div>
      <input type="file" accept="image/*" onChange={uploadSelectedHandler} />
      <button onClick={uploadClickedHanlder}> Upload </button>
    </div>
  )
}
\`\`\`

We have:

![](/assets/tech/171/001.png)

<center></center>

#### Files from FormData

##### Simple Text File Upload

As is always we upload files by \`FormData\`. We will study the stream of data by using this route:

\`\`\`js
app.post("/stream", async (req, res) => {
  const outputStream = createWriteStream("server_received.txt");
  req.pipe(outputStream);
});
\`\`\`

Let's upload a text file with the following content:

\`\`\`none
It is a long established fact that a reader
will be distracted by the readable
content of a page when looking at its layout.
The point of using Lorem Ipsum is that it has a more-or-less
normal distribution of letters.
\`\`\`

And our \`server_received.txt\` becomes:

\`\`\`none
------WebKitFormBoundaryQeBMs9N4limtK0VP
Content-Disposition: form-data; name="file_01"; filename="sometext.txt"
Content-Type: text/plain

It is a long established fact that a reader
will be distracted by the readable
content of a page when looking at its layout.
The point of using Lorem Ipsum is that it has a more-or-less
normal distribution of letters.
------WebKitFormBoundaryQeBMs9N4limtK0VP
Content-Disposition: form-data; name="oid"

someid
------WebKitFormBoundaryQeBMs9N4limtK0VP--
\`\`\`

- Things become complicated even we simply upload a text file.
- The entries of our \`FormData\` are separated by \`FormBoundary\`.
- Therefore we need to **_parse the output stream_** in order to get file-specfic content in each of separated streamed data.

##### Multiparty Package

Let's

\`\`\`text
yarn add multiparty @types/multiparty
\`\`\`

in this regard. And let's modify \`/stream\` route to parse incoming stream:

\`\`\`js
app.post("/stream", async (req, res) => {
  const form = new multiparty.Form();
  const chunks: number[] = [];
  form.parse(req);
  let counter = 0;
  form.on("part", (inputStream) => {
    try {
      counter += 1;
      console.log("InputStream #: ", counter);

      const outputStream = createWriteStream(inputStream.filename);
      inputStream.pipe(outputStream);
    } catch (e) {
      res.json({ success: false, erroreMessage: JSON.stringify(e) });
    }
  });
});
\`\`\`

- Now we can **_upload arbitary file_** and find that an **_identical_** file appears in our backend.
- Recall that our form data have two keys, \`file_01\` and \`oid\`.
- We experirmentally add a counter to see whether \`multiparty\` also parses data without \`filename\`, and the result is positive as the output becomes:
  \`\`\`none
  InputStream #:  1
  InputStream #:  2
  \`\`\`
- Infact \`inputStream.filename\` becomes \`undefined\` for the second entry in the \`FormData\`.
- The programme ended sliently even the input of \`createWriteStream\` is \`undefined\`.

Simple enough right? Let's dig deeper by studying what happens in

\`\`\`js
inputStream.pipe(outputStream);
\`\`\`

#### What Happens in \`inputStream.pipe(outputStream)\`?

For this, we remove the \`pipe\` line, we read \`chunk\` and write \`chunk\` on our own:

##### Version 1 of \`pipe\` (Demonstrative Purpose, Not Recommended)

We accumulate all the bytes and then write it into a file:

\`\`\`js
app.post("/stream", async (req, res) => {
  const form = new multiparty.Form();
  form.parse(req);
  form.on("part", (inputStream) => {
    try {
      const chunks: number[] = [];
      const outputStream = createWriteStream(inputStream.filename);
      inputStream.on("readable", () => {
        let chunk: Buffer;
        while ((chunk = inputStream.read()) != null) {
          const chunk_ = Array.from(chunk);
          chunks.push(...chunk_);
        }
      });

      inputStream.on("close", () => {
        const finalBuffer = Buffer.from(chunks);
        outputStream.write(finalBuffer);
      });
    } catch (e) {
      res.json({ success: false, erroreMessage: JSON.stringify(e) });
    }
  });
});
\`\`\`

For output of \`raw chunk\`, \`byte chunk\` and \`buffered chunk\`

\`\`\`none
raw chunk : <Buffer ca 4c 98 7f ac c8 98 ed 4f 77 f6 41 ba df b4 9c 3a d5 9b 66 93 92 c7 25 29 23 dd c9 66 51 e2 50 7b 9c be 25 66 a0 39 4a df 1a 63 6c 8f 33 89 e2 cd 9d ... 51798 more bytes>
byte chunk: [
  202,  76, 152, 127, 172, 200, 152, 237,  79, 119, 246,  65,
  186, 223, 180, 156,  58, 213, 155, 102, 147, 146, 199,  37,
   41,  35, 221, 201, 102,  81, 226,  80, 123, 156, 190,  37,
  102, 160,  57,  74, 223,  26,  99, 108, 143,  51, 137, 226,
  205, 157,   9,  22, 113, 210, 168, 152,  52, 222, 147,  50,
  209, 155, 106, 147, 129, 163, 207, 100,  95, 218, 116,  63,
  213, 161, 164,  57,  85,  80,  66, 186,  81, 191, 110,  32,
  123, 197, 152, 183, 102,  98, 108,  89, 138, 246, 198, 152,
  143, 109, 236,  71,
  ... 51748 more items
]
finalBuffer: <Buffer 89 50 4e 47 0d 0a 1a 0a 00 00 00 0d 49 48 44 52 00 00 0d 70 00 00 05 a0 08 02 00 00 00 c2 10 1d 93 00 00 00 06 62 4b 47 44 00 00 00 00 00 00 f9 43 bb ... 9553650 more bytes>
\`\`\`

##### Version 2 of \`pipe\`

Whenever we read a chunk, we write it into \`outputStream\`:

\`\`\`js
app.post("/stream", async (req, res) => {
  const form = new multiparty.Form();
  form.parse(req);
  form.on("part", (inputStream) => {
    try {
      const outputStream = createWriteStream(inputStream.filename);
      inputStream.on("readable", () => {
        let chunk: Buffer;
        while ((chunk = inputStream.read()) != null) {
          outputStream.write(chunk);
        }
      });
    } catch (e) {
      res.json({ success: false, erroreMessage: JSON.stringify(e) });
    }
  });
});
\`\`\`

Here if we \`console.log(chunk)\`, we have

\`\`\`text
<Buffer 81 a5 f4 37 66 e1 3a d1 72 9b 23 68 ... 65486 more bytes>
<Buffer f1 a7 eb 57 4e df be 8a b7 2e 29 dc ... 36888 more bytes>
<Buffer a6 1d aa 2e c0 3c 1e 76 c4 ae 75 c5 ... 28548 more bytes>
<Buffer 8c 37 a3 ec 93 b1 ec a3 21 c6 f1 30 ... 37611 more bytes>
<Buffer e9 4e 0d e9 8e 82 34 e1 7b 2b 2b bc ... 27825 more bytes>
<Buffer 24 f6 fe 13 d9 0a 57 e2 16 ba 62 e7 ... 65486 more bytes>
<Buffer fe 66 ac 0a 72 ef de eb 7f 05 70 b6 ... 65486 more bytes>
\`\`\`

We can observe that our chunks never exceed $2^8 \\times 2^8 = 2^{16} = 65536$ bytes.

##### Summary of Version 1 and Version 2

- **_Version 2_** is exactly what \`inputStream.pipe(outputStream)\` does for us. Therefore we have no hassle of worrying memory overflow problem for data streaming.

- Not only that, \`pipe\` method also handles **back-pressure** problem which we haven't implemented anything to handle yet:

##### Back-Pressure

- If we look that the return of \`WriteStream.write\`:
  <center></center>

  ![](/assets/tech/171/002.png)
  <center></center>

  It is in fact a boolean.

- When it returns \`false\`, which means that the buffer of size 65kb is not large enough to receive the incoming chunk immediately.
- The reason is mostly because of that the writing speed is slower than the data-pulling speed.
- We need to
  - \`inputStream.pause()\` when \`outputStream.write\` returns false;
  - \`inputStream.resume()\` when our buffer in the \`outputStream\` gets **_drained of_** data;
  - The **drainded event** can be subscribed by
    \`\`\`js
    outputStream.on("drain", () => { ... });
    \`\`\`

### Download Zip of Files with Stream Manipulation

#### Node.js

##### Backend Implementation

We take AWS S3 bucket as an example. We will:

- Use npm package \`aws-sdk\` to get \`ReadStream\` of our object through \`bucketName\` and \`objectKey\`.
- Use npm package \`archiver\` to pipe the \`ReadStream\` into a \`ZipStream\`, data will then be piped into our final \`WriteStream\`, i.e., \`res\`.

Let's create another route called \`/download\` for downloading zip of multiple files:

\`\`\`js
app.get("/download", async (req, res) => {
  const bucketName = "jaems-cicd";
  const objectKey1 = "assets/fonts/FreightTextProMedium-Italic.woff2";
  const objectKey2 = "assets/fonts/FreightTextProMedium-Italic.woff";

  const stream1 = await awsS3Util.getFileStream({
    bucketName,
    objectKey: objectKey1,
  });
  const stream2 = await awsS3Util.getFileStream({
    bucketName,
    objectKey: objectKey2,
  });

  const zipStream = streamUtil.getZipStream();

  if (stream1) {
    zipStream.append(stream1, { name: "FreightTextProMedium-Italic.woff2" });
  }
  if (stream2) {
    zipStream.append(stream2, { name: "FreightTextProMedium-Italic.woff" });
  }
  zipStream.finalize();
  zipStream.pipe(res);

  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="zip-file-example.zip"'
  );
});
\`\`\`

- Here \`streamUtil.getZipStream\` and \`awsS3Util.getFileStream\` are defined below.
- \`ZipStream\` is a kind of \`middleware\` between streams, we call it a \`Duplex\` stream in node.js, which is both a \`ReadStream\` and a \`WriteStream\`.
- Our \`name\` field can be \`some/path/file.ext\` inside \`zipStream.append\`. \`archiver\` will \`mkdir -p\` for us.
- Note that by default \`Content-Disposition\` is not among the auto-allowed headers, we need to specify it explicitly.
- It would be better to enclose the filename by \`"\`'s.
- Modern browser will try to parse the filename without quotes, but enclosing by \`"\`'s makes frontend more easy to grab the filename using regex, as we shall see later.

- \`streamUtil.getZipStream\`

  \`\`\`js
  // streamUtil.ts

  import archiver from "archiver";

  const getZipStream = () => {
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });
    return archive;
  };

  export default {
    getZipStream,
  };
  \`\`\`

- \`awsS3Util.getFileStream\`

  \`\`\`js
  // awsS3Util.ts
  import AWS from "aws-sdk";

  const S3 = new AWS.S3();

  async function getFileStream(props: {
    bucketName: string,
    objectKey: string,
  }) {
    const { bucketName, objectKey } = props;
    return S3.getObject({
      Bucket: bucketName,
      Key: objectKey,
    }).createReadStream();
  }

  export default {
    getFileStream,
  };
  \`\`\`

##### Frontend to Handle the Stream

We extract filename from header in line 14.

\`\`\`js-1
import Button from "@mui/material/Button/Button";
import Box from "@mui/material/Box";
import axios from "axios";
const fileNameRegex = /(?<=filename\\=\\").*?(?=\\")/g


export default () => {
  const downloadZip = async () => {
    const res = await axios.get("http://localhost:8080/download", { responseType: "blob" });
    const blob = new Blob([res.data], { type: "application/zip" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const contentDisposition = res.headers?.["content-disposition"] as string;
    const fileName = contentDisposition.match(fileNameRegex)?.[0] || "";
    link.download = fileName;
    link.href = url;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <Box sx={
      {
        "& .MuiButton-root": {
          textTransform: "none"
          }
        }
      }
    >
      <div>
        <Button onClick={downloadZip}> Download Zip File </Button>
      </div>
    </Box >
  )
}
\`\`\`

Note that since it is a \`GET\` request, \`downloadZip\` can be alternatively defined by

\`\`\`js
const downloadZip = async () => {
  const link = document.createElement("a");
  link.href = "http://localhost:8080/download";
  link.click();
};
\`\`\`

and we still get the same result (the filename can be correctly obtained).

The former approach (line 8) works equally well for \`POST\` request (e.g., we may want more complicated query data in the body).

#### Springboot

- Idea in node.js can be translated to spring directly.
- We create a \`middleware\` before piping data into \`outputStream\`.

\`\`\`java
@Data
@Accessors(chain = true)
public static class FullPathAndInputStream {
    private String fullPath;
    private InputStream inputStream;
}
public static StreamingResponseBody inputStreamsIntoZip(List<FullPathAndInputStream> inputs) {
    StreamingResponseBody responseBody = outputStream -> {
        try (ZipOutputStream zipOutStream = new ZipOutputStream(outputStream)) {
            for (var fullPathAndInputStream : inputs) {
                String fullPath = fullPathAndInputStream.getFullPath().replace("\\\\", "/");
                InputStream inputStream = fullPathAndInputStream.getInputStream();

                ZipEntry zipEntry = new ZipEntry(fullPath);
                zipEntry.setTime(System.currentTimeMillis());
                zipOutStream.putNextEntry(zipEntry);
                StreamUtils.copy(inputStream, zipOutStream);
                zipOutStream.closeEntry();
                inputStream.close();
            }
        }
    };
    return responseBody;
}
\`\`\`

Here \`InputStream\` can be obtained from \`S3ObjectInputStream\`:

\`\`\`java
public S3ObjectInputStream getFileStream(String bucketName, String key) {
    try {
        S3Object obj = s3.getObject(bucketName, key);
        S3ObjectInputStream s3inputStream = obj.getObjectContent();
        return s3inputStream;
    } catch (AmazonServiceException e) {
        logger.error(e);
    }
    return null;
}
\`\`\`

- In \`spring\`'s controller we can return \`ResponseEntity\` and pass \`StreamingResponseBody\` object into its \`body\` argument.
- Frontend code that handles the response is the same as the previous section.

### Reference

- **Web Dev Jounry**, Discussion on Streaming:
  - [Node JS - HTTP Streaming](https://www.youtube.com/watch?v=CiGnubZC5cs)
  - [Node JS - Streams Intro](https://www.youtube.com/watch?v=qU8PmZOOnac)
  - [Node JS - Readable Streams](https://www.youtube.com/watch?v=_pqv06ySvuk)
  - [Node JS - Writable Streams & Backpressure](https://www.youtube.com/watch?v=FS2OWxS5P_E&t=605s)
  - [Node JS - Pipe, Duplex, & Transform Streams](https://www.youtube.com/watch?v=rQXaDH__Suk)
`;export{e as default};
