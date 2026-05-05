const n=`---
title: "Networking in Linux Kernel: Part IX, Deep Dive of \`connect\`"
date: 2026-04-21
id: blog0486
tag: linux, C, networking
toc: true
intro: "Study networking on the process of TCP Connect"
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table td:first-child, table th:first-child {
    min-width: 120px;
  }
</style>

### Overview of \`connect\`

In client side, after we create a socket, we connect to a remote backend via:

\`\`\`c
int main(){
    fd = socket(AF_INET, SOCK_STREAM, 0);
    connect(fd, ...);
    ......
}
\`\`\`

There are many technical details behind this single call. We have discussed how a socket object is created, but in userspace we only hold the file descriptor \`fd\` as an integer. 

In the Linux kernel it is a combination of multiple objects — \`file\`, \`socket\`, \`sock\`, etc. — each with an \`ops\` function pointer set attached. The socket data structure looks like this:

![](/assets/img/2026-04-21-02-25-34.png)

### The Syscall Entry

When \`connect\` is invoked on the client side, the following system call in the Linux kernel is executed:

\`\`\`c
SYSCALL_DEFINE3(connect, int, fd, struct sockaddr __user *, uservaddr,
                int, addrlen)
{
    struct socket *sock;

    //根据用户fd查找内核中的socket对象
    sock = sockfd_lookup_light(fd, &err, &fput_needed);

    //进行connect
    err = sock->ops->connect(sock, (struct sockaddr *)&address, addrlen,
                            sock->file->f_flags);
    ......                          
}
\`\`\`

\`sockfd_lookup_light\` resolves the integer \`fd\` into the kernel \`socket\` object. 

### From \`inet_stream_connect\` to \`tcp_v4_connect\`

Since \`sock\` is of type \`AF_INET\`, \`sock->ops->connect\` points to \`inet_stream_connect\`:

\`\`\`c
int inet_stream_connect(struct socket *sock, ...)
{
    ...
    __inet_stream_connect(sock, uaddr, addr_len, flags);
}

int __inet_stream_connect(struct socket *sock, ...)
{
    struct sock *sk = sock->sk;

    switch (sock->state) {
    case SS_UNCONNECTED:
        err = sk->sk_prot->connect(sk, uaddr, addr_len);
        sock->state = SS_CONNECTING;
        break;
    }
    ...
}
\`\`\`

A freshly created socket is in state \`SS_UNCONNECTED\`. 

Inside the switch block, \`sk->sk_prot->connect\` points to \`tcp_v4_connect\`:

\`\`\`c
int tcp_v4_connect(struct sock *sk, struct sockaddr *uaddr, int addr_len)
{
    //设置 socket 状态为TCP_SYN_SENT
    tcp_set_state(sk, TCP_SYN_SENT);

    //动态选择一个端口
    err = inet_hash_connect(&tcp_death_row, sk);

    //函数用来根据sk中的信息，构建一个syn报文，并将它发送出去。
    err = tcp_connect(sk);
}
\`\`\`

The socket state is immediately promoted to \`TCP_SYN_SENT\`. After that, \`inet_hash_connect\` selects an available local port, and \`tcp_connect\` builds and transmits the SYN packet.

### Ephemeral Port Selection: \`inet_hash_connect\`

\`\`\`c
int inet_hash_connect(struct inet_timewait_death_row *death_row,
                      struct sock *sk)
{
    return __inet_hash_connect(death_row, sk,
                              inet_sk_port_offset(sk),
                              __inet_check_established,
                              __inet_hash_nolisten);
}
\`\`\`

\`inet_sk_port_offset(sk)\` computes a pseudo-random starting offset by hashing the 4-tuple \`(src IP, dst IP, dst port, net namespace)\` against a per-boot random secret. This means the port search begins at a different position on every \`connect()\` call, providing port randomization as a security measure.

\`__inet_check_established\` is passed as the collision-check callback. It verifies that the candidate port does not produce a duplicate 4-tuple in the established connections table.

### Inside \`__inet_hash_connect\`: Scanning the Port Range

\`\`\`c
int __inet_hash_connect(...)
{
    //是否绑定过端口
    const unsigned short snum = inet_sk(sk)->inet_num;

    //获取本地端口范围
    inet_get_local_port_range(&low, &high);
    remaining = (high - low) + 1;

    if (!snum) {
        //遍历查找
        for (i = 1; i <= remaining; i++) {
            port = low + (i + offset) % remaining;
            ...
        }
    }
}
\`\`\`

If \`snum\` is zero the socket has not been \`bind()\`-ed manually, so the kernel must pick a port from the ephemeral range. \`inet_get_local_port_range\` reads \`net.ipv4.ip_local_port_range\` — defaults to 32768–60999 on most Linux systems.

<Example>

**Remark.** If we call \`bind()\` before \`connect()\` on the client side, \`inet_sk(sk)->inet_num\` will already hold the bound port number, so \`snum\` is non-zero and the kernel skips the entire port-search loop — it simply uses whatever port we specified.

This is almost never desirable in client code: it prevents us from opening more than one simultaneous connection to the same remote endpoint, and it can collide with ports already in use. \`bind()\` before \`connect()\` is a server-side pattern for pinning a well-known port. In client code, we should leave it out and let the kernel handle ephemeral port selection.

</Example>

Starting from \`offset\`, the loop tries every port in a circular fashion until an available one is found. The port availability check is:

\`\`\`c
int __inet_hash_connect(...)
{
    for (i = 1; i <= remaining; i++) {
        port = low + (i + offset) % remaining;

        //查看是否是保留端口，是则跳过
        if (inet_is_reserved_local_port(port))
            continue;

        //查找和遍历已经使用的端口的哈希链表
        head = &hinfo->bhash[inet_bhashfn(net, port,
                                          hinfo->bhash_size)];
        inet_bind_bucket_for_each(tb, &head->chain) {

            //如果端口已经被使用
            if (net_eq(ib_net(tb), net) &&
                tb->port == port) {

                //通过 check_established 继续检查是否可用
                if (!check_established(death_row, sk,
                                      port, &tw))
                    goto ok;
            }
        }

        //未使用的话
        tb = inet_bind_bucket_create(hinfo->bind_bucket_cachep, ...);
        ......
        goto ok;
    }

    return -EADDRNOTAVAIL;

ok:
    ......
}
\`\`\`

\`inet_is_reserved_local_port\` skips any port listed in \`net.ipv4.ip_local_reserved_ports\`. We can add application ports there to prevent the kernel from accidentally picking them as ephemeral ports.

\`hinfo->bhash\` is a hash map recording all ports currently bound to a socket. A port absent from \`bhash\` is unconditionally available — \`inet_bind_bucket_create\` registers it and the loop exits via \`goto ok\`.

If a port is already in \`bhash\`, the loop does not give up immediately — it delegates to \`check_established\` to determine whether the port can be safely reused (see the next section).

If no port is available after exhausting the entire range, \`-EADDRNOTAVAIL\` is returned to userspace as:
\`\`\`
Cannot assign requested address
\`\`\`
When we encounter this error in production, the first thing to check is whether \`net.ipv4.ip_local_port_range\` is wide enough for our connection volume.

\`\`\`c
#define       EADDRNOTAVAIL   99
\`\`\`

### Port Reuse and the 4-Tuple Uniqueness Rule

When a port is already in \`bhash\`, \`check_established\` (which resolves to \`__inet_check_established\`) is called:

\`\`\`c
static int __inet_check_established(struct inet_timewait_death_row *death_row,
                                    struct sock *sk, __u16 lport,
                                    struct inet_timewait_sock **twp)
{
    //找到哈希桶
    struct inet_ehash_bucket *head =
        inet_ehash_bucket(hinfo, hash);

    //遍历看看有没有四元组一样的，一样的话就报错
    sk_nulls_for_each(sk2, node, &head->chain) {
        if (sk2->sk_hash != hash)
            continue;

        if (likely(INET_MATCH(sk2, net, acookie,
                              saddr, daddr, ports, dif)))
            goto not_unique;
    }

unique:
    //要用了，记录，返回 0（成功）
    return 0;

not_unique:
    return -EADDRNOTAVAIL;
}
\`\`\`

\`inet_ehash_bucket\` is the hash table of all sockets currently in \`ESTABLISHED\` or \`SYN_SENT\` state. For each bucket entry, \`INET_MATCH\` compares the full 4-tuple:

\`\`\`c
#define INET_MATCH(__sk, __net, __cookie, __saddr, __daddr, __ports, __dif) \\
    (inet_sk(__sk)->inet_portpair == (__ports) && \\
    (inet_sk(__sk)->inet_daddr    == (__saddr)) && \\
    (inet_sk(__sk)->inet_rcv_saddr == (__daddr)) && \\
    (!(__sk)->sk_bound_dev_if || \\
    ((__sk)->sk_bound_dev_if == (__dif)) && \\
      net_eq(sock_net(__sk), (__net))))
\`\`\`

The 4-tuple checked is \`(local IP, local port, remote IP, remote port)\`. A port is ***reusable*** as long as no existing connection shares the exact same 4-tuple. This is why the same local port can legitimately back multiple simultaneous connections — each goes to a different remote IP or remote port, making every 4-tuple globally unique.

### Why One Machine Can Have Far More Than 65535 Connections

The common misconception is that port numbers cap us at 65535 connections. In reality TCP uniqueness is governed by the full 4-tuple, not just the local port alone:

\`\`\`text
(local IP : local port, remote IP : remote port)
\`\`\`

If we connect to N different servers, each local port can be reused once per distinct remote endpoint. With a port range of ~28000 ports and connections spread across many remote IPs and ports, one machine can sustain hundreds of thousands or even millions of simultaneous outgoing connections — the limit is memory and CPU, not the port number space.

### Building and Sending the SYN: \`tcp_connect\`

Once \`inet_hash_connect\` returns a valid port, \`tcp_v4_connect\` calls \`tcp_connect\`:

\`\`\`c
int tcp_connect(struct sock *sk)
{
    //申请并设置skb
    buff = alloc_skb_fclone(MAX_TCP_HEADER + 15, sk->sk_allocation);
    tcp_init_nondata_skb(buff, tp->write_seq++, TCPHDR_SYN);

    //添加到发送队列sk_write_queue
    tcp_connect_queue_skb(sk, buff);

    //实际发出syn
    err = tp->fastopen_req ? tcp_send_syn_data(sk, buff) :
                       tcp_transmit_skb(sk, buff, 1, sk->sk_allocation);

    //启动重传定时器
    inet_csk_reset_xmit_timer(sk, ICSK_TIME_RETRANS,
                              inet_csk(sk)->icsk_rto, TCP_RTO_MAX);
}
\`\`\`

\`tcp_connect\` performs four things in sequence:

- Allocates an \`skb\` and initialises it as a SYN segment.
- Enqueues it onto \`sk_write_queue\`.
- Calls \`tcp_transmit_skb\` to pass it down the network stack and out the NIC.
- Arms the retransmit timer so the SYN is resent if no SYN-ACK arrives in time.

### The Retransmit Timer

\`\`\`c
void tcp_connect_init(struct sock *sk)
{
    //初始化为TCP_TIMEOUT_INIT
    inet_csk(sk)->icsk_rto = TCP_TIMEOUT_INIT;
    ......
}
\`\`\`

\`\`\`c
#define TCP_TIMEOUT_INIT ((unsigned)(1*HZ))
\`\`\`

The initial retransmit timeout \`TCP_TIMEOUT_INIT\` is defined as 1 second (older kernel versions used 3 seconds). If the SYN is lost and no SYN-ACK is received within this window, the kernel doubles the timeout (exponential backoff) and retransmits, up to the limit set by \`net.ipv4.tcp_syn_retries\`.

### Summary on \`connect\`

1. **What happens locally when \`connect\` is called.** The kernel immediately promotes the socket state to \`TCP_SYN_SENT\`, selects an available ephemeral port via \`inet_hash_connect\`, builds a SYN segment, transmits it with \`tcp_transmit_skb\`, and arms a retransmit timer — all before any network round-trip completes.

2. **Port exhaustion and \`EADDRNOTAVAIL\`.** \`inet_hash_connect\` scans \`net.ipv4.ip_local_port_range\` (default 32768–60999) in a randomised order. If every port in the range is occupied, it returns \`-EADDRNOTAVAIL\` ("Cannot assign requested address"). The first tuning knob to reach for in production is widening \`ip_local_port_range\`, e.g.:
   \`\`\`bash
   sysctl -w net.ipv4.ip_local_port_range="1024 65535"
   \`\`\`

3. **Reserving ports with \`ip_local_reserved_ports\`.** If certain port numbers must not be consumed as ephemeral ports (for example, because an application listens on them intermittently), add them to \`net.ipv4.ip_local_reserved_ports\`. The kernel's \`inet_is_reserved_local_port\` check will skip them during the search loop, preventing accidental conflicts.

4. **One machine can sustain far more than 65 535 connections.** TCP uniqueness is enforced on the full 4-tuple \`(local IP, local port, remote IP, remote port)\`, not on the local port alone. The same local port can back many simultaneous connections as long as each goes to a distinct remote endpoint. With enough remote diversity, a single machine can maintain hundreds of thousands — or even millions — of concurrent outgoing connections; the real limits are memory and CPU, not the 16-bit port number space.

5. **Port-search cost grows as the range fills up.** Because the search starts at a pseudo-random offset, a lightly loaded system finds a free port in one or two iterations. As \`ip_local_port_range\` approaches saturation, the loop must cycle through progressively more occupied entries before landing on a usable port, driving up CPU cost per \`connect\` call. Keeping the range comfortably larger than peak concurrent connections avoids this degradation.

6. **Do not call \`bind\` before \`connect\` on the client side.** Once \`bind\` assigns a port, \`inet_sk(sk)->inet_num\` is non-zero and the kernel skips the entire port-search loop, locking the socket to that single port. This prevents more than one simultaneous connection to the same remote endpoint from the same port and risks colliding with ports already in use. \`bind\` before \`connect\` is a server-side pattern for pinning a well-known port; in client code, omit it and let the kernel manage ephemeral port selection.

`;export{n as default};
