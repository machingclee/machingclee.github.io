const e=`---
title: "Temporary Values get Killed After the end of a Statement"
date: 2025-10-11
id: blog0424
tag: rust
toc: true
intro: Study temporary value
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

Consider the following function where \`self.cache\` is of type \`HashMap<String, BlockChain>\`:

\`\`\`rust{2}
    async fn get_index(&self) -> HttpResponse {
        let blockchain = self.cache.lock().unwrap().get("blockchain").unwrap();
        let first_block = blockchain[0].clone();
        let block_json = serde_json::to_string(&first_block).unwrap();
        debug!("block_json {:?}", block_json);
        HttpResponse::Ok().json(block_json)
    }
\`\`\`

Problem:

[![](/assets/img/2025-10-11-22-43-58.png)](/assets/img/2025-10-11-22-43-58.png)

The reason is that:

1. \`self.cache.lock()\` is a \`MutexGuard\` object with life time \`'a\`
2. \`self.cache.lock().get\` has signature:
    \`\`\`rust
    impl<K, V> HashMap<K, V> {
        pub fn get<'a, Q>(&'a self, k: &Q) -> Option<&'a V>
    \`\`\`
3. \`self.cache.lock().get("key").unwrap()\` is a \`&BlockChain\` object, i.e., a pointer
4. Pointer can never be moved, it will be copied whenever we assign it to another variable. Now \`blockchain = self.cache.lock().get("key").unwrap()\` is a copy of a pointer
5. \`self.cache.lock()\` is a temporary value, now it gets dropped at the end of the statement after \`;\`
6. \`self.cache.lock().get\` is now borrowing a dropped value, hence crashed


<Example>

**Remark.** By ***dropped*** we mean that the value has executed its \`drop\` method implemented for the \`Drop\` trait. Most of the time it is a cleanup process for freeing the memory, but it is not always true.

</Example>

### Solution

We simply move the temporary data to a local variable which has longer life span (so that the \`.get()\` makes sense):

\`\`\`rust{2,3}
    async fn get_index(&self) -> HttpResponse {
        let unlocked_cache = self.cache.lock().unwrap();
        let blockchain = unlocked_cache.get("blockchain").unwrap();
        let first_block = blockchain[0].clone();
        let block_json = serde_json::to_string(&first_block).unwrap();
        debug!("block_json {:?}", block_json);
        HttpResponse::Ok().json(block_json)
    }
\`\`\`

`;export{e as default};
