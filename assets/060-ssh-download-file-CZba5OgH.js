const n=`---
title: SSH Config and Download File in SSH Client
date: 2022-04-12
id: blog060
tag: coding
intro: Record script to download files using SSH client.
---

### SSH Into a Computer

Given that I have following following config in \`~/.ssh/config\`

\`\`\`text
Host gp
  HostName 12.34.567.89
  User cclee
  Port 1314
\`\`\`

Then I can ssh into this computer by

\`\`\`text
ssh gp
\`\`\`

and inputting the password.

### SSH into an EC2 Instance

With EC2 we additionally need a private key. In both Windows (with git-bash) and unix-based system, we can use that key in \`.pem\` format.

\`\`\`text
Host uat
  HostName ec2-some-number.ap-northeast-1.compute.amazonaws.com
  User ubuntu
  Port 22
  PreferredAuthentications publickey
  IdentityFile C:\\keys\\wbkeypair-tokyo-james.pem

Host prd
  HostName ec2-some-other-number.ap-northeast-1.compute.amazonaws.com
  User ubuntu
  Port 22
  PreferredAuthentications publickey
  IdentityFile C:\\keys\\wbkeypair-tokyo-james.pem
\`\`\`

### Download a File in SSH Client

#### With ~/.ssh/config

Suppose that we have identified the filepath to download, we can

\`\`\`text
scp gp:/the/file/path /local/file/path
\`\`\`

and we will be done by typing the password in console.

#### Without ~/.ssh/config

\`\`\`text
scp -P port-number user@domain:/destination source-file/directory
\`\`\`
`;export{n as default};
