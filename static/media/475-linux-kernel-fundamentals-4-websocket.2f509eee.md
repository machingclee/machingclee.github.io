---
title: "Networking in Linux Kernel: Part IV,  HTTP vs WebSocket at the Kernel Level"
date: 2026-03-16
id: blog0475
tag: linux, C, networking
toc: true
intro: "Compare standard HTTP/1.1 and Websocket Request for both-way communication"
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

### Comparison


The entire mechanism discussed in [Networking in Linux Kernel: Part III, How Socket Receive Data from NIC](/blog/article/Networking-in-Linux-Kernel-Part-III-How-Socket-Receive-Data-from-NIC) is **identical** for both HTTP and WebSocket connections. Both are plain TCP streams. At the kernel level, there is no "HTTP socket" or "WebSocket socket" — there is only `AF_INET, SOCK_STREAM`, and the four concepts covered in this article: socket creation, the blocking receive path, the SoftIRQ enqueue path, and the wake-up path.

The difference between the two protocols is entirely in **what user space does after `recvfrom()` returns**.

#### HTTP (Short-Lived Connections)

A minimal HTTP/1.0 server illustrates the "one request, one response, close" model:

```c
int server_fd = socket(AF_INET, SOCK_STREAM, 0);
bind(server_fd, ...);
listen(server_fd, SOMAXCONN);

while (1) {
    int conn_fd = accept(server_fd, ...);   // blocks on listening socket

    // --- everything below runs on conn_fd ---

    char buf[4096];
    ssize_t n = recvfrom(conn_fd, buf, sizeof(buf), 0, NULL, NULL);
    //  ↑ enters tcp_recvmsg → sk_wait_data → SLEEPS until SoftIRQ wakes it

    // parse HTTP request, build response ...
    send(conn_fd, response, resp_len, 0);

    close(conn_fd);   // ← process is done with this socket
                      //   kernel tears down TCP state, sends FIN
}
```

- After `recvfrom()` returns, the process handles one request, sends one response, and calls `close()`. The socket is destroyed; the wait queue is freed; the TCP connection is terminated. The process loops back to `accept()`, which blocks on the **listening socket's** queue — a completely different wait queue — waiting for the next client.



- `recvfrom()` is called on the ***connected*** socket (`conn_fd`), not the listening one. The listening socket (`server_fd`) has no TCP connection state — its only job is to accept new clients. It has no `sk_receive_queue` carrying application data.



#### WebSocket (Long-Lived Connections)

A WebSocket server keeps the `conn_fd` open and loops:

```c
int conn_fd = accept(server_fd, ...);

// HTTP Upgrade handshake (single recvfrom + send, same as HTTP above)
ssize_t n = recvfrom(conn_fd, buf, sizeof(buf), 0, NULL, NULL);
// ... verify "Upgrade: websocket", send 101 Switching Protocols ...

// ─── WebSocket event loop ────────────────────────────────────────────────
while (1) {
    // tcp_recvmsg → sk_wait_data → SLEEPS in wait queue
    ssize_t n = recvfrom(conn_fd, buf, sizeof(buf), 0, NULL, NULL);
    //  ↑ the SAME sleep/wake/copy path runs every single iteration

    // parse WebSocket frame header, dispatch message ...
    // optionally send a reply ...

    // loop back: process re-registers itself in sk->sk_wq and sleeps again
}
// close(conn_fd) only when the client disconnects or the server shuts down
```

The kernel has no awareness of the loop. Every iteration of `recvfrom()` goes through the exact same five-phase flow documented above: 

`tcp_recvmsg` \
→ `sk_wait_data` \
→ `schedule()` \
→ `tcp_v4_rcv` wakes via `sock_def_readable` \
→ `autoremove_wake_function` \
→ `try_to_wake_up` \
→ `finish_wait` \
→ `skb_copy_datagram_msg`

The only structural difference is that `close()` is never called between frames, so:

- The `conn_fd` and its `struct sock` remain allocated.
- The TCP connection (4-tuple) stays established.
- When the next frame arrives, `__inet_lookup_skb` finds the **same** `struct sock` again.
- `sock_def_readable` wakes the **same** sleeping process again.

#### Summary Table

| Aspect | HTTP (short-lived) | WebSocket (long-lived) |
|---|---|---|
| Socket type | `AF_INET, SOCK_STREAM` | `AF_INET, SOCK_STREAM` |
| Kernel receive path | `tcp_v4_rcv` → `tcp_queue_rcv` → `sock_def_readable` | **Identical** |
| Sleep mechanism | `sk_wait_data` → `schedule()` | **Identical** |
| Wake mechanism | `autoremove_wake_function` → `try_to_wake_up` | **Identical** |
| After `recvfrom()` returns | `close(conn_fd)` — socket destroyed | Loop back to `recvfrom()` — socket reused |
| `struct sock` lifetime | One request | Duration of connection |
| TCP connection teardown | Immediately after response | Only on `close()` or FIN/RST |
| Kernel "awareness" of protocol | None — just TCP bytes | None — just TCP bytes |

The kernel does not know or care whether the bytes flowing through a `SOCK_STREAM` socket represent HTTP/1.1, WebSocket frames, gRPC, or raw binary. Every layer from `tcp_v4_rcv` down to `copy_to_user` is shared. The protocol interpretation is exclusively a user-space concern.

### Terminate a WebSocket Connection

A WebSocket connection can end in three ways, at decreasing levels of protocol cleanliness.

#### Clean close — WS CLOSE handshake (RFC 6455 §5.5.1)

Either peer sends a CLOSE frame; the receiver echoes it back; then the TCP connection is torn down with a normal FIN exchange:

```text
Client                                Server
  │── CLOSE frame (opcode 0x8) ──────▶ │
  │◀─ CLOSE frame (opcode 0x8) ──────  │
  │── TCP FIN ──────────────────────▶  │
  │◀─ TCP FIN ──────────────────────   │
```

The CLOSE frame follows the standard RFC 6455 two-byte frame header. The first byte is always `0x88` (`FIN=1`, `RSV=000`, `opcode=0x8`). The second byte encodes the mask bit and payload length:

```text
Minimal (no status code):
  0x88 0x00   →  FIN=1, opcode=CLOSE, payload length = 0

With a status code (most common):
  0x88 0x02   →  FIN=1, opcode=CLOSE, payload length = 2
  0xNN 0xNN   →  status code as big-endian uint16
```

Common status codes:

| Code | Name | Meaning |
|---|---|---|
| 1000 | Normal Closure | Clean shutdown, all transfers complete |
| 1001 | Going Away | Server shutting down or browser navigating away |
| 1002 | Protocol Error | Protocol-level violation detected |
| 1003 | Unsupported Data | Received data type cannot be handled |
| 1011 | Internal Server Error | Unexpected server-side condition |

After the CLOSE echo, the server calls

`close(conn_fd)` → `tcp_close()` → `inet_unhash()`, 

removing the socket from `tcp_hashinfo.ehash`. The `TCP_CLOSE` path described [above](#rcu) then completes the teardown.

#### TCP FIN — half-close without WS CLOSE

If the remote peer calls `close(fd)` without first sending a WS CLOSE frame, the kernel sends a TCP FIN. The local `recvfrom()` returns `0` (EOF). The WebSocket library treats this as an abnormal close and surfaces it as an error event.

#### TCP RST — abrupt termination

If the peer process crashes, the machine loses power, or a middlebox forcibly drops the connection, a TCP RST is delivered. `recvfrom()` returns `-1` with `errno = ECONNRESET`. No CLOSE frame exchange is possible, and any in-flight data is lost.

| Termination mode | How `recvfrom()` signals it | CLOSE frame exchanged? |
|---|---|---|
| WS CLOSE handshake | Returns the CLOSE frame bytes, then `0` on next call | Yes |
| TCP FIN (no WS CLOSE) | Returns `0` (EOF) | No |
| TCP RST | Returns `-1`, `errno = ECONNRESET` | No |

### The Browser Is Just Another C Program

A common misconception is that browsers have special OS-level networking primitives for WebSocket. They do not. A browser tab is an ordinary OS process. The JavaScript APIs `new WebSocket(...)`, `fetch(...)`, `ws.send(...)` are high-level wrappers over the same `socket()`, `connect()`, `send()`, `recv()` system calls that any C program uses.

The full call chain for `new WebSocket("wss://example.com/chat")` inside Chrome looks like:

```text
JavaScript
  new WebSocket("wss://example.com/chat")
      │
      ▼
Chromium //net stack (C++)
  fd = socket(AF_INET, SOCK_STREAM, 0)    ← same SYSCALL_DEFINE3(socket)
  connect(fd, &server_addr, ...)          ← TCP three-way handshake
                                            → inet_ehash_nolisten() inserts into ehash

  // wss:// → TLS handshake before anything else
  SSL_connect(ssl, fd)                    ← TLS certificate exchange, key agreement
                                            (all via send/recv on the same fd)

  // HTTP Upgrade (inside TLS)
  send(fd, "GET /chat HTTP/1.1\r\n"
           "Upgrade: websocket\r\n"
           "Sec-WebSocket-Key: ...\r\n\r\n", ...)

  recv(fd, buf, ...)                      ← reads "HTTP/1.1 101 Switching Protocols"
                                            pattern-match: sees 101 → switch to WS mode

  // WebSocket event loop (Chromium internal thread)
  while (1) {
      recv(fd, buf, ...)                  ← tcp_recvmsg → sk_wait_data → sleeps
                                            woken by sock_def_readable when server sends
      // parse WS frame header from buf
      // fire JavaScript onmessage event
  }
      │
      ▼
Linux kernel on the browser machine
  tcp_recvmsg → sk_wait_data → schedule()       ← browser thread sleeps
  [packet arrives from server]
  tcp_v4_rcv → tcp_queue_rcv → sock_def_readable
  → autoremove_wake_function → try_to_wake_up   ← browser thread wakes
  → copy_to_user → Chromium reads bytes → JS onmessage fires
```

The `ws://` / `wss://` scheme string is consumed entirely by the browser before any network activity occurs. It never travels over the wire. Its sole purpose is to tell the browser:

- **Which internal engine to use**: WebSocket stack (not the HTTP fetch stack)
- **Whether to add TLS**: `wss://` → call `SSL_connect` first; `ws://` → skip TLS

The server never sees the scheme. It receives a plain TCP connection with some bytes that happen to start with an HTTP Upgrade request.

### The `ws://` Scheme Never Reaches the Server

This is why a backend WebSocket server has no concept of `ws://` or `wss://`. It simply:

```c
int server_fd = socket(AF_INET, SOCK_STREAM, 0);
bind(server_fd, ...);
listen(server_fd, SOMAXCONN);

int conn_fd = accept(server_fd, ...);   // plain TCP connection arrives

char buf[4096];
recv(conn_fd, buf, sizeof(buf), 0);     // first bytes arrive

// pattern-match on buf:
if (strstr(buf, "Upgrade: websocket")) {
    // do 101 handshake, switch to WS frame parsing
} else {
    // treat as plain HTTP
}
```

For `wss://`, the TLS layer sits in front of this — either handled by the server library or terminated at a reverse proxy (nginx, Caddy) — but after TLS decryption the server sees the same plaintext HTTP Upgrade bytes.

### JavaScript ↔ Kernel Correspondence

| JavaScript / Browser API | Chromium C++ internal | Kernel system call |
|---|---|---|
| `new WebSocket("ws://...")` | `socket()` + `connect()` | `sys_socket` + `sys_connect` |
| `new WebSocket("wss://...")` | `socket()` + `connect()` + `SSL_connect()` | `sys_socket` + `sys_connect` + `sys_send`/`sys_recv` for TLS handshake |
| `ws.send(data)` | `send()` / `SSL_write()` | `sys_sendto` → `tcp_sendmsg` |
| `ws.onmessage` callback fires | `recv()` loop in network thread | `sys_recvfrom` → `tcp_recvmsg` → `copy_to_user` |
| `ws.close()` | `close(fd)` | `sys_close` → `tcp_close` → `inet_unhash()` |
| `fetch("http://...")` | `socket()` + `connect()` + `send()` + `recv()` | identical to above |

At the OS boundary, a Chrome tab doing `fetch()` and a C program doing `connect()` + `send()` + `recv()` are indistinguishable. The kernel sees the same system calls either way.



