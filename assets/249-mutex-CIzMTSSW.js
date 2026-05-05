const n=`---
title: "Read Write Lock for Go"
date: 2024-03-24
id: blog0249
tag: go
intro: "We study read lock and write lock."
toc: false
---

<style>
  img {
    max-width: 660px;
  }
</style>

We study the following locks:

\`\`\`go
package main

import (
	"fmt"
	"sync"
	"time"
)

var wg sync.WaitGroup
var mutex sync.RWMutex

func write() {
	defer wg.Done()

	mutex.Lock()
	fmt.Println("Writing ...")
	time.Sleep(time.Second * 1)
	mutex.Unlock()
}

func read() {
	defer wg.Done()
	mutex.RLock()
	fmt.Println("Reading ...")
	time.Sleep(time.Second * 1)
	mutex.RUnlock()
}

func main() {
	for r := 0; r < 10; r++ {
		wg.Add(1)
		go write()
	}
	for r := 0; r < 10; r++ {
		wg.Add(1)
		go read()
	}
	wg.Wait()
}
\`\`\`

- In \`RWMutex\`, when we are writing we use \`Lock()\` to block any ***read*** and ***write*** access until we \`Unlock()\` it. 
- However, when we use \`RLock()\`, we are telling compiler we **allow** concurrent reads.
- If we execute the code above, we have:
  \`\`\`text
  Writing ...
  \`\`\`
  and ***1s*** later:
  \`\`\`text
  Reading ...
  Reading ...
  Reading ...
  Reading ...
  Reading ...
  Reading ...
  Reading ...
  Reading ...
  Reading ...
  Reading ...
  \`\`\`
  and then the following 1s later one another:
  \`\`\`text
  Writing ... // 1s
  Writing ... // 1s
  Writing ... // 1s
  Writing ...
  Writing ...     .
  Writing ...     .
  Writing ...     .
  Writing ...
  Writing ... // 1s
  \`\`\`

`;export{n as default};
