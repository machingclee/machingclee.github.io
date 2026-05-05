const n=`---
title: Call Python Script in Node.js
date: 2021-12-11
id: blog041
tag: javascript
intro: Sometimes we would like to call python script inside our node js program. We discuss how to execute a command, how to read the log and error in node-js and how to wait until this process is done.
---

### Situation I Encountered

As I am used to image processing in python than in nodejs, therefore I wrote a script in jupyter lab and wish to run it in my Electron-Nextjs application.

The script is very simple, it is used to compress all the images inside a folder:

\`\`\`py
# compress_image.py

for image_name in os.listdir(IMG_DIR):
    if image_name.endswith(".jpg"):
        print("processing", image_name)
        pic = Image.open(os.path.join(IMG_DIR, image_name)).convert('RGB')

        temp_img_dir = os.path.abspath(os.path.join(IMG_DIR, "..", "_screenshots"))
        if not os.path.exists(temp_img_dir):
            os.makedirs(temp_img_dir)

        tar_image_path = os.path.abspath(os.path.join(temp_img_dir, image_name))
        pic.save(tar_image_path, optimize=True, quality=60)
        print(tar_image_path, "saved")

shutil.rmtree(IMG_DIR)
os.rename(temp_img_dir, IMG_DIR)
\`\`\`

### Call this Python Script in Nodejs and Read any Log from the print

A function that takes \`cmd: string\` as input and output \`exitCode: number\` is created:

\`\`\`js
// exec-util.js

import { exec } from "child_process";

const execUtil = async (cmd: string) => {
  return (
    (await new Promise()) <
    number >
    ((resolve, _) => {
      console.log("spwanning process with command: ", cmd);
      const child = exec(cmd);
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");

      child.stdout?.on("data", function (data) {
        console.log("stdout: " + data);
      });
      child.stderr?.on("data", function (data) {
        console.log("stderr: " + data);
      });

      child.on("close", function (code) {
        console.log("exit code: " + code);
        if (code === null) {
          resolve(1);
        } else {
          resolve(code);
        }
      });
    })
  );
};
\`\`\`

Now in my nodejs program (in fact, in Electron) I call the following:

\`\`\`js
const cmd = \`conda activate <env> && python <some/location/compress_image.py>\`;
const exitCode = await execUtil(cmd);
\`\`\`

Which gives me the output coming from my \`print\` command in my python script (apart from \`exit code: 0\`):

\`\`\`text
stdout: C:\\Users\\user\\OneDrive\\Documents\\SCDictionary\\web-assets\\_screenshots\\1638900870035.jpg saved
processing 1638900889189.jpg
C:\\Users\\user\\OneDrive\\Documents\\SCDictionary\\web-assets\\_screenshots\\1638900889189.jpg saved
processing 1638900915323.jpg
C:\\Users\\user\\OneDrive\\Documents\\SCDictionary\\web-assets\\_screenshots\\1638900915323.jpg saved
processing 1638900919493.jpg
C:\\Users\\user\\OneDrive\\Documents\\SCDictionary\\web-assets\\_screenshots\\1638900919493.jpg saved
processing 1638900925208.jpg
...
exit code: 0
\`\`\`
`;export{n as default};
