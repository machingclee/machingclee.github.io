const n=`---
title: Understand \`select()\` and I/O Multiplexing
date: 2026-02-20
id: blog0458
tag: C, networking
toc: true
intro: "Study io multiplexing in mac"
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


### Repository 

- https://github.com/machingclee/2026-02-20-networking-in-C/blob/main/select_example.c




### What is I/O Multiplexing?

**I/O Multiplexing** is a technique that allows ***a single thread*** to monitor multiple file descriptors (sockets, files, pipes) simultaneously, waiting for any of them to become ready for I/O operations.

***The Problem*** Without Multiplexing:
\`\`\`c
// Server can only do ONE thing at a time
while (1) {
    int client = accept(listen_fd, ...);  // Stuck here! Can't handle existing clients
    read(client, buffer, ...);            // Stuck here! Can't accept new connections
}
\`\`\`

***The Solution*** With Multiplexing using \`select\`:
\`\`\`c
// Server can monitor ALL sockets at once
while (1) {
    select(...);  // Watches ALL sockets, wakes up when ANY is ready
    // Handle whatever is ready: new connections OR client data
}
\`\`\`
Here we are ***blocking*** our program execution using \`select\`. Different from \`accept\`, there are multiple ways to unblock this \`select\` sys call.


### The \`select()\` System Call

#### Purpose

\`select\` is used to monitor ***multiple*** file descriptors ***simultaneously***, waiting for any to become ready for I/O (such as new connection, new data received, disconnection of a socket, etc).

#### Function Signature
\`\`\`c
int select(int nfds, 
           fd_set *readfds, 
           fd_set *writefds,
           fd_set *exceptfds, 
           struct timeval *timeout);
\`\`\`

**Returns:** 
- Number of ready file descriptors (> 0)
- 0 if timeout expired
- -1 on error

**What it does:** Blocks until at least one file descriptor in the specified sets is ready for I/O, or until timeout.

#### How \`select()\` Enables Multiplexing

**Key Concept:** \`select()\` blocks on **multiple** file descriptors simultaneously, not just one.

\`\`\`text
Without select():              With select():
┌─────────────────┐           ┌─────────────────┐
│ accept(sock3)   │           │  select() on:   │
│   ↓ BLOCKED     │           │   - sock3       │
│ Can't do        │           │   - sock4       │
│ anything else!  │           │   - sock5       │
└─────────────────┘           │   ↓ BLOCKED     │
                              │ Wakes when ANY  │
                              │ socket is ready │
                              └─────────────────┘
\`\`\`

#### Parameters Explained

##### \`nfds\` - The Range to Monitor

- \`nfds\` **is NOT** the count of file descriptors! 

- \`nfds\` = **(highest file descriptor number) + 1**

- \`select()\` will check all file descriptors from 0 to (nfds - 1).

\`\`\`c
// Example: monitoring sockets 3, 4, and 7
// Highest fd is 7, so nfds = 8
// select() checks range [0, 1, 2, 3, 4, 5, 6, 7]

int nfds = 8;
select(nfds, &read_fds, NULL, NULL, NULL);
\`\`\`

*Adding by 1* simply because it specifies the range upper bound (exclusive), not the actual highest fd.

##### \`readfds\` - Sockets to Monitor for Reading

A set of file descriptors to monitor for "ready to read" status:
- For listening sockets: ready when a new connection is available
- For client sockets: ready when data is available to read

##### \`writefds\` - Sockets to Monitor for Writing (optional)

A set of file descriptors to monitor for "ready to write" status. Can be \`NULL\` if not needed.

##### \`exceptfds\` - Sockets to Monitor for Exceptions (optional)

A set of file descriptors to monitor for exceptional conditions. Usually \`NULL\`.

##### \`timeout\` - How Long to Wait (optional)

- \`NULL\`: Block indefinitely until activity
- Set value: Block for specified time
- \`{0, 0}\`: Return immediately (polling mode)

### File Descriptor Sets (\`fd_set\`)

To work with \`select()\`, we need to manage sets of file descriptors using these macros:

\`\`\`c
fd_set read_fds;

FD_ZERO(&read_fds);              // Clear the set (empty it)
FD_SET(fd, &read_fds);           // Add file descriptor to set
FD_CLR(fd, &read_fds);           // Remove file descriptor from set
FD_ISSET(fd, &read_fds);         // Check if fd is in set (after select returns)
\`\`\`

\`select()\` ***modifies*** the \`fd_set\` to indicate which descriptors are ready. We ***must rebuild*** the sets on each loop iteration by using our state variable:

\`\`\`c
clientstate_t clientStates[MAX_CLIENTS];
\`\`\`

### Complete Multiplexing Example

Here's a server that handles multiple clients using \`select()\`:

\`\`\`c
fd_set read_fds;
int listen_fd = /* listening socket */;
int nfds;

while (1) {
    // Step 1: Build the fd_set (must do this EVERY iteration)
    FD_ZERO(&read_fds);
    
    // Add listening socket
    FD_SET(listen_fd, &read_fds);
    nfds = listen_fd + 1;
    
    // Add all connected client sockets
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (clientStates[i].fd != -1) {
            FD_SET(clientStates[i].fd, &read_fds);
            
            // Track the highest fd
            if (clientStates[i].fd >= nfds) {
                nfds = clientStates[i].fd + 1;
            }
        }
    }
    
    // Step 2: Block until ANY socket has activity
    int activity = select(nfds, &read_fds, NULL, NULL, NULL);
    
    if (activity < 0) {
        perror("select");
        continue;
    }
    
    // Step 3: Check which socket(s) are ready
    
    // Check for new connections
    if (FD_ISSET(listen_fd, &read_fds)) {
        int new_client = accept(listen_fd, ...);
        // Add new_client to clientStates[]
    }
    
    // Check each client for incoming data
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (clientStates[i].fd != -1 && 
            FD_ISSET(clientStates[i].fd, &read_fds)) {
            
            // This client has data ready to read
            int bytes = read(clientStates[i].fd, buffer, sizeof(buffer));
            
            if (bytes <= 0) {
                // Client disconnected
                close(clientStates[i].fd);
                clientStates[i].fd = -1;
            } else {
                // Process the data
                process_data(buffer, bytes);
            }
        }
    }
}
\`\`\`

### Visualizing \`select()\` in Action

Here's a trace from a real server showing multiplexing:

\`\`\`bash
# Server starts, listening on fd 3
select(4, "[3]", ...) = 1              ← Monitoring only listen socket
accept(3, ...) = 4                     ← Client1 connects (fd 4)

select(5, "[3 4]", ...) = 1            ← Now monitoring 2 sockets
read(4, "Hello", ...) = 5              ← Client1 sends data

select(5, "[3 4]", ...) = 1            ← Back to monitoring both
accept(3, ...) = 5                     ← Client2 connects (fd 5)

select(6, "[3 4 5]", ...) = 1          ← Now monitoring 3 sockets!
read(5, "Hi there", ...) = 8           ← Client2 sends data

select(6, "[3 4 5]", ...) = 1          ← Monitoring all 3
read(4, "Bye", ...) = 3                ← Client1 sends more data
\`\`\`

**Notice:** 
- \`nfds\` increases as more clients connect (4 → 5 → 6)

- The \`fd_set\` shows which sockets are being watched \`[3]\` → \`[3 4]\` → \`[3 4 5]\`
- \`select()\` returns when **any** socket has activity (such as new data, new connection, new disconnection)
- The server handles new connections AND existing client data seamlessly

### The Blocking Paradox Explained

<Example>

**Question.** If \`select()\` blocks, how does it handle multiple connections?

</Example>

The answer: \`select()\` gets unblocked **efficiently on all sockets** at once.

#### Traditional Blocking (No Multiplexing)
\`\`\`c
// BLOCKED on just ONE operation
accept(listen_fd, ...);   
// ↑ Stuck here - cannot handle existing clients
\`\`\`

#### Multiplexed Blocking with \`select()\`
\`\`\`c
// BLOCKED on MULTIPLE operations
select(nfds, [listen_fd, client1, client2, client3], ...);
// ↑ Watching all sockets - wakes up when ANY has activity
\`\`\`

**Analogy:** Think of \`select()\` like a receptionist watching multiple phone lines:
- The receptionist waits (blocks) 
- But they're watching **all** phones simultaneously
- When **any** phone rings, they wake up and answer it
- Then go back to watching all phones again

This is much better than having one receptionist per phone (one thread per connection)!

### Why Multiplexing Matters

#### Without \`select()\` - Poor Solutions

**Option 1: Sequential blocking (doesn't work)**
\`\`\`c
while (1) {
    accept(...);   // Can't read from clients while waiting
    read(...);     // Can't accept new clients while reading
}
\`\`\`

**Option 2: One thread per connection (doesn't scale)**
\`\`\`c
for each client:
    create_thread(handle_client, client_fd);  // wasteful for many clients
\`\`\`

**Option 3: Busy polling (wastes CPU)**
\`\`\`c
while (1) {
    set_nonblocking(all_sockets);
    for each socket:
        try_read();  // Constantly checking, burning CPU!
}
\`\`\`

#### With \`select()\` - Elegant Solution

\`\`\`c
while (1) {
    select(nfds, &read_fds, ...);  // Efficient blocking on all sockets
    handle_ready_sockets();         // Handle only what's ready
}
\`\`\`

**Benefits:**
- Single thread handles many connections
- No wasted CPU (only wake when needed)
- Handles new connections AND existing clients
- Scales to hundreds of connections

### When to Use \`select()\`

**Good for:**
- Servers handling multiple concurrent clients

- Programs monitoring multiple I/O sources (sockets, files, pipes)
- When we need portability (select works on all Unix-like systems)

**Alternatives:**
- \`poll()\` - similar to select, but better interface for many fds

- \`epoll()\` (Linux) - more efficient for thousands of connections
- \`kqueue()\` (BSD/macOS) - BSD's equivalent to epoll


### Summary

1. **\`select()\` is a blocking multiplexer.** It blocks, but on multiple file descriptors simultaneously

2. **\`nfds\` is highest fd + 1.** This number tells select() the range to scan \`[0, nfds-1]\`

3. **\`fd_set\` must be rebuilt each iteration.** \`select()\` modifies it to show \`fd\`s that are ready

4. **Use \`FD_ISSET()\` after \`select()\` returns.** This is to check which specific fds are ready

5. **Multiplexing enables single-threaded concurrency.** By using \`select\` we have achieved the handling of multiple clients without threads

6. **The OS does the heavy lifting.** We let kernel monitor all sockets efficiently, wakes our process only when needed
`;export{n as default};
