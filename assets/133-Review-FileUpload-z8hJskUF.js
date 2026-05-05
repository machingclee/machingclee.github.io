const n=`---
title: "General Post Request in Springboot and File Uploading "
date: 2023-05-25
id: blog0133
tag: react, springboot, java
intro: "We record the whole workflow of uploading file from react frontend to springboot backend."
toc: true
img: spring
---

### General Post Request

### File Uploading

By adding

\`\`\`xml
<dependency>
  <groupId>org.mongodb</groupId>
  <artifactId>bson</artifactId>
  <version>4.9.1</version>
</dependency>
\`\`\`

into our pom.xml we are given a handy tool to parse json data in the body of request from frontend:

\`\`\`java
import org.bson.Document;

@PostMapping(value = "/projects)
@ResponseBody
public Map<String, Boolean> updateProject(@RequestBody String reqJson) throws Exception {
    Document updateReq = Document.parse(reqJson)
    ...
}
\`\`\`

Now we can get a value from key \`name\` via \`updateReq.get("name")\`.

#### On React Side

The basic logic:

\`\`\`typescript
export default () => {
    ...
    const [files, setFiles] = useState<FileList | null>(null);

    // used for file upload in <input ... onChange={uploadHandler} />
    const uploadHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        setFiles(e.target.files);
      }
    };

    const uploadClickHanlder = async () => {
        if ((files?.length || 0) > 0) {
            dispatch(asyncUploadImage({ oid: project.oid, file: files![0] }));
        }
    };

    return (
        ...
        <input type="file" accept="image/*" onChange={uploadHandler} />
        <button onClick={uploadClickHanlder}> Upload </button>
        ...
    )
}
\`\`\`

As usual we will upload a file in the form of \`FormData\`. We define \`asyncUploadImage\` in other slice file:

\`\`\`typescript
//projectSlice.ts

export const asyncUploadImage = createAsyncThunk(
  "upload-project-image",
  async ({ oid, file }: { oid: string; file: File }) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("oid", oid);

    const response = await apiClient.post<{ success: boolean }>(
      POST_PROJECTS_FILE_UPLOAD,
      formData
    );

    return response.data;
  }
);
\`\`\`

#### On Springboot Side

\`\`\`java
private final File uploadDir = new File("uploadfolder");

@PostMapping(value = "/projects/fileupload")
@ResponseBody
public Map<String, Object> updateProject(
    @RequestParam("oid") String oid,
    @RequestParam("file") MultipartFile file
) throws WbCustomException {
    if (!this.uploadDir.exists()) {
        this.uploadDir.mkdirs()
    }

    String filePath = this.uploadDir.getPath() + "/" + file.getOriginalFilename();

    try (FileOutputStream fos = new FileOutputStream(filePath)) {
        fos.write(file.getBytes());
        return Map.of("success", true);
    } catch (Exception e) {
        StringWriter errors = new StringWriter();
        e.printStackTrace(new PrintWriter(errors));
        return Map.of("success", false, "errorMessage", errors.toString());
    }
}
\`\`\`

- We use new \`File uplopadDir = new File("some/dir")\`, then we can use

  - \`uploadDir.exists()\` and
  - \`uploadDir.mkdirs()\`
    as in python.

- We use \`new FileOutputStream(filePath).write\` to write the received \`byte[]\` into a file.

- When receiving \`Formdata\` in springboot, it is as if receiving data from json object so that we can use \`@RequestParam\` to destructure the request body.
`;export{n as default};
