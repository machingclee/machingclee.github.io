const e=`---
title: "References don't Track Ownership Changes"
date: 2025-10-11
id: blog0423
tag: rust
toc: true
intro: Study owndership in rust
img: rust
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

### The Problem



Consdier the following struct and constructor:

\`\`\`rust
#[derive(Clone, Debug)]
pub struct ApiServer {
    port: u16,
    // mutex is not clonable, we wrap by Arc
    cache: Arc<Mutex<HashMap<String, BlockChain>>>,
}
\`\`\`

\`\`\`rust{9-13}
impl ApiServer {
    pub fn new(port: u16) -> Self {
        let api_server = ApiServer {
            port,
            cache: Arc::new(Mutex::new(HashMap::<String, BlockChain>::new())),
        };

        let wallet_miner = Wallet::new();
        let unlocked_cache = &mut api_server.cache.lock().unwrap();
        unlocked_cache.insert(
            "blockchain".to_string(),
            BlockChain::new(wallet_miner.get_address()),
        );

        api_server
    }
}
\`\`\`
now our compiler will complain:

[![](/assets/img/2025-10-11-22-07-26.png)](/assets/img/2025-10-11-22-07-26.png)



### What Causes the Problem?

#### Rules for Reference and Ownership

Rust's borrow checker follows simple, strict rules:

- "If you have a reference to something, you can't move that something"
- "References must always point to valid data".

  It doesn't matter that the reference dies ***immediately*** - the rule is applied at compile time based on code structure, not runtime execution.

#### Which rule have we broken?



Let's start with the line of borrowing:


\`\`\`rust 
        let unlocked_cache = &mut api_server.cache.lock().unwrap();
        unlocked_cache.insert(
            "blockchain".to_string(),
            BlockChain::new(wallet_miner.get_address()),
        );

        api_server
    }
\`\`\`

1. \`api_server\` is returned and its data ownership is ***potentially moved*** to another variable that receives the return

2. \`unlocked_cache\` references to \`api_server.cache\`, however, as \`api_server\` is moved, the access \`api_server.cache\` crashed
3. No matter \`unlocked_cache\` dies immediately outside of the scope of \`new()\` or not, we are referencing and moving a data ***at the same time***.


### Solution 1

We don't create intermediate reference, we simply mutate the data that the \`MutexGuard\` referencing to:

\`\`\`rust{9-12}
impl ApiServer {
    pub fn new(port: u16) -> Self {
        let api_server = ApiServer {
            port,
            cache: Arc::new(Mutex::new(HashMap::<String, BlockChain>::new())),
        };

        let wallet_miner = Wallet::new();
        api_server.cache.lock().unwrap().insert(
            "blockchain".to_string(),
            BlockChain::new(wallet_miner.get_address()),
        );

        api_server
    }
}
\`\`\`

### Solution 2 

We avoid ***moving*** and ***referencing to*** the same variable in the same scope:

\`\`\`rust{9-15}
impl ApiServer {
    pub fn new(port: u16) -> Self {
        let api_server = ApiServer {
            port,
            cache: Arc::new(Mutex::new(HashMap::<String, BlockChain>::new())),
        };

        let wallet_miner = Wallet::new();
        {
            let unlocked_cache = &mut api_server.cache.lock().unwrap();
            unlocked_cache.insert(
                "blockchain".to_string(),
                BlockChain::new(wallet_miner.get_address()),
            );
        }
        api_server
    }
}
\`\`\``;export{e as default};
