const n=`---
title: Rust Study Notes First Trial
date: 2022-04-03
id: blog057
tag: rust
intro: Record busic knowledge to rust project
wip: true
---

### Book

https://doc.rust-lang.org/stable/book/

### Installation Guide

https://doc.rust-lang.org/stable/book/ch01-01-installation.html

### Commands

- Create new project:
  \`\`\`text
  cargo new begin-rust
  \`\`\`
- Install new packages (called crates in rust): Find desired package from https://crates.io/crates, copy \`rand = "0.8.5"\` below [\`dependencies]

  \`\`\`text
  [package]
  name = "begin-rust"
  version = "0.1.0"
  edition = "2021"

  [dependencies]
  rand = "0.8.5"
  \`\`\`

  and then run \`cargo build\`

### How to Solve 'Z' is only accepted on the nightly compiler

This is because we need toolchain of nightly version, for this:

\`\`\`text
rustup install nightly
\`\`\`

and then use

\`\`\`text
rustup show
\`\`\`

to show all downloaded toolchain, finally,

\`\`\`text
rustup default nightly
\`\`\`

to change the default version we use.
`;export{n as default};
