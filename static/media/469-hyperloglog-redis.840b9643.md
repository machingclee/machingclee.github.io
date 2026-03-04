---
title: "Redis HyperLogLog: Probabilistic Counting"
date: 2026-03-05
id: blog0469
tag: redis
toc: true
intro: "Study statistic counting via HyperLogLog."
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

### Use Case: Counting Unique Article Views

Suppose we want to track how many unique users have viewed a particular blog article. Exact precision is not critical here — an approximation of ±1% is perfectly acceptable for analytics purposes. What matters is keeping the cost low and the implementation simple.

A naive approach would be to store every unique visitor ID in a Redis Set. Let's walk through what that would look like.

### Naive Approach: Using a Redis Set

Redis provides `SADD` to add members to a set and `SCARD` to count the total number of distinct members:

```text
SADD article:views:469 user:1001
SADD article:views:469 user:1002
SADD article:views:469 user:1001
SCARD article:views:469
```

The output of `SCARD` would be `2` since `user:1001` was added twice but sets only store unique values.

This works fine at a small scale. However, as an article gains popularity, the set grows proportionally — one stored entry per unique visitor. A single Redis string can be up to 512 MB, and storing millions of user IDs (each potentially being a UUID string of 36 characters) can consume hundreds of megabytes _per article_. For a platform hosting thousands of articles, this becomes a serious memory concern.

### The Problem at Scale

Suppose an article has 10 million unique views. A UUID like `550e8400-e29b-41d4-a716-446655440000` occupies roughly 36 bytes. Storing 10 million such entries in a single Set would require approximately:

$$
10{,}000{,}000 \times 36 \text{ bytes} \approx 360 \text{ MB}
$$

That is just _one_ article. Across a platform, this approach simply does not scale.

### HyperLogLog: Approximate Counting at Low Memory Cost

HyperLogLog (HLL) is a probabilistic data structure that estimates the cardinality (i.e., the number of distinct elements) of a set with very low memory usage — at most 12 KB, regardless of how many elements are tracked. The trade-off is a small margin of error, typically around 0.81%.

For use cases like page view counters, where exact counts are not required, HyperLogLog is an ideal fit.

### Commands

#### `PFADD` — Add Elements

```text
PFADD article:hll:469 user:1001
PFADD article:hll:469 user:1002
PFADD article:hll:469 user:1001
```

`PFADD` works similarly to `SADD` — it registers elements into the HyperLogLog structure. Duplicate insertions are handled internally and do not inflate the count.

One important distinction from a plain Set: `PFADD` does _not_ allocate the full 12 KB upfront. Memory usage starts small and grows incrementally as more unique elements are added — only reaching 12 KB when the cardinality is very large.

#### `PFCOUNT` — Estimate Cardinality

```text
PFCOUNT article:hll:469
```

This returns the estimated number of unique elements added to the HyperLogLog. For the above example, the result would be approximately `2`.

`PFCOUNT` can also accept multiple keys at once, returning the estimated cardinality of the _union_ of all specified HyperLogLogs:

```text
PFCOUNT article:hll:469 article:hll:470 article:hll:471
```

This is useful for computing site-wide unique visitor counts across multiple articles in a single call.

#### `PFMERGE` — Merge Multiple HyperLogLogs

```text
PFMERGE combined:hll article:hll:469 article:hll:470 article:hll:471
```

`PFMERGE` creates a new HyperLogLog (`combined:hll`) that represents the union of all source HyperLogLogs. We can then run `PFCOUNT` on the merged key to get the total estimated unique visitor count across all merged sources.

This is particularly useful when aggregating daily counters into a monthly summary, or combining per-article stats into a category-level or site-level metric.

### Memory Comparison

| Approach | 10M unique users | Notes |
|---|---|---|
| Redis Set | ~360 MB | Exact count, high memory |
| HyperLogLog | ≤ 12 KB | ~0.81% error, fixed upper bound |

For analytics workloads where approximate counts are acceptable, HyperLogLog offers an orders-of-magnitude improvement in memory efficiency.



