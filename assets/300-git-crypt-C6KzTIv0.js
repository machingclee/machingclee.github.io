const t=`---
title: "Git-Crypt Study"
date: 2024-07-27
id: blog0300
tag: git
toc: true
intro: "Sometimes it is much more convenient to save multiple config files in a repository than to git-ignore it. We study the encrpytion of those files using git-crypt."
---

<style>
  img {
    max-width: 660px;
  }
</style>

There are multiple reasons for encrpyting important files in order not to expose it to other people. Let's follow the following step:

### On your Machine (before pushing to existing directory)

1.  Let's install \`git-crypt\`. 
    - ***For windows*** just copy the executable from [**this repository**](https://github.com/oholovko/git-crypt-windows) into 
      \`\`\`text
      C:\\Program Files\\Git\\cmd
      \`\`\`
    - ***For Mac*** just run \`brew install git-crypt\`.

2.  Create a \`.gitattributes\` in your working repository, then write for example:
    \`\`\`text
    serverless.yml filter=git-crypt diff=git-crypt
    \`\`\`
    which usually contains important secrets.

3. Run \`git-crypt init\` to initiate the encrpytion config.

4.  Run \`git-crypt status\` to check which files get encrypted. In my case:
    \`\`\`text{3}
    ...
    not encrypted: backend/server.ts
        encrypted: backend/serverless.yml
    not encrypted: backend/service/authService.ts
    ...
    \`\`\`
5. The encryption only takes place when we git commit.

6.  Since someone in your team needs the credential, let's create a key for decrpytion:
    \`\`\`text
    git-crypt export-key ./git-crypt-key
    \`\`\`

7. ***Make sure*** to add \`git-crypt-key\` to \`.gitignore\`

8. Now push the code to the repository.

### From Other Machine

1. Pull the repository.

2. Get the \`git-crypt-key\` file from repository owner.

3. Run \`git-crypt unlock ./git-crypt-key\` in the working directory.

4. Now files  get decrpyted, and the decryption will be automatic for every \`git pull\`.`;export{t as default};
