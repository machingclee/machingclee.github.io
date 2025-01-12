---
title: "AWS Presigned URLs for File-Uploading"
date: 2025-01-12
id: blog0360
tag: aws
toc: true
intro: "Record a simple script to create a presigned-url for file uploading in frontend"
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

#### Mechanism Explained
##### Sequence Diagram

![](/assets/img/2025-01-12-17-26-59.png)

##### Example

###### Create a prsigned url for file uploading
![](/assets/img/2025-01-12-17-45-47.png)

###### Upload the file using raw bytes
![](/assets/img/2025-01-12-17-51-49.png)


#### Backend: `createPresignedURL (props: { bucket:string, key: string })`
```js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Request, Response } from "express";

type PresignedUrlParams = {
    bucket: string;
    key: string;
}

const createPresignedUrl = async (params: PresignedUrlParams): Promise<string> => {
    const region = process.env.FILE_SYNC_BUCKET_REGION
    const client = new S3Client({
        region,
        endpoint: `https://s3.${region}.amazonaws.com`,
        forcePathStyle: true
    });

    const command = new PutObjectCommand({
        Bucket: params.bucket,
        Key: params.key
    });

    return await getSignedUrl(client, command, { expiresIn: 3600 });
};
```

When then create a controller to handle presigned-url request:

```js
export default class AwsController {
    public static getPresignedURL = async (req: Request, res: Response): Promise<void> => {
        const { filenames } = req.body as { filenames: string[] }
        try {
            const bucket = process.env.FILE_SYNC_BUCKET || "";
            const presignedUrls = await Promise.all(filenames.map(filename => {
                return createPresignedUrl({ bucket, key: filename })
            }))
            res.json({
                success: true,
                result: { presignedUrls }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            });
        }
    }
}
```

#### Frontend: Upload Raw Bytes to PresignedURL
##### React 
```js
// component to upload file:
export default () => {
    const [file, setFile] = useState(null);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };
    
    const uploadFile = async () => {
        const uploadUrl = await getPresignedURL([file.name]);
        await uploadFileS3Browser(uploadUrl, file)
    }

    return (
        <>
            ...
            <input type="file" onChange={handleFileChange} />
        <>
    )
}

// util function: 
const uploadFileS3Browser = async (uploadUrl: string, file: File) => {
    const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
            "Content-Type": "application/octet-stream",
        },
    })
    console.log("[uploadFileS3Native]", res)
    return res
}
```
##### React Native

```js
export const uploadFileS3Browser = async ({ uploadUrl, fileUri }: { uploadUrl: string; fileUri: string }) => {
    const file = await fetch(fileUri).then((res) => res.blob())
    const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
            "Content-Type": "application/octet-stream",
        },
    })
    return res
}
```