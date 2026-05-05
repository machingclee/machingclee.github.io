const e=`---
title: "Manage Multiple Github Accounts Using SSH Keys in One Machine"
date: 2025-03-16
id: blog0372
tag: git
toc: true
intro: "Record a standard step to alter the authentication method (choose which account to authenticate) when we push changes to a repository."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Generate an Identity

First generate an SSH key:

\`\`\`text
ssh-keygen -t ed25519 -C "machingclee@gmail.com"
\`\`\`

Save the credential to the files named \`machingclee_github\`. Also add this SSH key into our github account.

### SSH Host Configuration

Note that the order does matter:

\`\`\`bash{2,12}
~/.ssh/config
Host github.com-machingclee
	HostName github.com
	User machingclee
	PreferredAuthentications publickey
	IdentityFile /Users/chingcheonglee/.ssh/machingclee_github
	UseKeychain yes
	AddKeysToAgent yes

# --- Sourcetree Generated ---

Host github.com
	HostName github.com
	User Ching-Cheong-Lee
	PreferredAuthentications publickey
	IdentityFile /Users/chingcheonglee/.ssh/Ching-Cheong-Lee-GitHub
	UseKeychain yes
	AddKeysToAgent yes

# ----------------------------
\`\`\`

If \`Host github.com\` record is put on top, it takes the first priority and other configs will get **_overriden_**.

On the other hand, the options

\`\`\`text
UseKeychain yes
AddKeysToAgent yes
\`\`\`

makes sure our configuration will be persisted in keychain once they have been used.

### Let SSH Agent load the Private key into Memory

For the first time using our account, execute the following to ensure our new SSH Host configuration can be recognized.

\`\`\`text
ssh-add ~/.ssh/machingclee_github
\`\`\`

Due to \`UseKeychain\` and \`AddKeysToAgent\`, we only need to do it **_once_**.

### Change the Authentication Method (by Different Github Accounts)

- When we \`git clone ...\`, the default authentication method recognized by the hostname \`github.com\` is always the default option (which is User **_Ching-Cheong-Lee_** in the configuration above).

- To \`git clone\` using our specified SSH key (namely, identity). we can change the ssh-path by changing the hostname beforehand:

  <Example>
  <span>git clone git@<b>github.com-machingclee</b>:machingclee/<b>repo-name</b>.git</span>
  </Example>

  Instead of using the default \`github.com\`

- If we **_did not_** change the ssh-hostname, we might need to authenticate our \`PUSH\` request using another account (namely, another hostname) via:

  <Example>
  <span>git remote set-url origin git@<b>github.com-machingclee</b>:machingclee/<b>repo-name</b>.git</span>
  </Example>

  This will change the config of **_that repository_** to using the new host configuration.
`;export{e as default};
