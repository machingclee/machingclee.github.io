---
title: "Manage Multiple Github Accounts Using SSH Keys in One Machine"
date: 2025-03-16
id: blog0372
tag: git
toc: true
intro: "Record a standard step to alter the authentication method (which account to authenticate) when we push changes to a repository."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

#### Generate an Identity

First generate an SSH key:

```text
ssh-keygen -t ed25519 -C "machingclee@gmail.com"
```

and save the credential to the files named `machingclee_github`.

Also add this SSH key into our github account.

#### SSH Host Configuration

Note that the order does matter. If `Host github.com` record is put on top, it takes the first priority and other config fails.

```bash{2,12}
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
```

The options

```text
UseKeychain yes
AddKeysToAgent yes
```

makes sure our configuration will be persisted in keychain once they have been used.

#### Let SSH Agent load the Private key into Memory

Execute the following

```text
ssh-add ~/.ssh/machingclee_github
```

Otherwise our SSH Host configs cannot be recognized.

Due to `UseKeychain` and `AddKeysToAgent`, we only need to do it **_once_**.

#### Change the Authentication Method (for Different Github Account)

- When we `git clone ...` the default authentication method recognized by the hostname `github.com` is always the default option (which is User Ching-Cheong-Lee in the configuration above).

- But now we might need to authenticate our `PUSH` request using another account (namely, another hostname).

- For that, we change the authentication method of that repository locally:

  ```text
  git remote set-url origin git@github.com-machingclee:machingclee/<repo-name>.git
  ```

  Note that hostname is changed from `github.com` to `github.com-machingclee`.

- We can also change the `git clone` path by changing the hostname beforehand:

  ```text
  git clone git@github.com-machingclee:machingclee/<repo-name>.git
  ```
