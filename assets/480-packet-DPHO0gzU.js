const e=`---
title: "Networking in Linux Kernel: Part VI, Send Packets"
date: 2026-04-13
id: blog0480
tag: linux, C, networking
toc: true
intro: "Study packets in linux kernel level"
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

### Overview


![](/assets/img/2026-04-07-20-13-06.png)

When a packet is sent from user space, it must traverse multiple layers of the Linux kernel before it actually reaches the network wire. In this article, we follow the journey of a packet from the moment user code calls \`send()\` all the way down to the NIC driver writing into the ring buffer and the DMA transfer completing.

The main stages are:

1. NIC initialization — how ring buffers are allocated
2. System call entry — from \`send()\` to the protocol stack
3. Transport layer — \`tcp_sendmsg\` and \`tcp_write_xmit\`
4. Network layer — IP header construction, routing, and fragmentation
5. Neighbor subsystem — ARP resolution and MAC header preparation
6. Network device subsystem — qdisc, \`dev_hard_start_xmit\`
7. NIC driver — mapping \`skb\` into the DMA ring buffer and final transmission
8. Cleanup — releasing \`skb\` memory after the NIC confirms transmission

### NIC Initialization and Ring Buffer Allocation

An NIC has both a receive queue and a transmit queue, and each queue is represented by a ring buffer. During NIC initialization, one critical task is setting up and allocating these ring buffers.

#### \`__igb_open\`

When NIC is opened, \`__igb_open\` is invoked:

\`\`\`c
// file: drivers/net/ethernet/intel/igb/igb_main.c
static int __igb_open(struct net_device *netdev, bool resuming)
{
    struct igb_adapter *adapter = netdev_priv(netdev);

    igb_setup_all_tx_resources(adapter);
    igb_setup_all_rx_resources(adapter);

    igb_request_irq(adapter);

    netif_tx_start_all_queues(netdev);

    return 0;
}
\`\`\`

- \`netdev_priv(netdev)\` retrieves the private adapter structure associated with the network device. 

- \`igb_setup_all_tx_resources\` 
  - sets up all ***transmit ring buffers*** and;
  - creates all ***receive ring buffers***
- Finally, \`netif_tx_start_all_queues(...)\` starts all transmit queues so the system can begin sending packets. 
- The hard-interrupt handler \`igb_msix_ring\` is also registered inside \`__igb_open\` (we refer the reader to [this link](https://www.cnblogs.com/573583868wuy/p/17810582.html) for more detail in Chinese).

\`igb_adapter\` is the driver's ***private*** data structure allocated immediately after the \`net_device\` struct in memory. It holds all Intel-specific hardware state for a single NIC instance. The key fields are:

\`\`\`c
struct igb_adapter {
    /* TX/RX ring arrays */
    struct igb_ring             *tx_ring[MAX_TX_QUEUES]; /* one per TX queue  */
    struct igb_ring             *rx_ring[MAX_RX_QUEUES]; /* one per RX queue  */
    unsigned int                 num_tx_queues;
    unsigned int                 num_rx_queues;

    /* MSI-X interrupt vectors (one per queue pair) */
    struct igb_q_vector         *q_vector[MAX_Q_VECTORS];
    int                          num_q_vectors;

    /* Hardware register access */
    struct e1000_hw              hw;                     /* raw HW struct      */

    /* PCI device */
    struct pci_dev              *pdev;

    /* Back-pointer to the generic net_device */
    struct net_device           *netdev;

    /* Link state */
    u16                          link_speed;
    u16                          link_duplex;

    /* Statistics */
    struct net_device_stats      stats;
};
\`\`\`

- \`net_device\` is the kernel's generic, protocol-agnostic view of any network interface. 
- \`igb_adapter\` is the vendor-specific view of the same physical card. 

- \`netdev_priv(...)\` simply returns the pointer to this private block, letting driver code go from the generic \`netdev\` handle to all the Intel-specific hardware details stored in \`adapter\`.

- \`adapter->tx_ring[i]\` is not itself the ring buffer — it is a pointer to an \`igb_ring\` struct, which is the *management struct* for one transmit queue. The two parallel arrays inside it are the actual ring buffer:

\`\`\`c
struct igb_ring {
    struct igb_tx_buffer     *tx_buffer_info; /* kernel-side array (vzalloc), holds skb pointers */
    struct e1000_adv_tx_desc *desc;           /* HW descriptor array (DMA), read by NIC hardware */
    unsigned int              count;          /* number of slots in the ring                      */
    u16                       next_to_use;    /* producer index — where the next skb will go      */
    u16                       next_to_clean;  /* consumer index — where cleanup continues         */
    struct device            *dev;
    struct net_device        *netdev;
};
\`\`\`

The full ownership hierarchy is:

\`\`\`
igb_adapter
  └─ tx_ring[i]  
   → igb_ring
        ├── tx_buffer_info[]   ← kernel array, slot i holds the skb pointer
        └── desc[]             ← DMA descriptor array, slot i holds the DMA address
\`\`\`

- \`skb\` lives in \`tx_buffer_info[i].skb\`, not in the descriptor array. 

- The descriptor array's job is to store the DMA-mapped addresses of those \`skb\` data buffers so the NIC can fetch the packet payload directly from RAM without CPU involvement.
- We discuss more on dma descriptor in section [#dma-desc].


#### \`igb_setup_all_tx_resources\`

\`igb_setup_all_tx_resources\` loops through each queue and calls \`igb_setup_tx_resources\` for each one:

\`\`\`c
static int igb_setup_all_tx_resources(struct igb_adapter *adapter)
{
    int i, err = 0;

    for (i = 0; i < adapter->num_tx_queues; i++) {
        err = igb_setup_tx_resources(adapter->tx_ring[i]);
        if (err) {
            igb_err(adapter, "Allocation for Tx Queue %u failed\\n", i);
            for (i--; i >= 0; i--)
                igb_free_tx_resources(adapter->tx_ring[i]);
            break;
        }
    }

    return err;
}
\`\`\`

#### \`igb_setup_tx_resources\`
Let's continue from the call chain inside of \`__igb_open\`. The actual ring buffer creation happens in \`igb_setup_tx_resources\`:

\`\`\`c
int igb_setup_tx_resources(struct igb_ring *tx_ring)
{
    struct device *dev = tx_ring->dev;
    int size;

    size = sizeof(struct igb_tx_buffer) * tx_ring->count;

    tx_ring->tx_buffer_info = vzalloc(size);
    if (!tx_ring->tx_buffer_info)
        goto err;

    tx_ring->desc = dma_alloc_coherent(dev,
                                       tx_ring->size,
                                       &tx_ring->dma,
                                       GFP_KERNEL);
    if (!tx_ring->desc)
        goto err;

    tx_ring->next_to_use   = 0;
    tx_ring->next_to_clean = 0;

    return 0;

err:
    vfree(tx_ring->tx_buffer_info);
    tx_ring->tx_buffer_info = NULL;
    return -ENOMEM;
}
\`\`\`

A ring buffer is not merely a circular array, it is actually two parallel arrays working together:

- \`igb_tx_buffer[]\` — used by the kernel, allocated with \`vzalloc\`

- \`e1000_adv_tx_desc[]\` — used by the NIC hardware, allocated via \`dma_alloc_coherent\` so the hardware can access it directly through DMA

When a packet is eventually queued for transmission, entries at the same index in both arrays will refer to the same \`skb\`. 
- \`tx_ring->next_to_use\` tracks where the next packet will be placed, and 

- \`tx_ring->next_to_clean\` tracks where cleanup should continue after transmission completes.


#### DMA Descriptor {#dma-desc}

A **DMA descriptor** (\`e1000_adv_tx_desc\`) is a small, fixed-size hardware-facing struct that tells the NIC *where* a packet's data lives in RAM and *how* to transmit it — it does not contain the packet bytes itself:

\`\`\`c
struct e1000_adv_tx_desc {
    __le64  buffer_addr;      /* physical (DMA) address of skb->data in RAM     */
    __le32  cmd_type_len;     /* data length + command flags (EOP, IFCS, RS...) */
    __le32  olinfo_status;    /* checksum offload info; writeback status from NIC */
};
\`\`\`

The workflow when a packet is transmitted:

1. **CPU** calls \`dma_map_single()\` on \`skb->data\`, obtaining a physical DMA address.
2. **CPU** writes that address into \`desc[i].buffer_addr\`, along with the length and flags.
3. **CPU** updates the NIC's tail register to signal "new descriptors are ready."
4. **NIC hardware** reads \`desc[i]\`, fetches the packet bytes from RAM via DMA (no CPU involvement), and puts them on the wire.
5. **NIC** writes a completion status back into \`olinfo_status\` and raises a hard interrupt.

This is fundamentally different from a **file descriptor** (fd) in Linux — a file descriptor is merely an integer index (e.g. \`0\`, \`1\`, \`3\`) into a per-process table that references an open file or socket in software. 

A DMA descriptor is a hardware-level struct living in DMA-coherent memory that both the CPU and the NIC can access directly. They share the word "descriptor" only in the generic sense of "something that describes something else."

### System Call: from \`send()\` to the Protocol Stack

The user-space \`send()\` call can be found in \`net/socket.c\`. It is mapped to \`sys_sendto\` as follows:

\`\`\`c
SYSCALL_DEFINE4(send, int, fd, void __user *, buff, size_t, len,
                unsigned int, flags)
{
    return sys_sendto(fd, buff, len, flags, NULL, 0);
}
\`\`\`

\`sys_sendto\` is defined as:

\`\`\`c
SYSCALL_DEFINE6(sendto, int, fd, void __user *, buff, size_t, len,
                unsigned int, flags, struct sockaddr __user *, addr,
                int, addr_len)
{
    struct socket *sock;
    struct msghdr msg;
    struct iovec iov;

    sock = sockfd_lookup_light(fd, &err, &fput_needed);

    iov.iov_base = buff;
    iov.iov_len  = len;

    msg.msg_name       = NULL;
    msg.msg_iov        = &iov;
    msg.msg_iovlen     = 1;
    msg.msg_control    = NULL;
    msg.msg_controllen = 0;
    msg.msg_namelen    = 0;
    msg.msg_flags      = flags;

    if (addr) {
        err = move_addr_to_kernel(addr, addr_len, (struct sockaddr *)&address);
        msg.msg_name    = (struct sockaddr *)&address;
        msg.msg_namelen = addr_len;
    }

    err = sock_sendmsg(sock, &msg, len);
    fput_light(sock->file, fput_needed);
    return err;
}
\`\`\`

\`sendto\` in the syscall layer is responsible for two things:

1. Find the socket in the kernel, and package the user's \`buff\`, \`len\`, \`flags\`, etc. into a \`struct msghdr\`. 

2. It then invokes \`sock_sendmsg\` → \`__sock_sendmsg\` → \`__sock_sendmsg_nosec\`. Inside \`__sock_sendmsg_nosec\`, we enter the protocol stack:

\`\`\`c
static inline int __sock_sendmsg_nosec(struct kiocb *iocb,
                                       struct socket *sock,
                                       struct msghdr *msg,
                                       size_t size)
{
    struct sock_iocb *si = kiocb_to_siocb(iocb);

    si->sock = sock;
    si->scm  = NULL;
    si->msg  = msg;
    si->size = size;

    return sock->ops->sendmsg(iocb, sock, msg, size);
}
\`\`\`

The call dispatches to \`inet_sendmsg\` through the socket's \`ops\` pointer.

### Transport Layer: \`tcp_sendmsg\`

#### \`inet_sendmsg\`  (1st Clone of Data)

In \`net/ipv4/af_inet.c\`, \`inet_sendmsg\` delegates to \`tcp_sendmsg\` via:

\`\`\`c
int inet_sendmsg(struct kiocb *iocb, struct socket *sock,
                 struct msghdr *msg, size_t size)
{
    struct sock *sk = sock->sk;
    return sk->sk_prot->sendmsg(iocb, sk, msg, size);
}
\`\`\`

\`sk->sk_prot->sendmsg\` resolves to \`tcp_sendmsg\`.

\`tcp_sendmsg\` is quite lengthy. At its core it repeatedly pulls an \`skb\` from the tail of the socket's write queue. The helper for that is:

\`\`\`c
static inline struct sk_buff *tcp_write_queue_tail(const struct sock *sk)
{
    return skb_peek_tail(&sk->sk_write_queue);
}
\`\`\`

- \`sk_write_queue\` is a doubly-linked list of \`sk_buff\` objects.
- \`tcp_write_queue_tail\` fetches the last \`skb\` in that list so the kernel can append data to it before allocating a new one. 

- More precisely, each \`sk_buff\` carries a data buffer with a reserved tail region. The key fields that track what space is left are:

\`\`\`c
struct sk_buff {
    unsigned char *head;   /* start of the allocated buffer                  */
    unsigned char *data;   /* start of the actual packet data                */
    unsigned char *tail;   /* end of the actual packet data (write pointer)  */
    unsigned char *end;    /* end of the allocated buffer (hard limit)       */
};
\`\`\`
The reader may wish to review \`struct socket\` thoroughly in [How Socket Receive Data from NIC](/blog/article/Networking-in-Linux-Kernel-Part-III-How-Socket-Receive-Data-from-NIC#1.1.-struct-sock-and-struct-socket). 

Now \`skb_availroom(skb)\` computes 
$$
\\texttt{skb->end}  - \\texttt{skb->tail},
$$
i.e., how many bytes are still free at the tail of the current \`skb\`. If room is available, \`skb_add_data_nocache\` copies bytes from the user buffer directly into \`skb->tail\` and advances \`skb->tail\` by the number of bytes copied:

\`\`\`
Before copy:
  [head]...[data ..... tail]...........[end]
                             ↑ free room

After copying N bytes:
  [head]...[data ........... tail+N]...[end]
                                        ↑ less free room
\`\`\`

Only when \`skb_availroom(skb) == 0\` (the current \`skb\` is full) does the kernel allocate a fresh \`skb\` via \`sk_stream_alloc_skb\` and append it to the write queue with \`skb_entail\`. This way the kernel packs as much data as possible into each \`skb\` before moving to the next, minimising the number of \`skb\` allocations and the overhead of per-segment headers.


#### \`tcp_sendmsg\`

Looking at the body of \`tcp_sendmsg\` (found in \`net/ipv4/tcp.c\`):

\`\`\`c
int tcp_sendmsg(struct kiocb *iocb, struct sock *sk, struct msghdr *msg,
                size_t size)
{
    iov    = msg->msg_iov;
    iovlen = msg->msg_iovlen;
    flags  = msg->msg_flags;

    while (--iovlen >= 0) {

        unsigned char __user *from = iov->iov_base;

        while (seglen > 0) {

            if (copy <= 0) {

                skb = sk_stream_alloc_skb(sk,
                                          select_size(sk, sg),
                                          sk->sk_allocation);

                skb_entail(sk, skb);
            }

            if (skb_availroom(skb) > 0) {
                skb_add_data_nocache(sk, skb, from, copy);
            }

            ......
        }
    }
}
\`\`\`

\`msg->msg_iov\` holds the user-space buffer being transmitted. The kernel allocates an \`skb\`, copies the user buffer into it — incurring one or more memory copies — and appends the \`skb\` to the write queue via \`skb_entail\`.

The kernel does not immediately transmit every \`skb\` it builds. The decision is made as follows (also in \`net/ipv4/tcp.c\`):



\`\`\`c
int tcp_sendmsg(...)
{
    while (...) {
        while (...) {

            if (forced_push(tp)) {
                tcp_mark_push(tp, skb);
                __tcp_push_pending_frames(sk, mss_now, TCP_NAGLE_PUSH);
            } else if (skb == tcp_send_head(sk)) {
                tcp_push_one(sk, mss_now);
            }

            continue;
        }
    }
}
\`\`\`

- Transmission begins only when \`forced_push(tp)\` returns true — meaning 

  1. The pending data exceeds half the maximum window or
  2. When the \`skb\` is the first unsent segment at the head of the write queue. 

- If neither condition holds, the call chain simply accumulates data into the write queue without transmitting.

Regardless of which path triggers transmission, both \`__tcp_push_pending_frames\` and \`tcp_push_one\` ultimately call \`tcp_write_xmit\` (found in \`net/ipv4/tcp_output.c\`):


#### \`tcp_write_xmit\` (2nd Clone of Data, Shallow copy of \`skb\`)
![](/assets/img/2026-04-10-04-24-35.png)

\`\`\`c
static bool tcp_write_xmit(struct sock *sk, unsigned int mss_now, int nonagle,
                            int push_one, gfp_t gfp)
{
    while ((skb = tcp_send_head(sk)))
    {
        cwnd_quota = tcp_cwnd_test(tp, skb);
        tcp_snd_wnd_test(tp, skb, mss_now);

        tcp_mss_split_point(...);
        tso_fragment(sk, skb, ...);
        ......

        tcp_transmit_skb(sk, skb, 1, gfp);
    }
}
\`\`\`



\`tcp_write_xmit\` pulls each pending \`skb\` from the head of the write queue, checks sliding window constraints (congestion window quota via \`tcp_cwnd_test\` and send window via \`tcp_snd_wnd_test\`), optionally splits or fragments the segment, and passes it to \`tcp_transmit_skb\`.

\`tcp_transmit_skb\` is the last step in the transport layer (also in \`net/ipv4/tcp_output.c\`):

\`\`\`c
static int tcp_transmit_skb(struct sock *sk, struct sk_buff *skb, int clone_it,
                            gfp_t gfp_mask)
{
    if (likely(clone_it)) {
        skb = skb_clone(skb, gfp_mask);
        ......
    }

    th = tcp_hdr(skb);
    th->source = inet->inet_sport;
    th->dest   = inet->inet_dport;
    th->window = ...;
    th->urg    = ...;
    ......

    err = icsk->icsk_af_ops->queue_xmit(skb, &inet->cork.fl);
}
\`\`\`

- The first thing \`tcp_transmit_skb\` does is clone the \`skb\`. \`skb_clone\` performs a **shallow copy** — it allocates a new \`sk_buff\` header struct but does *not* copy the underlying packet data buffer. Both the original and the clone point at the same \`skb->data\` memory, protected by a reference count (\`skb_shinfo(skb)->dataref\`). This is intentional and cheap: we only need a separate header so each copy can carry its own state (e.g. which layer has already processed it), while the actual bytes are shared.

- The original \`skb\` must remain in \`sk_write_queue\` because TCP is a reliable protocol — if the remote peer does not acknowledge the segment within a timeout, the kernel needs to retransmit it. Because the data buffer is shared, the original still has access to the full packet payload for retransmission without any extra copy.

- The clone is what gets handed down to lower layers and eventually freed at the network device layer once the NIC confirms transmission. When the clone is freed, the reference count on the shared data buffer is decremented; the data is only truly released when the count reaches zero, which happens after the original \`skb\` is also freed.

- The original \`skb\` is only removed from \`sk_write_queue\` once the corresponding ACK is received at the transport layer.

After stamping the TCP header, the function dispatches to the network layer via
\`\`\`c
icsk->icsk_af_ops->queue_xmit
\`\`\`
which eventually resolves to \`ip_queue_xmit\` in \`net/ipv4/tcp_ipv4.c\`.

### Network Layer: IP Header and Routing


![](/assets/img/2026-04-12-21-10-24.png)

#### \`ip_queue_xmit\`


\`ip_queue_xmit\` is responsible for routing lookup and IP header construction (in \`net/ipv4/ip_output.c\`):

\`\`\`c
int ip_queue_xmit(struct sk_buff *skb, struct flowi *fl)
{
    rt = (struct rtable *)__sk_dst_check(sk, 0);
    if (rt == NULL) {
        rt = ip_route_output_ports(...);
        sk_setup_caps(sk, &rt->dst);
    }

    skb_dst_set_noref(skb, &rt->dst);

    iph = ip_hdr(skb);
    iph->protocol = sk->sk_protocol;
    iph->ttl      = ip_select_ttl(inet, &rt->dst);
    iph->frag_off = ...;

    ip_local_out(skb);
}
\`\`\`

- The kernel first checks whether the socket has a cached route entry.

- If not, it calls \`ip_route_output_ports\` to find which interface and gateway to use, then caches the result in the socket for future packets. 

The routing table on a Linux machine (seen via \`route -n\`) looks like this:

\`\`\`text
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         172.25.0.1      0.0.0.0         UG    0      0        0 eth0
172.25.0.0      0.0.0.0         255.255.0.0     U     0      0        0 eth0
\`\`\`

Each row tells the kernel 
1. which NIC (\`Iface\`) to use and 
2. which gateway to route through 

for a given destination. The selected route entry (the single row in the routing table) is stored in \`skb\` via the \`_skb_refdst\` field:

\`\`\`c
struct sk_buff {
    ...
    unsigned long  _skb_refdst;
}
\`\`\`

#### \`ip_local_out\`

After setting the routing destination and constructing the IP header, \`ip_queue_xmit\` calls \`ip_local_out\` (also in \`net/ipv4/ip_output.c\`):

\`\`\`c
int ip_local_out(struct sk_buff *skb)
{
    err = __ip_local_out(skb);
    if (likely(err == 1))
        err = dst_output(skb);
    ...
}
\`\`\`

- The call chain \`ip_local_out\` → \`__ip_local_out\` → \`nf_hook\` passes through \`netfilter\`. If rules are configured in \`iptables\`, they are evaluated here. 

- Complex \`iptables\` rulesets can introduce significant CPU overhead at this point.

#### \`dst_output\`

\`\`\`c
static inline int dst_output(struct sk_buff *skb)
{
    return skb_dst(skb)->output(skb);
}
\`\`\`

- \`dst_output\` (in \`include/net/dst.h\`) finds the routing destination stored in \`skb\` and invokes its \`output\` function pointer. 

- This function pointer resolves to \`ip_output\` (in \`net/ipv4/ip_output.c\`):

\`\`\`c{6}
int ip_output(struct sk_buff *skb)
{
    ......

    return NF_HOOK_COND(NFPROTO_IPV4, NF_INET_POST_ROUTING,
                        ip_finish_output,
                        !(IPCB(skb)->flags & IPSKB_REROUTED));
}
\`\`\`

- Statistical accounting is done here (purely for observability that lets operators and monitoring systems see traffic volumes and detect anomalies).

- \`netfilter\` is consulted again for post-routing rules, then \`ip_finish_output\` is invoked (also in \`net/ipv4/ip_output.c\`):


#### \`ip_finish_output\`, the MTU and Fragmentation (3rd Clone of Data, Optional)
\`\`\`c
static int ip_finish_output(struct sk_buff *skb)
{
    if (skb->len > ip_skb_dst_mtu(skb) && !skb_is_gso(skb))
        return ip_fragment(skb, ip_finish_output2);
    else
        return ip_finish_output2(skb);
}
\`\`\`

- If the packet size exceeds the ***MTU*** (Maximum Transmission Unit), \`ip_fragment\` splits it into smaller pieces before continuing down the stack.

- The MTU is a limit imposed by the physical link — for Ethernet it is typically 1500 bytes. Fragmentation exists to handle packets larger than what a link can carry in a single frame.

However, fragmentation has two real ***costs***. 

1. Each fragment must be individually processed, increasing CPU usage across all intermediate hops. 

2. If any single fragment is lost in a transit, the entire original packet must be retransmitted because IP reassembly has no partial-recovery mechanism. 

Avoiding fragmentation reduces both computation overhead and retransmission cost.

The MTU itself is determined through Path MTU Discovery (PMTUD): we send packets with the "Don't Fragment" (DF) bit set, and if an intermediate router cannot forward the packet, it returns an ICMP "Fragmentation Needed" message specifying the maximum size it can handle. 

The kernel then updates the cached MTU for that route, and future packets will be sized accordingly.



### Neighbor Subsystem: ARP and MAC Header


#### Next-hop IP Address and MAC Address

Before diving into the code, it helps to be clear on what these two addresses mean and why both are needed.


##### What is a Hop?


A **hop** is one leg of a packet's journey — the transit across a single network link from one device to the next. Every time a packet passes through a router, that counts as one hop. The IP TTL (Time To Live) field is decremented by 1 per hop; when it hits 0 the packet is dropped. This is exactly how \`traceroute\` works — each line of its output represents one hop:

\`\`\`bash
$ traceroute google.com
 1  192.168.1.1      1ms   ← your home router       (hop 1)
 2  100.64.0.1       5ms   ← ISP edge router         (hop 2)
 3  72.14.204.1     12ms   ← Google's network        (hop 3)
 4  142.250.80.46   14ms   ← destination             (hop 4)
\`\`\`

##### IP Address and MAC Address

<item>

**IP address.** A logical, routable address assigned in software. It identifies a host globally across the entire internet and stays the same as a packet is forwarded from router to router.

</item>

<item>

**MAC address.** A 48-bit hardware address burned into the NIC at manufacture time (e.g. \`00:1A:2B:3C:4D:5E\`). It only identifies a device *within a single local network segment* (a broadcast domain / Layer-2 domain). Every Ethernet frame carries a destination MAC so the local switch knows which port to deliver the frame to.

</item>


The key distinction: IP addresses survive the entire journey end-to-end; MAC addresses are **replaced at every hop**.

\`\`\`
Host A ──────── Router R ──────── Host B
  IP:  10.0.0.2   10.0.0.1/192.168.1.1   192.168.1.2

Frame A→R:  src MAC = A's MAC,   dst MAC = R's MAC   (local link)
Frame R→B:  src MAC = R's MAC,   dst MAC = B's MAC   (next local link)
IP header:  src IP  = 10.0.0.2,  dst IP  = 192.168.1.2  (unchanged throughout)
\`\`\`

The **next-hop IP address** is the IP of the *immediately adjacent* device the packet should be forwarded to on the current local link — it is not necessarily the final destination:

- **Same subnet**: next-hop = destination IP itself (peer is reachable directly).
- **Different subnet**: next-hop = gateway IP (the router on the local link that will forward the packet onward).

##### Why Is the Ethernet Destination MAC Needed?

The **switch** — the device physically connecting machines on a local network — operates at Layer 2 and only understands MAC addresses. It has no knowledge of IP. When a frame arrives at a switch port, the switch looks at the destination MAC to decide which port to forward the frame out of, using a table like:

\`\`\`
MAC address          Port
00:1A:2B:3C:4D:5E    port 3
AA:BB:CC:DD:EE:FF    port 7
\`\`\`

Without a destination MAC, the switch would have to flood the frame out of every port, wasting bandwidth. The full flow on a local link is:

\`\`\`
Your machine
  └─ knows destination IP (e.g. 192.168.1.5)
  └─ asks ARP: "who has 192.168.1.5?" → gets back MAC AA:BB:CC:DD:EE:FF
  └─ builds Ethernet frame with dst MAC = AA:BB:CC:DD:EE:FF
        ↓
Switch receives frame
  └─ looks up AA:BB:CC:DD:EE:FF → "port 7"
  └─ forwards frame only out of port 7
        ↓
Destination NIC
  └─ sees its own MAC in dst field → accepts the frame
\`\`\`

The MAC is the switch's delivery address for the local segment; the IP is the router's delivery address for the global network. 

The ***neighbor subsystem's job*** is to take the next-hop IP and find the MAC address that corresponds to it, so that the kernel can fill in the Ethernet destination MAC field before putting the frame on the wire.

#### \`ip_finish_output2\`

\`ip_finish_output2\` passes the \`skb\` to the neighbor subsystem (in \`net/ipv4/ip_output.c\`):

\`\`\`c
static inline int ip_finish_output2(struct sk_buff *skb)
{
    nexthop = (__force u32) rt_nexthop(rt, ip_hdr(skb)->daddr);
    neigh = __ipv4_neigh_lookup_noref(dev, nexthop);
    if (unlikely(!neigh))
        neigh = __neigh_create(&arp_tbl, &nexthop, dev, false);

    int res = dst_neigh_output(dst, neigh, skb);
}
\`\`\`

- The neighbor subsystem sits between the network layer and the data link layer. Its job is to resolve the next-hop IP address to a MAC (hardware) address so the kernel can construct an Ethernet frame. 

- Because this concern is shared between IPv4 and IPv6, the subsystem lives outside \`net/ipv4/\` as a generic module that both protocol families use. This separation means neither the IP layer nor the link layer needs to contain any address-resolution logic directly.

\`__ipv4_neigh_lookup_noref\` receives the next-hop IP address (\`nexthop\`) as its second argument. This address is derived from the destination IP in the IP header — it is ***either*** the final destination itself (when the peer is on the same subnet) or the gateway address (when routing across subnets). 

The function consults the ARP cache:

#### \`__ipv4_neigh_lookup_noref\`

\`\`\`c
static inline struct neighbour *__ipv4_neigh_lookup_noref(
    struct net_device *dev, u32 key)
{
    struct neigh_hash_table *nht = rcu_dereference_bh(arp_tbl.nht);

    hash_val = arp_hashfn(......);
    for (n = rcu_dereference_bh(nht->hash_buckets[hash_val]);
          n != NULL;
          n = rcu_dereference_bh(n->next)) {
        if (n->dev == dev && *(u32 *)n->primary_key == key)
            return n;
    }
}
\`\`\`

If no entry is found, \`__neigh_create\` allocates a new neighbor item (detailed in \`net/core/neighbour.c\`):

\`\`\`c
struct neighbour *__neigh_create(......)
{
    struct neighbour *n1, *rc, *n = neigh_alloc(tbl, dev);

    memcpy(n->primary_key, pkey, key_len);
    n->dev = dev;
    n->parms->neigh_setup(n);

    rcu_assign_pointer(nht->hash_buckets[hash_val], n);
    ......
}
\`\`\`

A newly-created neighbor item does not yet have a MAC address — it is in an incomplete state. ARP (Address Resolution Protocol) is used to discover the MAC address corresponding to an IP address. 

When a neighbor item is first created, an ARP broadcast request is sent onto the local network, and the host with that IP responds with its MAC address. The MAC address is then stored in the neighbor entry.


#### \`dst_neigh_output\`

After creation, \`dst_neigh_output\` (in \`include/net/dst.h\`) delegates to \`neigh_resolve_output\`:

\`\`\`c
static inline int dst_neigh_output(struct dst_entry *dst,
                                    struct neighbour *n, struct sk_buff *skb)
{
    ......
    return n->output(n, skb);
}
\`\`\`

The \`output\` pointer resolves to \`neigh_resolve_output\` (in \`net/core/neighbour.c\`):

\`\`\`c
int neigh_resolve_output()
{
    if (!neigh_event_send(neigh, skb)) {

        dev_hard_header(skb, dev, ntohs(skb->protocol),
                        neigh->ha, NULL, skb->len);

        dev_queue_xmit(skb);
    }
}
\`\`\`

\`neigh_event_send\` may trigger an ARP request if the MAC address is not yet available. Once the MAC address is known, \`neigh->ha\` holds it, and \`dev_hard_header\` attaches the Ethernet MAC header to the \`skb\`. The packet is then passed to \`dev_queue_xmit\`.

![](/assets/img/2026-04-12-21-47-45.png)

### Network Device Subsystem: qdisc and Transmission

#### What is a qdisc?

A **qdisc** (queueing discipline) is the kernel's traffic scheduler attached to each transmit queue of a network interface. It sits between the IP stack and the NIC driver and controls *how* packets are ordered, delayed, or dropped before transmission.

The application can produce packets far faster than the NIC can put them on the wire. Without a qdisc, the only options when the NIC is busy are "send immediately" or "drop immediately." A qdisc provides a managed buffer in between. More concretely, it serves three purposes:

1. **Buffering / burst absorption** — holds packets while the NIC is busy with a previous one, so short bursts don't cause immediate drops.

2. **Traffic shaping** — controls the rate at which packets leave. For example, \`tbf\` (Token Bucket Filter) can cap an interface at exactly 100 Mbit/s regardless of how fast the kernel pushes packets down.

3. **Traffic prioritization / fairness** — decides *which* packet in the queue goes next. VoIP traffic can be sent before a bulk file transfer; multiple TCP flows can be given equal throughput shares.

Common qdiscs built into the kernel:

| qdisc | Behaviour |
|---|---|
| \`pfifo_fast\` | Default; simple 3-band FIFO based on ToS/DSCP |
| \`fq_codel\` | Fair queuing + CoDel AQM; default on many modern distros |
| \`tbf\` | Token Bucket Filter — hard rate cap |
| \`htb\` | Hierarchical Token Bucket — hierarchical bandwidth allocation |
| \`noqueue\` | No queuing at all; used for loopback |

The qdisc is the kernel's pluggable, per-queue packet scheduler. It is what makes \`tc\` (traffic control) possible — you can swap the qdisc on a live interface without rebooting or changing application code.

#### \`dev_queue_xmit\`


![](/assets/img/2026-04-12-22-16-27.png)

\`dev_queue_xmit\` is the entry point into the network device subsystem (in \`net/core/dev.c\`):

\`\`\`c
int dev_queue_xmit(struct sk_buff *skb)
{
    txq = netdev_pick_tx(dev, skb);

    q = rcu_dereference_bh(txq->qdisc);

    if (q->enqueue) {
        rc = __dev_xmit_skb(skb, q, dev, txq);
        goto out;
    }

    ......
}
\`\`\`

- \`netdev_pick_tx\` selects which of the NIC's transmit queues to use. This decision is influenced by XPS (Transmit Packet Steering) configuration. 

- XPS allows us to pin specific transmit queues to specific CPU cores, reducing cache contention and improving locality. If no XPS configuration is found, the kernel falls back to computing the queue index automatically (in \`net/core/flow_dissector.c\`):

  \`\`\`c
  u16 __netdev_pick_tx(struct net_device *dev, struct sk_buff *skb)
  {
      int new_index = get_xps_queue(dev, skb);

      if (new_index < 0)
          new_index = skb_tx_hash(dev, skb);
  }
  \`\`\`

#### \`__dev_xmit_skb\`

After selecting the queue, we obtain the qdisc (queueing discipline) associated with it and enter \`__dev_xmit_skb\` (in \`net/core/dev.c\`):

\`\`\`c
static inline int __dev_xmit_skb(struct sk_buff *skb, struct Qdisc *q,
                                  struct net_device *dev,
                                  struct netdev_queue *txq)
{
    if ((q->flags & TCQ_F_CAN_BYPASS) && !qdisc_qlen(q) &&
        qdisc_run_begin(q)) {
        ......
    }

    else {
        q->enqueue(skb, q);
        __qdisc_run(q);
    }
}
\`\`\`

There are two paths:
1. The queue can be bypassed entirely (if it is idle and supports bypass mode), or

2. The \`skb\` is enqueued normally and \`__qdisc_run\` is invoked to drain it (in \`net/sched/sch_generic.c\`):

#### \`__qdisc_run\` {#qdisc_run}

\`\`\`c
void __qdisc_run(struct Qdisc *q)
{
    int quota = weight_p;

    while (qdisc_restart(q)) {

        if (--quota <= 0 || need_resched()) {

            __netif_schedule(q);
            break;
        }
    }
}
\`\`\`

\`__qdisc_run\` loops to drain all pending \`skb\` objects from the queue, running in the context of the user process. 

If the quota runs out or another process needs the CPU, the loop breaks and a \`NET_TX_SOFTIRQ\` soft interrupt is raised to continue the work outside of user process context.

This is why when we inspect \`/proc/softirqs\`, the \`NET_RX\` counter is typically much larger than \`NET_TX\`. Receiving always goes through \`NET_RX\` soft interrupts, while sending only resorts to \`NET_TX_SOFTIRQ\` when the qdisc quota is exhausted.


#### \`qdisc_restart\`

\`qdisc_restart\` dequeues one \`skb\` and calls \`sch_direct_xmit\`:

\`\`\`c
static inline int qdisc_restart(struct Qdisc *q)
{
    skb = dequeue_skb(q);
    ......
    return sch_direct_xmit(skb, q, dev, txq, root_lock);
}
\`\`\`

\`\`\`c
int sch_direct_xmit(struct sk_buff *skb, struct Qdisc *q,
                    struct net_device *dev, struct netdev_queue *txq,
                    spinlock_t *root_lock)
{
    ret = dev_hard_start_xmit(skb, dev, txq);
}
\`\`\`


#### \`__netif_reschedule\`
Back to section [#qdisc_run], when the qdisc quota is exhausted, \`__netif_schedule\` calls \`__netif_reschedule\` (in \`net/core/dev.c\`):

\`\`\`c
static inline void __netif_reschedule(struct Qdisc *q)
{
    sd = &_get_cpu_var(softnet_data);
    q->next_sched = NULL;
    *sd->output_queue_tailp = q;
    sd->output_queue_tailp = &q->next_sched;

    ......
    raise_softirq_irqoff(NET_TX_SOFTIRQ);
}
\`\`\`

- \`softnet_data\` accumulates the queues that still have data to send. 

- The registered \`net_tx_action\` handler is invoked by the soft-interrupt infrastructure — outside of user process context — to continue delivering the data (in \`net/core/dev.c\`):

\`\`\`c
static void net_tx_action(struct softirq_action *h)
{
    struct softnet_data *sd = &__get_cpu_var(softnet_data);

    if (sd->output_queue) {

        head = sd->output_queue;

        while (head) {
            struct Qdisc *q = head;
            head = head->next_sched;

            qdisc_run(q);
        }
    }
}
\`\`\`

\`output_queue\` holds the target transmit queues. 

The soft interrupt loops through them and calls \`qdisc_run\`, which goes back through \`__qdisc_run\` → \`qdisc_restart\` → \`sch_direct_xmit\` → \`dev_hard_start_xmit\`.


### NIC Driver: Writing into the Ring Buffer
#### \`dev_hard_start_xmit\`


![](/assets/img/2026-04-14-02-37-32.png)

Both the user process context and the soft-interrupt context ultimately arrive at \`dev_hard_start_xmit\` (in \`net/core/dev.c\`):

\`\`\`c
int dev_hard_start_xmit(struct sk_buff *skb, struct net_device *dev,
                        struct netdev_queue *txq)
{
    const struct net_device_ops *ops = dev->netdev_ops;

    features = netif_skb_features(skb);

    skb_len = skb->len;
    rc = ops->ndo_start_xmit(skb, dev);
}
\`\`\`

\`ndo_start_xmit\` is a callback defined by the NIC driver through \`net_device_ops\` (in \`include/linux/netdevice.h\`):

\`\`\`c
struct net_device_ops {
    netdev_tx_t     (*ndo_start_xmit) (struct sk_buff *skb,
                                      struct net_device *dev);
};
\`\`\`

In the igb NIC driver (in \`drivers/net/ethernet/intel/igb/igb_main.c\`), this is wired to \`igb_xmit_frame\`:

\`\`\`c
static const struct net_device_ops igb_netdev_ops = {
    .ndo_open        = igb_open,
    .ndo_stop        = igb_close,
    .ndo_start_xmit  = igb_xmit_frame,
    ......
};
\`\`\`

\`igb_xmit_frame\` selects the ring buffer and delegates to \`igb_xmit_frame_ring\`:

\`\`\`c
static netdev_tx_t igb_xmit_frame(struct sk_buff *skb,
                                  struct net_device *netdev)
{
    ......
    return igb_xmit_frame_ring(skb, igb_tx_queue_mapping(adapter, skb));
}
\`\`\`

\`\`\`c
netdev_tx_t igb_xmit_frame_ring(struct sk_buff *skb,
                                struct igb_ring *tx_ring)
{
    first = &tx_ring->tx_buffer_info[tx_ring->next_to_use];
    first->skb = skb;
    first->bytecount = skb->len;
    first->gso_segs = 1;

    igb_tx_map(tx_ring, first, hdr_len);
}
\`\`\`

The transmit ring buffer picks the next available slot via \`next_to_use\`, assigns the \`skb\`, and calls \`igb_tx_map\` to create the DMA mapping (also in \`drivers/net/ethernet/intel/igb/igb_main.c\`):

\`\`\`c
static void igb_tx_map(struct igb_ring *tx_ring,
                      struct igb_tx_buffer *first,
                      const u8 hdr_len)
{
    tx_desc = IGB_TX_DESC(tx_ring, i);

    dma = dma_map_single(tx_ring->dev, skb->data, size, DMA_TO_DEVICE);

    for (frag = &skb_shinfo(skb)->frags[0];; frag++) {
        tx_desc->read.buffer_addr = cpu_to_le64(dma);
        tx_desc->read.cmd_type_len = ...;
        tx_desc->read.olinfo_status = 0;
    }

    cmd_type |= size | IGB_TXD_DCMD;
    tx_desc->read.cmd_type_len = cpu_to_le32(cmd_type);
}
\`\`\`

\`dma_map_single\` creates a mapping between the \`skb\`'s data buffer in RAM and a DMA-accessible address. The descriptor array (\`e1000_adv_tx_desc[]\`) is populated with these DMA addresses. The NIC reads the descriptors and fetches the packet data directly from RAM via DMA without involving the CPU, then transmits it onto the wire.

![](/assets/img/2026-04-14-03-21-58.png)

### Cleanup After Transmission

After the NIC finishes transmitting, it issues a hard interrupt to notify the kernel that the ring buffer slots can be freed. Regardless of whether the hard interrupt was caused by a receive or a transmit completion, the soft interrupt it raises is always \`NET_RX_SOFTIRQ\` (in \`drivers/net/ethernet/intel/igb/igb_main.c\`):

\`\`\`c
static inline void ____napi_schedule(...)
{
    list_add_tail(&napi->poll_list, &sd->poll_list);
    __raise_softirq_irqoff(NET_RX_SOFTIRQ);
}
\`\`\`

This is another reason \`NET_RX\` always dominates in \`/proc/softirqs\`.

The \`igb_poll\` NAPI handler handles the transmit completion cleanup:

\`\`\`c
static int igb_poll(struct napi_struct *napi, int budget)
{
    if (q_vector->tx.ring)
        clean_complete = igb_clean_tx_irq(q_vector);
    ......
}
\`\`\`

\`igb_clean_tx_irq\` does the actual memory cleanup:

\`\`\`c
static bool igb_clean_tx_irq(struct igb_q_vector *q_vector)
{
    dev_kfree_skb_any(tx_buffer->skb);

    tx_buffer->skb = NULL;
    dma_unmap_len_set(tx_buffer, len, 0);

    while (tx_desc != eop_desc) {
    }
}
\`\`\`

The cloned \`skb\` (the one handed down to lower layers) is freed here via \`dev_kfree_skb_any\`, the DMA mapping is removed, and the ring buffer slot is cleared.

The original \`skb\` — the one that stayed in \`sk_write_queue\` as the TCP retransmission buffer — is not freed at this point. It remains in the queue until the transport layer receives an ACK from the remote peer confirming successful delivery, at which point it is finally destroyed.

![](/assets/img/2026-04-14-08-57-57.png)



### References
- 划水的猫, [*网卡驱动初始化解析*](https://www.cnblogs.com/573583868wuy/p/17810582.html), 博客園

- 張彥飛, *深入理解 Linux 網絡*, Broadview`;export{e as default};
