const e=`---
title: "Dev Container"
date: 2024-03-29
id: blog0251
tag: docker
intro: "Sometimes a library may require user installing gcc, c++, ca-certificates, or some other linux-specific libraries. Let's use docker image to provide us a consistent working environment."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>



### Why 

- By looking at the \`Dockerfile\` clearly we wouldn't want to install those dependencies at the developer's machine because some may use windows, some may use mac. 

- By using dev container, we can unify the dev environment.

### Project Structure

![](/assets/img/2024-03-29-23-18-18.png)

### devcontainer.json

\`\`\`json
{
    "name": "For Kafka",
    "build": {
        "dockerfile": "Dockerfile"
    }
}
\`\`\`

### Dockerfile

\`\`\`Dockerfile
FROM node:20-alpine

RUN apk --no-cache add \\
      bash \\
      g++ \\
      ca-certificates \\
      lz4-dev \\
      musl-dev \\
      cyrus-sasl-dev \\
      openssl-dev \\
      make \\
      python3

RUN apk add --no-cache --virtual .build-deps gcc zlib-dev libc-dev bsd-compat-headers py-setuptools bash
\`\`\`
- Note that we don't write \`RUN npm install <package-name>\` inside the \`Dockerfile\` because by default we are at the root level inside the container where we are not allowed to \`WRITE\` at that level. 

- Even we \`mkdir -p\` and \`WORKDIR\` at a directory and successfully  \`npm install\`, but inside container we are at the workspace defined by the vscode extention \`Remote Development\` rather than the directory specified by \`WORKDIR\`.

- The correct procedure should be to install just the native linux libraries, and then we install runtime-specific library ***inside*** the container.

- Note that the \`node_modules\` installed inside the container will be linux-specific, running it in windows will fail.

### Open the Project Inside dev Container

1.  Click the lower-left button in vs-code:

    ![](/assets/img/2024-03-29-23-28-39.png)

2.  Choose \`Reopen in Container\`

    ![](/assets/img/2024-03-29-23-29-15.png)

3.  Choose the configuration we have just named:

    ![](/assets/img/2024-03-29-23-31-12.png)
`;export{e as default};
