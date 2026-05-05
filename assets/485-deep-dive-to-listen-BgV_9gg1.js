const e=`---
title: "Networking in Linux Kernel: Part VIII, Deep Dive of \`listen\`"
date: 2026-04-19
id: blog0485
tag: linux, C, networking
toc: true
intro: "Study networking on the process of TCP Listen"
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

### Overview

In this article we trace the Linux kernel implementation of the \`listen\` syscall, following the call path from the syscall entry point down to the memory allocation routines for the accept queue and SYN queue. Understanding this path gives us insight into how the kernel prepares a TCP socket for incoming connections before a single client has connected.

The two internal queues at the center of this story are:

- SYN queue (半連接隊列) — holds incomplete connections waiting for the final ACK of the 3-way handshake.
- Accept queue (全連接隊列) — holds completed connections waiting for the application to call \`accept()\`.

### Example Use Case

A typical server program calls \`listen\` immediately after \`bind\`, and before entering its \`accept\` loop:

\`\`\`c
int server_fd = socket(AF_INET, SOCK_STREAM, 0);

bind(server_fd, (struct sockaddr *)&addr, sizeof(addr));

listen(server_fd, 128);

int client_fd = accept(server_fd, NULL, NULL);
\`\`\`

The second argument to \`listen\` is \`backlog\`, which is the hint we pass to the kernel for the desired queue capacity. As we will see, the kernel may silently reduce this value based on system-wide limits.

### The \`listen\` Syscall Entry Point

The syscall definition lives in \`net/socket.c\`. When we call \`listen(fd, backlog)\` from userspace, the kernel executes \`SYSCALL_DEFINE2(listen, ...)\`:

\`\`\`c
SYSCALL_DEFINE2(listen, int, fd, int, backlog) {
    // 根据fd查找socket内核对象
    sock = sockfd_lookup_light(fd, &err, &fput_needed);
    if (sock) {
        // 获取内核参数net.core.somaxconn
        somaxconn = sock_net(sock->sk)->core.sysctl_somaxconn;
        if ((unsigned int)backlog > somaxconn)
            backlog = somaxconn;

        // 调用协议栈注册的listen函数
        err = sock->ops->listen(sock, backlog);
        ......
    }
}
\`\`\`

The kernel first resolves the socket object from the file descriptor, then reads the kernel parameter \`net.core.somaxconn\`. If our \`backlog\` argument exceeds \`somaxconn\`, the kernel silently caps it. The final capped value is then passed down to the protocol layer via the function pointer \`sock->ops->listen\`.

### Protocol Layer: \`inet_listen\`

The function pointer \`sock->ops->listen\` resolves to \`inet_listen\` in \`net/ipv4/af_inet.c\`:

\`\`\`c
// file: net/ipv4/af_inet.c
int inet_listen(struct socket *sock, int backlog)
{
    // 还不是listen状态（尚未listen过）
    if (old_state != TCP_LISTEN) {
        // 开始监听
        err = inet_csk_listen_start(sk, backlog);
    }

    // 设置全连接队列长度
    sk->sk_max_ack_backlog = backlog;
}
\`\`\`

\`sk_max_ack_backlog\` stores the maximum number of entries allowed in the accept queue. After \`inet_csk_listen_start\` returns, the socket transitions into \`TCP_LISTEN\` state and is ready to receive incoming SYN packets.

### Socket Struct Hierarchy

Before going deeper, we need to understand how the socket structs relate to each other. For TCP, every \`sock\` is physically a \`tcp_sock\`, and the kernel freely casts between the following four types:

![](/assets/img/2026-04-20-00-34-30.png)

- \`sock\` — the base socket object.
- \`inet_sock\` — extends \`sock\` with IP-level addressing fields.
- \`inet_connection_sock\` — extends \`inet_sock\` with connection management fields, including the accept queue.
- \`tcp_sock\` — extends \`inet_connection_sock\` with TCP-specific state and timers.

Because \`sock\` is always the first member of each successive struct, a pointer of any of these types can be safely cast to any of the others.

### Initializing the Queues: \`inet_csk_listen_start\`

\`inet_csk_listen_start\` in \`net/ipv4/inet_connection_sock.c\` is where the accept queue and SYN queue are allocated. It casts the base \`sock\` to \`inet_connection_sock\` and calls \`reqsk_queue_alloc\`:

\`\`\`c
// file: net/ipv4/inet_connection_sock.c
int inet_csk_listen_start(struct sock *sk, const int nr_table_entries)
{
    struct inet_connection_sock *icsk = inet_csk(sk);

    // icsk->icsk_accept_queue 是接收队列，详情见 2.3 节
    // 接收队列对象的申请和初始化，详情见 2.4 节
    int rc = reqsk_queue_alloc(&icsk->icsk_accept_queue, nr_table_entries);
    ......
}
\`\`\`

\`icsk_accept_queue\` is of type \`request_sock_queue\`, which is the single struct the kernel uses to hold both queues. Its location inside \`inet_connection_sock\` is highlighted in the diagram below:

![](/assets/img/2026-04-20-00-53-35.png)

The struct definition confirms the layout:

\`\`\`c
//file: include/net/inet_connection_sock.h
struct inet_connection_sock {
    /* inet_sock has to be the first member! */
    struct inet_sock          icsk_inet;
    struct request_sock_queue icsk_accept_queue;
    ......
}
\`\`\`

### The \`request_sock_queue\` Struct

\`request_sock_queue\` wraps both queues under one roof:

\`\`\`c
//file: include/net/request_sock.h
struct request_sock_queue {

    //全连接队列
    struct request_sock  *rskq_accept_head;
    struct request_sock  *rskq_accept_tail;

    //半连接队列
    struct listen_sock   *listen_opt;
    ......
};
\`\`\`

The accept queue is a simple linked list because FIFO access is all we need — a head pointer and a tail pointer are sufficient. The SYN queue, on the other hand, is managed through \`listen_opt\`, a pointer to a \`listen_sock\`:

\`\`\`c
struct listen_sock {
    u8   max_qlen_log;
    u32  nr_table_entries;
    ......
    struct request_sock  *syn_table[0];
};
\`\`\`

\`syn_table\` is a hash map. During the third step of the 3-way handshake, the server must quickly locate the matching half-open socket for the incoming ACK packet, which requires hash-based lookup rather than a linear scan. \`max_qlen_log\` and \`nr_table_entries\` together govern the maximum capacity of the SYN queue.

### Memory Allocation: \`reqsk_queue_alloc\`

\`reqsk_queue_alloc\` in \`net/core/request_sock.c\` performs the actual allocation and initialization:

\`\`\`c
//file: net/core/request_sock.c
int reqsk_queue_alloc(struct request_sock_queue *queue,
                      unsigned int nr_table_entries)
{
    size_t lopt_size = sizeof(struct listen_sock);
    struct listen_sock *lopt;

    //计算半连接队列的长度
    nr_table_entries = min_t(u32, nr_table_entries, sysctl_max_syn_backlog);
    nr_table_entries = ......

    //为listen_sock对象申请内存，这里包含了半连接队列
    lopt_size += nr_table_entries * sizeof(struct request_sock *);
    if (lopt_size > PAGE_SIZE)
        lopt = vzalloc(lopt_size);
    else
        lopt = kzalloc(lopt_size, GFP_KERNEL);

    //全连接队列初始化
    queue->rskq_accept_head = NULL;

    //半连接队列设置
    lopt->nr_table_entries = nr_table_entries;
    queue->listen_opt = lopt;
    ......
}
\`\`\`

The function first computes the SYN queue length, capping it against \`sysctl_max_syn_backlog\`. Memory for \`listen_sock\` (which embeds \`syn_table\`) is then allocated via \`vzalloc\` or \`kzalloc\` depending on the total size. Finally, the accept queue head is set to \`NULL\` and the SYN queue pointer is attached to the \`request_sock_queue\`.

### Summary of \`listen\`

The reason we call \`listen\` before \`accept\` is that \`listen\` is what builds the two queues the kernel needs to process incoming connections during the 3-way handshake. Without these structures in place, there is nowhere to buffer connection state.

Queue length rules:

- Accept queue length = \`min(backlog, net.core.somaxconn)\`
- SYN queue length is constrained by \`backlog\`, \`net.core.somaxconn\`, and \`net.ipv4.tcp_max_syn_backlog\`

To tune the SYN queue capacity, we need to adjust all three parameters together. Changing only one of them may have no observable effect.

`;export{e as default};
