---
title: "Redis Stream Part I: An Introduction to Redis Stream, as a Replacement of `BLMOVE`"
date: 2026-03-01
id: blog0462
tag: redis
toc: true
intro: "Master Redis Streams for production-grade message processing. Learn about Radix Tree internals, consumer groups, pending entry lists (PEL), message claiming, and building reliable distributed systems with XADD, XREADGROUP, XACK, XPENDING, and XCLAIM."
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

### Redis Streams: Lightweight Message Queue

Redis Streams is a data structure specifically designed for message queue and event sourcing use cases. It addresses all the [Problems of `BLMOVE`](/blog/article/Redis-BLMOVE-Building-Message-Queues-with-Lists#3.1.-the-problems) while remaining lightweight and fast.

#### Key Features

- **Unique IDs.** Every message has a globally unique, auto-generated ID

- **Structured data.** Messages can have multiple field-value pairs
- **Consumer groups.** Built-in support for distributed consumption
- **ACK mechanism.** Native acknowledgment with pending message tracking
- **Range queries.** Query messages by ID or timestamp
- **Persistence.** Messages stay in stream until explicitly deleted
- **$O(1)$ access.** Fast lookup by message ID

#### Basic Stream Operations

<item>

**Adding messages with `XADD`.**

```bash
# Syntax: XADD stream_name ID field value [field value ...]
# * means "auto-generate ID"

XADD orders * orderID 1001 userID 123 amount 99.99 productID 456
# Returns: "1709251200000-0"

XADD orders * orderID 1002 userID 456 amount 149.50 productID 789
# Returns: "1709251200001-0"

XADD orders * orderID 1003 userID 123 amount 49.99 productID 321
# Returns: "1709251200002-0"
```

</item>

<item>

**Understand Auto-generated IDs.**

The ID format is `TIMESTAMP-SEQUENCE`:
- `TIMESTAMP`: Milliseconds since Unix epoch
- `SEQUENCE`: Counter starting from 0 for messages in same millisecond

```bash
# ID: 1709251200000-0
#     └─timestamp─┘ └sequence
#
# If multiple messages added in same millisecond:
# 1709251200000-0
# 1709251200000-1  
# 1709251200000-2
# 1709251200001-0  (next millisecond)
```

</item>


<item>

**List All Messages.** To list all messages in a stream:

```bash
XRANGE orders - +
```
In redis stream the notation `-` means the minimum possible and `+` means the maximum possible.

To list all messages within a time range:

```bash
XRANGE orders 1772397259792 1772397259794
```
since $1772397259793 \in [1772397259792, 1772397259794]$, the `XRANGE` command yields:

```text
1) 1) "1772397259793-0"
   2) 1) "orderID"
      2) "1001"
      3) "userID"
      4) "123"
      5) "amount"
      6) "99.99"
      7) "productID"
      8) "456"
```

</item>

<item>

**Checking Stream Length.**

```bash
# Add some messages
XADD payments * payerID 1 amount 69.00 orderID 9
XADD payments * payerID 2 amount 420.00 orderID 10
XADD payments * payerID 3 amount 15.50 orderID 11

# Check how many messages
XLEN payments
# Returns: 3
```

</item>

### Radix Tree: Stream's Underlying Structure

Redis Streams use a **Radix Tree** (also called compressed prefix tree) as the underlying data structure. This is why Streams are efficient for both insertion and range queries.

#### What is a Radix Tree?

A Radix Tree is a space-optimized tree where nodes with single children are merged with their parent. It's particularly efficient for storing data with common prefixes.

Regular Trie vs Radix Tree:

```text
Regular Trie (stores "test", "team", "toast", "tear"):
         root
        /    \
       t      ...
       |
       e
      / \
     s   a
     |   |\
     t   m r

Radix Tree (same data, compressed):
         root
        /    
       t
      /|\
    est eam oast ear
```

#### How Redis Uses Radix Trees for Streams

Redis Streams store messages in a Radix Tree where:
- Keys: Message IDs (timestamp-sequence format)
- Values: Message data (field-value pairs)
- Ordering: IDs are sorted lexicographically

Why this works well:

```text
Message IDs with same timestamp prefix:
1709251200000-0
1709251200000-1  } Share prefix "1709251200000-"
1709251200000-2
1709251200001-0  } Different millisecond
1709251200001-1

In Radix Tree:
                  1709251200
                 /          \
              000-           001-
             / | \           / \
            0  1  2         0   1
```

Benefits for Streams:

1. **Fast insertion: $O(\log N)$ average**

    ```bash
    XADD orders * orderID 5000 amount 100
    ```

    Tree insertion: Follow path based on timestamp.

2. **Fast range queries: $O(\log N + M)$ where $M$ = results**

    ```bash
    XRANGE orders 1709251200000 1709251201000
    ```

    Tree traversal: Find start node, iterate until end.

3. **Efficient memory: Common prefixes stored once**

    IDs: `1709251200000-0` through `1709251200000-999` - Prefix `"1709251200000-"` stored once in tree.

4. **Ordered iteration: In-order tree traversal**

    ```bash
    XREVRANGE orders + - COUNT 10
    ```

    Tree traverse right-to-left: Latest messages first.

#### Radix Tree Operations Complexity

| Operation | Complexity | Example |
|-----------|-----------|---------|
| Insert | O(k) where k = key length | `XADD` |
| Lookup by ID | O(k) | `XRANGE` with specific ID |
| Range query | O(k + M) where M = results | `XRANGE` with range |
| Delete | O(k) | `XDEL` |

Comparison with Lists:

| Operation | List | Stream (Radix Tree) |
|-----------|------|---------------------|
| Add message | O(1) | O(log N) |
| Get by ID | O(N) scan | O(log N) |
| Range query | O(N) scan | O(log N + M) |
| ACK message | O(N) with `LREM` | O(1) with `XACK` |

#### Visual Example: Message Storage

```bash
# Add messages
XADD events * type "login" userID 123
XADD events * type "purchase" userID 456  
XADD events * type "logout" userID 123

# Returns:
# 1709251200000-0
# 1709251200001-0
# 1709251200002-0

# Stored in Radix Tree:
#                    root
#                     |
#              1709251200
#               /    |    \
#           000-   001-   002-
#            |      |      |
#       {login}  {purchase} {logout}
#
# Each leaf contains: {type: "...", userID: ...}
```

Why this matters:

```bash
# Fast time-range queries (common use case)
XRANGE events 1709251200000 1709251200001
# Tree finds start node, iterates to end node
# O(log N + M) where M = 2 messages

# Fast "latest N messages" queries  
XREVRANGE events + - COUNT 100
# Start from rightmost node, iterate left 100 times
# Much faster than scanning entire list

# Fast specific message lookup
XRANGE events 1709251200001-0 1709251200001-0
# Direct tree traversal to node
# O(log N) instead of O(N) scan
```

### Simple Payment Queue with Redis Streams

Let's build a practical payment processing queue using Redis Streams to see how it works in a real scenario.

#### Basic Setup and Message Production

Creating a payment stream:

```bash
# Add payment orders to stream
# XADD stream_name * field1 value1 field2 value2 ...

XADD orders:payments * orderID 1001 seafood 68 beverages 30 amount 598 userID 123
# Returns: "1709251200000-0"

XADD orders:payments * orderID 1002 seafood 150 amount 450 userID 456  
# Returns: "1709251200001-0"

XADD orders:payments * orderID 1003 beverages 80 desserts 40 amount 320 userID 789
# Returns: "1709251200002-0"

# Check stream length
XLEN orders:payments
# Returns: 3
```

Understanding the structure:

```bash
# Each message is a structured entry:
# ID: 1709251200000-0
#     timestamp     sequence
#
# Data: {
#   orderID: "1001",
#   seafood: "68",
#   beverages: "30",
#   amount: "598",
#   userID: "123"
# }
```

#### On `XREAD`



##### Syntax

`XREAD` is the basic consumer command for reading messages from one or more streams.

Basic syntax:
```text
XREAD [COUNT count] [BLOCK milliseconds] STREAMS key [key ...] ID [ID ...]
```

Parameters:
- `COUNT`: Maximum number of messages to return
- `BLOCK`: Wait for new messages (milliseconds)
  - `0` = wait indefinitely (most common for consumer workers)
  - `> 0` = timeout in milliseconds
  - Omit `BLOCK` = non-blocking, return immediately
- `STREAMS`: Keyword followed by stream name(s) and starting ID(s)
- `ID`: Starting position (`0` = from beginning, `$` = only new messages)


##### Various Examples using `XREAD`    



###### Read All Messages from Beginning

Read from the start (ID 0):

```bash
XREAD STREAMS orders:payments 0
```


###### Read with COUNT Limit

Read only first 2 messages:

```bash
XREAD COUNT 2 STREAMS orders:payments 0
```


###### Read from Specific Position
Read messages after ID `1709251200000-0`:

```bash
XREAD STREAMS orders:payments 1709251200000-0
```



###### Blocking Read for New Messages


```bash
XREAD BLOCK 0 STREAMS orders:payments 0
# or 
XREAD BLOCK 0 STREAMS orders:payments $
```

Difference between `0` and `$`:

<item>

**`ID = 0`.** Read ***all*** messages from beginning
```bash
XREAD STREAMS orders:payments 0
# Returns: ALL 4 messages (1001, 1002, 1003, 1004)
```

</item>


<item>


**`ID = $`.** Read only ***new*** messages added after this command

```bash
XREAD BLOCK 5000 STREAMS orders:payments $
# Waits up to 5 seconds for new messages
# Returns: Only messages added AFTER this command was issued
```



 ###### Blocking with Timeout

```bash
# Wait for max 30 seconds (30000 milliseconds)
XREAD BLOCK 30000 STREAMS orders:payments $

```


###### Read from Multiple Streams

```bash
# Create multiple streams
XADD orders:payments * orderID 2001 amount 100
XADD orders:refunds * refundID 3001 amount 50
XADD orders:subscriptions * subID 4001 amount 29.99

# Read from all three streams simultaneously
XREAD STREAMS \
    # stream names
    orders:payments orders:refunds orders:subscriptions \
    # ids
    0 0 0 
```


##### `XREAD` Behavior: Messages Persist

Critical difference from `BLMOVE`:

```bash
# Add messages
XADD orders:payments * orderID 5001 amount 100
XADD orders:payments * orderID 5002 amount 200
XADD orders:payments * orderID 5003 amount 300

# Consumer 1 reads all messages
XREAD STREAMS orders:payments 0
# Returns: All 3 messages

# Restart consumer and read again
XREAD STREAMS orders:payments 0
# Returns: ALL 3 messages AGAIN!

# Messages are NOT deleted after reading
XLEN orders:payments
# Still returns: 3
```

This means:
- Messages are ***never*** automatically deleted
- Each consumer sees the same messages
- Need to track "last read ID" manually
- Suitable for event sourcing and audit logs
- Different from traditional queue (where consumption removes message)


##### `XREAD` Example via Python Script

```python
import redis
import time

r = redis.Redis(host='localhost', port=6379, decode_responses=True)


def main():
    print("Hello from undestand-command!")


# Track last ID we processed
# If only new messages are desired, use '$'
# Start from beginning:
last_id = '0'  


def process_payment(data):
    # Simulate payment processing
    time.sleep(1)  # Simulate time taken to process payment
    print(f'Payment for order {data["orderID"]} processed.')


while True:
    # Read messages after last_id
    result = r.xread(
        count=10,
        block=5000,  # Wait up to 5 seconds
        streams={'orders:payments': last_id}
    )

    if result:
        # result format: [(stream_name, [(id, data), (id, data), ...])]
        stream_name, messages = result[0]
        # result[0] =
        # ['orders:payments', [(...), (...), (...), (...), (...), (...), (...)]]
        for message_id, data in messages:
            print(f'Processing order {data["orderID"]}: ${data["amount"]}')

            # Process payment
            process_payment(data)

            # Update last_id to this message
            last_id = message_id

        print(f'Processed {len(messages)} messages. Last ID: {last_id}')
    else:
        print('No new messages, waiting...')


if __name__ == "__main__":
    main()

```

Result:

```text
Processing order 1001: $598
Payment for order 1001 processed.
Processing order 1002: $450
Payment for order 1002 processed.
Processing order 1003: $320
Payment for order 1003 processed.
Processing order 1003: $320
Payment for order 1003 processed.
Processing order 5001: $100
Payment for order 5001 processed.
Processing order 5002: $200
Payment for order 5002 processed.
Processing order 5003: $300
Payment for order 5003 processed.
Processed 7 messages. Last ID: 1772399368367-0
```

</item>

##### Limitations of `XREAD` Without Consumer Groups

Redis Stream has the following ***limitations***:
- No automatic consumer coordination
- Must manually track last read ID
- **No built-in ACK mechanism**
- Cannot distribute messages among multiple consumers
- No automatic retry on failure
- Each consumer sees all messages (no automatic distribution)

Solution: ***Stream with Consumer Groups***, we will be intrducing it in the [next article](/blog/article/Redis-Stream-Part-II-Production-Ready-Message-Queues-with-Consumer-Groups).


#### Advantages Over `BLMOVE`

1. **Structured Data (No String Parsing Needed).**     Redis Streams support structured messages with multiple field-value pairs:

    ```bash
    # Streams: Structured data
    XADD orders * orderID 1 amount 100 items 5

    # Lists: String serialization required
    LPUSH orders "orderID:1,amount:100,items:5"  # Need to parse manually
    ```

2. **Messages Persist (Replayable).**    Messages remain in the stream after reading, enabling replay and multiple consumers:

    ```bash
    XREAD STREAMS orders 0
    # Always returns all messages - can replay anytime

    # vs BLMOVE/RPOP where message is deleted immediately
    ```

3. **Multiple Consumers Can Read Same Messages.**    Different consumers can independently read the same stream:

    ```bash
    # Consumer 1: Analytics
    XREAD STREAMS orders 0

    # Consumer 2: Processing
    XREAD STREAMS orders 0

    # Both get all messages - useful for analytics + processing pipelines
    ```

4. **Time-Based Queries.**    Stream IDs contain timestamps, enabling time-range queries:

    ```bash
    # Get messages in specific time range
    XRANGE orders 1709251200000 1709251201000

    # Impossible with Lists - no timestamp information
    ```

5. **Non-Destructive Reads.**    Perfect for event sourcing, audit logs, and replay scenarios. Messages stay in stream until explicitly deleted.


### References

- 李健青, *Redis 高手心法*, Broadview
- Claude Sonnect 4.5