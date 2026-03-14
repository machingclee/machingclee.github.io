---
title: "(WIP) Networking in Linux Kernel: Part III, How Socket Receive Data from NIC"
date: 2026-03-15
id: blog0473
tag: linux, C, networking
toc: true
intro: "This time we study how data is received by the socket after the process of soft interrupt."
indent: true
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

![](/assets/img/2026-03-15-03-16-22.png)

### Socket Creation — How TCP Gets Bound to the Socket

From user space:

```c
int fd = socket(AF_INET, SOCK_STREAM, 0);
```

#### System Call Entry

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

**Remark.** In linux kernel whenever a function is prefixed by `__`, then certain kinds of invariants have been computed/maintained before the exectution of this function.

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

Each pointer slot is populated at boot time by `inet_init()` (invoked via `fs_initcall(inet_init)`), as discussed in [initialising-the-protocol-stack](/blog/article/Networking-in-Linux-Kernel-Part-I-Hard-Interrupt#5.-initialising-the-protocol-stack-—-inet_init) when discussing hard interrupt. Among other things it registers the `AF_INET` address family with the socket layer via 
```c
sock_register(&inet_family_ops)
```
writing the pointer `&inet_family_ops` into `net_families[AF_INET]`. 

- `inet_family_ops` will be discussed in [#inet_family_ops] right below
- The meaning of `rcu` is deferred to [#rcu]. Right now we consider `rcu_dereference` simply as a dereference from a pointer.



##### On `inet_family_ops` {#inet_family_ops}



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

```c
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

#### Protocol Operation Tables

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

#### `sock_init_data()` — Critical Initialization

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

---

### `recvfrom()` Execution Path

#### System Call Entry

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

    err = sock_recvmsg(sock, &msg, size, flags);

    return err;
}
```

#### Layered Dispatch

```c
int sock_recvmsg(struct socket *sock,
                 struct msghdr *msg,
                 size_t size, int flags)
{
    return sock->ops->recvmsg(sock, msg, size, flags);
}
```

For TCP:

```text
sock->ops->recvmsg    → inet_recvmsg
sk->sk_prot->recvmsg  → tcp_recvmsg
```

#### `inet_recvmsg()`

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

---

### `tcp_recvmsg()` — The Core Receive Logic

```c
int tcp_recvmsg(struct sock *sk, struct msghdr *msg,
                size_t len, int nonblock,
                int flags, int *addr_len)
{
    int copied = 0;
    long timeo;

    timeo = sock_rcvtimeo(sk, nonblock);

    do {
        skb_queue_walk(&sk->sk_receive_queue, skb) {
            // copy data from skb to user buffer
            copied += chunk;
        }

        if (copied >= target)
            break;

        if (copied == 0)
            sk_wait_data(sk, &timeo);

    } while (condition);

    return copied;
}
```

---

### What Happens If No Data?

We enter:

```c
sk_wait_data(sk, &timeo);
```

#### Blocking Implementation

```c
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

---

### `prepare_to_wait()` — What Actually Happens

```c
void prepare_to_wait(wait_queue_head_t *q,
                     wait_queue_entry_t *wait,
                     int state)
{
    spin_lock_irqsave(&q->lock, flags);

    if (list_empty(&wait->entry))
        __add_wait_queue(q, wait);

    set_current_state(state);

    spin_unlock_irqrestore(&q->lock, flags);
}
```

This does two critical things:

1. Adds current process to the socket wait queue.
2. Changes process state to `TASK_INTERRUPTIBLE`.

Then `schedule()` is called and the process sleeps — the CPU switches to another task.

---

### Hardware → Kernel → Socket Queue

While the process sleeps:

1. Packet arrives at NIC.
2. NIC performs DMA to kernel ring buffer.
3. Hardware interrupt fires.
4. SoftIRQ (`ksoftirqd`) runs.
5. Ethernet → IP → TCP processing.
6. TCP places `skb` into `sk->sk_receive_queue`.

---

### Wake-Up Path

Because `sock_init_data()` set `sk->sk_data_ready = sock_def_readable`, when data is queued:

```c
static void sock_def_readable(struct sock *sk)
{
    struct socket_wq *wq;

    rcu_read_lock();
    wq = rcu_dereference(sk->sk_wq);

    if (wq && waitqueue_active(&wq->wait))
        wake_up_interruptible_sync_poll(&wq->wait,
                                        POLLIN | POLLRDNORM);

    rcu_read_unlock();
}
```

This triggers:

- Wait queue traversal.
- Wake callback execution.
- Process state → `TASK_RUNNING`.
- Task reinserted into run queue.

---

### Process Resumes

Control returns to `schedule()`, then:

```c
finish_wait(sk_sleep(sk), &wait);
```

The loop continues inside `tcp_recvmsg()`. Now `skb_queue_walk(&sk->sk_receive_queue, skb)` finds data, copies it to the user buffer, and `recvfrom()` returns.

---

### Full End-to-End Flow

```text
User:
    recvfrom()

Kernel:
    SYSCALL_DEFINE6(recvfrom)
        sockfd_lookup_light()
        sock_recvmsg()

Dispatch:
    sock->ops->recvmsg  → inet_recvmsg
    sk->sk_prot->recvmsg → tcp_recvmsg

tcp_recvmsg:
    skb_queue_walk()

    IF empty:
        sk_wait_data()
            DEFINE_WAIT
            prepare_to_wait()
            schedule()

Hardware:
    NIC → DMA → IRQ → SoftIRQ
    TCP processing
    skb added to sk_receive_queue
    sock_def_readable()
    wake_up_interruptible()

Scheduler:
    Process becomes TASK_RUNNING
    schedule() returns

tcp_recvmsg:
    skb_queue_walk()
    copy_to_user()

Return to user.
```

