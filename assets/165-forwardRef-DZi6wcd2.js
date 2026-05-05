const e=`---
title: "forwardRef and useImperativeHandle"
date: 2023-08-14
id: blog0165
tag: react
intro: "A method to pass complicated function in a component to its parent."
toc: false
---

<Center></Center>

Consider a file uploader called \`Uploader\`:

\`\`\`ts
export type UploaderHandle = {
    fileIdArrs: number[],
    postFilesToServer: () => Promise<number[]>,
}

type UploaderProps = {
    documents: SomeFile[],
}

const Uploader = forwardRef<UploaderHandle, UploaderProps>((props, ref) => {
    const { documents } = props
    useImperativeHandle(ref, () => ({
        fileIdArrs,
        postFilesToServer,
    }))
    ...
    const [fileIdArrs, setfileIdArrs] = useState<number[]>([]);

    const postFilesToServer = async () => {
        for (let file of fileList) {
          await uploadFile(file);
          ...
        }
    }
})
\`\`\`

- We want the method to be triggered by the parent of \`<Uploader/>\` instead.
- Sometimes it is done for the purpose of code separation (e.g., its parent is already complicated enough).

Now consider a parent that makes use of \`<Uploader/>\`:

\`\`\`ts-1
export default function SomeComponent() {
    const uploaderRef = useRef<UploaderHandle>(null);
    ...
    const saveHandler = async () => {
        const fileIds = await uploaderRef.current?.postFilesToServer();
        ...
    }
    return(
        ...
        <Box>
            <Uploader
                documents={documents}
                ref={uploaderRef}
            />
        </Box>
    )
}
\`\`\`

In line 5 we use the method \`postFilesToServer\` which belongs to its child \`<Uploader/>\`.
`;export{e as default};
