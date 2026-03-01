---
title: "Redis `BLMOVE`: Building Message Queues with Lists"
date: 2026-02-21
id: blog0461
tag: redis
toc: true
intro: "Learn how to build reliable message queues using Redis Lists and BLMOVE. Covers the ACK mechanism with LREM, dead letter queue pattern, retry logic, and understanding when to graduate to Redis Streams for production workloads."
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

### `BLMOVE` - Reliable List-Based Message Queue

#### What is `BLMOVE`?

`BLMOVE` (Blocking List Move) is a Redis command that atomically moves an element from one list to another. It's the blocking version of `LMOVE`, meaning it will wait for an element to be available if the source list is empty.

Syntax:
```text
BLMOVE source destination LEFT|RIGHT \
    LEFT|RIGHT timeout
```

Parameters:
- `source` - The list to move from
- `destination` - The list to move to  
- First `LEFT|RIGHT` - Which end to pop from source (LEFT = head, RIGHT = tail)
- Second `LEFT|RIGHT` - Which end to push to destination
- `timeout` - Maximum seconds to wait (0 = wait forever)

#### Why `BLMOVE`?

Problem it solves:

When building a message queue with Redis Lists, we face a critical issue: what happens if a consumer crashes while processing a message?

Without `BLMOVE` (using `RPOP`):
```bash
# Consumer pops a message
RPOP tasks
# Returns: "process-payment-order-123"
# 
# Now processing... but consumer crashes!
# Message is lost forever - payment was never processed!
```

With `BLMOVE`:
```bash
# Atomically move from tasks to processing
BLMOVE tasks processing RIGHT LEFT 0
# Returns: "process-payment-order-123"
#
# Consumer crashes!
# Message is still in "processing" list - can be recovered!
```

#### Scenarios

Scenario 1: Order Processing System

```bash
# Producer adds orders to queue
LPUSH orders "order:1001"
LPUSH orders "order:1002"
LPUSH orders "order:1003"

# Consumer 1 starts processing
BLMOVE orders processing:consumer1 RIGHT LEFT 30
# Returns: "order:1001"
# Message moved to processing:consumer1

# Consumer 2 starts processing  
BLMOVE orders processing:consumer2 RIGHT LEFT 30
# Returns: "order:1002"
# Message moved to processing:consumer2

# If Consumer 1 completes successfully, remove from processing
LREM processing:consumer1 1 "order:1001"

# If Consumer 2 crashes, "order:1002" stays in processing:consumer2
# Recovery process can find it and reprocess
```

Scenario 2: Email Notification Queue

```bash
# Add email jobs
LPUSH email:queue "send-welcome-email:user123"
LPUSH email:queue "send-receipt-email:order456"

# Worker picks up job
BLMOVE email:queue email:processing RIGHT LEFT 0
# Returns: "send-welcome-email:user123"

# Email sent successfully - acknowledge
LREM email:processing 1 "send-welcome-email:user123"
```

#### BLMOVE with LREM: ACK Mechanism

The combination of `BLMOVE` and `LREM` creates a reliable message acknowledgment pattern:

Complete workflow:

```bash
# 1. Producer: Add tasks
LPUSH tasks "task1" "task2" "task3"

# 2. Consumer: Consume task (blocks until available)
BLMOVE tasks processing RIGHT LEFT 0
# Returns: "task1"

# 3. Process the task
# ... processing logic ...

# 4a. Success: ACK by removing from processing
LREM processing 1 "task1"
# Returns: 1 (removed successfully)

# 4b. Failure: Task stays in processing list
# Recovery worker can reconsume it
```

#### Handling Failed Consumption with BRPOP

When a task fails and remains in the processing list, we can reconsume it:

```bash
# Check what's stuck in processing
LRANGE processing 0 -1
# Returns: ["task2", "task5", "task8"]

# Reconsume failed task (blocking pop from processing queue)
BRPOP processing 30
# Returns: ["processing", "task2"]

# Retry processing
# ... retry logic ...

# If successful
LREM processing 1 "task2"

# If still fails, increment failure counter
HINCRBY task:task2:failures count 1
```

#### Dead Letter Queue (DLQ) Pattern

When a task fails multiple times, move it to a dead letter queue for manual review:

```bash
# Track failure count with hash
HSET task:failures task1 0

# Consumer logic (pseudocode):
task = BLMOVE tasks processing RIGHT LEFT 0

try:
    process(task)
    # Success - ACK
    LREM processing 1 task
    HDEL task:failures task
catch error:
    # Increment failure count
    failures = HINCRBY task:failures task 1
    
    if failures >= 3:
        # Too many failures - move to DLQ
        LREM processing 1 task
        LPUSH dead_letter_queue task
        HSET task:dlq:task timestamp "2026-03-01T10:00:00"
        HSET task:dlq:task error error.message
    else:
        # Keep in processing for retry
        # Recovery worker will pick it up
```

Complete example with retry logic:

```python
import redis
import time
import json

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

def process_with_retry(task_data):
    """Simulate task processing with retry and DLQ"""
    task_id = task_data
    max_retries = 3
    
    while True:
        # Get current failure count
        failures = int(r.hget(f'task:failures', task_id) or 0)
        
        if failures >= max_retries:
            # Move to dead letter queue
            r.lrem('processing', 1, task_id)
            r.lpush('dead_letter_queue', task_id)
            r.hset(f'task:dlq:{task_id}', mapping={
                'timestamp': time.time(),
                'failures': failures,
                'reason': 'Max retries exceeded'
            })
            print(f'Task {task_id} moved to DLQ after {failures} failures')
            break
        
        try:
            # Simulate processing
            print(f'Processing {task_id} (attempt {failures + 1})')
            
            # Your actual processing logic here
            # raise Exception("Simulated failure")  # Uncomment to test failure
            
            # Success - ACK
            r.lrem('processing', 1, task_id)
            r.hdel('task:failures', task_id)
            print(f'Task {task_id} completed successfully')
            break
            
        except Exception as e:
            # Increment failure count
            r.hincrby('task:failures', task_id, 1)
            print(f'Task {task_id} failed: {e}')
            time.sleep(2 ** failures)  # Exponential backoff

# Consumer loop
while True:
    # Wait for task (30 second timeout)
    result = r.blmove('tasks', 'processing', 30, 'RIGHT', 'LEFT')
    
    if result:
        process_with_retry(result)
    else:
        print('No tasks available, waiting...')
```

#### Flow Diagram

```mermaid
flowchart TD
    Start([Producer adds task]) --> Queue[(tasks queue)]
    Queue --> |BLMOVE| Consumer[Consumer receives task]
    Consumer --> Processing[(processing list)]
    Processing --> Process{Process task}
    
    Process -->|Success| ACK[LREM from processing]
    ACK --> Done([Task completed])
    
    Process -->|Failure| CheckRetry{Retry count < 3?}
    CheckRetry -->|Yes| IncrementRetry[HINCRBY failures count]
    IncrementRetry --> StayProcessing[Stay in processing]
    StayProcessing --> |Recovery worker| TryAgain[BRPOP from processing]
    TryAgain --> Process
    
    CheckRetry -->|No| MoveDLQ[LREM from processing<br/>LPUSH to DLQ]
    MoveDLQ --> DLQ[(Dead Letter Queue)]
    DLQ --> Manual[Manual review required]
    
    Consumer -.->|Crash| Processing
    Processing -.->|Task preserved| Recovery[Recovery worker<br/>finds stuck tasks]
    Recovery --> TryAgain
    
    style Queue fill:#e1f5ff
    style Processing fill:#fff3cd
    style DLQ fill:#f8d7da
    style Done fill:#d4edda
```

#### Complete Working Example

```bash
# Setup: Clear existing data
DEL tasks processing dead_letter_queue
DEL task:failures

# Producer: Add tasks
LPUSH tasks "payment:order1" "payment:order2" "payment:order3"

# Consumer 1: Process first task
BLMOVE tasks processing RIGHT LEFT 0
# Returns: "payment:order1"

# Simulate successful processing
LREM processing 1 "payment:order1"

# Consumer 2: Process second task
BLMOVE tasks processing RIGHT LEFT 0
# Returns: "payment:order2"

# Simulate failure
HINCRBY task:failures "payment:order2" 1
# Retry 1: fails again
HINCRBY task:failures "payment:order2" 1
# Retry 2: fails again
HINCRBY task:failures "payment:order2" 1
# Retry 3: max retries reached

# Check failure count
HGET task:failures "payment:order2"
# Returns: "3"

# Move to DLQ
LREM processing 1 "payment:order2"
LPUSH dead_letter_queue "payment:order2"
HSET task:dlq:payment:order2 timestamp "2026-03-01T10:00:00"
HSET task:dlq:payment:order2 reason "Payment gateway timeout"

# Check DLQ
LRANGE dead_letter_queue 0 -1
# Returns: ["payment:order2"]

# Check DLQ details
HGETALL task:dlq:payment:order2
# Returns: ["timestamp", "2026-03-01T10:00:00", "reason", "Payment gateway timeout"]

# Manual intervention: Process DLQ item and remove
RPOP dead_letter_queue
# Returns: "payment:order2"
# ... manually fix and reprocess ...
```



### Problems of `BLMOVE`

While `BLMOVE` provides reliability for message queues, it has several limitations that make it unsuitable for complex messaging scenarios:
#### The Problems 

##### No Native ACK Mechanism

> **Problem.** Redis Lists don't have built-in acknowledgment support.

We must manually implement ACK using `LREM`, which creates additional complexity:
- Need to track processing state separately
- Manual retry logic required
- No automatic redelivery on consumer failure

Example of the manual work required:
```bash
# Must manually manage all these steps:
BLMOVE tasks processing RIGHT LEFT 0  # 1. Consume
# ... process ...
LREM processing 1 "task1"             # 2. Manual ACK
HINCRBY failures "task1" 1            # 3. Track failures manually
# ... check retry count ...
LPUSH dlq "task1"                     # 4. Manual DLQ management
```

Comparison with proper MQ systems:
```javascript
// With Kafka/RabbitMQ - built-in ACK
consumer.consume((message) => {
  process(message)
  message.ack()  // Automatic redelivery if not acked
})
```

##### No Consumer Group Support

> **Problem.** Cannot distribute messages among multiple consumers efficiently.

With Lists, each message can only be consumed by one consumer, but there's no coordination:

```bash
# Setup: 3 consumers, 1 queue
LPUSH tasks "task1" "task2" "task3"

# All consumers call:
BLMOVE tasks processing:consumer1 RIGHT LEFT 0
BLMOVE tasks processing:consumer2 RIGHT LEFT 0  
BLMOVE tasks processing:consumer3 RIGHT LEFT 0

# Result: Each gets different task (good)
# But: No load balancing, no consumer state tracking, no automatic rebalancing
```

Missing features:
- No automatic message distribution
- No consumer health tracking
- No rebalancing when consumers join/leave
- No pending message ownership tracking
- Cannot see which consumer is processing which message

What Kafka consumer groups provide:
```javascript
// Kafka automatically:
// - Assigns partitions to consumers
// - Rebalances when consumers join/leave  
// - Tracks consumer offsets
// - Handles consumer failures with automatic reassignment
consumer.subscribe(['orders'], {
  groupId: 'order-processors'  // Automatic distribution!
})
```

##### Performance Degradation at Scale

> **Problem.** Messages accumulate faster than consumers can process them.

When production rate exceeds consumption rate, the processing list grows indefinitely:

```bash
# Production rate: 1000 msg/sec
# Consumption rate: 500 msg/sec
# After 1 hour: 1.8 million backlog!

LLEN processing
# Returns: 1800000

# Each BLMOVE now has to:
# 1. Pop from large tasks list (O(1) - still ok)
# 2. Push to large processing list (O(1) - still ok)
# 3. But LREM for ACK becomes slow: O(N) where N = 1.8M!

LREM processing 1 "task1"  
# Takes seconds on large list!
```

Time complexity issues:

| Operation | Complexity | Performance at Scale |
|-----------|-----------|---------------------|
| `LPUSH` | O(1) | Fast |
| `BLMOVE` | O(1) | Fast |
| `LREM` | O(N) | Slow when N is large! |
| `LRANGE` | O(S+N) | Slow for large ranges |

Real-world impact:
```bash
# With 1M messages in processing list:
# LREM must scan from head until it finds the message
LREM processing 1 "task_at_position_900000"
# Scans 900,000 elements! Takes several seconds!

# This creates a bottleneck:
# - Consumer spends more time ACKing than processing
# - Throughput drops as backlog grows
# - System becomes slower as it gets busier (worst case scenario)
```

##### Linear Structure Query Inefficiency

> **Problem.** Finding specific messages requires O(N) operations.

Lists are sequential data structures - no random access by ID:

```bash
# Want to check status of order:123?
# Must scan entire list!

LRANGE processing 0 -1  # Get all messages
# Returns: ["order:456", "order:789", ..., "order:123", ...]
# Client must scan through results

# With 100,000 messages:
# - Redis sends all 100k over network
# - Client must iterate to find "order:123"
# - Inefficient and slow
```

Common queries that are inefficient:

```bash
# 1. Check if specific task exists
LRANGE processing 0 -1 | grep "order:123"  # O(N) scan

# 2. Count tasks by type  
LRANGE tasks 0 -1 | grep "payment:" | wc -l  # O(N) scan + filter

# 3. Find tasks older than 5 minutes
# Impossible without external tracking!

# 4. Get all tasks for a specific user
LRANGE tasks 0 -1 | grep "user:123"  # O(N) scan + filter
```

What we need but Lists cannot provide:
- Query by message ID: O(1) lookup
- Query by timestamp: Range queries
- Query by field: Index-based search
- Query pending messages per consumer: Fast lookup

##### No Message Metadata

> **Problem.** Cannot store additional information about messages.

Lists only store strings - no structured data:

```bash
# Can only store string values
LPUSH tasks "order:123"

# But we need:
# - When was it added?
# - How many times has it been retried?
# - Which consumer is processing it?
# - What's the priority?
# - When did processing start?

# Workaround: Use separate Hash keys
HSET task:order:123 created_at 1735689600
HSET task:order:123 retries 2
HSET task:order:123 consumer "worker-1"
HSET task:order:123 started_at 1735689700

# Now we have consistency issues:
# - Message in list but Hash missing (race condition)
# - Hash exists but message consumed (stale data)
# - Must manage multiple keys in sync
# - No atomic operations across list + hash
```

#### Why These Problems Matter

Scenario: High-throughput payment processing

```python
# System requirements:
# - 10,000 payments/second  
# - Must track payment status
# - Must handle failures
# - Must not lose payments

# With BLMOVE + Lists:
# LREM becomes bottleneck at scale (O(N))
# Cannot query "status of payment X" efficiently
# No automatic retry on consumer crash
# Manual consumer group coordination
# Separate Hashes for metadata (consistency issues)

# Result: System breaks under load
```

These limitations led to Redis Streams:

Redis Streams solve all these problems by providing:
- Built-in consumer groups
- Automatic ACK mechanism with `XACK`
- O(1) message lookup by ID
- Rich metadata support
- Pending message tracking (PEL)
- Automatic consumer failover
- Range queries by timestamp
- Message claiming for recovery

### When to Use BLMOVE vs Redis Streams

`BLMOVE` with Lists is suitable for:
- Low to medium throughput (< 1000 messages/second)
- Simple message structure (string-based tasks)
- Single consumer or small number of consumers
- No need for message history or replay
- Learning Redis basics

Upgrade to Redis Streams when you need:
- High throughput (> 1000 messages/second)
- Structured message data with multiple fields
- Consumer groups with automatic distribution
- Built-in ACK and pending message tracking
- Message history and replay capability
- Time-based queries and analytics
- Production-grade reliability

### Next Steps

For production-ready message processing with consumer groups, automatic ACK, and all the features missing from BLMOVE, see the companion article on [Redis Streams](/blog/article/Redis-Streams-Production-Ready-Message-Queues-with-Consumer-Groups).
