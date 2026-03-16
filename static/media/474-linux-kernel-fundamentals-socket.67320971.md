---
title: "Networking in Linux Kernel: Part III, How Socket Receive Data from NIC"
date: 2026-03-15
id: blog0473
tag: linux, C, networking
toc: true
intro: "This time we study how data is received by the socket after the process of soft interrupt."
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



### Socket Creation — How TCP Gets Bound to the Socket

From user space:

```c
int fd = socket(AF_INET, SOCK_STREAM, 0);
```

#### `struct sock` and `struct socket`

![](/assets/img/2026-03-15-21-34-57.png)

We will be explaining the components in this image throughout the article. 


#### System Call Entry

`SYSCALL_DEFINE3(socket, ...)` is the kernel's definition of the `socket` system call. It executes ***at the moment*** user-space code calls `socket(AF_INET, SOCK_STREAM, 0)`. Here's the exact sequence:

1. User space calls `socket(AF_INET, SOCK_STREAM, 0)` (from glibc / a C program).
2. glibc issues a `syscall` instruction (on x86-64: `mov $SYS_socket, %rax; syscall`).
3. CPU switches to kernel mode; the trap handler looks up the system call table entry for `__NR_socket` (syscall number 41 on x86-64).
4. Kernel dispatches to the function registered for that number — which is exactly what `SYSCALL_DEFINE3(socket, ...)` expands to: `__x64_sys_socket(...)`.
5. That function body runs — calling `sock_create()` → `__sock_create()` → `inet_create()` etc., as described below.

The macro itself is a registration shorthand that:
- Generates a properly-named kernel function (`__x64_sys_socket`).
- Inserts a pointer to it into the kernel's syscall dispatch table at boot time.
- Handles argument copying from user-space registers into kernel-space variables.

Everything after that (the `sock_create` → `inet_create` chain) happens **within the same synchronous kernel execution context** before control returns to user space with the file descriptor.

```c
// net/socket.c
SYSCALL_DEFINE3(socket, int, family, int, type, int, protocol)
{
    struct socket *sock;
    int retval;

    ...

    retval = sock_create(family, type, protocol, &sock);
    return retval;
}
```

Which leads to:

```c
int sock_create(int family, int type, int protocol, struct socket **res)
{
    ... // invariants maintained here
    return __sock_create(current->nsproxy->net_ns,
                         family, type, protocol, res, 0);
}
```

<item>

**Remark.** In linux kernel whenever a function is prefixed by `__`, then certain kind of invariants have been maintained before the exectution of this function.

</item>

#### Core Socket Construction

```c
// net/socket.c
int __sock_create(struct net *net, int family, int type, int protocol,
                  struct socket **res, int kern)
{
    struct socket *sock;
    const struct net_proto_family *pf;

    sock = sock_alloc(); // allocate struct socket            
    sock->type = type;

    pf = rcu_dereference(net_families[family]);

    // For AF_INET → calls inet_create()
    pf->create(net, sock, protocol, kern);

    *res = sock;
    return 0;
}
```

##### On `rcu_dereference(net_families[family]`

`net_families` is a global array of pointers `(struct net_proto_family)*`  indexed by address family number (e.g., `AF_INET = 2`). 




```c
static const struct net_proto_family inet_family_ops = {
    .family = PF_INET,
    .create = inet_create,
    .owner  = THIS_MODULE,
};
```


This struct is the **address-family-level factory** registered with the generic socket layer. Its sole job is to provide the `.create` function pointer — `inet_create` — so that when the caller specifies `AF_INET`, the kernel knows how to construct the socket.

When `socket(AF_INET, SOCK_STREAM, 0)` is called, `__sock_create()` looks up `net_families[AF_INET]` to get `&inet_family_ops`, then calls `pf->create(...)` which resolves to `inet_create()`. The latter then does the real work:
1. Allocating `struct sock`
2. Binding `inet_stream_ops` and `tcp_prot`
3. Calling `sock_init_data()`, etc. 


##### What is RCU (Read-Copy-Update)? {#rcu}

The `rcu_dereference()` wrapper is an RCU (Read-Copy-Update) mechanism. Since `net_families` can be updated at runtime (e.g., a kernel module registering or unregistering a protocol family), RCU ensures: 
1. The pointer read is memory-barrier-protected so you never see a partially-written pointer; 
2. Readers don't block writers — the old pointer stays valid until all current readers finish their RCU read-side critical section; 
3. A compiler barrier prevents the compiler from re-loading the pointer a second time after it may have changed. 

Without `rcu_dereference`, a concurrent `sock_unregister()` could free the struct while `__sock_create` is still using `pf->create`, causing a use-after-free crash.

#### `inet_create()` — Binding TCP
##### Implementation Detail
```c-1
static int inet_create(struct net *net, struct socket *sock,
                       int protocol, int kern)
{
    struct sock *sk;
    struct inet_protosw *answer;

    // Find, entry (protocols) for AF_INET + SOCK_STREAM
    // Multiple protocols can share the same socket type,
    // like IPPROTO_TCP and IPPROTO_SCTP, both belong to SOCK_STREAM
    list_for_each_entry_rcu(answer, &inetsw[sock->type], list) { // macro
        sock->ops = answer->ops;    // inet_stream_ops

        sk = sk_alloc(net, 
                      PF_INET, 
                      GFP_KERNEL,
                      answer->prot, // tcp_prot
                      kern);

        sock_init_data(sock, sk);
    }
}
```

The key lookup is `&inetsw[sock->type]` (line 10).

Here `sock->type` is `SOCK_STREAM`, the offset from the pointer `inetsw`  is exactly the index represeting the  socket type, so `inetsw[SOCK_STREAM]` is the list of all registered ***protocols*** that serve stream sockets under `AF_INET`. 

The loop walks that list until it finds the matching entry (e.g., `IPPROTO_TCP`). From the matched entry (`struct inet_protosw *answer`) two bindings are made:

| Assignment | Source field and Bound to | What it carries |
|---|---|---|
| `sock->ops = answer->ops` | from `inet_protosw.ops` to  `inet_stream_ops` | socket-level callbacks (`recvmsg`, `sendmsg`, …) |
| `sk->sk_prot = answer->prot` | from `inet_protosw.prot` to `tcp_prot` | protocol-level callbacks (`tcp_recvmsg`, `tcp_sendmsg`, …) |

After `sock_init_data()` returns, the socket is fully wired: 

1. A call to `sock->ops->recvmsg` dispatches `inet_recvmsg`;
2. Which in turn calls `sk->sk_prot->recvmsg` = `tcp_recvmsg`.


##### Protocol Operation Tables {#protocol_table}

`inet_stream_ops`:

```c
const struct proto_ops inet_stream_ops = {
    .family   = PF_INET,
    .connect  = inet_stream_connect,
    .sendmsg  = inet_sendmsg,
    .recvmsg  = inet_recvmsg,
};
```

`tcp_prot`:

```c
struct proto tcp_prot = {
    .name     = "TCP",
    .connect  = tcp_v4_connect,
    .sendmsg  = tcp_sendmsg,
    .recvmsg  = tcp_recvmsg,
};
```

##### `sock_init_data()` — Critical Initialization

```c
void sock_init_data(struct socket *sock, struct sock *sk)
{
    skb_queue_head_init(&sk->sk_receive_queue);

    sk->sk_data_ready   = sock_def_readable;
    sk->sk_write_space  = sock_def_write_space;
    sk->sk_error_report = sock_def_error_report;
}
```

At this point the binding is complete:

```text
struct socket
   ├── ops → inet_stream_ops
   └── sk  → struct sock
              ├── sk_prot → tcp_prot
              ├── sk_receive_queue
              ├── sk_wq->wait
              └── sk_data_ready → sock_def_readable
```

### TCP Connection Lifecycle: The Lookup Table `tcp_hashinfo.ehash`

`__inet_lookup_skb` (called by `tcp_v4_rcv` on every arriving packet) searches `tcp_hashinfo.ehash` — the kernel's global hash table of all **established** TCP connections, keyed by 4-tuple `(src_ip, src_port, dst_ip, dst_port)`. There are two natural questions:

1. When is a socket **inserted** into the table?
2. When `close()` is called, does the kernel **remove** it?

Both answers turn on the TCP state machine, not on any user-space call.

#### Insertion — During the Three-Way Handshake

The insertion happens at the **third packet of the handshake**, long before `accept()` or `recvfrom()` is ever called.

**Server-side path:**

```text
Client  →  SYN
    Kernel: tcp_v4_rcv()
        tcp_rcv_state_process()        [sk->sk_state == TCP_LISTEN]
        tcp_conn_request()
            inet_reqsk_alloc()          ← lightweight "request socket" (no full sock yet)
            inet_csk_reqsk_queue_hash_add()  ← stored in SYN queue (half-open)
    Kernel: sends SYN-ACK

Client  →  ACK  ← third packet; handshake completes
    Kernel: tcp_v4_rcv()
        tcp_check_req()
        tcp_v4_syn_recv_sock()        ← allocates full struct sock for this connection
        inet_csk_complete_hashdance()
            inet_ehash_insert()         ← *** INSERT INTO tcp_hashinfo.ehash ***
            inet_csk_reqsk_queue_removed()   ← remove from SYN half-open queue
            inet_csk_reqsk_queue_add()       ← place on accept() backlog
```

By the time the application calls `accept()`, the `struct sock` is **already in the hash table**. `accept()` just dequeues it from the backlog and returns a file descriptor — it does not modify the hash table at all.

**Client-side path:**

```c
tcp_v4_connect()
  → inet_hash_connect()
    → __inet_hash_connect()
      → inet_ehash_nolisten()   // ← inserted BEFORE the SYN is sent
```

The client side is inserted even earlier — before the SYN goes out — so that the incoming SYN-ACK can be routed back to the correct socket.

#### `inet_ehash_insert()` — How the 4-Tuple Becomes Searchable

```c
bool inet_ehash_insert(struct sock *sk, struct sock *osk, bool *found_dup_sk)
{
    struct inet_hashinfo *hashinfo = sk->sk_prot->h.hashinfo;
    struct inet_ehash_bucket *head;
    spinlock_t *lock;

    sk->sk_hash = sk_ehashfn(sk);           // hash the 4-tuple into a bucket index
    head = inet_ehash_bucket(hashinfo, sk->sk_hash);
    lock = inet_ehash_lockp(hashinfo, sk->sk_hash);

    spin_lock(lock);
    hlist_nulls_add_head_rcu(&sk->sk_nulls_node, &head->chain);
    spin_unlock(lock);
    ...
}
```

When a packet later arrives and `tcp_v4_rcv` calls `__inet_lookup_skb`, it hashes the packet's 4-tuple identically and walks that same bucket,  typically in $O(1)$, to find the match.

#### Removal — `close()` calls `inet_unhash()`

When `close(conn_fd)` is called the kernel  ***removes*** the socket from the hash table, but not immediately at the `close()` call. It happens when the TCP state machine transitions to `TCP_CLOSE`:

```text
close(conn_fd)
  → __close_fd() → fput() → sock_close() → inet_release()
      → tcp_close()
          flush unsent data, send FIN
          tcp_set_state(sk, TCP_CLOSE)     ← transitions to CLOSED state
            inet_unhash(sk)
              __inet_unhash(sk)
                hlist_nulls_del_init_rcu(&sk->sk_nulls_node)
                                           ← *** REMOVED from tcp_hashinfo.ehash ***
```

After `inet_unhash()` returns, no arriving packet with that 4-tuple can be routed to this socket. Any late-arriving packets hit the `goto no_tcp_socket` path in `tcp_v4_rcv` and  trigger an  RST reply, where RST means ***Reset*** (a control flag in the TCP header used to abruptly terminate a connection).

<item>

**TIME_WAIT.** The socket is not removed from the table at the instance `close()` is called, the removal happens after the FIN-ACK exchange completes and any queued data is flushed. Furthermore, after the socket itself is freed, a lightweight `tcp_timewait_sock` takes its place in `tcp_hashinfo.ehash` for **2×MSL seconds** (typically 60 s on Linux). This `TIME_WAIT` entry absorbs any late duplicate packets that arrive after the connection is logically closed, preventing them from being misdelivered to a future connection that reuses the same 4-tuple.

</item>

#### Summary

| Event | Hash table operation | Called by |
|---|---|---|
| Client calls `connect()` | `inet_ehash_insert()` | `__inet_hash_connect()` |
| Server receives final ACK | `inet_ehash_insert()` | `inet_csk_complete_hashdance()` |
| `accept()` in user space | **none** | — |
| `recvfrom()` in user space | **none** | — |
| `close()` → `TCP_CLOSE` | `inet_unhash()` | `tcp_close()` → `tcp_set_state()` |
| 2×MSL timer fires | Remove `TIME_WAIT` entry | `tcp_time_wait_kill()` |

### Blocking IO

#### Flow for BIO


For simple commands in linux networking in C such as  `int sk = socket(AF_INET, SOCK_STREAM, 0)`, `bind`, `accept`, `listen`, etc, both the ***user process*** and the ***kernel*** perform a considerably significant amount of work together. 

First, the user process issues a command to create a socket, which causes a switch to kernel mode where the kernel initializes the necessary kernel objects.

When receiving network packets in Linux, the handling is performed by hardware interrupts and the `ksoftirqd` thread. After `ksoftirqd` finishes processing the packet, it notifies the relevant user process.

From 
> The moment a socket is created 

to

> When a network packet arrives at the NIC and its data is finally read by the user process

The overall workflow of synchronous blocking I/O follows the sequence illustrated in the diagram below:

![](/assets/img/2026-03-17-03-13-36.png)

#### `recvfrom()` Execution Path

After a socket is created and a connection is established, ***either*** via `connect()` on the client side or `accept()` on the server side, the user process calls `recvfrom()` to read incoming data:

```c
int server_fd = socket(AF_INET, SOCK_STREAM, 0);
bind(server_fd, ...);
listen(server_fd, backlog);

int conn_fd = accept(server_fd, ...); // new socket for this incoming client

char buf[1024];
recvfrom(conn_fd, buf, sizeof(buf), 0, NULL, NULL); // blocks here
```

<item bar>

**Remark.** `recvfrom()` is called on the ***connected*** socket (`conn_fd`), not the listening one. The listening socket (`server_fd`) has no TCP connection state — its only job is to accept new clients. It has no `sk_receive_queue` carrying application data.

</item>

When a client connects, the kernel creates a new `struct sock` for that specific client connection with its own TCP state machine, its own sequence numbers, and its own `sk_receive_queue`. 

`accept()` returns `conn_fd`, which is an integer file descriptor that indirectly reaches this `struct sock` through the chain: `fd` → `struct file` → `struct socket` → `struct sock` → `sk_receive_queue`.


 Note that both `accept()` and `recvfrom()` are blocking calls, but they block for different reasons:

| Call | Blocks waiting for |
|---|---|
| `accept()` | a client to complete the TCP three-way handshake |
| `recvfrom()` | data to arrive on an already-established connection |



##### System Call Entry

Let's look at the underlying implementation that the `recv` function relies on. First, by tracing with the `strace` command, we can see that the C library function `recv` executes the `recvfrom` system call.

After entering the system call, the user process enters ***kernel mode*** and executes a series of kernel protocol layer functions. 

It then checks the receive queue of the socket object (`sk->sk_receive_queue`) to see if there is any data; if not, it adds itself to the wait queue corresponding to the socket. 

Finally, it yields the CPU, and the operating system will select the next process in the ready state to execute. The entire process is shown in the following figure:

![](/assets/img/2026-03-16-04-54-42.png)



```c
SYSCALL_DEFINE6(recvfrom, int, fd,
                void __user *, ubuf,
                size_t, size,
                unsigned int, flags,
                struct sockaddr __user *, addr,
                int __user *, addr_len)
{
    struct socket *sock;
    int err, fput_needed;

    sock = sockfd_lookup_light(fd, &err, &fput_needed);
    ...
    err = sock_recvmsg(sock, &msg, size, flags);
    ...
    return err;
}
```

##### Layered Dispatch

```c
int sock_recvmsg(struct socket *sock,
                 struct msghdr *msg,
                 int flags)
{
    int err = security_socket_recvmsg(sock, msg,
                                      msg->msg_iter.count, flags);
    return err ?: sock_recvmsg_nosec(sock, msg, flags);
}

static inline int sock_recvmsg_nosec(struct socket *sock,
                                     struct msghdr *msg,
                                     int flags)
{
    return sock->ops->recvmsg(sock, msg,
                              msg->msg_iter.count, flags);
}
```

<item bar>

**Remark.** `sock_recvmsg` first calls `security_socket_recvmsg()` — an LSM (Linux Security Module) hook that lets SELinux / AppArmor / etc. deny the call before any data is touched. 

The `_nosec` suffix on `sock_recvmsg_nosec` means "the security check has already been done; skip it". 

This two-step pattern appears throughout the kernel socket layer.

</item>



##### `inet_recvmsg()`


Earlier we have mentioned that `sock->ops` was bound to `inet_stream_ops` during `inet_create()`, and `inet_stream_ops.recvmsg = inet_recvmsg`. So `sock->ops->recvmsg` resolves to `inet_recvmsg`:

```c
int inet_recvmsg(struct socket *sock,
                 struct msghdr *msg,
                 size_t size, int flags)
{
    struct sock *sk = sock->sk;

    return sk->sk_prot->recvmsg(sk, msg, size,
                                flags & MSG_DONTWAIT,
                                flags & ~MSG_DONTWAIT,
                                &addr_len);
}
```

`sk->sk_prot` was bound to `tcp_prot` during `inet_create()` via 
- `sk_alloc(..., answer->prot, ...)` and
- `tcp_prot.recvmsg = tcp_recvmsg`

So `sk->sk_prot->recvmsg` resolves to `tcp_recvmsg`:

##### `tcp_recvmsg()` and `skb_queue_walk`: The Core Receive Logic {#recvmsg}


```c-1{11}
int tcp_recvmsg(struct sock *sk, struct msghdr *msg,
                size_t len, int nonblock,
                int flags, int *addr_len)
{
    int copied = 0;
    long timeo;

    timeo = sock_rcvtimeo(sk, nonblock);

    do {
        skb_queue_walk(&sk->sk_receive_queue, skb) {
            // copy data from each skb to user buffer
            copied += chunk;
        }

        if (copied >= target) {
            /* Have enough data — release lock briefly to drain backlog,
               then reacquire and continue the loop. */
            release_sock(sk);
            lock_sock(sk);
        } else {
            sk_wait_data(sk, &timeo);
        }

    } while (condition);

    return copied;
}
```


`skb_queue_walk` is a ***macro*** that expands to a `for` loop iterating over every `struct sk_buff` in `sk->sk_receive_queue`, which is a doubly-linked list:

```c
for (skb = sk->sk_receive_queue.next;
     skb != (struct sk_buff *)&sk->sk_receive_queue;
     skb = skb->next)
```

Each `sk_buff` holds a TCP segment's payload. Inside the loop body, 
```c
skb_copy_datagram_msg(skb, offset, msg, chunk)
``` 
copies the payload bytes from the kernel `skb` into the user-space buffer, and `copied += chunk` accumulates the total. The walk stops naturally when the queue is exhausted (the sentinel node is reached).

If `copied` has not yet reached `target` bytes at that point, the `else` branch calls `sk_wait_data` to block until more data arrives.

```text
sk->sk_receive_queue → [skb1] → [skb2] → [skb3] → (sentinel)
                         ↓         ↓        ↓
                   copy chunk  copy chunk  copy chunk  →  user buffer
```

<item bar>

**Remark (What is Sentinel?).** `sk_receive_queue` is a circular doubly-linked list where the queue head itself is the sentinel, a dummy node embedded in `struct sock` that carries no data. The walk stops when `skb` laps back and equals the head:

```c
for (skb = sk->sk_receive_queue.next;
     skb != (struct sk_buff *)&sk->sk_receive_queue;  // stop when lapped back
     skb = skb->next)
```

When the queue is empty, `head->next == head`, so the loop body never executes. This is the standard Linux `list_head` idiom used throughout the kernel.

</item>

##### What's Happening when Copying Data from the List of `skb`'s

There are several layers involved, and only the last one is a real CPU copy:

1. **NIC → DMA → kernel pages (no CPU copy).** The NIC writes packet bytes directly into kernel-allocated memory pages via DMA. No CPU is involved.

2. **Ring buffer descriptor → `sk_buff` (no CPU copy).** The NAPI/softIRQ driver wraps the ring buffer entry into an `sk_buff` by storing a pointer (`skb->data`) into those same DMA-written pages. No bytes are moved.

3. **IP/TCP header stripping (no CPU copy).** The IP/TCP layers strip headers by advancing the `skb->data` and enqueue the `sk_buff`  of the form 
    ```c
    [ Ethernet header | IP header | TCP header | payload bytes ... ] 
                                                ^ skb->data is now here
    ```
    into `sk->sk_receive_queue`.

    Note that by ***strip*** we simply mean doing pointer-arithmatics to ignore the consumed headers.

4. **`skb_copy_datagram_msg` → user buffer (actual CPU copy).** This is the only real copy. It reads from `skb->data` (ultimately pointing to the DMA pages) and writes across the kernel/user boundary into the user-space buffer.

    ```text
    NIC → DMA → [kernel pages] ← skb->data (pointer, no copy)
                                  ↓
                            sk_receive_queue   (pointer, no copy)
                                  ↓
                      skb_copy_datagram_msg → user buffer   ← real copy here
            (copy_to_user: validate ptr, handle page faults, CPU load+store)
    ```

##### Why CPU copy is Necessary in `skb_copy_datagram_msg`?

The kernel/user boundary is enforced by the CPU's MMU (Memory Management Unit). Every process's virtual address space is split into two halves:

1. Kernel Space (ring 0 only) and 
2. User Space (ring 3) 

The MMU marks kernel pages as supervisor-only:

```text
Virtual Address Space (x86-64 Linux)
┌─────────────────────────────┐  0xFFFFFFFFFFFFFFFF
│      kernel space           │  mapped into every process,
│      (ring 0 only)          │  but inaccessible from ring 3
├─────────────────────────────┤  0xFFFF800000000000
│      user space             │  process's own code, stack, heap
│      (ring 3)               │
└─────────────────────────────┘  0x0000000000000000
```

Because of this separation, a raw pointer to `skb->data` cannot be handed to user space, the process's page table has no mapping for that kernel address, so accessing it from ring 3 would immediately fault. 

The kernel equally cannot write to a user pointer without first validating it. `copy_to_user()` is the sanctioned path: it validates the destination pointer, handles any page faults safely, and physically copies bytes from the kernel page to the user page via CPU load/store instructions.

**This is why the `skb_copy_datagram_msg` → user-buffer step is the performance bottleneck** in classic socket receives — every byte must be touched by the CPU a second time. Zero-copy technologies (`MSG_ZEROCOPY`, `io_uring`, `splice`, kernel TLS, RDMA) exist specifically to eliminate or reduce this crossing.




#### What Happens If No Data?


##### `sk_wait_data`

When there is no data, from line 22 in the first code block of [#recvmsg] we are blocked by `sk_wait_data` to await for new incoming data. 

The definition of  `sk_wait_data` relies on the following macros:

First, under the `DEFINE_WAIT` macro, a wait queue entry wait is defined:

```c
// file: include/linux/wait.h
#define DEFINE_WAIT(name) DEFINE_WAIT_FUNC(name, autoremove_wake_function)
```

In this newly created wait queue entry:

1. The callback function `autoremove_wake_function` is registered (for what are being removed, see [#wake-up-path]), and 
2. The current process descriptor `current` is associated with its private member:
```c
#define DEFINE_WAIT_FUNC(name, function)        \
    wait_queue_t name = {                       \
        .private   = current,                   \
        .func      = function,                  \
        .task_list = LIST_HEAD_INIT((name).task_list), \
    }
```

Now `sk_wait_data` is defined as follows, in which we focus on `sk_sleep` first:


```c{5}
int sk_wait_data(struct sock *sk, long *timeo)
{
    DEFINE_WAIT(wait);

    prepare_to_wait(sk_sleep(sk),
                    &wait,
                    TASK_INTERRUPTIBLE);

    sk_wait_event(sk, timeo,
                  !skb_queue_empty(&sk->sk_receive_queue));

    finish_wait(sk_sleep(sk), &wait);

    return 0;
}
```




##### `sk_sleep`




In `sk_wait_data`, the function `sk_sleep` is called to obtain the wait queue ***head*** `wait_queue_head_t` under the `sock` object.

The source code of `sk_sleep` is as follows:

```c
// file: include/net/sock.h
static inline wait_queue_head_t *sk_sleep(struct sock *sk)
{
    BUILD_BUG_ON(offsetof(struct socket_wq, wait) != 0);
    return &rcu_dereference_raw(sk->sk_wq)->wait;
}
```

##### `prepare_to_wait()` — What Actually Happens

```c
void prepare_to_wait(struct wait_queue_head *wq_head, 
                     struct wait_queue_entry *wq_entry, int state)
{
    unsigned long flags;

    wq_entry->flags &= ~WQ_FLAG_EXCLUSIVE;
    spin_lock_irqsave(&wq_head->lock, flags);
    if (list_empty(&wq_entry->entry))
      __add_wait_queue(wq_head, wq_entry);
    set_current_state(state);
    spin_unlock_irqrestore(&wq_head->lock, flags);
}
```

This does two critical things:

1. Adds current process to the socket wait queue.
2. Changes process state to `TASK_INTERRUPTIBLE`.


##### `sk_wait_event`


`sk_wait_event` can expand roughly to:

```c
#define sk_wait_event(__sk, __timeo, __condition)       \
({                                                       \
    release_sock(__sk);          /* drop the lock   */   \
    if (!(__condition))                                  \
        *(__timeo) = schedule_timeout(*(__timeo));       \
                                 /* ^^^ calls schedule() internally */ \
    lock_sock(__sk);             /* reacquire lock  */   \
    __condition;                                         \
})
```

So the actual CPU yield happens at `schedule_timeout()` → `schedule()`. 

The process is removed from the run queue here. More precisely, `schedule()` sets `task_struct->state` to `TASK_INTERRUPTIBLE` (a ***flag***, not a physical removal) so the scheduler will skip it when selecting the next task to run. It remains suspended until `sock_def_readable()` wakes it up. 


<item bar>

**Remark (`schedule()` is Blocking).** When `schedule()` is called, the process is blocked from the caller's perspective, but the CPU is not. `schedule()` performs a context switch: it saves the current process's registers and stack pointer, then loads another task's. Execution of the current process is frozen at that instruction until `try_to_wake_up()` sets its state back to `TASK_RUNNING` and re-enqueues it. The CPU runs other tasks in the meantime. In short: `schedule()` blocks **the calling process**, never the CPU.

</item>

Note also that `release_sock` / `lock_sock` bracket the sleep — the socket lock is dropped while the process sleeps so incoming softIRQ work can enqueue `skb`s, then reacquired before checking the condition again.





#### Hardware → Kernel → Socket Queue: The SoftIRQ Receive Path

![](/assets/img/2026-03-16-04-47-33.png)


While the user process is asleep inside `schedule()`:

1. The NIC fires a hardware interrupt
2. The kernel's NAPI/softIRQ machinery processes the packet up through the IP layer
3. And then TCP takes over.

The entry point for every incoming IPv4 TCP segment is `tcp_v4_rcv`.

##### `tcp_v4_rcv` — Entry Point

```c
// net/ipv4/tcp_ipv4.c
int tcp_v4_rcv(struct sk_buff *skb)
{
    const struct iphdr  *iph = ip_hdr(skb);
    const struct tcphdr *th  = tcp_hdr(skb);
    struct sock *sk;

    // Look up the per-connection sock by 4-tuple:
    // (src_ip, src_port, dst_ip, dst_port)
    sk = __inet_lookup_skb(&tcp_hashinfo, skb,
                           th->source, th->dest);
    if (!sk)
        goto no_tcp_socket;

    // Hand off to the per-state handler
    return tcp_v4_do_rcv(sk, skb);
}
```

The hash table lookup `__inet_lookup_skb` finds the exact `struct sock` that `accept()` returned. This is how the kernel routes an arriving packet to the correct connection out of potentially thousands.

##### `tcp_v4_do_rcv` — Dispatch by Connection State

```c
// net/ipv4/tcp_ipv4.c
int tcp_v4_do_rcv(struct sock *sk, struct sk_buff *skb)
{
    if (sk->sk_state == TCP_ESTABLISHED) {
        // Fast path — connection is up, data is flowing
        if (tcp_rcv_established(sk, skb,
                                tcp_hdr(skb), skb->len) == 0)
            return 0;
        goto reset;
    }

    // Slow path — SYN_RECV, FIN_WAIT_2, CLOSE_WAIT, etc.
    if (tcp_rcv_state_process(sk, skb))
        goto reset;

    return 0;
}
```

For an already-established connection receiving payload data, the fast path `tcp_rcv_established` is taken.

##### `tcp_rcv_established` — Fast Path for In-Order Data

```c
// net/ipv4/tcp_input.c
int tcp_rcv_established(struct sock *sk, struct sk_buff *skb,
                        struct tcphdr *th, unsigned int len)
{
    struct tcp_sock *tp = tcp_sk(sk);

    // Fast path: segment arrives in order (no gaps)
    if (TCP_SKB_CB(skb)->seq == tp->rcv_nxt) {

        // Strip the TCP header, leaving only payload bytes
        __skb_pull(skb, th->doff * 4);

        // Advance the receive window sequence number
        tcp_rcv_nxt_update(tp, TCP_SKB_CB(skb)->end_seq);

        // Append skb to sk_receive_queue
        tcp_queue_rcv(sk, skb, 0, &fragstolen);

        // Wake up any process sleeping on this socket
        sk->sk_data_ready(sk, 0);   // → sock_def_readable
        return 0;
    }

    // Slow path: out-of-order, urgent data, etc.
    ...
}
```

Two things happen at the end:
1. `tcp_queue_rcv` pushes the `skb` onto the socket's receive queue.
2. `sk->sk_data_ready` (set to `sock_def_readable` during `sock_init_data`) wakes the sleeping process.

##### `tcp_queue_rcv` — Enqueue to `sk_receive_queue`

```c
// net/ipv4/tcp_input.c
static int __must_check tcp_queue_rcv(struct sock *sk, struct sk_buff *skb,
				      bool *fragstolen)
{
    int eaten;
    struct sk_buff *tail = skb_peek_tail(&sk->sk_receive_queue);

    eaten = (tail &&
        tcp_try_coalesce(sk, tail,
              skb, fragstolen)) ? 1 : 0;
    tcp_rcv_nxt_update(tcp_sk(sk), TCP_SKB_CB(skb)->end_seq);
    if (!eaten) {
        tcp_add_receive_queue(sk, skb);
        skb_set_owner_r(skb, sk);
    }
    return eaten;
}
```

After this returns, `sk->sk_receive_queue` is no longer empty — the `skb_queue_walk` loop in `tcp_recvmsg` will find data on its next iteration.

```text
NIC IRQ → NAPI poll → ip_rcv() → tcp_v4_rcv()
                                       │
                               __inet_lookup_skb()    ← find the right sock
                                       │
                               tcp_v4_do_rcv()
                                       │  (TCP_ESTABLISHED fast path)
                               tcp_rcv_established()
                                       │
                               tcp_queue_rcv()         ← skb appended to sk_receive_queue
                                       │
                               sk->sk_data_ready()     → sock_def_readable()
                                       │
                               wake_up_interruptible() ← sleeping process unblocked
```

#### Wake-Up Path {#wake-up-path}

Because `sock_init_data()` set `sk->sk_data_ready = sock_def_readable`, when data is queued:

```c
void sock_def_readable(struct sock *sk)
{
    struct socket_wq *wq;

    trace_sk_data_ready(sk);

    rcu_read_lock();
    wq = rcu_dereference(sk->sk_wq);
    // if any sleeping process has been registered in the wait queue of this socket
    if (skwq_has_sleeper(wq))
        // wake this process up
        wake_up_interruptible_sync_poll(&wq->wait, EPOLLIN | EPOLLPRI |
                EPOLLRDNORM | EPOLLRDBAND);
    sk_wake_async_rcu(sk, SOCK_WAKE_WAITD, POLL_IN);
    rcu_read_unlock();
}
```

Internally, `wake_up_interruptible_sync_poll` expands through three layers:

```c
// include/linux/wait.h
#define wake_up_interruptible_sync_poll(x, m)					\
	__wake_up_sync_key((x), TASK_INTERRUPTIBLE, poll_to_key(m))

// kernel/sched/wait.c
void __wake_up_sync_key(struct wait_queue_head *wq_head, unsigned int mode,
                        void *key)
{
    if (unlikely(!wq_head))
        return;

    __wake_up_common_lock(wq_head, mode, 1, WF_SYNC, key);
}
```

`__wake_up_common_lock` acquires the wait queue `spinlock` and delegates to `__wake_up_common`:

```c
// kernel/sched/wait.c
static int __wake_up_common_lock(struct wait_queue_head *wq_head, unsigned int mode,
                                 int nr_exclusive, int wake_flags, void *key)
{
    unsigned long flags;
    int remaining;

    spin_lock_irqsave(&wq_head->lock, flags);
    remaining = __wake_up_common(wq_head, mode, nr_exclusive,
                                 wake_flags, key);
    spin_unlock_irqrestore(&wq_head->lock, flags);

    return nr_exclusive - remaining;  // number of waiters actually woken
}
```

`__wake_up_common` is where the actual traversal and per-entry wake happens:

```c
// kernel/sched/wait.c
static int __wake_up_common(struct wait_queue_head *wq_head, unsigned int mode,
                            int nr_exclusive, int wake_flags, void *key)
{
    wait_queue_entry_t *curr, *next;

    lockdep_assert_held(&wq_head->lock);

    curr = list_first_entry(&wq_head->head, wait_queue_entry_t, entry);

    if (&curr->entry == &wq_head->head)
        return nr_exclusive;   // queue is empty, nothing to wake

    list_for_each_entry_safe_from(curr, next, &wq_head->head, entry) {
        unsigned flags = curr->flags;
        int ret;

        ret = curr->func(curr, mode, wake_flags, key);
                // ^^^ calls autoremove_wake_function for our process
        if (ret < 0)
            break;   // error, stop
        if (ret && (flags & WQ_FLAG_EXCLUSIVE) && !--nr_exclusive)
            break;   // woken nr_exclusive exclusive waiters, stop
    }

    return nr_exclusive;  // remaining exclusive wakes still needed (0 = done)
}
```

`nr_exclusive = 1` was passed from `__wake_up_sync_key`, so the loop stops after the first successfully woken exclusive waiter — exactly one sleeping `recvfrom()` caller is woken per data-ready event.

`curr->func` is `autoremove_wake_function` — the callback registered by `DEFINE_WAIT` — which does three things in sequence:

1. **Removes** the wait queue entry from the list (the "autoremove" part), so the process won't be woken again.
2. Calls `try_to_wake_up()`, which:
   - Sets `task_struct->state` back to `TASK_RUNNING`.
   - Selects an appropriate CPU run queue and **enqueues** the task onto it.
3. Returns `1`, which satisfies the `WQ_FLAG_EXCLUSIVE` break condition above, stopping the walk.

The process is now on a run queue but **not yet executing** — the softIRQ context that called `sock_def_readable` is still running. 

Since `wake_up_interruptible_sync_poll` uses the `_sync` variant, it explicitly **defers the reschedule**: it sets a `TIF_NEED_RESCHED` flag on the target CPU instead of triggering an immediate context switch. The scheduler will perform the actual switch once the softIRQ exits and the CPU returns to the normal kernel/user preemption point.



#### Process Resumes

When the softIRQ exits, the CPU checks `TIF_NEED_RESCHED` and calls `schedule()`. The scheduler picks our process off the run queue and resumes it — execution continues from exactly where it left off inside `schedule_timeout()` → `schedule()`, unwinding back up through `sk_wait_event`.

`lock_sock(sk)` reacquires the socket lock, then `sk_wait_event` re-evaluates the condition `!skb_queue_empty(&sk->sk_receive_queue)` — which is now `true` since `tcp_queue_rcv` already enqueued the `skb`. The condition is satisfied, so `sk_wait_data` falls through to `finish_wait`:

```c
finish_wait(sk_sleep(sk), &wait);
```

`finish_wait` sets the process state back to `TASK_RUNNING` (in case it was woken by a signal rather than autoremove) and removes the wait queue entry if it wasn't already removed by `autoremove_wake_function`.

Control returns to the `do { } while` loop in `tcp_recvmsg`. This time `skb_queue_walk` finds data in `sk_receive_queue`, `skb_copy_datagram_msg` copies the payload across the kernel/user boundary via `copy_to_user`, and `recvfrom()` eventually returns the byte count to user space.

### Full End-to-End Flow

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PHASE 1 — USER SPACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  recvfrom(conn_fd, buf, ...)
      │
      ▼ syscall
  SYSCALL_DEFINE6(recvfrom)
    └─► sock_recvmsg()
          └─► inet_recvmsg()          [inet_stream_ops.recvmsg]
                └─► tcp_recvmsg()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PHASE 2 — FIRST PASS: QUEUE EMPTY, PROCESS SLEEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  tcp_recvmsg() do { } while loop
    skb_queue_walk(&sk->sk_receive_queue)  ← empty, nothing to copy
        │
        ▼
    sk_wait_data(sk, &timeo, skb)
      DEFINE_WAIT(wait)                    ← allocates wait_queue_entry_t
                                             with func = autoremove_wake_function
      prepare_to_wait(sk_sleep(sk), &wait,
                      TASK_INTERRUPTIBLE)  ← registers entry in wq_head->head list
                                             sets task state = TASK_INTERRUPTIBLE
      sk_wait_event(sk, &timeo, ...)
        schedule_timeout(timeo)            ← calls schedule()
          schedule()                       ← removes task from run queue
                                           ← PROCESS NOW SLEEPING

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PHASE 3 — HARDWARE / SOFTIRQ (runs on a different CPU or
             after the sleeping CPU's next IRQ)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  NIC receives Ethernet frame → DMA into ring buffer
  NIC raises hardware interrupt → IRQ handler schedules NET_RX softIRQ
  NET_RX softIRQ fires:
    tcp_v4_rcv()
      __inet_lookup_skb()                  ← finds struct sock by 4-tuple
      tcp_v4_do_rcv()
        tcp_rcv_established()              ← fast path: in-order, seq matches
          tcp_queue_rcv()
            tcp_try_coalesce()             ← try to merge into tail skb
            tcp_add_receive_queue(sk, skb) ← enqueues skb into sk_receive_queue
          sk->sk_data_ready(sk)            ← = sock_def_readable (set by sock_init_data)
            wake_up_interruptible_sync_poll(&wq->wait, EPOLLIN|...)
              __wake_up_sync_key(wq, TASK_INTERRUPTIBLE, key)
                __wake_up_common_lock()    ← acquires wq spinlock
                  __wake_up_common()       ← walks wait queue list
                    curr->func(...)        ← = autoremove_wake_function
                      list_del(&wait->entry)     ← removes from wait queue
                      try_to_wake_up(task)        ← state = TASK_RUNNING
                                                     enqueues onto run queue
                      return 1            ← nr_exclusive satisfied; loop stops
                                           ← PROCESS ON RUN QUEUE, NOT YET RUNNING
                                           ← _sync: sets TIF_NEED_RESCHED,
                                              defers context switch

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PHASE 4 — SCHEDULER RESUMES THE PROCESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  softIRQ exits
  CPU checks TIF_NEED_RESCHED at return-to-kernel preemption point
  schedule() → context switch → our process is now RUNNING
  Resumes inside schedule() → schedule_timeout() → sk_wait_event
    lock_sock(sk)                          ← reacquires socket lock
    re-evaluates !skb_queue_empty(...)     ← now TRUE
    falls through to finish_wait()
      list_del_init(&wait->entry)          ← no-op if autoremove already did it
      __set_current_state(TASK_RUNNING)    ← ensure state is correct

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PHASE 5 — SECOND PASS: DATA PRESENT, COPY TO USER SPACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  tcp_recvmsg() do { } while loop (second iteration)
    skb_queue_walk(&sk->sk_receive_queue)  ← finds enqueued skb
      skb_copy_datagram_msg()              ← copy_to_user into application buf
  recvfrom() returns byte count to user space
```

### Application: HTTP vs WebSocket at the Kernel Level

The entire mechanism discussed in this article is **identical** for both HTTP and WebSocket connections. Both are plain TCP streams. At the kernel level, there is no "HTTP socket" or "WebSocket socket" — there is only `AF_INET, SOCK_STREAM`, and the four concepts covered in this article: socket creation, the blocking receive path, the SoftIRQ enqueue path, and the wake-up path.

The difference between the two protocols is entirely in **what user space does after `recvfrom()` returns**.
#### Comparison
##### HTTP (Short-Lived Connections)

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



##### WebSocket (Long-Lived Connections)

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

##### Summary Table

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

#### Terminate a WebSocket Connection

A WebSocket connection can end in three ways, at decreasing levels of protocol cleanliness.

##### Clean close — WS CLOSE handshake (RFC 6455 §5.5.1)

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

##### TCP FIN — half-close without WS CLOSE

If the remote peer calls `close(fd)` without first sending a WS CLOSE frame, the kernel sends a TCP FIN. The local `recvfrom()` returns `0` (EOF). The WebSocket library treats this as an abnormal close and surfaces it as an error event.

##### TCP RST — abrupt termination

If the peer process crashes, the machine loses power, or a middlebox forcibly drops the connection, a TCP RST is delivered. `recvfrom()` returns `-1` with `errno = ECONNRESET`. No CLOSE frame exchange is possible, and any in-flight data is lost.

| Termination mode | How `recvfrom()` signals it | CLOSE frame exchanged? |
|---|---|---|
| WS CLOSE handshake | Returns the CLOSE frame bytes, then `0` on next call | Yes |
| TCP FIN (no WS CLOSE) | Returns `0` (EOF) | No |
| TCP RST | Returns `-1`, `errno = ECONNRESET` | No |

#### The Browser Is Just Another C Program

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

#### The `ws://` Scheme Never Reaches the Server

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

#### JavaScript ↔ Kernel Correspondence

| JavaScript / Browser API | Chromium C++ internal | Kernel system call |
|---|---|---|
| `new WebSocket("ws://...")` | `socket()` + `connect()` | `sys_socket` + `sys_connect` |
| `new WebSocket("wss://...")` | `socket()` + `connect()` + `SSL_connect()` | `sys_socket` + `sys_connect` + `sys_send`/`sys_recv` for TLS handshake |
| `ws.send(data)` | `send()` / `SSL_write()` | `sys_sendto` → `tcp_sendmsg` |
| `ws.onmessage` callback fires | `recv()` loop in network thread | `sys_recvfrom` → `tcp_recvmsg` → `copy_to_user` |
| `ws.close()` | `close(fd)` | `sys_close` → `tcp_close` → `inet_unhash()` |
| `fetch("http://...")` | `socket()` + `connect()` + `send()` + `recv()` | identical to above |

At the OS boundary, a Chrome tab doing `fetch()` and a C program doing `connect()` + `send()` + `recv()` are indistinguishable. The kernel sees the same system calls either way.



