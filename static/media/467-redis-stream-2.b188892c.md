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


### Consumer Groups

<item>

**What is it?** Consumer Groups in Redis Stream is analogous to Kafka consumer groups. They solve the coordination problems we had with manual `XREAD`.

</item>

<item>

**Key Features.**

1. **Independent consumer groups.** Multiple groups can process the same stream independently

2. **Automatic message distribution.** Messages automatically distributed among consumers in a group
3. **Pending Entry List (PEL).** Tracks which consumer has which unacknowledged messages. Messages are added to PEL immediately when consumed via `XREADGROUP` (not after processing). Only messages consumed without `NOACK` flag enter PEL.
4. **At-least-once delivery.** Messages remain pending (in `PEL`) until explicitly acknowledged with `XACK`
5. **Consumer failure handling.** Can claim messages from dead consumers
6. **Last delivered ID tracking.** Group tracks progress automatically


</item>

### Commands for Consumer Group
#### `XGROUP`

`XGROUP` manages consumer groups: creation, deletion, and configuration.

##### `XGROUP CREATE` - Create Consumer Group


<item> 

**Syntax.**

```text
XGROUP CREATE stream group_name starting_id [MKSTREAM]
```

Parameters:
- `stream` - Stream name
- `group_name` - Name for the consumer group
- `starting_id` - Where to start reading (`0` = beginning, `$` = only new messages)
- `MKSTREAM` - Create stream if it doesn't exist (optional)

</item> 

<item>



**Examples.**

Create consumer group starting from beginning:

```bash
XGROUP CREATE orders:payments payment-processors 0
```

Create group starting from current position (only new messages):

```bash
XGROUP CREATE orders:payments analytics-team $
```

Create group and stream if stream doesn't exist:

```bash
XGROUP CREATE orders:refunds refund-processors 0 MKSTREAM
```

Error if group already exists:

```bash
XGROUP CREATE orders:refunds refund-processors 0
```


</item>

<item>

**When to use `0` vs `$`.**

**Using `0`** - Process all existing + new messages:

```bash
XGROUP CREATE backfill-orders backfill-processors 0
```


**Using `$`** - Only process new messages (ignore existing):

```bash
XGROUP CREATE orders:payments real-time-processors $
```


</item>

##### `XGROUP SETID` - Reset Group Position

<item>

**Syntax.**

```text
XGROUP SETID stream group_name new_id
```

</item>

<item> 

**Use cases.**



Skip to only new messages:

```bash
XGROUP SETID orders:payments payment-processors $
```

Reset to beginning (reprocess all messages):

```bash
XGROUP SETID orders:payments payment-processors 0
```

Reset to specific message ID:

```bash
XGROUP SETID orders:payments payment-processors 1709251200500-0
```

**Recovery scenario.** Processing got stuck at bad message - skip past the problematic message:

```bash
XGROUP SETID orders:payments payment-processors 1709251200123-0
```

</item>

##### `XGROUP DESTROY` - Delete Consumer Group

Delete consumer group (cannot be undone!):

```bash
XGROUP DESTROY orders:payments analytics-team
```

Returns: `1` (success)

Deleting non-existent group:

```bash
XGROUP DESTROY orders:payments fake-group
```

Returns: `0` (group didn't exist)

##### `XGROUP DELCONSUMER` - Remove Consumer

Remove specific consumer from group:

```bash
XGROUP DELCONSUMER orders:payments payment-processors worker-1
```

Returns: `2` (number of pending messages that were assigned to worker-1)

These pending messages become available for other consumers.



#### `XREADGROUP`

`XREADGROUP` reads messages with automatic distribution and tracking.

##### Syntax


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

<item>

**Side Effect (When `ID=>` and `COUNT > 0`).** In this case when we execute `XREADGROUP` to a consumer, the consumer has an internal state that records the `last_id` consumed. 

The next time we execute `XREADGROUP` again the messages that are ***older than*** the `last_id` will be ***eliminated***


</item>

<item>

**Side Effect (When `ID=>`).** `XREADGROUP` with `ID=>` consumes messages from the stream, redis also immediately adds them to consumer's PEL

</item>



</item>

<item>

***No* Side Effect (When `ID=0`)** In this case `XREADGROUP` reads from the consumer's PEL, ***not*** from the stream directly. 

The returned messages are already consumed but ***not*** ACKed.

> **Remark.** PEL is a separate **radix tree** data structure tracking unacknowledged messages per consumer.

In this case we also say that we read the ***pending messages*** of a consumer.


</item>


##### Understand `PEL` (Pending Entry List) Behavior

When `XREADGROUP` returns messages, they are **immediately added to the consumer's PEL** before any processing begins. This happens at the moment of consumption, not after processing. The PEL tracks unacknowledged messages and enables reliable message delivery:

- Messages stay in PEL until explicitly acknowledged with `XACK`
- If a consumer crashes, messages remain in its PEL for recovery
- Use `NOACK` flag only when you don't need reliability (fire-and-forget scenarios)
- Only messages that need acknowledgment enter the PEL


##### Examples

###### Basic Consumer Group Read

<item>

**Setup.**

```bash
# Create stream with messages
XADD orders:payments * orderID 1001 amount 100 userID 123
XADD orders:payments * orderID 1002 amount 200 userID 456
XADD orders:payments * orderID 1003 amount 300 userID 789

# Create consumer group
XGROUP CREATE orders:payments payment-processors 0
```


`>` means "give me new messages ***not yet delivered*** to this group":

```bash
XREADGROUP GROUP payment-processors worker-1 COUNT 2 \
    STREAMS orders:payments >
```

</item>

<item>

**PEL Tracking.** These 2 messages are ***immediately*** added to `worker-1`'s Pending Entry List (`PEL`) the moment `XREADGROUP` returns them—before any processing happens. 

They will remain in the `PEL` until either:
- Successfully acknowledged with `XACK` after processing completes
- Reclaimed by another consumer via `XCLAIM` (if `worker-1` crashes or takes too long)

This immediate `PEL` tracking is what enables at-least-once delivery semantics: if the consumer crashes before ACKing, the messages remain in the `PEL` and can be recovered.

Consumer 2 reads (simultaneously):

```bash
XREADGROUP GROUP payment-processors worker-2 COUNT 2 \
    STREAMS orders:payments >
```
Here
- `worker-2` gets ***different*** messages (automatic distribution!)

- Messages 1001, 1002 already assigned to `worker-1`

</item>

###### Blocking Read with Consumer Group

By using `XREADGROUP` we  (i) ***create*** `worker-1` and  (ii) ***listen*** to new messages to the stream at the same time:

```bash
XREADGROUP GROUP payment-processors worker-1 BLOCK 30000 \
    STREAMS orders:payments >
```

We can test by adding a new message in another terminal:

```bash
XADD orders:payments * orderID 1004 amount 400 userID 111
```

###### With Specific ID Value

<item>

**Resume from Specific Point.** `XREADGROUP` returns messages with ID greater than specified, including:

1. ***Pending*** messages from this consumer's PEL with ID > specified ID
2. ***New*** messages from stream with ID > specified ID (not yet delivered to group)

```bash
XREADGROUP GROUP mygroup consumer1 STREAMS \
    mystream 1709251200000-0
```


</item>


<item>

**Example.** If consumer has pending 
```bash
[1709251200005-0, 1709251200010-0]
```
and we query with ID `1709251200007-0`, it returns: `1709251200010-0` (from ***PEL***) + any newer ***undelivered*** messages from the stream.

</item>

#### `XACK`


##### Syntax

```text
XACK stream group_name message_id [message_id ...]
```

Note that `group_name` is required, this command only operates within the context of a consumer group.

##### What is it?
- `XACK` removes messages from the Pending Entry List (PEL), signaling successful processing.

- `XACK` ***only*** works with consumer groups. When using `XREAD` without consumer groups, there is no `PEL` and no `XACK` command, we must manually track which messages we have processed.

- `XACK` ***does not*** delete messages from the stream for potential reprocessing, auditing, or consumption by other consumer groups.

  More specifically, even we have `ACK`-ed a message via 
  ```python
  r.xack('orders:payments',    # the stream
         'payment-processors', # the consumer group
          message_id)
  ```

  1. **Stream Storage**: ACKed messages remain in the stream permanently (unless explicitly trimmed with `XTRIM`)

  2. **PEL**: `XACK` only removes messages from the consumer group's PEL. We can verify the message is removed from PEL by checking:
      ```bash
      XREADGROUP GROUP payment-processors \
          worker-1 STREAMS orders:payments 0
      ```
      If the message was ACKed, it will NOT appear in this result (because it's no longer in worker-1's PEL).
  


**Different Read Commands See Different Views:**
- `XREAD STREAMS orders:payments 0` - Reads ALL messages from stream (includes ACKed messages)
- `XREADGROUP ... STREAMS orders:payments 0` - Reads only unACKed messages from THIS consumer's PEL
- `XREADGROUP ... STREAMS orders:payments >` - Reads new messages not yet delivered to consumer group

To actually remove messages from the stream, use `XTRIM`:
```bash
XTRIM orders:payments MINID 1709251200100-0  # Remove older messages
XTRIM orders:payments MAXLEN 1000             # Keep only last 1000
```



##### Examples 
###### Complete Workflow (From Read to `ACK`)
1. Worker reads messages:
    ```bash
    XREADGROUP GROUP payment-processors worker-1 STREAMS orders:payments >
    ```
    It returns message: `1709251200000-0`

2. Process the payment (... payment successful ...)

3. Acknowledge message (remove from PEL):
    ```bash
    XACK orders:payments payment-processors 1709251200000-0
    ```
    Returns: `1` (number of messages acknowledged)

4. Can `ACK` multiple messages at once:

    ```bash
    XACK orders:payments payment-processors 1709251200000-0 1709251200001-0 1709251200002-0
    ```

    Returns: `3`

###### Python Script Example

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
        
        # Check if there are messages (list could be empty)
        if not messages:
            continue
            
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


#### `XINFO`

`XINFO` provides detailed information about streams, groups, and consumers.

Three subcommands:


##### `XINFO STREAM` - Stream Details

```bash
XINFO STREAM orders:payments
```

##### `XINFO GROUPS` - List Consumer Groups

```bash
XINFO GROUPS orders:payments
```

<item>

**Example output (Listpack).**

```bash
1) 1) "name"
   2) "payment-processors"
   3) "consumers"
   4) (integer) 1
   5) "pending"
   6) (integer) 0
   7) "last-delivered-id"
   8) "1772438927833-0"
   9) "entries-read"
  10) (integer) 16
  11) "lag"
  12) (integer) 0
```

</item>

<item>

**Key fields.**
- `name` - Consumer group name
- `consumers` - Number of active consumers in this group
- `pending` - Total unacknowledged messages across all consumers
- `last-delivered-id` - Last message ID delivered to any consumer (determines what `ID=>` returns)
- **`entries-read`** - Total messages read by this group since creation
- `lag` - Number of messages in stream not yet delivered (stream length - entries-read)

</item>

<item>

**Important.** If `last-delivered-id` is ahead of all message IDs in the stream, `XREADGROUP` with `ID=>` will return nothing. 

If it is intended to re-deliver all messages again, run 

```bash
XGROUP SETID <stream> <group> 0
``` 


Upon reset, any blocking call of `XGROUPREAD` will process those messages.


</item>

##### `XINFO CONSUMERS` - List Consumers in Group

```bash
XINFO CONSUMERS orders:payments payment-processors
```

##### Python Monitoring Script


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
```

Output of the script:

![](/assets/img/2026-03-02-11-07-36.png)

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
- Use `ID=0` to read pending messages
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

##### Pattern 3: Combined Approach

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

##### Syntax

```text
XPENDING stream group_name [IDLE min_idle_time] start_id end_id \
    count [consumer_name]
```

#####  Examples


###### Get pending messages from a consumer group

Get detailed info for first 10 pending messages:

```bash
XPENDING orders:payments payment-processors - + 10
```

Returns for each message:
1. Message ID
2. Consumer name
3. Milliseconds since delivered
4. Delivery count (how many times read)



We have used `XGROUP SETID` to trigger the consumption of a stream in a blocking while-loop of `XGROUPREAD`, and deliberately thrown exceptions for a few of them, making them be consumed but not ACKed.

```bash
1) 1) "1772438038075-0"
   2) "worker-1"
   3) (integer) 109119
   4) (integer) 1
2) 1) "1772438927833-0"
   2) "worker-1"
   3) (integer) 109118
   4) (integer) 1
```


###### Get pending messages from a consumer group idle for more than 60 seconds (60000 ms)

Returns only messages not processed for > 60s:

```bash
XPENDING orders:payments payment-processors IDLE 60000 - + 10
```




###### Get pending messages from specific consumer

```bash
XPENDING orders:payments payment-processors - + 10 worker-1
```

Returns only `worker-1`'s pending messages.

##### Major Use Case: Finding Stuck Messages

Find messages stuck for > 5 minutes (300000 ms):

```bash
XPENDING orders:payments payment-processors IDLE 300000 - + 100
```

These are candidates for ***claiming*** (***reassigning*** to another consumer).

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

##### Example 1: Basic Claim Flow

1. `worker-1` crashed after reading message:

    ```bash
    XREADGROUP GROUP payment-processors worker-1 STREAMS orders:payments >
    ```

2. Returns: `1709251200000-0` (now in worker-1's PEL)

3. `worker-1` crashes and doesn't recover.

4. Check pending (5 minutes later = 300000 ms):

    ```bash
    XPENDING orders:payments payment-processors IDLE 300000 - + 10
    ```

5. Shows: `1709251200000-0` owned by `worker-1`, idle for 300000ms

6. `worker-2` claims the stuck message:

    ```bash
    XCLAIM orders:payments payment-processors 
        worker-2 \
        60000 \ # min-idle time
        1709251200000-0
    ```

7. Returns the claimed message:
    ```bash
    1) 1) "1772438038075-0"
      2) "worker-1"
      3) (integer) 109119
      4) (integer) 1
    2) 1) "1772438927833-0"
      2) "worker-1"
      3) (integer) 109118
      4) (integer) 1
    ```

8. Message now in `worker-2`'s PEL.

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

Here the `delivery_count` is recorded in the `struct` of `PEL` and is very helpful to implementing maximum retry threshold for DLQ.

##### Example 3: Claim Multiple Messages

Claim multiple stuck messages at once:

```bash
XCLAIM orders:payments payment-processors worker-3 60000 \
  1709251200000-0 1709251200001-0 1709251200002-0
```

Returns all 3 claimed messages. All moved from original consumers to worker-3's PEL.


### Concurrent Message Processing

#### Asyncio

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

##### Asyncio with Error Recovery

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


#### Semaphore

Similar to [Multithreading with Semaphore](/blog/article/Multithreading-with-Semaphore) in Kotlin, we don't want the unlimited amount of messages to exhaust all the resource of a machine.

We use `Semaphore` to 

- limit concurrent downstream requests
- Prevents overwhelming external APIs or databases
- Balances throughput with resource constraints


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
