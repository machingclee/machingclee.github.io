const n=`---
title: "Multiple Ngroks Via Docker Compose"
date: 2024-12-18
id: blog0348
tag: docker
toc: false
intro: "Suppose we want to test production-like environment by making a production build for mobile, it is helpful to host multiple backends in localhost and expose it via https, multiple ngroks can do the trick for us."
---

<style>
  img {
    max-width: 660px;
  }
</style>

Below we registered two accounts in ngrok and therefore obtained two \`NGROK_AUTHTOKEN\`'s.

It forwards our \`localhost:8080\` and \`localhost:9090\` as an \`https\` endpoints which are reachable in public.

\`\`\`yml
version: '3.8'

services:
  ngrok1:
    image: ngrok/ngrok:latest
    environment:
      - NGROK_AUTHTOKEN=token1
      - NGROK_LOG=stdout
      - NGROK_LOG_LEVEL=info
    command:
      - "http"
      - "--log=stdout"
      - "host.docker.internal:9090"
    ports:
      - "4040:4040"  # Web interface for ngrok1
    extra_hosts:
      - "host.docker.internal:host-gateway"

  ngrok2:
    image: ngrok/ngrok:latest
    environment:
      - NGROK_AUTHTOKEN=token2
      - NGROK_LOG=stdout
      - NGROK_LOG_LEVEL=info
    command:
      - "http"
      - "--log=stdout"
      - "host.docker.internal:8080"
    ports:
      - "4041:4040"  # Web interface for ngrok2
    extra_hosts:
      - "host.docker.internal:host-gateway"
\`\`\``;export{n as default};
