const n=`---
title: "Using Go-Chi"
date: 2023-10-30
id: blog0204
tag: go
intro: "Study one of the most popular framework in routing http requests."
toc: true
wip: true
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

### Installations

After \`go mod init <projec-name>\`, we add:

- \`\`\`text
  go get github.com/go-chi/chi/v5
  \`\`\`

### Go-Chi

#### Hello World

\`\`\`go
package main

import (
	"fmt"
	"github.com/go-chi/chi/v5"
	"net/http"
)

func basicHandler(w http.ResponseWriter, req *http.Request) {
	fmt.Fprint(w, "Hello World")
}

func main() {
	router := chi.NewRouter()
	router.Get("/hello", basicHandler)

	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	err := server.ListenAndServe()
	if err != nil {
		fmt.Println("Failed to listen to server", err)
	}
}
\`\`\`
`;export{n as default};
