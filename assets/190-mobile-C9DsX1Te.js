const e=`---
title: "File Upload and Download Using Stream and FormData in React-Native"
date: 2023-10-05
id: blog0190
tag: react-native
intro: "File streaming is a very basic technique to effectively transmit files from frontend to backend and, of course, from within backends as well."
toc: true
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

### File Upload

#### The Visual Result

<center>
  <video controls width="400">
    <source  src="/assets/tech/190/001.mp4" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  </video>
</center>

<p></p>

<center></center>

#### Behind the Scene

The following pieces have taken place:

- An audio file is \`base64\`-encoded in frontend
- We send this \`base64\`-encoded string as \`formData\`
- We have nice package in backend to receive \`formData\` as \`inputStreams\`
- The input stream of audio file is processed by the following pipelines:
  - \`base64\`-encoded to \`uint8\`
  - \`m4a\` file to \`mp3\` file
  - The stream is piped into a \`Duplex\` stream (to adapt to api design of \`ffmpeg\`)
  - That \`Duplex\` stream is piped into azure's \`uploadStream()\` method

#### Fontend: Upload an Audio Using FormData and Base64 Encoded String

\`\`\`js
import * as FileSystem from "expo-file-system";

const uploadFile = async (audioFileUri: string) => {
  const base64EncodedFile = await FileSystem.readAsStringAsync(audioFileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  dispatch(
    chatThunkAction.uploadVoice({
      roomOid: selectedRoom._id,
      base64EncodedFile: { current: base64EncodedFile },
    })
  )
    .unwrap()
    .finally(() => {
      FileSystem.deleteAsync(audioFileUri).catch(() => {
        msgUtil.error(\`Cannot delete file: \${audioFileUri}\`);
      });
    });
};
\`\`\`

Here the thunk action \`chatThunkAction.uploadVoice()\` is defined as follows:

\`\`\`js
chatThunkAction =
{
    uploadVoice: createAsyncThunk("chatSlice/upload-voice", async (props: {
        roomOid: string,
        base64EncodedFile: { current: string }
    }, api) => {
        const { base64EncodedFile, roomOid } = props;
        const formData = new FormData();
        formData.append("file", base64EncodedFile.current);
        const res = await apiClient
            .post<WBResponse<undefined>>(
                apiRoutes.POST_UPLOAD_VOICE(roomOid),
                formData,
                { headers: { "Content-Type": "multipart/form-data" } }
            );
        return processRes(res, api);
    }),
    ...
}
\`\`\`

We also pass an object to avoid copying the base64 encoded string (which is huge).

- Now we have changed the file-upload procedures into a standard \`form-data\` approach that we have learnt from web developement.

- As a full-stack developer in nodejs we love to handle incoming file stream by multiparty!

#### Backend: Process the String Stream: Base64 to Uint8, From m4a To mp3, Pass Resulting Stream to azureClient.uploadStream()

We import a duplex to transform the base64-string-stream into a bytes-stream:

\`\`\`js
... // other dependencies
import { Base64Decode } from "base64-stream";
import multiparty from 'multiparty';

const voiceUpload = async (req: Request, res: Response) => {
    const { roomOid } = req.query as { roomOid: string }
    const form = new multiparty.Form();
    const msgDoc = await MessageModel.create({
        roomOid,
        userOid: req.user?.userOid,
        type: "Voice"
    });
    form.parse(req);
    form.on("part", async (inputStream) => {
        const uint8Stream = inputStream.pipe(new Base64Decode());
        const bufferStream = new PassThrough();
        const ffmpeg = ffmpegUtil.getFfmpeg();
        ffmpeg(uint8Stream)
            .inputFormat("m4a")
            .audioCodec('libmp3lame')
            .audioChannels(1)
            .audioBitrate(128)
            .format('mp3')
            .pipe(bufferStream)

        const res_ = await client.getBlockBlobClient(filename).uploadStream(bufferStream);
    })
\`\`\`

#### Summary for Backend

Since every step is merely processing stream, our data processing (from data conversion to file uploading to azure) is memory efficient as we never wait for the whole stream to complete before moving to the next step.

Apart from handling data conversion in stream, we also discussed zip stream in the past! [Check this out](/blog/article/Handle-Streams-in-File-Responding-Request)!

### File Download

#### Example of Redesigned Image Component for API That Returns a Stream

When \`<Image source={{ uri: imageUrl }}/>\` fails, it is possible that the API returns a stream (chunks), then you may try the following:

\`\`\`js
export default (props: { imageUri: string }) => {
    const { imageUri } = props;
    const [base64, setBase64] = useState("");
    const [id, setId] = useState("");

useEffect(() => {
        RNFetchBlob
            .fetch('GET', imageUri)
            .then((res) => {
                setBase64("data:image/jpeg;base64," + res.base64());
                setId(uuid.v4() as string);
            })
            .catch((err) => {
                msgUtil.error(err);
            })
    }, []);

    if (!base64) {
        return null;
    }

    return (
        <Image
            source={{ uri: base64 }}
            key={id}
            style={{
                width: 180,
                height: 300,
                marginTop: 10,
                borderRadius: 4
            }}
        />
    )
}
\`\`\`

### More on Base64 Encoding

- [Why do we use Base64?](https://stackoverflow.com/questions/3538021/why-do-we-use-base64)
`;export{e as default};
