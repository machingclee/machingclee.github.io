const e=`---
title: "Networking in Linux Kernel: Part X, Complete TCP Connection (WIP)"
date: 2026-05-04
id: blog0490
tag: linux, C, networking
toc: true
wip: false
intro: "Study networking on a complete TCP Connection"
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
  table td:first-child, table th:first-child {
    min-width: 120px;
  }
</style>




![](/assets/img/2026-05-05-02-54-11.png)

### Full TCP Connection 

#### Overview of \`connect\` from the Client Side

On the server side, the core setup involves creating a socket, binding it to a port, putting it into a listening state, and finally accepting connections from clients:

\`\`\`c
int main(int argc, char const *argv[])
{
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    bind(fd, ...);
    listen(fd, 128);
    accept(fd, ...);
}
\`\`\`

On the client side, the core logic is simpler:

\`\`\`c
int main(){
    fd = socket(AF_INET, SOCK_STREAM, 0);
    connect(fd, ...);
    ...
}
\`\`\`

\\indent 123 We have covered the details of the client-side connection initiation in a previous article. The client initiates a connection via the \`connect\` system call, which eventually reaches \`tcp_v4_connect\`:

\`\`\`c
// file: net/ipv4/tcp_ipv4.c
int tcp_v4_connect(struct sock *sk, struct sockaddr *uaddr, int addr_len)
{
    // 设置 socket 状态为 TCP_SYN_SENT
    tcp_set_state(sk, TCP_SYN_SENT);

    // 动态选择一个端口
    err = inet_hash_connect(&tcp_death_row, sk);

    // 函数用来根据 sk 中的信息，构建一个完整的 syn 报文，并将它发送出去
    err = tcp_connect(sk);
}
\`\`\`

Here the socket state is set to \`TCP_SYN_SENT\`, then \`inet_hash_connect\` dynamically selects an ephemeral port before invoking \`tcp_connect\`:

\`\`\`c
// file: net/ipv4/tcp_output.c
int tcp_connect(struct sock *sk)
{
    tcp_connect_init(sk);

    // 申请 skb 并构造为一个 SYN 包
    ......

    // 添加到发送队列 sk_write_queue
    tcp_connect_queue_skb(sk, buff);

    // 实际发出 syn
    err = tp->fastopen_req ?
          tcp_send_syn_data(sk, buff) :
          tcp_transmit_skb(sk, buff, 1, sk->sk_allocation);

    // 启动重传定时器
    inet_csk_reset_xmit_timer(sk, ICSK_TIME_RETRANS,
                              inet_csk(sk)->icsk_rto, TCP_RTO_MAX);
}
\`\`\`

Inside \`tcp_connect\`, we allocate and construct a SYN packet, add it to the send queue, transmit it, and then start a retransmission timer. If the server does not respond within the timeout interval, the kernel retransmits the SYN packet automatically.

#### Server Side Handling of SYN

On the server side, all incoming TCP packets, including SYN requests from the client, travel through the NIC and the soft-interrupt handler before reaching \`tcp_v4_rcv\`. This function reads the TCP header of the incoming \`skb\`, locates the socket in \`TCP_LISTEN\` state, and then invokes \`tcp_v4_do_rcv\` to begin the handshake processing:

\`\`\`c
// file: net/ipv4/tcp_ipv4.c
int tcp_v4_do_rcv(struct sock *sk, struct sk_buff *skb)
{
    ......

    // 服务端收到第一步握手 SYN 或者第三步 ACK 都会走到这里
    if (sk->sk_state == TCP_LISTEN) {
        struct sock *nsk = tcp_v4_hnd_req(sk, skb);
    }

    if (tcp_rcv_state_process(sk, skb, tcp_hdr(skb), skb->len)) {
        rsk = sk;
        goto reset;
    }
}
\`\`\`

#### Checking the SYN Queue

Inside \`tcp_v4_do_rcv\`, we first verify that the socket is in \`TCP_LISTEN\` state, then call \`tcp_v4_hnd_req\` to search the SYN queue (半連接隊列). When the server receives a SYN for the first time, the SYN queue is empty, so \`tcp_v4_hnd_req\` finds nothing and returns the original socket unchanged:

\`\`\`c
// file: net/ipv4/tcp_ipv4.c
static struct sock *tcp_v4_hnd_req(struct sock *sk, struct sk_buff *skb)
{
    // 查找 listen socket 的半连接队列
    struct request_sock *req =
        inet_csk_search_req(sk, &prev, th->source,
                            iph->saddr, iph->daddr);
    ......
    return sk;
}
\`\`\`

#### Dispatching the SYN in \`tcp_rcv_state_process\`

Control then passes to \`tcp_rcv_state_process\`, which dispatches the packet based on the current socket state:

\`\`\`c
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
                          const struct tcphdr *th, unsigned int len)
{
    switch (sk->sk_state) {

    // 第一次握手
    case TCP_LISTEN:
        if (th->syn) {   // 判断是否为 SYN 握手包
            ......
            if (icsk->icsk_af_ops->conn_request(sk, skb) < 0)
                return 1;
        }
        ......
    }
    ......
}
\`\`\`

The function pointer \`conn_request\` resolves to \`tcp_v4_conn_request\`, which contains the core server-side logic for responding to a SYN packet:

\`\`\`c
// file: net/ipv4/tcp_ipv4.c
int tcp_v4_conn_request(struct sock *sk, struct sk_buff *skb)
{
    // 看看半连接队列是否满了
    if (inet_csk_reqsk_queue_is_full(sk) && !isn)
        want_cookie = tcp_syn_flood_action(sk, skb, "TCP");
    if (!want_cookie)
        goto drop;

    // 在全连接队列满的情况下，如果有 young_ack，那么直接丢弃
    if (sk_acceptq_is_full(sk) &&
        inet_csk_reqsk_queue_young(sk) > 1) {
        NET_INC_STATS_BH(sock_net(sk), LINUX_MIB_LISTENOVERFLOWS);
        goto drop;
    }

    ......

    // 分配 request_sock 内核对象
    req = inet_reqsk_alloc(&tcp_request_sock_ops);

    // 构造 syn+ack 包
    skb_synack = tcp_make_synack(sk, dst, req,
                    fastopen_cookie_present(&valid_foc) ? &valid_foc : NULL);

    if (likely(!do_fastopen)) {
        // 发送 syn + ack 响应
        err = ip_build_and_send_pkt(skb_synack, sk, ireq->loc_addr,
                                    ireq->rmt_addr, ireq->opt);

        // 添加到半连接队列，并开启计时器
        inet_csk_reqsk_queue_hash_add(sk, req, TCP_TIMEOUT_INIT);
    } else ...
}
\`\`\`

#### Queue Overflow Checks and SYNACK Transmission

The function first checks whether the SYN queue is full. If the SYN queue is full and \`tcp_syncookies\` is not enabled, the incoming SYN packet is silently dropped. If \`tcp_syncookies\` is enabled, the kernel falls back to cookie-based connection tracking instead.

Next, we check whether the accept queue (全連接隊列) is already full. If the accept queue is full and the \`young_ack\` counter exceeds 1, the packet is dropped.

\`young_ack\` is a counter maintained by the SYN queue that tracks half-open connections satisfying all three of the following conditions:

1. The SYN request has been received.
2. The initial SYNACK has been sent, but its retransmission timer has not yet fired.
3. The 3-way handshake has not yet been completed.

The counter is incremented when a new entry is enqueued immediately after the first SYNACK is sent, and decremented when the retransmission timer fires for that entry. A "young" entry is therefore one whose SYNACK has been sent exactly once and is still awaiting the client's ACK.

If neither queue is full, the kernel allocates a \`request_sock\` object, constructs the SYNACK packet, sends it via \`ip_build_and_send_pkt\`, and adds the half-open connection to the SYN queue while starting a timer. The purpose of this timer is to retransmit the SYNACK if the third step of the handshake does not arrive within the timeout.

In summary, the server reacts to an incoming SYN by checking whether the SYN queue is full. If the queue has room, it sends a SYNACK, records the connection information in the SYN queue via a \`request_sock\` object, and starts a retransmission timer.


#### Client Side Response to SYNACK

When the client receives the SYNACK packet, the kernel invokes \`tcp_rcv_state_process\`. Since the socket is currently in \`TCP_SYN_SENT\` state, execution falls into the corresponding branch:

\`\`\`c
//file:net/ipv4/tcp_input.c
//除了ESTABLISHED和TIME_WAIT，其他状态下的TCP处理都在这里
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
        const struct tcphdr *th, unsigned int len)
{
    switch (sk->sk_state) {
        //服务器收到第一个ACK包
        case TCP_LISTEN:
        ......

        //客户端第二次握手处理
        case TCP_SYN_SENT:
            //处理synack包
            queued = tcp_rcv_synsent_state_process(sk, skb, th, len);
            ......
            return 0;
    }
}
\`\`\`

#### Processing SYNACK in \`tcp_rcv_synsent_state_process\`

The function \`tcp_rcv_synsent_state_process\` contains the core logic for how the client reacts to the incoming SYNACK:

\`\`\`c
//file:net/ipv4/tcp_input.c
static int tcp_rcv_synsent_state_process(struct sock *sk, struct sk_buff *skb,
        const struct tcphdr *th, unsigned int len)
{
    ......
    tcp_ack(sk, skb, FLAG_SLOWPATH);

    //连接建立完成
    tcp_finish_connect(sk, skb);

    if (sk->sk_write_pending ||
        icsk->icsk_accept_queue.rskq_defer_accept ||
        icsk->icsk_ack.pingpong)
        //延迟确认......
    else {
        tcp_send_ack(sk);
    }
}
\`\`\`


The call to \`tcp_ack\` internally triggers \`tcp_clean_rtx_queue\`, which removes the SYN packet from the send queue and cancels the retransmission timer that was set during \`tcp_connect\`:

\`\`\`c
//file:net/ipv4/tcp_input.c
static int tcp_clean_rtx_queue(struct sock *sk, int prior_fackets,
        u32 prior_snd_una)
{
    //删除发送队列
    ......

    //删除定时器
    tcp_rearm_rto(sk);
}
\`\`\`

#### Finalizing the Connection on the Client Side

After acknowledging the SYNACK, \`tcp_finish_connect\` transitions the socket to \`TCP_ESTABLISHED\` state and initializes congestion control:

\`\`\`c
//file:net/ipv4/tcp_input.c
void tcp_finish_connect(struct sock *sk, struct sk_buff *skb)
{
    //修改 socket 状态
    tcp_set_state(sk, TCP_ESTABLISHED);

    //初始化拥塞控制
    tcp_init_congestion_control(sk);
    ......

    //保活计时器打开
    if (sock_flag(sk, SOCK_KEEPOPEN))
        inet_csk_reset_keepalive_timer(sk, keepalive_time_when(tp));
}
\`\`\`

The Keepalive Timer is also activated here. Once the socket reaches \`TCP_ESTABLISHED\`, the client constructs and transmits the third-handshake ACK packet via \`tcp_send_ack\`:

\`\`\`c
//file:net/ipv4/tcp_output.c
void tcp_send_ack(struct sock *sk)
{
    //申请和构造ack包
    buff = alloc_skb(MAX_TCP_HEADER, sk_gfp_atomic(sk, GFP_ATOMIC));
    ......

    //发送出去
    tcp_transmit_skb(sk, buff, 0, sk_gfp_atomic(sk, GFP_ATOMIC));
}
\`\`\`

In summary, when the client reacts to SYNACK, it clears the retransmission timer for \`connect\`, sets the socket state to \`TCP_ESTABLISHED\`, activates the Keepalive Timer, and transmits the third-handshake ACK packet.

#### Server Side Response to ACK

In the third step of the handshake, the server again invokes \`tcp_v4_do_rcv\`:

\`\`\`c
//file: net/ipv4/tcp_ipv4.c
int tcp_v4_do_rcv(struct sock *sk, struct sk_buff *skb)
{
    ......
    if (sk->sk_state == TCP_LISTEN) {
        struct sock *nsk = tcp_v4_hnd_req(sk, skb);

        if (nsk != sk) {
            if (tcp_child_process(sk, nsk, skb)) {
                ......
            }
            return 0;
        }
    }
    ......
}
\`\`\`

#### Locating the Entry in the SYN Queue

Since this is the third handshake, the SYN queue already contains an entry from the earlier exchange. Therefore \`tcp_v4_hnd_req\` behaves differently this time, searching the SYN queue for the matching request:

\`\`\`c
//file: net/ipv4/tcp_ipv4.c
static struct sock *tcp_v4_hnd_req(struct sock *sk, struct sk_buff *skb)
{
    ......
    struct request_sock *req = inet_csk_search_req(sk, &prev,
                        th->source, iph->saddr, iph->daddr);
    if (req)
        return tcp_check_req(sk, skb, req, prev, false);
}
\`\`\`

\`inet_csk_search_req\` retrieves the matching request socket from the SYN queue, after which we invoke \`tcp_check_req\`:

\`\`\`c
//file: net/ipv4/tcp_minisocks.c
struct sock *tcp_check_req(struct sock *sk, struct sk_buff *skb,
        struct request_sock *req,
        struct request_sock **prev,
        bool fastopen)
{
    ......
    //创建子socket
    child = inet_csk(sk)->icsk_af_ops->syn_recv_sock(sk, skb, req, NULL);

    //清理半连接队列
    inet_csk_reqsk_queue_unlink(sk, req, prev);
    inet_csk_reqsk_queue_removed(sk, req);

    //添加全连接队列
    inet_csk_reqsk_queue_add(sk, req, child);
    return child;
}
\`\`\`

This function coordinates three operations in sequence: 
1. Creating a child socket
2. Removing the entry from the SYN queue, and 
3. Appending it to the accept queue.

##### Creation of the Child Socket

The function pointer \`icsk_af_ops->syn_recv_sock\` points to \`tcp_v4_syn_recv_sock\`:

\`\`\`c
//file:net/ipv4/tcp_ipv4.c
const struct inet_connection_sock_af_ops ipv4_specific = {
    ......
    .conn_request   = tcp_v4_conn_request,
    .syn_recv_sock  = tcp_v4_syn_recv_sock,
};

//这里创建sock内核对象
struct sock *tcp_v4_syn_recv_sock(struct sock *sk, struct sk_buff *skb,
        struct request_sock *req,
        struct dst_entry *dst)
{
    //判断接收队列是不是满了
    if (sk_acceptq_is_full(sk))
        goto exit_overflow;

    //创建sock并初始化
    newsk = tcp_create_openreq_child(sk, req, skb);
    ......
}
\`\`\`

Note that during the third handshake we again check whether the accept queue is full. If it is full, the request is discarded and the timer is adjusted. If the accept queue has room, a new \`sock\` object is allocated via \`tcp_create_openreq_child\`.

##### Deletion from the SYN Queue

Once the child socket is created, the corresponding entry is removed from the SYN queue:

\`\`\`c
//file: include/net/inet_connection_sock.h
static inline void inet_csk_reqsk_queue_unlink(struct sock *sk,
        struct request_sock *req,
        struct request_sock **prev)
{
    reqsk_queue_unlink(&inet_csk(sk)->icsk_accept_queue, req, prev);
}
\`\`\`

\`reqsk_queue_unlink\` removes the request socket from the SYN queue, completing the half-open connection cleanup.

##### Appending to the Accept Queue

Next, the newly created \`sock\` object is added to the accept queue (全連接隊列):

\`\`\`c
//file:net/ipv4/syn_cookies.c
static inline void inet_csk_reqsk_queue_add(struct sock *sk,
        struct request_sock *req,
        struct sock *child)
{
    reqsk_queue_add(&inet_csk(sk)->icsk_accept_queue, req, sk, child);
}
\`\`\`

Inside \`reqsk_queue_add\`, the \`request_socket\` that has completed the 3-way handshake is appended to the tail of the accept queue:

\`\`\`c
//file: include/net/request_sock.h
static inline void reqsk_queue_add(...)
{
    req->sk = child;
    sk_acceptq_added(parent);

    if (queue->rskq_accept_head == NULL)
        queue->rskq_accept_head = req;
    else
        queue->rskq_accept_tail->dl_next = req;

    queue->rskq_accept_tail = req;
    req->dl_next = NULL;
}
\`\`\`

##### Setting the Child Socket to ESTABLISHED

After the accept queue addition, \`tcp_rcv_state_process\` is invoked again with the child socket, which is in \`TCP_SYN_RECV\` state:

\`\`\`c
//file:net/ipv4/tcp_input.c
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb,
        const struct tcphdr *th, unsigned int len)
{
    ......
    switch (sk->sk_state) {

        //服务器第三次握手处理
        case TCP_SYN_RECV:
            //改变状态为连接
            tcp_set_state(sk, TCP_ESTABLISHED);
            ......
    }
}
\`\`\`

The child socket's state is now set to \`TCP_ESTABLISHED\`. In summary, the third handshake on the server side removes the entry from the SYN queue, creates a new \`sock\` object, appends it to the accept queue, and sets its state to \`ESTABLISHED\`.

##### Server Side Accept

The final operation is the \`accept\` system call, which retrieves the completed connection from the accept queue:

\`\`\`c
//file: net/ipv4/inet_connection_sock.c
struct sock *inet_csk_accept(struct sock *sk, int flags, int *err)
{
    //从全连接队列中获取
    struct request_sock_queue *queue = &icsk->icsk_accept_queue;
    req = reqsk_queue_remove(queue);

    newsk = req->sk;
    return newsk;
}
\`\`\`

\`reqsk_queue_remove\` pops off the leading element from the accept queue and returns it to the user process:

\`\`\`c
//file:include/net/request_sock.h
static inline struct request_sock *reqsk_queue_remove(struct request_sock_queue *queue)
{
    struct request_sock *req = queue->rskq_accept_head;

    WARN_ON(req == NULL);

    queue->rskq_accept_head = req->dl_next;
    if (queue->rskq_accept_head == NULL)
        queue->rskq_accept_tail = NULL;

    return req;
}
\`\`\`

So \`accept\` simply pops the first entry off the accept queue and returns the corresponding socket to the user process.

#### Summary and Timing Analysis of a Full TCP Connection

We can classify all operations involved in a complete TCP connection into two categories.

The first category covers CPU-bound work: receiving and transmitting packets, system calls, soft-interrupt handling, and context switches. Each of these operations individually takes on the order of a few nanoseconds.

The second category is network transmission. Once a packet leaves a machine, it travels through network cables, routers, and other intermediate devices. This latency, on the order of hundreds of milliseconds, dominates the CPU cost entirely.

To study the latency of a TCP connection, it is sufficient to focus on the network transmission component. An RTT (Round-Trip Time) measures the time for a packet to travel from one device to another and back. We can reason about the 1.5 RTT figure as follows: the client sends SYN and it reaches the server in 0.5 RTT, the server sends SYNACK and it reaches the client in another 0.5 RTT, and finally the client sends ACK back to the server in the last 0.5 RTT. These three one-way transmissions sum to 1.5 RTT. Adding the CPU processing cost on both sides, a complete TCP 3-way handshake takes approximately 1.5 RTT in total.

From the client's perspective, once the ACK is transmitted, the kernel considers the connection established and data transmission can begin immediately.


### Abnormal TCP Connection

`;export{e as default};
