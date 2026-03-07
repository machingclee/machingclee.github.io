---
title: "Networking in Linux Kernel"
date: 2026-03-07
id: blog0471
tag: linux, C
toc: true
intro: "We study networking via diving into the source code."
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

### Overview

When a network packet arrives at a machine, the Linux kernel does not process it all in one shot. Instead it splits the work across two distinct phases: a hard interrupt that signals the CPU as fast as possible, and a deferred soft interrupt that does the heavier lifting without blocking the CPU from other tasks. Understanding these two phases — and the subsystems that wire them together — is the foundation for understanding how Linux networking works at a kernel level.

### Hard Interrupts and Soft Interrupts

#### NIC — Network Interface Card

A NIC (Network Interface Card) is the hardware component that connects a machine to a network. It has a MAC address identifying it on the local network, receives raw electrical or optical signals and converts them into bytes, and writes those bytes directly into kernel memory via **DMA** (Direct Memory Access) — the CPU is not involved in the data copy. When a frame is fully received, the NIC raises a hardware interrupt to notify the CPU.

In modern servers the NIC is often a PCIe add-in card or an on-board controller. The `igb` driver discussed later in this article targets the Intel 82575/82576 family of Gigabit Ethernet NICs.

#### ISR — Interrupt Service Routine

When a NIC receives a packet, it raises a ***hard interrupt***. The CPU stops what it is doing, saves registers, consults the interrupt vector table to find the registered handler for that interrupt vector, and jumps to it — the ISR (Interrupt Service Routine).

For the `igb` driver the ISR is `igb_msix_ring`. It must run in the shortest time possible because while the ISR executes, all other interrupts on that CPU core are blocked. Its only jobs are:

1. Acknowledge the interrupt to the NIC hardware so it stops asserting the line.

2. Call `napi_schedule` to queue the heavier processing work.
3. Return immediately, restoring the CPU to what it was doing.

All actual packet work — DMA mapping, `sk_buff` allocation, protocol dispatch — is deferred to a ***soft interrupt*** (softirq). A softirq runs after the hard interrupt handler returns, in a context that still cannot be preempted by user processes but can be preempted by other hard interrupts. This two-phase design lets the kernel acknowledge the hardware quickly and get out of the way, while actual packet processing happens in the softer deferred phase.

```mermaid
flowchart TD
    A([NIC receives packet]) --> B[Hard Interrupt raised]
    B --> C[ISR runs on CPU]
    C --> D[Acknowledge HW\nset softirq bit]
    D --> E([Return from ISR])
    E --> F[Soft Interrupt phase]
    F --> G[DMA mapping\nskb allocation\nprotocol dispatch]
```

#### The Socket Buffer — `sk_buff` (aka `skb`)

`skb` is shorthand for `struct sk_buff`, the central data structure that represents a network packet as it travels through the kernel networking stack. When the NAPI poll function drains the hardware ring buffer, it wraps each received page in an `sk_buff` so that every layer above — IP, TCP, UDP — can work with a uniform interface.

An `sk_buff` carries:

- **Data pointers** — `head`, `data`, `tail`, and `end` delimit the packet payload and the headroom/tailroom reserved for headers. Each layer peels or pushes headers by adjusting `data` and `tail` without copying bytes.

- **Protocol metadata** — offsets to the MAC, network, and transport headers, plus the protocol identifier.
- **Device reference** — a pointer to the `net_device` the packet arrived on.
- **Checksum and timestamp fields** — used by the checksum offload engine and packet timestamping subsystem.

The reason skb allocation is listed alongside DMA mapping in the softirq phase — rather than the hard interrupt phase — is deliberate. Allocating memory (`kmem_cache_alloc` from the `skbuff_head_cache` slab) and filling in metadata takes non-trivial time. Doing it inside a hard interrupt would block all other interrupts on that CPU core. Deferring it to the softirq phase keeps the ISR minimal and the system responsive.

### `ksoftirqd` and `ksoftirqd_should_run`

Each CPU core has a dedicated kernel thread called `ksoftirqd/N` (where `N` is the CPU index). It is created at boot time via `smpboot_register_percpu_thread`. Once created, the thread enters a loop managed by the `smpboot` infrastructure: it repeatedly calls `ksoftirqd_should_run` to decide whether there is pending softirq work, then calls `run_ksoftirqd` to process it.

`ksoftirqd_should_run` is not an explicit `while` loop in user-visible code — the looping is done by `smpboot`'s thread function. Internally `ksoftirqd_should_run` simply checks whether any softirq is pending:

```c
static int ksoftirqd_should_run(unsigned int cpu)
{
    return local_softirq_pending();
}
```

If `local_softirq_pending()` returns non-zero — meaning at least one softirq bit is set for this CPU — the thread wakes up and calls `run_ksoftirqd`, which in turn calls `__do_softirq`. That function iterates over the pending softirq bits and invokes the registered handler for each one. After draining the queue, the thread goes back to sleep. The result is a recurring, CPU-affine loop that processes soft interrupts without starving user-space.

```mermaid
flowchart TD
    A(["smpboot thread loop"]) --> B{"ksoftirqd_should_run?\nlocal_softirq_pending"}
    B -- No --> C[sleep / schedule]
    C --> A
    B -- Yes --> D[run_ksoftirqd]
    D --> E["__do_softirq"]
    E --> F["iterate pending bits\ncall softirq_vec handlers"]
    F --> A
```

### Soft Interrupt Types

All softirq types are enumerated in `include/linux/interrupt.h`:

```c
enum
{
    HI_SOFTIRQ=0,
    TIMER_SOFTIRQ,
    NET_TX_SOFTIRQ,
    NET_RX_SOFTIRQ,
    BLOCK_SOFTIRQ,
    IRQ_POLL_SOFTIRQ,
    TASKLET_SOFTIRQ,
    SCHED_SOFTIRQ,
    HRTIMER_SOFTIRQ,
    RCU_SOFTIRQ,
    NR_SOFTIRQS
};
```

The two entries relevant to networking are `NET_TX_SOFTIRQ` (outgoing packet processing) and `NET_RX_SOFTIRQ` (incoming packet processing). Each value is simply an index into `softirq_vec`, an array of `struct softirq_action` that maps each index to its handler function. When a hard interrupt sets a bit in the pending mask, `__do_softirq` picks it up and calls the corresponding entry.

```mermaid
flowchart TD
    A["NET_TX_SOFTIRQ index"] --> B[softirq_vec]
    C["NET_RX_SOFTIRQ index"] --> B
    B --> D[net_tx_action]
    B --> E[net_rx_action]
```

### Initialising the Network Subsystem — `net_dev_init`

The network device subsystem is initialised via:

```c
subsys_initcall(net_dev_init);
```

This macro registers `net_dev_init` to run during the `subsys` phase of kernel boot, before any device drivers load. Inside `net_dev_init`, two things happen that matter for packet reception.

First, a `struct softnet_data` is allocated for every CPU:

```c
struct softnet_data {
    struct list_head    poll_list;
    ...
};
```

Second, the softirq handlers for networking are registered:

```c
open_softirq(NET_TX_SOFTIRQ, net_tx_action);
open_softirq(NET_RX_SOFTIRQ, net_rx_action);
```

This records `net_rx_action` and `net_tx_action` in `softirq_vec` at the `NET_RX_SOFTIRQ` and `NET_TX_SOFTIRQ` indices respectively. 

From this point on, whenever a NIC raises a hard interrupt and sets the `NET_RX_SOFTIRQ` bit, `ksoftirqd` (or the `__do_softirq` path) will eventually call `net_rx_action`.

#### NAPI — New API

NAPI is the interrupt-mitigation mechanism introduced in Linux 2.6 to handle high-throughput NICs without drowning the CPU in hardware interrupts.

The problem it solves: at 10 Gbps line rate a NIC can raise tens of millions of hard interrupts per second — one per packet. Each interrupt preempts whatever the CPU was doing, saves and restores context, and runs the ISR. At high packet rates this overhead alone consumes the entire CPU, leaving no time for actual processing.

NAPI's solution is to switch from interrupt-driven reception to a polling loop once traffic exceeds a threshold:

1. The first packet on a queue triggers a normal hard interrupt.

2. The ISR calls `napi_schedule`, which adds the queue's `napi_struct` to `softnet_data.poll_list` and **disables further interrupts for that queue**.
3. `ksoftirqd` (via `net_rx_action`) then calls the driver's registered `poll` callback in a loop, processing up to a `budget` number of packets per invocation without any further interrupts.
4. Once the ring is empty (or the budget is exhausted), interrupts are re-enabled and polling stops.

This converts a storm of interrupts into a single interrupt followed by a bounded polling loop, which drastically reduces interrupt overhead under load while still being responsive at low traffic rates.

Each NIC queue is represented by a `napi_struct`:

```c
struct napi_struct {
    struct list_head    poll_list;   /* link into softnet_data.poll_list */
    int                 (*poll)(struct napi_struct *, int); /* driver poll fn */
    int                 weight;      /* max packets per poll call (budget) */
    ...
};
```

The driver registers its `poll` function and a `weight` (typically 64) during `igb_probe`. When traffic arrives, NAPI orchestrates everything through this struct.

#### The Role of `poll_list`

`poll_list` is a linked list of `napi_struct` instances. When a NIC's hard interrupt is fired, the driver adds its `napi_struct` to the current CPU's `softnet_data.poll_list` and then disables further NIC interruptions for that queue. Then, during `net_rx_action`, the kernel iterates over `poll_list`, calling each registered `poll` function to drain the hardware ring buffer. 

After the ring is empty the NIC's interrupttion is re-enabled. `poll_list` is therefore the central handoff point between the hard-interrupt world and the softirq world. 



```mermaid
flowchart TD
    A(["subsys_initcall\nnet_dev_init"]) --> B["alloc softnet_data\nper CPU"]
    B --> C["poll_list per CPU\nlinked list of napi_struct"]
    A --> D["open_softirq\nNET_RX_SOFTIRQ -> net_rx_action"]
    A --> E["open_softirq\nNET_TX_SOFTIRQ -> net_tx_action"]
```


```mermaid
flowchart TD
    F(["NIC hard interrupt"]) --> G[napi_schedule]
    G --> H["add napi_struct to poll_list"]
    H --> I["raise NET_RX_SOFTIRQ"]
    I --> J[net_rx_action]
    J --> K["iterate poll_list\ncall poll callbacks"]
    K --> L[drain ring buffer]
    L --> M[re-enable NIC interruptions]
```

### Initialising the Protocol Stack — `inet_init`

Layer-3 and layer-4 protocol's support are brought in by:

```c
fs_initcall(inet_init);
```

`fs_initcall` runs slightly later than `subsys_initcall`, after filesystems are ready. `inet_init` lives in `net/ipv4/af_inet.c` and orchestrates several things:

1. The `AF_INET` address family is registered with the socket layer via `sock_register`.
2. Core protocol handlers are added to the IP layer's protocol table via `inet_add_protocol`. This is where `tcp_protocol` and `udp_protocol` are inserted:

```c
static struct net_protocol tcp_protocol = {
    .handler     = tcp_v4_rcv,
    .err_handler = tcp_v4_err,
    ...
};

static struct net_protocol udp_protocol = {
    .handler     = udp_rcv,
    .err_handler = udp_err,
    ...
};
```

3. The per-protocol socket operations structs (`inet_stream_ops`, `inet_dgram_ops`) are wired up.
4. `/proc` entries and sysctl knobs are registered.

#### `udp_rcv` and `tcp_v4_rcv`

Both functions are the entry point for IP packets that have been demultiplexed by the IP layer. When `ip_local_deliver_finish` pulls a packet off the IP queue, it looks up the transport protocol number in the protocol table and calls the matching `.handler`. For TCP that is `tcp_v4_rcv`; for UDP that is `udp_rcv`.

At this point the kernel has already verified the IP header and confirmed the packet is destined for this host. `tcp_v4_rcv` and `udp_rcv` then perform transport-layer processing: 
- Checksum Verification

- Socket Lookup
- Queue Insertion (into `sk->sk_receive_queue` for UDP, or into the TCP receive buffer machinery) and finally
- Waking any Blocked `recv()` Call in user space. 

These functions are executed in the context of the `net_rx_action` softirq, driven by `ksoftirqd`.

```mermaid
flowchart TD
    A(["fs_initcall\ninet_init"]) --> B["sock_register AF_INET"]
    A --> C[inet_add_protocol]
    C --> D["tcp_protocol\n.handler = tcp_v4_rcv"]
    C --> E["udp_protocol\n.handler = udp_rcv"]
    A --> F["wire inet_stream_ops\ninet_dgram_ops"]
    A --> G["register /proc\nand sysctl knobs"]

    H(["ip_local_deliver_finish"]) --> I{"proto number?"}
    I -- TCP --> D
    I -- UDP --> E
    D --> J["checksum, socket lookup\nenqueue TCP buffer"]
    E --> K["checksum, socket lookup\nenqueue sk_receive_queue"]
    J --> L(["wake user recv"])
    K --> L
```

### The NIC Driver — `igb_init_module` and `pci_register_driver`

The Intel Gigabit Ethernet driver (`igb`) registers itself at module init time:

```c
static int __init igb_init_module(void)
{
    ...
    return pci_register_driver(&igb_driver);
}
module_init(igb_init_module);
```

`pci_register_driver` does not immediately bind to any hardware. It tells the kernel's PCI subsystem that the `igb` driver exists, along with the `igb_driver` struct which carries:

- The `id_table`: a list of PCI vendor/device IDs this driver handles.
- The `probe` function pointer (`igb_probe`): called by the PCI core whenever a matching device is found.

When the PCI core enumerates the bus and finds a device whose ID matches the `id_table`, it calls `igb_probe`. At that point the driver interrogates the hardware, allocates resources, and registers a `net_device`. The driver also registers a NAPI `poll` function here — this is the function that will be placed on `poll_list` and called from `net_rx_action` to drain received packets from hardware.

```mermaid
flowchart TD
    A([igb_init_module]) --> B["pci_register_driver\nregister igb_driver"]
    B --> C{"PCI core finds\nmatching device?"}
    C -- Yes --> D[igb_probe]
    D --> E[alloc net_device]
    D --> F["register napi_struct\nwith poll function"]
    C -- No --> G([wait])
```

### Activating the Network Card — Ring Buffer and Queues

When an interface is brought up (e.g. `ip link set eth0 up`), the kernel calls through `net_device_ops.ndo_open`, which for `igb` is `igb_open`. The call order is:

```text
__igb_open
  -> igb_setup_all_rx_resources
  -> igb_setup_all_tx_resources
  -> igb_request_irq
```

`igb_setup_all_rx_resources` creates one Rx queue per CPU (or as many as configured). For each queue it calls `igb_setup_rx_resources`:

```c
int igb_setup_rx_resources(struct igb_ring *rx_ring)
{
    int size = sizeof(struct igb_rx_buffer) * rx_ring->count;
    rx_ring->rx_buffer_info = vmalloc(size);

    rx_ring->desc = dma_alloc_coherent(
        dev, rx_ring->size,
        &rx_ring->dma, GFP_KERNEL);
    ...
}
```

#### Two Parallel Arrays: the Ring Buffer

Two parallel arrays are allocated for each queue:

- `igb_rx_buffer[]` — a kernel-side software array, one entry per descriptor slot. Each entry holds the `struct page` pointer and the DMA address of the memory page allocated for that slot.

- `e1000_adv_rx_desc[]` — the hardware descriptor ring itself, allocated in DMA-coherent memory shared with the NIC. Each entry is a small structure containing a physical (DMA) buffer address the NIC writes packet data into when it deposits a packet.

These two arrays together form the ***ring buffer***. The NIC walks the descriptor ring in hardware, writing packet data directly into the kernel pages pointed to by each `e1000_adv_rx_desc` entry via DMA — the CPU is not involved in the copy. When a descriptor is filled, the NIC raises a hard interrupt. The driver's ISR then hands control off to NAPI, which calls the registered `poll` function inside `net_rx_action`. The poll function walks the ring from the last-known head, reads each completed `e1000_adv_rx_desc`, retrieves the matching page from `igb_rx_buffer`, constructs an `sk_buff`, and passes it up through the network stack.

The reason for having two separate arrays is that the NIC only understands physical (DMA) addresses, not kernel virtual addresses or `struct page` pointers. The software-side `igb_rx_buffer` keeps all the bookkeeping that only the CPU needs, while the hardware-side `e1000_adv_rx_desc` is the minimal shared interface with the NIC.

```mermaid
flowchart TD
    A(["__igb_open"]) --> B[igb_setup_all_rx_resources]
    B --> C["igb_setup_rx_resources\nper queue"]
    C --> D["vmalloc igb_rx_buffer array\nkernel-side bookkeeping"]
    C --> E["dma_alloc_coherent\ne1000_adv_rx_desc ring\nshared with NIC hardware"]
    D -- index N --> F((slot N))
    E -- index N --> F
    F --> G["page ptr + DMA addr\nin igb_rx_buffer"]
    F --> H["physical DMA addr\nin e1000_adv_rx_desc"]
    H --> I(["NIC writes packet\nvia DMA into page"])
```

### Registering Interrupt Handlers — `igb_request_irq`

After the ring buffers are set up, `__igb_open` calls `igb_request_irq` to wire the hardware interrupts to their handlers:

```c
static int igb_request_irq(struct igb_adapter *adapter)
{
    if (adapter->msix_entries) {
        err = igb_request_msix(adapter);
        ...
    }
    ...
}
```

Modern Intel NICs support MSI-X (Message Signalled Interrupts Extended), which allows each Rx/Tx queue to raise a distinct interrupt vector, each of which can be affined to a specific CPU core. `igb_request_msix` registers one handler per vector:

```c
static int igb_request_msix(struct igb_adapter *adapter)
{
    for (i = 0; i < adapter->num_q_vectors; i++) {
        struct igb_q_vector *q_vector = adapter->q_vector[i];
        ...
        err = request_irq(
            adapter->msix_entries[vector].vector,
            igb_msix_ring,
            0,
            q_vector->name,
            q_vector);
        ...
    }

    err = request_irq(
        adapter->msix_entries[vector].vector,
        igb_msix_other,
        0,
        netdev->name,
        adapter);
}
```

#### MSI-X — One Vector per Queue

Traditional interrupts used a single shared wire (INTx). If a NIC received a packet on any queue, the same wire fired and the driver had to figure out which queue caused it. That is slow and does not scale to multi-core systems.

MSI-X (Message Signalled Interrupts Extended) replaces the wire with **writes to memory**. The NIC is configured with a table of up to 2048 entries, each containing a target memory address (pointing to the CPU's local APIC) and a data value (the vector number). When a queue has work, the NIC DMA-writes that data value to that address. The CPU's interrupt controller sees it and invokes the handler registered for that specific vector number.

So "the NIC raises vector `i`" means:

1. Queue `i` has received a packet.
2. The NIC writes the MSI-X message for slot `i` into the CPU's interrupt controller.
3. The CPU invokes `igb_msix_ring` with the `igb_q_vector` for queue `i` as its argument.
4. That handler knows exactly which ring buffer to poll — no guessing, no shared state.

This one-to-one mapping of queue → vector → CPU core enables **interrupt affinity**: each queue's interrupts can be pinned to a specific core, so packet processing for that queue always happens on the same core, keeping data in that core's L1/L2 cache.

Two kinds of handler are registered:

- `igb_msix_ring` — one per Rx/Tx queue vector. When a packet arrives on queue `i`, the NIC raises vector `i`, which triggers `igb_msix_ring` on the affined CPU. This handler calls `napi_schedule`, which adds the queue's `napi_struct` to `softnet_data.poll_list` and raises the `NET_RX_SOFTIRQ` bit. `ksoftirqd` then wakes and calls `net_rx_action`, which drains the ring via the registered poll callback.

- `igb_msix_other` — handles administrative events: link state changes, hardware errors, and similar non-data-path events.

#### Full Call Chain

The full path from packet arrival to user-space delivery is:

```mermaid
flowchart TD
    A(["NIC raises MSI-X vector"]) --> B["igb_msix_ring\nhard interrupt on affined CPU"]
    B --> C[napi_schedule]
    C --> D["add napi_struct to poll_list"]
    C --> E["raise NET_RX_SOFTIRQ"]
    E --> F["ksoftirqd wakes up"]
    F --> G[net_rx_action]
    G --> H["igb poll drains ring buffer"]
    H --> I["napi_gro_receive\nnetif_receive_skb"]
    I --> J[ip_rcv]
    J --> K{proto?}
    K -- TCP --> L[tcp_v4_rcv]
    K -- UDP --> M[udp_rcv]
    L --> N(["enqueue -> wake recv"])
    M --> N
```

Each layer of this chain is deliberately CPU-localised so that packet processing avoids cross-core cache misses wherever possible.

