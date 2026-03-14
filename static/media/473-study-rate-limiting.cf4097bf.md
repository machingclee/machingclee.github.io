---
title: "Rate Limiting"
date: 2026-03-11
id: blog0472
tag: linux, C, networking
toc: true
intro: "Study several implementation of rate limiting in a high level."
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


### Algorithms for Rate Limiting

Rate limiting controls how frequently a client can make requests to a server. Below are five widely-used algorithms, each with a conceptual explanation and a concrete Redis + Node.js implementation.



### Token Bucket

#### How It Works

Imagine a bucket that holds tokens. A **refill process** adds tokens at a fixed rate (e.g., 10 tokens per second) up to a maximum capacity. Every incoming request consumes one token. If the bucket has tokens, the request is allowed; if empty, the request is rejected (or queued).

Key properties:
- **Allows bursts** up to the bucket capacity.
- Smooth average rate enforced by the refill rate.
- Simple and memory-efficient (only two numbers per user: `tokens` and `last_refill_time`).

> **Real-world usage:** Both **Amazon** (AWS API Gateway) and **Stripe** use the token bucket algorithm to throttle their API requests.

**How many buckets do we need?** It depends on the rules:
- Different buckets per API endpoint — e.g., 1 post/second, 150 friend-adds/day, and 5 likes/second each need their own bucket.
- One bucket per IP address if throttling by IP.
- One global bucket if a single system-wide cap applies (e.g., 10,000 req/s total).

#### Pros and Cons

**Pros:**
- Easy to implement
- Memory efficient
- Allows short bursts as long as tokens remain

**Cons:**
- Two parameters (`bucket size` and `refill rate`) can be tricky to tune properly

#### Redis + Node.js Example

```js
const redis = require("ioredis");
const client = new redis();

const CAPACITY = 10;        // max tokens
const REFILL_RATE = 10;     // tokens per second

async function tokenBucket(userId) {
  const key = `rate:token:${userId}`;
  const now = Date.now() / 1000; // seconds

  const data = await client.hgetall(key);
  let tokens = data.tokens ? parseFloat(data.tokens) : CAPACITY;
  let lastRefill = data.lastRefill ? parseFloat(data.lastRefill) : now;

  // Refill tokens based on elapsed time
  const elapsed = now - lastRefill;
  tokens = Math.min(CAPACITY, tokens + elapsed * REFILL_RATE);

  if (tokens < 1) {
    return { allowed: false, tokens };
  }

  tokens -= 1;
  await client.hset(key, "tokens", tokens, "lastRefill", now);
  await client.expire(key, 60);

  return { allowed: true, tokens };
}
```



###  Leaking Bucket

#### How It Works

Think of a bucket with a **hole at the bottom**. Requests pour in at any rate but leak out (are processed) at a fixed rate. If the bucket overflows, new requests are dropped.

Key properties:
- **Smooths out bursts** — output rate is always constant.
- Good for scenarios requiring a steady processing rate (e.g., payment gateways).
- Implemented as a **FIFO queue** with a fixed drain rate.

> **Real-world usage:** **Shopify** uses the leaking bucket algorithm to rate-limit its REST Admin API.

The algorithm takes two parameters:
- **Bucket size** — equal to the queue depth; how many requests can wait.
- **Outflow rate** — how many requests are processed per second.

#### Pros and Cons

**Pros:**
- Memory efficient — bounded queue size
- Stable, predictable outflow; ideal when a constant processing rate is required

**Cons:**
- A sudden burst fills the queue with old requests; newer requests get dropped
- Two parameters are also difficult to tune properly

#### Redis + Node.js Example

```js
const BUCKET_CAPACITY = 10;   // max queue depth
const LEAK_RATE = 1;          // requests processed per second

async function leakingBucket(userId) {
  const queueKey = `rate:leak:queue:${userId}`;
  const lastLeakKey = `rate:leak:time:${userId}`;
  const now = Date.now() / 1000;

  const lastLeak = parseFloat(await client.get(lastLeakKey) || now);
  const elapsed = now - lastLeak;

  // Drain the queue based on elapsed time
  const leaked = Math.floor(elapsed * LEAK_RATE);
  if (leaked > 0) {
    // Remove "leaked" items from the front
    const pipeline = client.pipeline();
    for (let i = 0; i < leaked; i++) pipeline.lpop(queueKey);
    pipeline.set(lastLeakKey, now, "EX", 60);
    await pipeline.exec();
  }

  const queueLen = await client.llen(queueKey);
  if (queueLen >= BUCKET_CAPACITY) {
    return { allowed: false };
  }

  await client.rpush(queueKey, now);
  await client.expire(queueKey, 60);
  return { allowed: true };
}
```



### Fixed Window Counter

#### How It Works

Time is divided into **fixed-size windows** (e.g., 1-minute slots: 00:00–01:00, 01:00–02:00 …). Each request increments a counter for the current window. Once the counter exceeds the limit the request is rejected.

Key properties:
- Very simple; uses a single integer counter per window per user.
- **Weakness**: a burst at the window boundary can double the effective rate.

**Boundary-burst problem illustrated:**  
Suppose the limit is 5 requests per minute and the window resets on the round minute. A client sends 5 requests at `2:00:58` (end of window 1) and 5 more at `2:01:02` (start of window 2). Both batches are accepted — yet within the 60-second span `2:00:30 → 2:01:30`, **10 requests** went through — twice the intended limit.

#### Pros and Cons

**Pros:**
- Memory efficient — one integer counter per window
- Easy to understand and reason about
- Resetting quota at a fixed boundary suits certain business rules (e.g., daily billing cycles)

**Cons:**
- Spike at window edges can allow up to 2× the intended quota

#### Redis + Node.js Example

```js
const LIMIT = 100;       // max requests per window
const WINDOW_SEC = 60;   // window size in seconds

async function fixedWindowCounter(userId) {
  const window = Math.floor(Date.now() / 1000 / WINDOW_SEC);
  const key = `rate:fixed:${userId}:${window}`;

  const count = await client.incr(key);
  if (count === 1) {
    // Set TTL only on first request in window
    await client.expire(key, WINDOW_SEC * 2);
  }

  if (count > LIMIT) {
    return { allowed: false, count };
  }
  return { allowed: true, count };
}
```



### Sliding Window Log (Fixing Problem from BytebyteGo)

#### How It Works

Instead of snapping to fixed window boundaries, we keep a **log (sorted set) of timestamps** for every **allowed** request. On each new request, we:
1. Remove all entries older than `now - windowSize`.
2. Count remaining entries.
3. If count < limit, insert the new timestamp and allow. Otherwise reject — without inserting.

Key properties:
- **Accurate** — no boundary burst problem.
- **Memory-bounded** — the log holds at most `limit` entries at any time, because rejected requests are never inserted.
- Naive implementations that insert first and check after will let the log grow proportional to attack traffic during a DDoS, causing memory exhaustion. Always check first.

**Step-by-step walkthrough** (limit = 2 requests/min, `windowSize` = 1min):

<table>
  <thead>
    <tr>
      <th style="width:100px">Time</th>
      <th style="width:230px">Action</th>
      <th style="width:150px">Log state</th>
      <th>Decision</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1:00:01</td>
      <td>Insert timestamp, check size</td>
      <td><code>[1:00:01]</code></td>
      <td>Allowed (size 1 ≤ 2)</td>
    </tr>
    <tr>
      <td>1:00:30</td>
      <td>Insert timestamp, check size</td>
      <td><code>[1:00:01, 1:00:30]</code></td>
      <td>Allowed (size 2 ≤ 2)</td>
    </tr>
    <tr>
      <td>1:00:50</td>
      <td>Prune (nothing removed), count = 2, limit reached — <strong>reject without inserting</strong></td>
      <td><code>[1:00:01, 1:00:30]</code></td>
      <td><strong>Rejected</strong> (count 2 ≥ limit 2) — log unchanged</td>
    </tr>
    <tr>
      <td>1:01:40</td>
      <td>Prune entries before <code>1:00:40</code> (removes <code>1:00:01</code>, <code>1:00:30</code>), count = 0, insert <code>1:01:40</code></td>
      <td><code>[1:01:40]</code></td>
      <td>Allowed (count 0 &lt; limit 2)</td>
    </tr>
  </tbody>
</table>

<Example>

**Why reject without inserting?** If rejected timestamps are stored like ***bytebytego***: 

![](/assets/img/2026-03-12-03-42-40.png)

A DDoS attack floods the log with millions of entries per window. The log grows unbounded in memory and every future request must scan/count a huge set. By only inserting allowed requests, the log is capped at `limit` entries — a constant memory footprint regardless of attack volume.

</Example>

#### Pros and Cons

**Pros:**
- Very accurate — requests never exceed the limit in any rolling window
- Memory-bounded — log holds at most `limit` entries when check-before-insert is used

**Cons:**
- Higher implementation complexity than counter-based approaches

#### Redis + Node.js Example

```js
const LIMIT = 100;
const WINDOW_MS = 60_000; // 60 seconds in milliseconds

async function slidingWindowLog(userId) {
  const key = `rate:swlog:${userId}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const pipeline = client.pipeline();
  // zremrangebyscore will also remove the right endpoint.
  pipeline.zremrangebyscore(key, "-inf", windowStart); // prune old entries
  pipeline.zcard(key);                                 // count entries after pruning
  const results = await pipeline.exec();

  const count = results[1][1]; // result of zcard
  if (count >= LIMIT) {
    // Reject without inserting — log stays bounded to LIMIT entries
    return { allowed: false, count };
  }

  // Only insert when allowed
  await client.zadd(key, now, `${now}-${Math.random()}`);
  await client.expire(key, Math.ceil(WINDOW_MS / 1000) + 1);

  return { allowed: true, count: count + 1 };
}
```



### Sliding Window Counter

#### How It Works

A hybrid between **Fixed Window Counter** and **Sliding Window Log**. It keeps two adjacent fixed-window counters and **interpolates** the request count based on how far the current timestamp falls into the current window.

Formula:
$$
\text{estimated count} = \text{prev_count} \times (1 - \text{window progress}) + \text{curr_count}
$$

**Concrete example:**  
- Limit: **7 requests/min**  
- Previous minute: **5 requests**  
- Current minute so far: **3 requests**  
- Current time is at the **30% mark** of the current minute (i.e., window progress = 0.30, so the previous window overlaps by 70%)

$$3 + 5 \times 0.7 = 6.5 \approx 6$$

The request is allowed (6 < 7). One more request would hit the limit.

Key properties:
- **Memory efficient** — only two counters needed, not a full log.
- Close approximation; assumes previous window requests are evenly distributed.
- According to **Cloudflare** experiments, only **0.003%** of requests are wrongly allowed or rate-limited among 400 million requests — an acceptable error rate.

#### Pros and Cons

**Pros:**
- Memory efficient — only two counters per user
- Smooths out traffic spikes by averaging over the previous window

**Cons:**
- Approximation only; assumes uniform distribution within the previous window

#### Redis + Node.js Example

```js
const LIMIT = 100;
const WINDOW_SEC = 60;

async function slidingWindowCounter(userId) {
  const now = Date.now() / 1000;
  const currentWindow = Math.floor(now / WINDOW_SEC);
  const prevWindow = currentWindow - 1;

  const currKey = `rate:swctr:${userId}:${currentWindow}`;
  const prevKey = `rate:swctr:${userId}:${prevWindow}`;

  const [prevCount, currCount] = await Promise.all([
    client.get(prevKey).then(v => parseInt(v || "0")),
    client.get(currKey).then(v => parseInt(v || "0")),
  ]);

  // How far into the current window (0.0 → 1.0)
  const windowProgress = (now % WINDOW_SEC) / WINDOW_SEC;

  // Weighted estimate: previous window contributes its "remaining" fraction
  const estimated = prevCount * (1 - windowProgress) + currCount;

  if (estimated >= LIMIT) {
    return { allowed: false, estimated };
  }

  const pipeline = client.pipeline();
  pipeline.incr(currKey);
  pipeline.expire(currKey, WINDOW_SEC * 2);
  await pipeline.exec();

  return { allowed: true, estimated: estimated + 1 };
}
```



### System Architecture

#### Where to Put the Rate Limiter

Rate limiting can be enforced at multiple points:

- **Client-side** — unreliable; clients can forge requests and you often have no control over the client.
- **Server-side middleware** — a dedicated rate limiter layer sits in front of API servers.
- **API Gateway** — in microservice architectures, the API gateway (a managed service) handles rate limiting alongside SSL termination, authentication, and IP whitelisting.

Guidelines for choosing:
- If you own the stack end-to-end, server-side middleware gives full algorithm control.
- If you already have an API gateway for auth/routing, add rate limiting there.
- If engineering resources are scarce, a commercial API gateway is faster than building your own.

#### High-Level Architecture

The core idea: use an **in-memory store** (Redis) to track request counters. Databases are too slow due to disk I/O. Redis provides two key primitives:

- `INCR` — atomically increment a counter by 1.
- `EXPIRE` — attach a TTL so counters auto-delete after the window.

Request flow:
1. Client sends request to **rate limiter middleware**.
2. Middleware fetches the counter from Redis for the matching bucket (user ID, IP, endpoint).
3. If the counter exceeds the limit → return **HTTP 429 Too Many Requests**.
4. Otherwise → forward to API servers and increment the counter in Redis.

#### HTTP Headers

Clients need to know when they are being throttled and how long to back off. The rate limiter should return these headers:

```
X-Ratelimit-Remaining:  Remaining requests allowed in the current window
X-Ratelimit-Limit:      Total requests allowed per window
X-Ratelimit-Retry-After: Seconds to wait before retrying (sent with 429 responses)
```

#### Rate Limiting Rules

Rules are typically stored as configuration files (e.g., YAML) on disk, loaded by workers into a cache, and read by the middleware at request time.

```yaml
# Allow max 5 marketing messages per day
domain: messaging
descriptors:
  - key: message_type
    value: marketing
    rate_limit:
      unit: day
      requests_per_unit: 5

# Allow max 5 login attempts per minute
domain: auth
descriptors:
  - key: auth_type
    value: login
    rate_limit:
      unit: minute
      requests_per_unit: 5
```

> **Lyft** open-sourced their rate-limiting component ([github.com/lyft/ratelimit](https://github.com/lyft/ratelimit)) which follows this rule-file pattern.

---

### Distributed Environment Concerns

#### Race Condition

In a highly concurrent environment, a naive read-check-write is not atomic:

1. Thread A reads counter = 3.
2. Thread B reads counter = 3.
3. Thread A writes counter = 4.
4. Thread B writes counter = 4.

The counter ends up at 4 instead of the correct 5 — two requests effectively shared one token.

**Solutions:**
- **Lua scripts** — Redis executes Lua scripts atomically, so the read-increment-write happens as a single operation.
- **Redis sorted sets** — use `ZADD` + `ZCOUNT` within a pipeline; sorted set operations are inherently ordered and can be made atomic.

```js
// Atomic increment with Lua (token bucket example)
const lua = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local now = tonumber(ARGV[2])
  local rate = tonumber(ARGV[3])
  local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
  local tokens = tonumber(data[1]) or capacity
  local lastRefill = tonumber(data[2]) or now
  local elapsed = now - lastRefill
  tokens = math.min(capacity, tokens + elapsed * rate)
  if tokens < 1 then return 0 end
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
  redis.call('EXPIRE', key, 60)
  return 1
`;
// returns 1 = allowed, 0 = rejected
```

#### Synchronization Issue

When multiple rate limiter instances run (horizontal scaling), each instance has its own in-memory state. A client routed to a different instance on each request bypasses per-instance counters entirely.

**Wrong approach:** Sticky sessions (binds a client to one server) — not scalable.

**Correct approach:** Use a **centralized Redis cluster** shared by all rate limiter instances. Every instance reads from and writes to the same counters, regardless of which instance handles the request.

---

### Performance Optimization

- **Multi-data-center / edge nodes** — route each request to the geographically nearest edge server to minimize latency. Cloudflare operates 194+ globally distributed edge servers for this purpose.
- **Eventual consistency** — replicate rate limiter state across data centers using an eventual consistency model. A tiny window of inconsistency is acceptable for rate limiting in exchange for much lower cross-region latency.

---

### Monitoring

After deploying a rate limiter, track these metrics to verify effectiveness:

- **Drop rate** — if too high, rules may be too strict; relax them.
- **Pass-through rate during spikes** — if abusive traffic still gets through during flash sales or DDoS events, consider switching to Token Bucket (better burst absorption) or tightening the window.
- **Latency overhead** — the rate limiter should add < 1 ms to response time in the 99th percentile.

---

### Additional Considerations


#### Rate Limiting at Different OSI Layers

This article focuses on Layer 7 (HTTP / application layer). Rate limiting can also be applied at:

- **Layer 3 (Network / IP layer)** — using `iptables` rules to cap packets-per-second from a source IP.
- **Layer 4 (Transport / TCP)** — connection rate limiting at the load balancer level.

#### Client Best Practices

To avoid being rate-limited:
- Cache responses locally to avoid redundant API calls.
- Respect `X-Ratelimit-Remaining` and back off before hitting zero.
- Implement **exponential backoff with jitter** when retrying after a 429.
- Catch 429 responses gracefully rather than crashing.


### References

- Alex Xu, [*Design A Rate Limiter*](https://bytebytego.com/courses/system-design-interview/design-a-rate-limiter?fbclid=IwY2xjawQd_w9leHRuA2FlbQIxMABicmlkETF1bllMTEZkQ3VpY1Y0dVFIc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHuOOx7kYKE21pYoXJA4vzxx3OxZaDWnIZ8tI5bv47u9t79UFxXHHApkpr92L_aem_F_SWhowXadxiphtAhCQlFg), bytebytego