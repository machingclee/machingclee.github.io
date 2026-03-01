---
title: "Redis Stream Part II: Production-Ready Message Queues with Consumer Groups"
date: 2026-03-02
id: blog0467
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


### Consumer Groups: Production-Ready Message Processing

Consumer Groups in Redis Stream is the answer to distributive message processing, similar to Kafka consumer groups. They solve all the coordination problems we had with manual `XREAD`.

#### Key Features

1. **Independent consumer groups.** Multiple groups can process the same stream independently

2. **Automatic message distribution.** Messages automatically distributed among consumers in a group
3. **Pending Entry List (PEL).** Tracks which consumer has which unacknowledged messages. Messages are added to PEL immediately when consumed via `XREADGROUP` (not after processing). Only messages consumed without `NOACK` flag enter PEL.
4. **At-least-once delivery.** Messages remain pending (in `PEL`) until explicitly acknowledged with `XACK`
5. **Consumer failure handling.** Can claim messages from dead consumers
6. **Last delivered ID tracking.** Group tracks progress automatically

#### Consumer Group Architecture

```text
Stream: orders:payments
├── Message 1: 1709251200000-0
├── Message 2: 1709251200001-0
├── Message 3: 1709251200002-0
└── Message 4: 1709251200003-0

Consumer Group: payment-processors
├── last_delivered_id: 1709251200003-0
├── Consumer: worker-1
│   └── PEL: [1709251200000-0, 1709251200002-0]  (pending messages)
└── Consumer: worker-2
    └── PEL: [1709251200001-0, 1709251200003-0]

Consumer Group: analytics-team
├── last_delivered_id: 1709251200001-0
├── Consumer: analyst-1
│   └── PEL: [1709251200000-0]
└── Consumer: analyst-2
    └── PEL: [1709251200001-0]
```
### Commands for Consumer Group
#### `XGROUP`

`XGROUP` manages consumer groups: creation, deletion, and configuration.

##### `XGROUP CREATE` - Create Consumer Group

Syntax:
```text
XGROUP CREATE stream group_name starting_id [MKSTREAM]
```

Parameters:
- `stream` - Stream name
- `group_name` - Name for the consumer group
- `starting_id` - Where to start reading (`0` = beginning, `$` = only new messages)
- `MKSTREAM` - Create stream if it doesn't exist (optional)

Examples:

```bash
# Create consumer group starting from beginning
XGROUP CREATE orders:payments payment-processors 0
# Create group starting from current position (only new messages)
XGROUP CREATE orders:payments analytics-team $
# Create group and stream if stream doesn't exist
XGROUP CREATE orders:refunds refund-processors 0 MKSTREAM
# Error if group already exists
XGROUP CREATE orders:refunds refund-processors 0
```

When to use `0` vs `$`:

```bash
# 0 - Process all existing + new messages
XGROUP CREATE backfill-orders backfill-processors 0
# Use case: Need to process historical data

# $ - Only process new messages (ignore existing)
XGROUP CREATE orders:payments real-time-processors $
# Use case: Real-time processing, don't care about backlog
```

##### `XGROUP SETID` - Reset Group Position

Syntax:
```text
XGROUP SETID stream group_name new_id
```

Use cases:

```bash
# Reset to beginning (reprocess all messages)
XGROUP SETID orders:payments payment-processors 0

# Reset to specific message ID
XGROUP SETID orders:payments payment-processors 1709251200500-0

# Skip to only new messages
XGROUP SETID orders:payments payment-processors $

# Recovery scenario: Processing got stuck at bad message
# Skip past the problematic message
XGROUP SETID orders:payments payment-processors 1709251200123-0
```

##### `XGROUP DESTROY` - Delete Consumer Group

```bash
# Delete consumer group (cannot be undone!)
XGROUP DESTROY orders:payments analytics-team
# Returns: 1 (success)

# Deleting non-existent group
XGROUP DESTROY orders:payments fake-group
# Returns: 0 (group didn't exist)
```

##### `XGROUP DELCONSUMER` - Remove Consumer

```bash
# Remove specific consumer from group
XGROUP DELCONSUMER orders:payments payment-processors worker-1
# Returns: 2 (number of pending messages that were assigned to worker-1)

# These pending messages become available for other consumers
```

#### `XREADGROUP`

`XREADGROUP` reads messages with automatic distribution and tracking.

Syntax:
```text
XREADGROUP GROUP group_name consumer_name \
    [COUNT count] [BLOCK ms] [NOACK] STREAMS stream_name ID
```

Parameters:
- `GROUP group_name consumer_name` - Group and consumer identity
- `COUNT` - Max messages to read
- `BLOCK` - Wait for messages (milliseconds)
  - `0` = wait indefinitely (most common for consumer workers)
  - `> 0` = timeout in milliseconds
  - Omit `BLOCK` = non-blocking, return immediately
- `NOACK` - Don't add to PEL (fire-and-forget, rarely used). By default, messages ARE added to PEL immediately when consumed
- `ID` - Starting position
  - `>` = only undelivered messages (most common for new work)
  - `0` = check PEL first (returns this consumer's pending messages)
  - Valid message ID (e.g., `1709251200000-0`) = returns messages with ID greater than specified, including any that are in this consumer's PEL

##### Understand `PEL` (Pending Entry List) Behavior

When `XREADGROUP` returns messages, they are **immediately added to the consumer's PEL** before any processing begins. This happens at the moment of consumption, not after processing. The PEL tracks unacknowledged messages and enables reliable message delivery:

- Messages stay in PEL until explicitly acknowledged with `XACK`
- If a consumer crashes, messages remain in its PEL for recovery
- Use `NOACK` flag only when you don't need reliability (fire-and-forget scenarios)
- Only messages that need acknowledgment enter the PEL

##### Example 1: Basic Consumer Group Read

Setup:

```bash
# Create stream with messages
XADD orders:payments * orderID 1001 amount 100 userID 123
XADD orders:payments * orderID 1002 amount 200 userID 456
XADD orders:payments * orderID 1003 amount 300 userID 789

# Create consumer group
XGROUP CREATE orders:payments payment-processors 0
```

Consumer 1 reads:

```bash
# > means "give me new messages not yet delivered to this group"
XREADGROUP GROUP payment-processors worker-1 COUNT 2 \
    STREAMS orders:payments >

# Returns:
# 1) 1) "orders:payments"
#    2) 1) 1) "1709251200000-0"
#          2) 1) "orderID" 2) "1001" 3) "amount" 4) "100" 5) "userID" 6) "123"
#       2) 1) "1709251200001-0"
#          2) 1) "orderID" 2) "1002" 3) "amount" 4) "200" 5) "userID" 6) "456"
```

**Important: PEL Tracking Happens Immediately**

These 2 messages are **immediately added to worker-1's Pending Entry List (PEL)** the moment `XREADGROUP` returns them—before any processing happens. They will remain in the PEL until either:
- Successfully acknowledged with `XACK` after processing completes
- Reclaimed by another consumer via `XCLAIM` (if worker-1 crashes or takes too long)

This immediate PEL tracking is what enables at-least-once delivery semantics: if the consumer crashes before ACKing, the messages remain in the PEL and can be recovered.

Consumer 2 reads (simultaneously):

```bash
XREADGROUP GROUP payment-processors worker-2 COUNT 2 \
    STREAMS orders:payments >

# Returns:
# 1) 1) "orders:payments"
#    2) 1) 1) "1709251200002-0"
#          2) 1) "orderID" 2) "1003" 3) "amount" 4) "300" 5) "userID" 6) "789"

# Worker-2 gets DIFFERENT message (automatic distribution!)
# Messages 1001, 1002 already assigned to worker-1
```

##### Example 2: Blocking Read with Consumer Group

```bash
# Worker-1: Block waiting for new messages
XREADGROUP GROUP payment-processors worker-1 BLOCK 30000 \
    STREAMS orders:payments >

# (Waiting...)

# Add new message in another terminal
XADD orders:payments * orderID 1004 amount 400 userID 111

# Worker-1 immediately receives:
# 1) 1) "orders:payments"
#    2) 1) 1) "1709251200003-0"
#          2) 1) "orderID" 2) "1004" ...
```

##### Example 3: Check Pending Messages with ID 0

```bash
# Worker-1 has unacknowledged messages in PEL
# Use ID = 0 to see pending messages for THIS consumer

XREADGROUP GROUP payment-processors worker-1 STREAMS orders:payments 0

# Returns messages in worker-1's PEL:
# 1) 1) "orders:payments"
#    2) 1) 1) "1709251200000-0"
#          2) ... (orderID 1001)
#       2) 1) "1709251200001-0"
#          2) ... (orderID 1002)

# Use case: Recovery after crash - check what was being processed
```

##### Special ID Values

```bash
# > = Get new undelivered messages (most common)
XREADGROUP GROUP mygroup consumer1 STREAMS mystream >
# Use case: Normal worker loop - get messages not yet delivered to any consumer in group

# 0 = Get MY pending messages (from PEL)
XREADGROUP GROUP mygroup consumer1 STREAMS mystream 0
# Use case: Recovery after crash - see what THIS consumer was processing

# Valid message ID = Get messages after that ID (including from PEL if needed)
XREADGROUP GROUP mygroup consumer1 STREAMS mystream 1709251200000-0
# Use case: Resume from specific point, will return:
#   1. Pending messages from this consumer's PEL with ID > specified ID
#   2. New messages from stream with ID > specified ID
# Example: If consumer has pending [1709251200005-0, 1709251200010-0]
#          and you query with ID 1709251200007-0
#          Returns: 1709251200010-0 (from PEL) + any newer undelivered messages
```

#### `XACK`

`XACK` removes messages from the Pending Entry List (PEL), signaling successful processing.

`XACK` ***only works with consumer groups***. When using `XREAD` without consumer groups, there is no PEL and no `XACK` command—you must manually track which messages you've processed.

Syntax:
```text
XACK stream group_name message_id [message_id ...]
```

Note that `group_name` is required—this command only operates within the context of a consumer group.

Examples:

```bash
# Worker reads messages
XREADGROUP GROUP payment-processors worker-1 STREAMS orders:payments >
# Returns message: 1709251200000-0

# Process the payment
# ... payment successful ...

# Acknowledge message (remove from PEL)
XACK orders:payments payment-processors 1709251200000-0
# Returns: 1 (number of messages acknowledged)

# Can ACK multiple messages at once
XACK orders:payments payment-processors 1709251200000-0 1709251200001-0 1709251200002-0
# Returns: 3
```

Complete workflow:

```python
import redis

r = redis.Redis(decode_responses=True)

# Consumer loop
while True:
    # Read message
    result = r.xreadgroup(
        groupname='payment-processors',
        consumername='worker-1',
        streams={'orders:payments': '>'},
        count=1,
        block=5000
    )
    
    if result:
        stream, messages = result[0]
        message_id, data = messages[0]
        
        try:
            # Process payment
            process_payment(data['orderID'], data['amount'])
            
            # Success - ACK
            r.xack('orders:payments', 'payment-processors', message_id)
            print(f'Acknowledged: {message_id}')
            
        except Exception as e:
            # Error: Message stays in PEL for retry
            print(f'Failed: {message_id}, Error: {e}')
            # Will be re-processed when we check PEL
```

#### Error Recovery: Ensuring At-Least-Once Delivery

When exceptions occur during processing, messages ***remain in the PEL*** without being ACKed. Redis Streams provides mechanisms to ensure at-least-once delivery by retrying these pending messages.

How It Works:

1. **Message consumed** → Added to consumer's PEL immediately
2. **Exception thrown** → Message NOT ACKed, stays in PEL
3. **Worker crashes** → Message still in PEL (persistent)
4. **Recovery** → Read pending messages and retry

##### Pattern 1: Consumer Checks Its Own PEL

Each consumer periodically checks its own pending messages:

```python
import redis
import time

r = redis.Redis(decode_responses=True)

def consumer_with_retry():
    """Consumer that retries its own pending messages"""
    while True:
        # Step 1: Check for pending messages first (ID=0)
        result = r.xreadgroup(
            groupname='payment-processors',
            consumername='worker-1',
            streams={'orders:payments': '0'},  # 0 = check MY PEL
            count=10
        )
        
        if result and result[0][1]:
            # Found pending messages - retry them
            stream, messages = result[0]
            print(f'Found {len(messages)} pending messages, retrying...')
            
            for message_id, data in messages:
                try:
                    process_payment(data)
                    r.xack('orders:payments', 'payment-processors', message_id)
                    print(f'Retry successful: {message_id}')
                except Exception as e:
                    print(f'Retry failed: {message_id}, Error: {e}')
                    # Still in PEL, will retry next iteration
        
        # Step 2: Process new messages (ID=>)
        result = r.xreadgroup(
            groupname='payment-processors',
            consumername='worker-1',
            streams={'orders:payments': '>'},  # > = new messages
            count=10,
            block=5000  # Wait up to 5s for new messages (prevents busy-waiting)
        )
        # Note: block=5000 makes the command wait up to 5 seconds if no messages
        # are available, instead of returning immediately. This prevents busy-waiting
        # (constantly polling in a tight loop), reducing CPU and network usage.
        
        if result:
            stream, messages = result[0]
            for message_id, data in messages:
                try:
                    process_payment(data)
                    r.xack('orders:payments', 'payment-processors', message_id)
                    print(f'Processed: {message_id}')
                except Exception as e:
                    print(f'Failed: {message_id}, Error: {e}')
                    # Stays in PEL for next retry cycle

# consumer_with_retry()
```

**Key Points:**
- Use `ID=0` to read YOUR pending messages
- Check PEL periodically (e.g., every loop iteration or every N seconds)
- Failed messages remain in PEL for next retry
- Simple pattern for single consumer recovery

##### Pattern 2: Dedicated Recovery Worker

A separate worker monitors and claims stuck messages from ALL consumers:

```python
import redis
import time

r = redis.Redis(decode_responses=True)

def recovery_worker(max_idle_time=60000, max_retries=3):
    """
    Dedicated worker that claims stuck messages from any consumer
    
    Args:
        max_idle_time: Claim messages idle for > this time (ms)
        max_retries: Move to DLQ after this many attempts
    """
    while True:
        # Find ALL stuck messages across all consumers
        pending = r.xpending_range(
            name='orders:payments',
            groupname='payment-processors',
            min='-',
            max='+',
            count=100,
            idle=max_idle_time  # Only messages idle > 60s
        )
        
        if not pending:
            print('No stuck messages')
            time.sleep(30)
            continue
        
        print(f'Found {len(pending)} stuck messages')
        
        for msg in pending:
            message_id = msg['message_id']
            consumer = msg['consumer']
            idle_ms = msg['time_since_delivered']
            delivery_count = msg['times_delivered']
            
            print(f'Stuck message: {message_id}')
            print(f'  Consumer: {consumer}, Idle: {idle_ms}ms, Attempts: {delivery_count}')
            
            # Check if exceeded max retries
            if delivery_count >= max_retries:
                # Move to Dead Letter Queue
                message_data = r.xrange('orders:payments', message_id, message_id)[0]
                r.xadd('orders:dlq', {
                    'original_id': message_id,
                    'original_data': str(message_data[1]),
                    'attempts': delivery_count,
                    'last_consumer': consumer,
                    'reason': 'max_retries_exceeded'
                })
                
                # ACK to remove from PEL
                r.xack('orders:payments', 'payment-processors', message_id)
                print(f'  → Moved to DLQ (exceeded {max_retries} retries)')
                continue
            
            # Claim and retry
            try:
                claimed = r.xclaim(
                    name='orders:payments',
                    groupname='payment-processors',
                    consumername='recovery-worker',
                    min_idle_time=max_idle_time,
                    message_ids=[message_id]
                )
                
                if claimed:
                    _, data = claimed[0]
                    
                    try:
                        # Attempt to process
                        process_payment(data)
                        
                        # Success - ACK
                        r.xack('orders:payments', 'payment-processors', message_id)
                        print(f'  → Recovered successfully')
                        
                    except Exception as e:
                        print(f'  → Recovery failed: {e}')
                        # Stays in PEL, delivery_count incremented
                        # Will retry later if idle time threshold reached
                        
            except Exception as e:
                print(f'  → Claim failed: {e}')
        
        time.sleep(30)  # Check every 30 seconds

# recovery_worker(max_idle_time=60000, max_retries=3)
```

**Advantages of Recovery Worker:**
- Monitors ALL consumers (finds stuck messages from crashed workers)
- Automatic cleanup of dead consumer's pending messages
- Centralized retry logic and DLQ management
- Prevents message loss from permanent consumer failures

##### Pattern 3: Combined Approach (Recommended)

Best practice: Regular consumers retry their own pending + dedicated recovery worker:

```python
def smart_consumer():
    """Consumer with built-in retry + recovery worker backup"""
    retry_interval = 60  # Check own PEL every 60 seconds
    last_pel_check = time.time()
    
    while True:
        # Periodically check own PEL
        if time.time() - last_pel_check > retry_interval:
            # Retry my pending messages
            result = r.xreadgroup(
                groupname='payment-processors',
                consumername='worker-1',
                streams={'orders:payments': '0'},
                count=10
            )
            
            if result and result[0][1]:
                for message_id, data in result[0][1]:
                    try:
                        process_payment(data)
                        r.xack('orders:payments', 'payment-processors', message_id)
                    except Exception as e:
                        print(f'Retry failed: {e}')
            
            last_pel_check = time.time()
        
        # Process new messages
        result = r.xreadgroup(
            groupname='payment-processors',
            consumername='worker-1',
            streams={'orders:payments': '>'},
            count=10,
            block=5000
        )
        
        if result:
            for message_id, data in result[0][1]:
                try:
                    process_payment(data)
                    r.xack('orders:payments', 'payment-processors', message_id)
                except Exception as e:
                    print(f'Processing failed: {e}')
                    # Will retry in next PEL check

# Run multiple consumers + 1 recovery worker
# Terminal 1: smart_consumer() as worker-1
# Terminal 2: smart_consumer() as worker-2  
# Terminal 3: recovery_worker()
```

##### Summary: At-Least-Once Delivery Guarantees

Redis Streams ensures at-least-once delivery through:

1. **PEL Persistence** - Messages added to PEL immediately when consumed
2. **Survives Crashes** - PEL stored in Redis, not consumer memory
3. **Self Retry** - Consumers check own PEL with `ID=0`
4. **Cross-Consumer Recovery** - `XCLAIM` allows other consumers to take over
5. **Idle Detection** - `XPENDING` finds stuck messages
6. **DLQ Pattern** - Failed messages after max retries moved to dead letter queue

**No message is lost** as long as:
- Redis server is running
- Recovery worker or consumers check PEL periodically
- Messages are ACKed only after successful processing

#### `XPENDING`

`XPENDING` shows unacknowledged messages in the Pending Entry List.

Two forms:

1. Summary form - Overview of pending messages
2. Detailed form - Individual message details

##### `XPENDING` Summary

Syntax:
```text
XPENDING stream group_name
```

Example:

```bash
# Worker-1 read 3 messages but hasn't ACKed them
XREADGROUP GROUP payment-processors worker-1 COUNT 3 \
    STREAMS orders:payments >

# Check pending summary
XPENDING orders:payments payment-processors

# Returns:
# 1) 3                      # Total pending count
# 2) "1709251200000-0"      # Smallest pending ID
# 3) "1709251200002-0"      # Largest pending ID
# 4) 1) 1) "worker-1"       # Consumer name
#       2) "3"              # Messages pending for this consumer
```

##### `XPENDING` Detailed

Syntax:
```text
XPENDING stream group_name [IDLE min_idle_time] start_id end_id \
    count [consumer_name]
```

Examples:

```bash
# Get detailed info for first 10 pending messages
XPENDING orders:payments payment-processors - + 10

# Returns:
# 1) 1) "1709251200000-0"        # Message ID
#    2) "worker-1"                # Consumer
#    3) 15000                     # Milliseconds since delivered
#    4) 2                         # Delivery count (how many times read)
# 2) 1) "1709251200001-0"
#    2) "worker-1"
#    3) 15000
#    4) 1
# 3) 1) "1709251200002-0"
#    2) "worker-2"
#    3) 8000
#    4) 1

# Get pending messages idle for more than 60 seconds (60000 ms)
XPENDING orders:payments payment-processors IDLE 60000 - + 10

# Returns only messages not processed for > 60s:
# 1) 1) "1709251200000-0"
#    2) "worker-1"
#    3) 65000                     # Idle for 65 seconds!
#    4) 3                         # Already tried 3 times

# Get pending messages for specific consumer
XPENDING orders:payments payment-processors - + 10 worker-1

# Returns only worker-1's pending messages
```

##### Use Case: Finding Stuck Messages

```bash
# Find messages stuck for > 5 minutes (300000 ms)
XPENDING orders:payments payment-processors IDLE 300000 - + 100

# Returns:
# 1) 1) "1709251200015-0"
#    2) "worker-3"
#    3) 450000         # Stuck for 7.5 minutes!
#    4) 1

# These are candidates for claiming (reassigning to another consumer)
```

#### `XCLAIM`

`XCLAIM` transfers pending messages from one consumer to another, useful for recovering from consumer failures.

Syntax:
```text
XCLAIM stream group_name consumer_name min_idle_time message_id [message_id ...] [IDLE ms] [TIME unix_time_ms] [RETRYCOUNT count] [FORCE] [JUSTID]
```

Parameters:
- `min_idle_time` - Only claim if message idle for at least this long (milliseconds)
- `IDLE ms` - Set the idle time of claimed message
- `RETRYCOUNT count` - Set delivery count
- `FORCE` - Claim even if not in PEL
- `JUSTID` - Return only IDs (not full messages)

Examples:

##### Example 1: Basic Claim

```bash
# Worker-1 crashed after reading message
XREADGROUP GROUP payment-processors worker-1 STREAMS orders:payments >
# Returns: 1709251200000-0 (now in worker-1's PEL)

# Worker-1 crashes and doesn't recover

# Check pending (5 minutes later = 300000 ms)
XPENDING orders:payments payment-processors IDLE 300000 - + 10
# Shows: 1709251200000-0 owned by worker-1, idle for 300000ms

# Worker-2 claims the stuck message
XCLAIM orders:payments payment-processors worker-2 60000 1709251200000-0

# Returns the claimed message:
# 1) 1) "1709251200000-0"
#    2) 1) "orderID" 2) "1001" 3) "amount" 4) "100" ...

# Message now in worker-2's PEL
```

##### Example 2: Automated Recovery Worker

```python
import redis
import time

r = redis.Redis(decode_responses=True)

def recovery_worker():
    """Claim and process stuck messages"""
    while True:
        # Find messages stuck for > 2 minutes
        pending = r.xpending_range(
            name='orders:payments',
            groupname='payment-processors',
            min='-',
            max='+',
            count=10,
            idle=120000  # 2 minutes
        )
        
        if not pending:
            print('No stuck messages')
            time.sleep(30)
            continue
        
        for msg in pending:
            message_id = msg['message_id']
            original_consumer = msg['consumer']
            idle_time = msg['time_since_delivered']
            delivery_count = msg['times_delivered']
            
            print(f'Found stuck message: {message_id}')
            print(f'  Original consumer: {original_consumer}')
            print(f'  Idle time: {idle_time}ms')
            print(f'  Delivery count: {delivery_count}')
            
            if delivery_count >= 3:
                # Too many retries - move to DLQ
                r.xack('orders:payments', 'payment-processors', message_id)
                r.xadd('orders:dlq', {'original_id': message_id, 'reason': 'max_retries'})
                print(f'  → Moved to DLQ')
            else:
                # Claim and retry
                claimed = r.xclaim(
                    name='orders:payments',
                    groupname='payment-processors',
                    consumername='recovery-worker',
                    min_idle_time=60000,
                    message_ids=[message_id]
                )
                
                if claimed:
                    try:
                        # Process message
                        _, data = claimed[0]
                        process_payment(data)
                        
                        # Success - ACK
                        r.xack('orders:payments', 'payment-processors', message_id)
                        print(f'  → Recovered successfully')
                    except Exception as e:
                        print(f'  → Recovery failed: {e}')
                        # Stays in PEL for next retry
        
        time.sleep(30)  # Check every 30 seconds

# recovery_worker()
```

##### Example 3: Claim Multiple Messages

```bash
# Claim multiple stuck messages at once
XCLAIM orders:payments payment-processors worker-3 60000 \
  1709251200000-0 1709251200001-0 1709251200002-0

# Returns all 3 claimed messages
# All moved from original consumers to worker-3's PEL
```

#### `XINFO`

`XINFO` provides detailed information about streams, groups, and consumers.

Three subcommands:

1. `XINFO STREAM` - Stream information
2. `XINFO GROUPS` - List consumer groups
3. `XINFO CONSUMERS` - List consumers in a group

##### `XINFO STREAM` - Stream Details

```bash
XINFO STREAM orders:payments

# Returns:
#  1) "length"
#  2) 5                         # Number of messages in stream
#  3) "radix-tree-keys"
#  4) 1
#  5) "radix-tree-nodes"
#  6) 2
#  7) "last-generated-id"
#  8) "1709251200004-0"         # Most recent message ID
#  9) "groups"
# 10) 2                         # Number of consumer groups
# 11) "first-entry"
# 12) 1) "1709251200000-0"      # Oldest message
#     2) 1) "orderID" 2) "1001" ...
# 13) "last-entry"
# 14) 1) "1709251200004-0"      # Newest message
#     2) 1) "orderID" 2) "1005" ...
```

##### `XINFO GROUPS` - List Consumer Groups

```bash
XINFO GROUPS orders:payments

# Returns:
# 1) 1)  "name"
#    2)  "payment-processors"
#    3)  "consumers"
#    4)  3                      # Number of consumers in group
#    5)  "pending"
#    6)  15                     # Total pending messages
#    7)  "last-delivered-id"
#    8)  "1709251200004-0"      # Last message delivered to any consumer
# 2) 1)  "name"
#    2)  "analytics-team"
#    3)  "consumers"
#    4)  2
#    5)  "pending"
#    6)  5
#    7)  "last-delivered-id"
#    8)  "1709251200003-0"
```

##### `XINFO CONSUMERS` - List Consumers in Group

```bash
XINFO CONSUMERS orders:payments payment-processors

# Returns:
# 1) 1) "name"
#    2) "worker-1"
#    3) "pending"
#    4) 5                       # Messages in worker-1's PEL
#    5) "idle"
#    6) 15000                   # Milliseconds since last activity
# 2) 1) "name"
#    2) "worker-2"
#    3) "pending"
#    4) 8
#    5) "idle"
#    6) 2000
# 3) 1) "name"
#    2) "worker-3"
#    3) "pending"
#    4) 2
#    5) "idle"
#    6) 450000                  # Dead consumer? Idle for 7.5 minutes!
```

##### Practical Monitoring Example


```python
import redis
import json

r = redis.Redis(decode_responses=True)

def monitor_consumer_groups(stream_name):
    """Monitor health of consumer groups"""
    print(f'\n=== Stream: {stream_name} ===')
    
    # Stream stats
    stream_info = r.xinfo_stream(stream_name)
    print(f'Total messages: {stream_info["length"]}')
    print(f'Consumer groups: {stream_info["groups"]}')
    print(f'Last message ID: {stream_info["last-generated-id"]}\n')
    
    # Each consumer group
    groups = r.xinfo_groups(stream_name)
    for group in groups:
        group_name = group['name']
        print(f'Group: {group_name}')
        print(f'  Consumers: {group["consumers"]}')
        print(f'  Pending: {group["pending"]}')
        print(f'  Last delivered: {group["last-delivered-id"]}')
        
        # Each consumer in group
        consumers = r.xinfo_consumers(stream_name, group_name)
        for consumer in consumers:
            print(f'    Consumer: {consumer["name"]}')
            print(f'      Pending: {consumer["pending"]}')
            print(f'      Idle: {consumer["idle"]}ms')
            
            # Alert if consumer is too idle
            if consumer['idle'] > 300000 and consumer['pending'] > 0:
                print(f'      ALERT: Consumer may be dead!')
        print()

# Usage:
# monitor_consumer_groups('orders:payments')

# Output:
# === Stream: orders:payments ===
# Total messages: 25
# Consumer groups: 2
# Last message ID: 1709251200024-0
#
# Group: payment-processors
#   Consumers: 3
#   Pending: 15
#   Last delivered: 1709251200024-0
#     Consumer: worker-1
#       Pending: 5
#       Idle: 15000ms
#     Consumer: worker-2
#       Pending: 8
#       Idle: 2000ms
#     Consumer: worker-3
#       Pending: 2
#       Idle: 450000ms
#       ALERT: Consumer may be dead!
```

#### Scaling with Asyncio: Concurrent Message Processing

For **I/O-bound workloads** (API calls, database queries, external services), asyncio provides efficient concurrent processing with minimal overhead compared to threads.

##### Why Asyncio for Redis Streams?

**Problem**: Single-threaded consumers process messages sequentially:

```python
# Single-threaded - processes ONE message at a time
while True:
    result = r.xreadgroup(...)
    for message_id, data in messages:
        process_payment(data)  # Takes 2 seconds (network call to payment API)
        r.xack(...)
# Throughput: ~0.5 messages/second
```

**Solution**: Asyncio consumers process multiple messages concurrently:

```python
# Asyncio - 10 coroutines process messages in parallel
# While one waits for I/O, others continue working
# Throughput: ~5 messages/second (10x improvement)
```

##### Basic Asyncio Consumer

```python
import asyncio
import redis.asyncio as redis
from typing import Dict, Any

async def process_payment_async(data: Dict[str, Any]):
    """Async payment processing (simulates API call)"""
    order_id = data.get('orderID')
    amount = data.get('amount')
    
    print(f'Processing payment {order_id}...')
    await asyncio.sleep(2)  # Simulates async I/O (network call)
    print(f'Payment {order_id} completed: ${amount}')
    return True

async def consumer_coroutine(consumer_name: str):
    """Single async consumer coroutine"""
    r = await redis.Redis(decode_responses=True)
    
    print(f'{consumer_name} started')
    
    try:
        while True:
            # XREADGROUP is async
            result = await r.xreadgroup(
                groupname='payment-processors',
                consumername=consumer_name,
                streams={'orders:payments': '>'},
                count=10,
                block=5000
            )
            
            if result:
                stream, messages = result[0]
                for message_id, data in messages:
                    try:
                        await process_payment_async(data)
                        await r.xack('orders:payments', 'payment-processors', message_id)
                        print(f'{consumer_name}: ACKed {message_id}')
                    except Exception as e:
                        print(f'{consumer_name}: Failed {message_id}: {e}')
    finally:
        await r.close()

# Run single consumer
# asyncio.run(consumer_coroutine('worker-1'))
```

##### Running Multiple Concurrent Consumers

**Pattern 1: Multiple Coroutines in One Process**

Perfect for maximizing single-machine utilization:

```python
import asyncio
import redis.asyncio as redis
import os

async def main():
    """Run multiple concurrent consumers on this machine"""
    hostname = os.getenv('HOSTNAME', 'server1')
    num_consumers = 10  # 10 concurrent coroutines
    
    # Create consumer group (only needs to happen once)
    r = await redis.Redis(decode_responses=True)
    try:
        await r.xgroup_create('orders:payments', 'payment-processors', id='0', mkstream=True)
        print('Consumer group created')
    except redis.ResponseError as e:
        if 'BUSYGROUP' not in str(e):
            raise
    await r.close()
    
    # Launch all consumers concurrently
    tasks = [
        consumer_coroutine(f'{hostname}-consumer-{i}')
        for i in range(num_consumers)
    ]
    
    print(f'Starting {num_consumers} concurrent consumers...')
    await asyncio.gather(*tasks)

if __name__ == '__main__':
    asyncio.run(main())
```

**Output:**
```text
Starting 10 concurrent consumers...
server1-consumer-0 started
server1-consumer-1 started
...
server1-consumer-0: Processing payment 1001...
server1-consumer-1: Processing payment 1002...
server1-consumer-2: Processing payment 1003...
# All 10 consumers work concurrently!
server1-consumer-0: Payment 1001 completed: $99.99
server1-consumer-0: ACKed 1709251200000-0
```

##### Pattern 2: Asyncio with Error Recovery

Combine async processing with PEL-based retry:

```python
import asyncio
import redis.asyncio as redis

async def consumer_with_retry(consumer_name: str):
    """Async consumer with periodic PEL checking"""
    r = await redis.Redis(decode_responses=True)
    retry_interval = 60  # Check PEL every 60 seconds
    last_pel_check = asyncio.get_event_loop().time()
    
    while True:
        current_time = asyncio.get_event_loop().time()
        
        # Periodically check own PEL
        if current_time - last_pel_check > retry_interval:
            print(f'{consumer_name}: Checking own PEL for retries...')
            
            result = await r.xreadgroup(
                groupname='payment-processors',
                consumername=consumer_name,
                streams={'orders:payments': '0'},  # 0 = my pending messages
                count=10
            )
            
            if result and result[0][1]:
                print(f'{consumer_name}: Found {len(result[0][1])} pending messages, retrying...')
                for message_id, data in result[0][1]:
                    try:
                        await process_payment_async(data)
                        await r.xack('orders:payments', 'payment-processors', message_id)
                        print(f'{consumer_name}: Retry successful for {message_id}')
                    except Exception as e:
                        print(f'{consumer_name}: Retry failed for {message_id}: {e}')
            
            last_pel_check = current_time
        
        # Process new messages
        result = await r.xreadgroup(
            groupname='payment-processors',
            consumername=consumer_name,
            streams={'orders:payments': '>'},
            count=10,
            block=5000
        )
        
        if result:
            for message_id, data in result[0][1]:
                try:
                    await process_payment_async(data)
                    await r.xack('orders:payments', 'payment-processors', message_id)
                except Exception as e:
                    print(f'{consumer_name}: Processing failed: {e}')
                    # Stays in PEL for next retry cycle

async def main():
    """Run 20 async consumers with retry logic"""
    tasks = [
        consumer_with_retry(f'async-worker-{i}')
        for i in range(20)
    ]
    await asyncio.gather(*tasks)

# asyncio.run(main())
```

##### Asyncio vs Threading Comparison

| Aspect | **Asyncio** | **Threading** |
|--------|-------------|---------------|
| **Concurrency Model** | Cooperative multitasking | Preemptive multitasking |
| **Context Switching** | Very lightweight (user space) | Heavier (kernel space) |
| **Memory per Unit** | ~1-2 KB per coroutine | ~8 MB per thread (Linux) |
| **Max Concurrent** | 1000s of coroutines | 10-100 threads |
| **Best For** | I/O-bound (network, DB) | CPU-bound + I/O-bound |
| **Python GIL** | Single-threaded (no GIL issue) | Limited by GIL |
| **Error Isolation** | One exception can affect all | Thread isolation |
| **Debugging** | Easier (single thread) | Harder (race conditions) |

When to use Asyncio:
- High concurrency (100+ consumers on one machine)
- I/O-bound workloads (API calls, database queries)
- Lower memory footprint
- Simpler debugging (no thread synchronization)

When to use Threading:
- Need true parallelism (CPU-bound work)
- Using blocking libraries (no async support)
- Better fault isolation (thread crashes don't affect others)

##### Production Deployment: Multi-Process + Asyncio

Combine processes (horizontal scaling) with asyncio (vertical scaling):

```python
# consumer_asyncio.py
import asyncio
import redis.asyncio as redis
import os
import sys

async def main():
    # Each Kubernetes pod runs this script
    pod_name = os.getenv('POD_NAME', 'unknown')
    consumers_per_pod = int(os.getenv('CONSUMERS_PER_POD', '10'))
    
    # Create consumer group
    r = await redis.Redis(
        host=os.getenv('REDIS_HOST', 'localhost'),
        port=6379,
        decode_responses=True
    )
    try:
        await r.xgroup_create('orders:payments', 'payment-processors', id='0', mkstream=True)
    except redis.ResponseError as e:
        if 'BUSYGROUP' not in str(e):
            raise
    await r.close()
    
    # Launch coroutines
    tasks = [
        consumer_with_retry(f'{pod_name}-consumer-{i}')
        for i in range(consumers_per_pod)
    ]
    
    print(f'{pod_name}: Starting {consumers_per_pod} async consumers')
    await asyncio.gather(*tasks)

if __name__ == '__main__':
    asyncio.run(main())
```

Kubernetes Deployment:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-consumers
spec:
  replicas: 5  # 5 pods
  template:
    spec:
      containers:
      - name: consumer
        image: payment-consumer:latest
        env:
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: CONSUMERS_PER_POD
          value: "10"  # 10 coroutines per pod
        - name: REDIS_HOST
          value: "redis-service"
```

Result: 5 pods × 10 coroutines = **50 concurrent consumers** processing messages in parallel!

##### Performance Considerations

```python
# Async consumer with concurrency control
import asyncio
from asyncio import Semaphore

async def consumer_with_concurrency_limit(consumer_name: str, max_concurrent: int = 5):
    """Limit concurrent message processing to avoid overwhelming downstream services"""
    r = await redis.Redis(decode_responses=True)
    semaphore = Semaphore(max_concurrent)  # Max 5 concurrent processing tasks
    
    async def process_with_limit(message_id, data):
        async with semaphore:  # Acquire semaphore slot
            await process_payment_async(data)
            await r.xack('orders:payments', 'payment-processors', message_id)
    
    while True:
        result = await r.xreadgroup(
            groupname='payment-processors',
            consumername=consumer_name,
            streams={'orders:payments': '>'},
            count=10,
            block=5000
        )
        
        if result:
            tasks = []
            for message_id, data in result[0][1]:
                task = asyncio.create_task(process_with_limit(message_id, data))
                tasks.append(task)
            
            # Wait for all messages in batch to complete (with concurrency limit)
            await asyncio.gather(*tasks, return_exceptions=True)

# asyncio.run(consumer_with_concurrency_limit('worker-1', max_concurrent=5))
```

**Key Points:**
- Use `Semaphore` to limit concurrent downstream requests
- Prevents overwhelming external APIs or databases
- Balances throughput with resource constraints

#### Complete Example

Full payment processing system with consumer groups:

```python
import redis
import time
import logging
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PaymentConsumer:
    def __init__(
        self,
        stream_name: str,
        group_name: str,
        consumer_name: str,
        redis_host: str = 'localhost'
    ):
        self.r = redis.Redis(host=redis_host, port=6379, decode_responses=True)
        self.stream_name = stream_name
        self.group_name = group_name
        self.consumer_name = consumer_name
        
        # Ensure consumer group exists
        try:
            self.r.xgroup_create(stream_name, group_name, id='0', mkstream=True)
            logger.info(f'Created consumer group: {group_name}')
        except redis.ResponseError as e:
            if 'BUSYGROUP' not in str(e):
                raise
            logger.info(f'Consumer group already exists: {group_name}')
    
    def process_payment(self, data: Dict[str, Any]) -> bool:
        """Process a payment"""
        order_id = data.get('orderID')
        amount = data.get('amount')
        user_id = data.get('userID')
        
        logger.info(f'Processing payment: Order={order_id}, Amount=${amount}, User={user_id}')
        
        try:
            # Simulate payment processing
            time.sleep(0.5)
            
            # Simulate occasional failures
            import random
            if random.random() < 0.1:  # 10% failure rate
                raise Exception('Payment gateway timeout')
            
            logger.info(f'Payment successful: Order={order_id}')
            return True
            
        except Exception as e:
            logger.error(f'Payment failed: Order={order_id}, Error={e}')
            return False
    
    def start(self):
        """Start consuming messages"""
        logger.info(f'Consumer {self.consumer_name} started')
        
        while True:
            try:
                # Read messages (blocking with 5s timeout)
                result = self.r.xreadgroup(
                    groupname=self.group_name,
                    consumername=self.consumer_name,
                    streams={self.stream_name: '>'},
                    count=10,
                    block=5000
                )
                
                if not result:
                    logger.debug('No new messages')
                    continue
                
                stream_name, messages = result[0]
                
                for message_id, data in messages:
                    success = self.process_payment(data)
                    
                    if success:
                        # ACK message
                        self.r.xack(self.stream_name, self.group_name, message_id)
                        logger.info(f'ACKed message: {message_id}')
                    else:
                        # Leave in PEL for retry
                        logger.warning(f'Left in PEL for retry: {message_id}')
                
            except KeyboardInterrupt:
                logger.info('Shutting down...')
                break
            except Exception as e:
                logger.error(f'Error in consumer loop: {e}')
                time.sleep(5)

# Run multiple consumers
if __name__ == '__main__':
    import sys
    consumer_name = sys.argv[1] if len(sys.argv) > 1 else 'worker-1'
    
    consumer = PaymentConsumer(
        stream_name='orders:payments',
        group_name='payment-processors',
        consumer_name=consumer_name
    )
    
    consumer.start()
```

Running the system:

```bash
# Terminal 1: Start consumer 1
python payment_consumer.py worker-1

# Terminal 2: Start consumer 2
python payment_consumer.py worker-2

# Terminal 3: Start consumer 3
python payment_consumer.py worker-3

# Terminal 4: Add payments
redis-cli
XADD orders:payments * orderID 1001 amount 99.99 userID 123
XADD orders:payments * orderID 1002 amount 149.50 userID 456
XADD orders:payments * orderID 1003 amount 49.99 userID 789
XADD orders:payments * orderID 1004 amount 199.99 userID 111

# Terminal 5: Monitor
XINFO CONSUMERS orders:payments payment-processors
XPENDING orders:payments payment-processors

# Check for stuck messages
XPENDING orders:payments payment-processors IDLE 60000 - + 10
```

