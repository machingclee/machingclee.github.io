---
title: "`strace` in mac"
date: 2026-02-19
id: blog0459
tag: C
toc: true
intro: "Introduce strace in mac"
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>

### Purpose 

In linux we can use `strace` to investigate all of the system call in a program. This tool is unfortunately ***not available in Mac OS*** and in this article we explore a third party tool to achieve the same functionality in mac.

### Installation

We simply follow the installation steps in 

- https://github.com/Mic92/strace-macos

Note that we may need to add the `bin/` directory into our `$PATH` variable manually, to do this, we write the following in `~/.zshrc`:

```sh
export PATH="$PATH:/Users/<user-name>/Library/Python/3.9/bin"
```

Now the executable `strace` should be detectable.


### Result 
Compile your `C` program by `gcc` such as `gcc -o some_app some_app.c`, then 

```sh
strace ./some_app
```

we should see the colored logging in our terminal:

![](/assets/img/2026-02-20-16-15-24.png)