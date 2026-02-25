---
title: "Understand Stale Statistics and Query Execution Plans"
date: 2026-02-24
id: blog0462
tag: database, postgresql, oracle, mongodb
toc: true
intro: "Examine how stale statistics affect query execution plans in PostgreSQL, Oracle, and MongoDB, and learn strategies to resolve them"
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

### What Are Database Statistics

Database statistics are metadata that the query optimizer uses to estimate the cost of different execution plans. These statistics include.

- Row counts in tables
- Distribution of values in columns
- Index cardinality
- Data density and selectivity
- NULL value frequencies

When these statistics become outdated (stale), the optimizer makes suboptimal decisions, leading to poor query performance.

### Join Algorithms

Before diving into stale statistics, we need to understand the join algorithms that database optimizers choose between. These algorithms are fundamental to how databases combine data from multiple tables.

#### Nested Loop Join

**How it works.**
- For each row in the outer table, scan the entire inner table looking for matches
- Similar to nested for-loops in programming

**Example.**
```text
For each row in Table A (outer table):
    For each row in Table B (inner table):
        If A.key = B.key:
            Output joined row
```

**Why is it called "outer" and "inner"?**

The terminology comes from nested loop structure in programming.
- The **outer table** (Table A) is like the **outer loop** - it's processed first and runs fewer times (once through the entire table)
- The **inner table** (Table B) is like the **inner loop** - it's nested inside and runs many times (once for each row in the outer table)

Just like in nested loops where the outer loop variable changes slowly and the inner loop variable changes rapidly, the outer table is scanned once while the inner table is scanned repeatedly.

In this example, Table A is the **outer table** (scanned once) and Table B is the **inner table** (scanned repeatedly for each row in A).

**When it's used.**
- Small outer table with indexed inner table
- Selective `WHERE` clauses (few matching rows)

**Performance.**
- Time complexity: $O(n \cdot m)$ where $n$ = outer rows, $m$ = inner rows
- Best when outer table is small (Table A) and inner table has an index (Table B)

**Example scenario.**
```sql
SELECT * FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE c.state = 'CA';
```

**Execution order.**
- **Step 1.** Apply `WHERE` clause - filter customers by state (returns 5 customers from 10 total)
- **Step 2.** For each of those 5 customers, use index to find their orders

Good choice: only 5 CA customers after filtering. The `customers` (outer table) is small after `WHERE` clause, and `orders` (inner table) is large (1M rows) but has index on `customer_id`. Result: Only 5 index lookups - very fast!

#### Hash Join

**How it works.**
- Build phase. Create hash table from smaller table
- Probe phase. Scan larger table, probe hash table for matches

**Example.**
```text
1. Build hash table from Table A (smaller table) on join key
2. For each row in Table B (larger table):
    - Hash the join key
    - Look up in hash table
    - Output matches
```

In this example, Table A is the **build input** (smaller table, used to create hash table) and Table B is the **probe input** (larger table, scanned to find matches).

**When it's used.**
- Large tables where indexes don't exist or wouldn't be efficient (both Table A and B can be large, but algorithm works best when at least one is significantly smaller)
- Equality joins only (=)
- Sufficient memory available to hold the hash table

**Why choose hash join over nested loop (even when indexes exist).**
- Hash join ignores indexes but doesn't require their absence
- **Optimizer chooses hash join based on cost**, which can be lower than nested loop even with indexes when.
  - Both tables return many rows (poor selectivity) - repeatedly using an index becomes expensive
  - Full table scans + hash join is faster than many index lookups
  - The `WHERE` clause filters result in large intermediate result sets
- Example. If our `WHERE` clause returns 50,000 customers, doing 50,000 index lookups on orders is slower than scanning both tables and hashing

**Performance.**
- Time complexity: $O(n + m)$ - linear
- Space complexity: $O(\text{smaller table size})$
- Fast for large datasets


##### Example 1. No indexes
```sql
SELECT * FROM orders o
JOIN order_items oi ON o.id = oi.order_id;
```

Hash join builds hash table on smaller table (`orders` as build input), then probes with larger table (`order_items` as probe input).

##### Example 2. Indexes exist, but hash join is still chosen
```sql
SELECT * FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.order_date >= '2025-01-01';
```

**Execution order.**
- **Step 1.** Apply `WHERE` clause - filter orders by date (returns 100k orders)
- **Step 2.** Now need to join these 100k orders with `order_items`

Even with index on `order_id`, if `WHERE` returns 100k orders.
- **Nested loop.** 100k index lookups on `order_items` (expensive!)
- **Hash join.** Scan filtered orders + scan `order_items` = faster!

The `WHERE` clause is applied FIRST, creating a large intermediate result. Then the join algorithm is chosen based on that filtered row count. Optimizer chooses hash join based on cost estimates.

#### Merge Join (Sort-Merge Join)

**How it works.**
- **1st Phase (Sort).** Sort both tables by join key (if not already sorted)
- **2nd Phase (Merge).** Scan both sorted tables simultaneously with two pointers, matching rows as we go

**Why is it called "Sort-Merge"?**

The algorithm has two distinct phases.
- The **sort phase** ensures both inputs are ordered by the join key
- The **merge phase** walks through both sorted lists simultaneously, similar to the merge step in merge sort algorithm

**Detailed merge process.**

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'fontSize':'13px'}, 'flowchart': {'padding': 20}}}%%
graph TD
    Start["Start: orders=[1,3,5,7,9], items=[1,3,3,5,5,5,8], A=1, B=1"] --> Step1
    
    Step1["S1: A=1 B=1 MATCH"] --> Out1["OUT#1: A→3 B→3"]
    
    Out1 --> Step2["S2: A=3 B=3 MATCH"] --> Out2["OUT#2: A=3 B→3"]
    
    Out2 --> Step3["S3: A=3 B=3 MATCH"] --> Out3["OUT#3: A=3 B→5"]
    
    Out3 --> Step4["S4: A=3 B=5 skip"] --> Adv4["A→5"]
    
    Adv4 --> Step5["S5: A=5 B=5 MATCH"] --> Out5["OUT#4: A=5 B→5"]
    
    Out5 --> Step6["S6: A=5 B=5 MATCH"] --> Out6["OUT#5: A=5 B→5"]
    
    Out6 --> Step7["S7: A=5 B=5 MATCH"] --> Out7["OUT#6: A=5 B→8"]
    
    Out7 --> Step8["S8: A=5 B=8 skip"] --> Adv8["A→7"]
    
    Adv8 --> Step9["S9: A=7 B=8 skip"] --> Adv9["A→9"]
    
    Adv9 --> Step10["S10: A=9 B=8 skip"] --> End["Done: 6 results"]
    
    style Start fill:#e1f5ff
    style End fill:#d4edda
    style Out1 fill:#fff3cd
    style Out2 fill:#fff3cd
    style Out3 fill:#fff3cd
    style Out5 fill:#fff3cd
    style Out6 fill:#fff3cd
    style Out7 fill:#fff3cd
```

Each pointer advances monotonically through its table - we never go backwards. When we find order 3 with 2 items, we scan through both items for order 3, then move on. We don't need to rescan because both tables are sorted.

**Advantage.** Each table is scanned only once during the merge phase, making it very efficient for large datasets that are already sorted.

**When it is used.**
- Both inputs already sorted (indexes on join columns) - avoids expensive sort phase
- Non-equality joins ($<$, $>$, BETWEEN) - unlike hash join which only works with $=$
- Large sorted datasets where hash join would require too much memory
- Range joins where we need to match ranges of values

**Performance.**
- Time complexity: $O(n \log n + m \log m)$ if sorting needed, $O(n + m)$ if pre-sorted
- Space complexity: $O(1)$ if data already sorted (no buffering needed)
- Efficient for sorted data - single pass through each table during merge



##### Example 1. Pre-sorted data (optimal case)
```sql
SELECT * FROM customers c
JOIN orders o ON c.id = o.customer_id
ORDER BY c.id;
```

**Execution order.**
- **Step 1.** Both tables have clustered indexes on their join columns, so they're already sorted
- **Step 2.** Merge phase only - scan both tables once with two pointers
- **Step 3.** Output is already sorted (bonus)

***Result.*** $O(n + m)$ - single scan of each table.

##### Example 2. Range joins
```sql
SELECT * FROM sales s
JOIN promotions p ON s.sale_date BETWEEN p.start_date AND p.end_date;
```

**Why merge join?**
- Hash join doesn't work with BETWEEN (non-equality)
- Nested loop would be $O(n \cdot m)$ - checking every sale against every promotion
- Merge join. Sort both by date, then efficiently match ranges in $O(n + m)$ after sorting

##### Example 3. When might merge join be chosen despite sorting cost?
```sql
SELECT * FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE e.salary > 50000
ORDER BY e.dept_id;
```

**Key question.** If no indexes exist on `dept_id`, why not use hash join instead of merge join?

**Answer.** Hash join is typically better! But merge join might be chosen when.

**Case A. Result needs sorting (`ORDER BY` clause present)**
- **Step 1.** Apply `WHERE` clause - filter employees by salary
- **Step 2 (Hash join).** Build hash on departments, probe with employees → unsorted result
- **Step 3 (Sort result).** by `dept_id` for `ORDER BY`, costing $O(N\log N)$, where $N$ = number of results

vs.

- **Step 1.** Apply `WHERE` clause - filter employees by salary  
- **Step 2 (Merge join approach).** Sort employees by dept_id: $O(n \log n)$
- **Step 3.** Sort departments by id: $O(m \log m)$
- **Step 4.** Merge (output is already sorted!) → $O(n + m)$

If the result set is large, sorting it after hash join is expensive. Merge join produces pre-sorted output, saving the final sort step.

**Case B. Limited memory (hash table would not fit)**
```sql
SELECT * FROM huge_orders o
JOIN massive_items i ON o.category_id = i.category_id;
```

If both tables are massive and hash table won't fit in available memory.
- **Hash join.** Build hash table on smaller table → might exceed `work_mem`, spill to disk (very slow!)
- **Merge join.** External sort both tables using disk-based sort → $O(n \log n + m \log m)$ disk I/O, then merge

Merge join's external sort is more efficient than hash join's disk spilling.

**Case C. Statistics-driven decision**

**The optimizer considers.**
- Table sizes ($n$ and $m$)
- Available memory (`work_mem` in PostgreSQL)
- Expected result size
- Presence of `ORDER BY` clause

**Cost comparison.**
- **Hash join cost.** $O(n + m)$ + potential sort cost if we are using `ORDER BY`
- **Merge join cost.** $O(n \log n + m \log m)$ + $O(n + m)$ merge

**Decision.** It depends on statistics! If:
- Small tables → nested loop or hash join
- Large tables + sufficient memory + no `ORDER BY` → hash join  
- Large tables + limited memory → merge join
- Any size + `ORDER BY` on join key → merge join
- Pre-sorted data (indexes) → merge join (no sort needed!)

**Typical scenario.** For Example 3 without `ORDER BY`, **hash join would be preferred**. Merge join is chosen when there's a good reason (sorting needed, memory constraints, or data already sorted).

**Comparison with other joins.**

| Scenario | Nested Loop | Hash Join | Merge Join |
|----------|-------------|-----------|------------|
| Small outer + indexed inner | Best | Too slow | Overkill |
| Large tables, unsorted | Terrible | Best | Good if sorted |
| Pre-sorted data | Slow | Wastes sort | Best |
| Range joins (BETWEEN) | Slow | Can't use | Best |
| Limited memory | OK | Needs RAM | Best |

#### Comparison Summary

| Feature | Nested Loop | Hash Join | Merge Join |
|---------|-------------|-----------|------------|
| **Best for** | Small outer table | Large tables | Pre-sorted data |
| **Memory** | Low | High | Medium |
| **Complexity** | $O(n*m)$ | $O(n+m)$ | $O(n+m)$ sorted |
| **Index helps?** | Yes (inner) | No | Yes (both) |
| **Join types** | All | Equality only | All |
| **Parallelizable** | Limited | Easy | Medium |

#### SQL Example for Different Joins

Given tables.
- `customers` - 1,000 rows
- `orders` - 1,000,000 rows

```sql
SELECT c.name, o.total
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE c.country = 'USA';
```

**Scenario 1.** USA has 5 customers, `orders.customer_id` indexed
- **Best choice.** Nested Loop (5 index lookups)

**Scenario 2.** USA has 900 customers, no indexes, plenty of RAM
- **Best choice.** Hash Join (build hash on customers, probe orders)

**Scenario 3.** Both tables ordered by ID, limited RAM
- **Best choice.** Merge Join (both already sorted, no memory needed)

The database optimizer chooses the appropriate algorithm based on statistics, available indexes, and system resources. This is why accurate statistics are crucial for optimal performance.

### Stale Statistics in PostgreSQL

#### How Statistics Affect Execution Plans

PostgreSQL's query planner relies heavily on statistics stored in `pg_statistic` to choose between.
- Index scans vs sequential scans
- Join algorithms (nested loop, hash join, merge join)
- Join order when multiple tables are involved

When statistics are stale, PostgreSQL might.
- Choose a sequential scan when an index scan would be faster
- Use the wrong join algorithm
- Estimate row counts incorrectly, leading to insufficient memory allocation

#### Detecting Stale Statistics

We can check when tables were last analyzed.

```sql
SELECT 
    schemaname,
    relname,
    last_analyze,
    last_autoanalyze,
    n_mod_since_analyze  -- Number of rows modified (INSERT/UPDATE/DELETE) since last ANALYZE
FROM pg_stat_user_tables
WHERE n_mod_since_analyze > 1000
ORDER BY n_mod_since_analyze DESC;
```

#### Interpreting the Real Statistic Results

Let's examine a real-world example of query results to understand what they reveal about database health.

##### Example Output

![](/assets/img/2026-02-24-17-46-58.png)

##### Key Findings

- **High modification counts without statistics updates.**
  - All 6 tables have over 1,000 modifications (`n_mod_since_analyze`) since their ***last*** statistics update
  - `Notification_Logging` has the most with **6,723 modifications** - this is concerning

- **Relying solely on autovacuum.**
  - `last_analyze` is `NULL` for all tables → no manual `ANALYZE` has ever been run
  - Only `last_autoanalyze` has dates → statistics are managed entirely by autovacuum

- **Outdated statistics.**
  - `Notification_Logging`. Last analyzed **25 days ago** (Jan 30) with 6,723 changes
  - `Session` **42 days ago** (Jan 13) with 2,770 changes  
  - `Tagging_Tag` **110 days ago** (Nov 6) with 2,116 changes
  - `Tagging_Rel_Team_tag` **91 days ago** (Nov 25) with 2,498 changes

**What this means.** Autovacuum is not triggering frequently enough. By default, autovacuum analyzes a table when:

$$
N > T +  k \cdot n
$$

where 
- $N$ = `n_mod_since_analyze`
- $T$ = `autovacuum_analyze_threshold`
- $k$ = `autovacuum_analyze_scale_factor` and
- $n$ = `reltuples`

with ***default values*** $T=50$ and $k=0.1$ (10% of table rows).

**What these parameters mean.**
- `autovacuum_analyze_threshold (50)`  - a fixed base number, minimum 50 row modifications needed before autovacuum considers analyzing
- `autovacuum_analyze_scale_factor (0.1)` - a percentage (0.1 = 10%), adds 10% of the table's total row count to the threshold
- `reltuples` - total ***estimated*** rows in a table



  **Combined effect.** The trigger point = $50 + (0.1 \times \text{total rows})$

  For example:

  ![](/assets/img/2026-02-25-22-08-27.png?width=400px)



**Why is `reltuples` an estimate?.** PostgreSQL doesn't maintain an exact row count (too expensive)
Updated only after ANALYZE or autovacuum runs
More accurate after recent analysis, less accurate as table changes


**Examples across different table sizes.**

- **100-row table.** $50 + 0.1 \times 100 = 60$ modifications needed
- **1,000-row table.** $50 + 0.1 \times 1000 = 150$ modifications needed
- **10,000-row table.** $50 + 0.1 \times 10000 = 1050$ modifications needed
- **67,000-row table.** $50 + 0.1 \times 67000 = 6750$ modifications needed


**Key insight.** Larger tables need proportionally more changes before autovacuum analyzes them. This percentage-based approach prevents small tables from being analyzed too frequently, but it can cause large tables to have very stale statistics in high-volume systems.

**Example for `Notification_Logging`.**
- If it has ~67,000 rows, autovacuum triggers at. $50 + 0.1 \times 67000 = 6750$ modifications
- Currently: 6,723 modifications, approaching threshold but hasn't triggered yet
- Meanwhile, 25 days of stale statistics means the query planner is working with outdated cardinality estimates

**Performance implications.** Our application might experience:
- Suboptimal execution plans (wrong join algorithms chosen)
- Inefficient index usage decisions
- Poor memory allocation for hash joins/sorts
- Slow queries on these tables, especially joins involving `Notification_Logging` and `Session`

**Why this happens.** For tables with steady modification rates, autovacuum's percentage-based threshold (10% by default) means larger tables need proportionally more changes before analysis triggers. A 100,000-row table needs 10,000+ modifications before autovacuum analyzes it - that could take weeks or months depending on workload.

**Immediate actions recommended.**

**1st Manual analysis of most affected tables.**
```sql
ANALYZE public."Notification_Logging";
ANALYZE public."Session";
ANALYZE public."Tagging_Rel_Team_tag";
```

**2nd Tune autovacuum for high-churn (high rate of data modifications) tables.**
```sql
ALTER TABLE public."Notification_Logging" SET (
    autovacuum_analyze_threshold = 50,
    autovacuum_analyze_scale_factor = 0.05  -- 5% instead of 10%
);
```

**3rd Set up monitoring to catch this earlier.**
```sql
SELECT relname, n_mod_since_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE n_mod_since_analyze > 1000
ORDER BY n_mod_since_analyze DESC;
```

This real-world example demonstrates how stale statistics accumulate in production systems and why proactive monitoring is essential. The tables shown would benefit from more aggressive autovacuum settings or scheduled manual `ANALYZE` operations during maintenance windows.

#### Solutions in PostgreSQL

**1st Manual ANALYZE.**
```sql
-- Analyze specific table
ANALYZE table_name;

-- Analyze specific columns
ANALYZE table_name (column1, column2);

-- Analyze entire database
ANALYZE;
```

**2nd Configure Autovacuum.**
```sql
-- Adjust autovacuum thresholds
ALTER TABLE table_name SET (
    autovacuum_analyze_threshold = 50,
    autovacuum_analyze_scale_factor = 0.1
);
```

**3rd Increase Statistics Target.**
```sql
-- Collect more detailed statistics for specific columns
ALTER TABLE table_name ALTER COLUMN column_name 
SET STATISTICS 1000;
```

**4th Monitor Configuration.**
```sql
-- Check current autovacuum settings
SHOW autovacuum_analyze_threshold;
SHOW autovacuum_analyze_scale_factor;
```

### Stale Statistics in Oracle Database

#### How Statistics Affect Execution Plans

Oracle's Cost-Based Optimizer (CBO) uses statistics from `DBA_TAB_STATISTICS` and `DBA_TAB_COL_STATISTICS` to determine.
- Access paths (full table scan, index scan, index fast full scan)
- Join methods (nested loops, hash join, sort-merge join)
- Parallel execution decisions

Stale statistics in Oracle can cause.
- Inefficient execution plans being cached in the shared pool
- Wrong cardinality estimates leading to memory pressure
- Suboptimal partition pruning

#### Detecting Stale Statistics

```sql
-- Check table statistics staleness
SELECT 
    owner,
    table_name,
    last_analyzed,
    num_rows,
    stale_stats
FROM dba_tab_statistics
WHERE stale_stats = 'YES'
ORDER BY last_analyzed;

-- Check column statistics
SELECT 
    owner,
    table_name,
    column_name,
    num_distinct,
    last_analyzed
FROM dba_tab_col_statistics
WHERE owner = 'SCHEMA_NAME'
ORDER BY last_analyzed;
```

#### Solutions in Oracle

##### Manual Statistics Gathering
```sql
-- Gather table statistics
EXEC DBMS_STATS.GATHER_TABLE_STATS(
    ownname => 'SCHEMA_NAME',
    tabname => 'TABLE_NAME',
    estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
    method_opt => 'FOR ALL COLUMNS SIZE AUTO',
    cascade => TRUE
);

-- Gather schema statistics
EXEC DBMS_STATS.GATHER_SCHEMA_STATS(
    ownname => 'SCHEMA_NAME',
    estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
    cascade => TRUE
);

-- Gather system statistics
EXEC DBMS_STATS.GATHER_SYSTEM_STATS('START');
-- Run workload
EXEC DBMS_STATS.GATHER_SYSTEM_STATS('STOP');
```

##### Understand the different `GATHER` commands

Three `GATHER` commands serve different purposes:

**`GATHER_TABLE_STATS` (single table).**
- **Purpose.** Update statistics for one specific table
- **When to use.** One table has stale statistics, after large data changes to a single table, quick targeted fix
- **Duration.** Seconds to minutes (one table only)

**`GATHER_SCHEMA_STATS` (all tables in schema).**
- **Purpose.** Update statistics for all tables in a schema at once
- **When to use.** Multiple tables are stale, after bulk data load affecting many tables, regular maintenance
- **Duration.** Minutes to hours (depends on schema size)
- **Note.** This automatically gathers stats for all tables, so we don't need individual `GATHER_TABLE_STATS` for each table

**`GATHER_SYSTEM_STATS` (database-wide I/O metrics).**
- **Purpose.** Collects hardware performance metrics (CPU speed, I/O throughput, disk latency)
- **When to use.** Once after hardware changes or database migration, helps optimizer understand system capabilities
- **Duration.** Hours (needs workload sampling)
- **Note.** This is NOT about table statistics - it's about hardware performance characteristics

**Decision guide for stale statistics.**
- **One problematic table** → `GATHER_TABLE_STATS` for that table
- **Multiple tables need updating** → `GATHER_SCHEMA_STATS` once (covers all tables)
- **Regular maintenance** → `GATHER_SCHEMA_STATS` scheduled weekly/monthly
- **New database or hardware** → `GATHER_SYSTEM_STATS` first (once), then `GATHER_SCHEMA_STATS`

**Hierarchy.**
```text
System Stats (hardware characteristics)  ← Run once/rarely
    ↓
Schema Stats (all tables in schema)      ← Run weekly/monthly
    ↓
Table Stats (individual table)           ← Run as needed for specific tables
```

For most stale statistics problems, **just run `GATHER_SCHEMA_STATS`** - it's the most practical choice.

##### Configure Automatic Statistics Collection
```sql
-- Enable automatic statistics gathering
EXEC DBMS_AUTO_TASK_ADMIN.ENABLE(
    client_name => 'auto optimizer stats collection',
    operation => NULL,
    window_name => NULL
);

-- Set preferences
EXEC DBMS_STATS.SET_GLOBAL_PREFS(
    pname => 'ESTIMATE_PERCENT',
    pvalue => 'DBMS_STATS.AUTO_SAMPLE_SIZE'
);
```

#####  Set Table Monitoring
```sql
-- Enable monitoring for specific table
ALTER TABLE table_name MONITORING;

-- Check monitoring status
SELECT table_name, monitoring 
FROM dba_tables 
WHERE owner = 'SCHEMA_NAME';
```

##### Lock Statistics (when needed)
```sql
-- Lock statistics to prevent automatic updates
EXEC DBMS_STATS.LOCK_TABLE_STATS('SCHEMA_NAME', 'TABLE_NAME');

-- Unlock when ready to update
EXEC DBMS_STATS.UNLOCK_TABLE_STATS('SCHEMA_NAME', 'TABLE_NAME');
```

### Stale Statistics in MongoDB

#### How Statistics Affect Execution Plans

MongoDB's query optimizer uses statistics from collection metadata and index statistics to decide.
- Whether to use an index or collection scan
- Which index to use when multiple options exist
- Query shape and plan caching decisions

Unlike relational databases, MongoDB uses a different approach with:
- Query plan caching based on query shape
- Empirical testing of multiple plans
- Adaptive plan selection

#### How Stale Statistics Impact MongoDB

MongoDB's query planner can suffer from.
- Cached plans becoming suboptimal as data distribution changes
- Index selection issues when index cardinality changes significantly
- Performance degradation with stale plan cache

### Detecting Stale Statistics in MongoDB

#### Key difference from relational databases 

Unlike PostgreSQL or Oracle, MongoDB doesn't maintain explicit staleness indicators like `n_mod_since_analyze` or `stale_stats` columns. Instead, we must detect stale statistics indirectly through performance symptoms and query analysis.

#### MongoDB's Automatic Plan Cache Invalidation

MongoDB automatically invalidates cached query plans after approximately **1,000 write operations** (inserts, updates, deletes) on a collection. This means.
- Statistics effectively "reset" every ~1,000 writes
- High-write-volume collections get fresh plans more frequently
- Low-write-volume collections might cache suboptimal plans longer

However, this automatic mechanism doesn't always catch gradual data distribution changes or index selectivity degradation.

#### Important note for MongoDB Atlas users

Atlas restricts direct access to plan cache operations (`$planCacheStats`, `getPlanCache()`) for security and resource management.

**Where plan cache operations ARE available:**
- **Self-hosted MongoDB** - full access to all plan cache commands
- **MongoDB Community/Enterprise** running on our own servers (on-premises or cloud VMs)
- **Local MongoDB** development instances (localhost)
- **Containerized MongoDB** (Docker, Kubernetes) that we manage

**Where plan cache operations are NOT available:**
- **MongoDB Atlas** (managed cloud service) - restricted for security
- **Atlas Serverless** - no direct cache access
- **Other managed MongoDB services** - may have restrictions

**Atlas users should rely on:**
- Performance Advisor in Atlas UI (provides similar insights)
- Query profiler and slow query logs
- `explain("executionStats")` for individual queries (still works!)
- Atlas monitoring metrics and alerts
- Real User Monitoring (RUM) for query performance tracking

#### Indirect Detection Methods

##### Performance degradation symptoms
- Query execution time suddenly increases without code changes
- Previously fast queries become slow
- Increased CPU or memory usage for specific queries
- More timeouts or slow query log entries

#### Analyze an `explain("executionStats")` output

```javascript
db.orders.find({ status: "pending" }).explain("executionStats")
```

**Key metrics to examine.**

```javascript
{
  "executionStats": {
    "nReturned": 100,           // Rows returned to client
    "totalDocsExamined": 50000, // Rows scanned
    "executionTimeMillis": 1523,
    "executionStages": {
      "stage": "COLLSCAN"       // Collection scan instead of index!
    }
  }
}
```

#### Red flags indicating stale statistics or poor index usage

##### High examination ratio (totalDocsExamined / nReturned > 10)

  > **Misconception.** "High examination ratio is inevitable because we filter documents with `WHERE` clauses first, then return results."

  This is wrong, with proper indexes, the database uses the index to **identify matching documents BEFORE examining them**. The index ***is*** the filter mechanism.

  > **Question.** "But don't I need to scan all rows to check the `WHERE` condition?"

  No! This is the entire purpose of indexes - to avoid scanning all rows.

  **How B-tree indexes eliminate full scans:**

  Think of an index like a phone book:
  - **Without index (full scan):** To find "John Smith", open EVERY page and check EVERY name (scan all 1 million entries)
  - **With index (B-tree):** Jump to the "S" section → Jump to "Sm" → Jump to "Smith, John" (check ~log₂(1M) ≈ 20 entries)

  **Detailed example - How the B-tree structure works:**

  ```javascript
  // Collection has 1,000,000 users
  // We want: status = "active"
  // Only 1,000 users are "active"

  // WITHOUT INDEX - Must scan everything:
  db.users.find({ status: "active" })

  // Physical process WITHOUT index:
  // 1. Start at first document on disk
  // 2. Read document #1, check status → "inactive" → skip
  // 3. Read document #2, check status → "pending" → skip
  // 4. Read document #3, check status → "active" → keep!
  // 5. Read document #4, check status → "inactive" → skip
  // ... repeat for ALL 1,000,000 documents!
  // Total reads: 1,000,000 documents from disk
  // Time: ~10+ seconds
  ```

  Now let's see what happens WITH an index:

  ```javascript
  // CREATE INDEX - builds this B-tree structure:
  db.users.createIndex({ status: 1 })

  // Index creates a separate sorted tree structure:
  /*
  B-tree Index on "status" field:
                      [Root Node]
                    /            \
              ["active"]          ["inactive", "pending"]
                /                     /              \
      [Doc IDs: 5, 12,         [Doc IDs:        [Doc IDs:
      23, 45, 78,              1, 2, 3,         999,997,
      ... 1000 IDs]            ... 500k IDs]    ... 499k IDs]
      
  The index stores:
  - Sorted keys ("active", "inactive", "pending")
  - Document IDs/pointers for each key value
  - Tree structure for fast lookup (log N time)
  */

  // Now query WITH index:
  db.users.find({ status: "active" })

  // Physical process WITH index:
  // 1. Look at root node of B-tree (1 read)
  // 2. Compare "active" < root → go left branch (1 read)
  // 3. Found "active" node → contains list of 1,000 document IDs
  // 4. Read only those 1,000 documents by ID from disk
  // Total reads: ~3 index nodes + 1,000 documents = 1,003 reads
  // Time: ~10 milliseconds

  // Result:
  // WITHOUT index: Read 1,000,000 docs, examined 1,000,000, returned 1,000 (1000x ratio)
  // WITH index:    Read 1,000 docs, examined 1,000, returned 1,000 (1.0x ratio)
  ```

  > **Question.** Why we DON'T need to scan all rows with an index?  
  
  The B-tree index is a **pre-sorted lookup table** that was built when we created the index:

  ```javascript
  // When we run: db.users.createIndex({ status: 1 })
  // MongoDB builds this mapping (simplified):

  Index structure:
  {
    "active": [5, 12, 23, 45, 78, ... 1000 document IDs],
    "inactive": [1, 2, 3, 4, 6, ... 500,000 document IDs],
    "pending": [7, 8, 9, ... 499,000 document IDs]
  }

  // When we query: db.users.find({ status: "active" })
  // MongoDB does NOT scan the collection!
  // Instead:
  // 1. Look up "active" in the pre-built index → Found! [5, 12, 23, ...]
  // 2. Jump directly to documents 5, 12, 23, ... on disk
  // 3. Return those specific documents
  ```


  **The key difference:**
  - **Full scan:** Check condition on EVERY row in the table
  - **Index scan:** Check condition in the INDEX ONLY (which is sorted and tiny), then fetch only matching rows

  **Performance comparison:**

  | Operation | Without Index | With Index | Improvement |
  |-----------|---------------|------------|-------------|
  | **Data structures accessed** | Main table only | Index tree + specific docs | Separate lookup structure |
  | **Comparisons needed** | 1,000,000 | ~20 (tree depth) + 1,000 | 1000x fewer |
  | **Documents read from disk** | 1,000,000 | 1,000 | Read only matches |
  | **Time complexity** | $O(N)$ linear | $O(\log N + K)$ | K = matching docs |
  | **Actual time** | 10+ seconds | 10 milliseconds | 1000x faster |
  | **totalDocsExamined** | 1,000,000 | 1,000 | Only matching docs |
  | **Examination ratio** | 1000x | 1.0x | Perfect efficiency |

  Let's answer the following question:

  > "Do we need to scan all rows to check the WHERE condition?"

  **No!** The index IS a pre-built answer to your WHERE condition.

  When you create an index, MongoDB:
  1. **Scans all rows ONCE** during index creation
  2. **Builds a sorted structure** (B-tree) with the answer
  3. **Maintains it** as data changes

  When you query:
  1. **Look up in the pre-built answer** (the index)
  2. **Get document IDs instantly** (no scanning needed)
  3. **Fetch only those specific documents**

  Think of it as: "Scanning is done at index creation time, not at query time."

  **When high examination ratio is acceptable:**
  ```javascript
  // Multikey indexes on arrays may have slight overhead
  db.collection.find({ "tags": "urgent" })
  // If document has: tags: ["urgent", "important", "review"]
  // Index creates entry for each tag, multiple documents may share tags
  // Ratio: 1.5x - 3x is normal (some non-matching examined)
  ```

  **When high ratio indicates a problem:**
  ```javascript
  // No index exists - must scan everything
  nReturned: 100
  totalDocsExamined: 50,000
  stage: "COLLSCAN"
  // Problem: Missing index, add one!

  // Wrong index chosen due to stale statistics
  nReturned: 100
  totalDocsExamined: 50,000
  stage: "IXSCAN"
  indexName: "wrong_index"
  // Problem: Optimizer chose poorly selective index
  // Solution: Update statistics or hint correct index

  // Index exists but has poor selectivity
  nReturned: 1
  totalDocsExamined: 10,000
  stage: "IXSCAN"
  indexName: "status_1"
  // Problem: Index not selective enough (e.g., status has only 2 values)
  // Solution: Create compound index with more selective fields
  ```

##### Collection scans (stage: "COLLSCAN") when an index should exist

  This is the PRIMARY indicator. If you see `COLLSCAN`:
  - No index exists on filtered fields, OR
  - Optimizer determined full scan is cheaper (table too small, or query returns >30% of data)

  ```javascript
  // Expected COLLSCAN (acceptable):
  db.smallCollection.find({})  // Fetching all documents
  // Collection has 100 documents - full scan is efficient

  // Problematic COLLSCAN:
  db.largeCollection.find({ userId: "12345" })  // Should use index
  // Collection has 10M documents - needs index on userId!
  ```

##### Wrong index chosen (indexName shows unexpected index)

  Even with `IXSCAN`, the optimizer might choose the wrong index due to stale statistics:

  ```javascript
  // Expected: Use compound index { userId: 1, timestamp: 1 }
  // Actual: Used index { timestamp: 1 } - less selective
  stage: "IXSCAN"
  indexName: "timestamp_1"
  totalDocsExamined: 50,000  // High ratio despite using index!
  nReturned: 10
  ```

  > **Question.** When does the optimizer choose the wrong index?

  The query optimizer uses **statistics** to estimate how many documents each index will need to examine (this estimate is called **cardinality**). It chooses the index with the lowest estimated cost.

  **Scenario: Stale statistics cause wrong index selection**

  Consider a `users` collection with 1,000,000 documents and two indexes:
  - Index A: `{ status: 1 }` (user account status)
  - Index B: `{ email: 1 }` (user email)

  Query: `db.users.find({ status: "premium", email: "john@example.com" })`

  **When statistics were fresh (1 month ago):**
  - Status distribution: 50% "free", 50% "premium" (500K each)
  - Optimizer's estimate: Index A would scan ~500K docs, Index B would scan ~1 doc
  - **Correct choice: Index B** (email is unique)

  **After data growth (statistics NOT updated):**
  - Status distribution changed: 90% "free", 10% "premium" (900K free, 100K premium)
  - But optimizer still thinks: 50% "free", 50% "premium" (old stats)
  - **Optimizer's calculation (based on stale stats):**
    - Index A: ~500K docs to scan (WRONG - actually 100K)
    - Index B: ~1 doc to scan (correct)
    - **Still chooses Index B** (correct by luck)

  **Now a different scenario with multiple stale statistics:**

  Query: `db.users.find({ status: "premium", country: "USA" })`

  Indexes:
  - Index A: `{ status: 1 }` 
  - Index C: `{ country: 1 }`

  **Optimizer's calculation (using stale stats):**
  - Old stats say: 50% premium users (500K), 30% USA users (300K)
  - Optimizer estimates: Index A scans 500K, Index C scans 300K
  - **Choice: Index C** (lower estimate)

  **Actual current data:**
  - Reality: 10% premium users (100K), 80% USA users (800K)
  - If optimizer knew this: Index A scans 100K, Index C scans 800K
  - **Should have chosen: Index A** (much better!)

  **Result with wrong index choice:**
  ```javascript
  stage: "IXSCAN"
  indexName: "country_1"  // Wrong index!
  totalDocsExamined: 800,000  // Scans most USA users
  docsReturned: 8,000  // Only 10% of USA users are premium
  // Examination ratio: 800,000 / 8,000 = 100x inefficiency!
  ```

  **Why this happens:**

  1. Statistics capture data distribution at a point in time
  2. Data changes (inserts, updates, deletes skew distribution)
  3. Optimizer uses OLD cardinality estimates to calculate index costs
  4. Wrong index appears cheaper based on outdated information
  5. Query uses IXSCAN but examines many irrelevant documents

  **MongoDB vs SQL databases - same behavior:**

  This is NOT unique to MongoDB - **major databases** (PostgreSQL, MySQL, Oracle, SQL Server) have the same issue. They all:
  - Use B-tree indexes (same data structure)
  - Rely on statistics for query planning
  - Need periodic statistics updates to maintain optimal plans
  - Can choose wrong indexes when statistics are stale

  The index mechanics work identically - the problem is the optimizer's **decision-making** based on outdated information, not the index structure itself.

  **How to fix: Force the optimizer to use the correct index**

  When stale statistics cause wrong index selection, we have several solutions:

  **Solution 1: Update statistics (Permanent fix)**

  MongoDB automatically maintains statistics, but we can force a refresh:

  ```javascript
  // Option 1: Reindex the collection (updates statistics)
  db.users.reIndex()
  
  // Option 2: Run validate command (repairs and updates stats)
  db.runCommand({ validate: "users", full: true })
  
  // Option 3: Drop and recreate problematic index
  db.users.dropIndex("country_1")
  db.users.createIndex({ country: 1 })
  ```

  **Solution 2: Use index hints (Temporary workaround)**

  Force the query to use a specific index:

  ```javascript
  // Force use of status index
  db.users.find({ status: "premium", country: "USA" })
    .hint({ status: 1 })
  
  // Alternative: Force by index name
  db.users.find({ status: "premium", country: "USA" })
    .hint("status_1")
  
  // Verify it uses the correct index
  db.users.find({ status: "premium", country: "USA" })
    .hint({ status: 1 })
    .explain("executionStats")
  ```

  **Solution 3: Create compound index (Better long-term solution)**

  If queries frequently filter on multiple fields:

  ```javascript
  // Create compound index
  db.users.createIndex({ status: 1, country: 1 })
  
  // Now this query will efficiently use the compound index
  db.users.find({ status: "premium", country: "USA" })
  // Uses status first (10% selectivity) then country (eliminates most remaining)
  ```

  **Solution 4: Rewrite query (Alternative approach)**

  Sometimes restructuring the query helps:

  ```javascript
  // Original problematic query
  db.users.find({ status: "premium", country: "USA" })
  
  // Alternative: Use aggregation with explicit pipeline
  db.users.aggregate([
    { $match: { status: "premium" } },  // Use status index first
    { $match: { country: "USA" } }       // Then filter by country
  ])
  ```

  **Verification: Confirm the fix worked**

  After applying any solution, verify using `explain()`:

  ```javascript
  db.users.find({ status: "premium", country: "USA" })
    .explain("executionStats")
  
  // Check these values:
  // 1. executionStats.executionStages.indexName: "status_1" ✓
  // 2. executionStats.totalDocsExamined: ~100,000 (not 800,000) ✓
  // 3. Examination ratio: ~12.5x (100K examined / 8K returned) ✓
  //    Much better than 100x before!
  ```

  **Best practice workflow:**

  1. **Short-term**: Use `.hint()` to immediately fix slow queries in production
  2. **Medium-term**: Update statistics with `reIndex()` or `validate` command
  3. **Long-term**: Create compound indexes for frequently-used query patterns
  4. **Ongoing**: Schedule regular statistics updates (weekly/monthly depending on data change rate)

##### High execution time (executionTimeMillis significantly higher than baseline)

  Combined with other metrics to identify problems.

#### Summary: Why examination ratio IS a good metric

  - **Ratio near 1.0x** → Index working perfectly, only examines matching docs
  - **Ratio 1.5-3x** → Acceptable for multikey indexes or range queries  
  - **Ratio > 10x** → Problem! Either no index (COLLSCAN) or wrong index (IXSCAN with poor selectivity)

#### Diagnostic workflow: What to check in order

  1. **First:** Check `stage` - is it COLLSCAN or IXSCAN?
    - COLLSCAN → Need to create index
    - IXSCAN → Continue to next check

  2. **Second:** Check `indexName` - is it the right index?
    - Wrong index → Update statistics or use hint
    - Correct index → Continue to next check

  3. **Third:** Check examination ratio - is the index selective?
    - High ratio with correct index → Index has poor selectivity, need compound index
    - Low ratio → Everything is good!

#### Example analysis

```javascript
// Good performance (index used efficiently)
stage: "IXSCAN"
indexName: "userId_1"
nReturned: 100
totalDocsExamined: 120
Ratio: 1.2x (acceptable - slight overhead from multikey or range)

// Poor performance - missing index
stage: "COLLSCAN"
nReturned: 100
totalDocsExamined: 50000
Ratio: 500x (PROBLEM - create index!)

// Poor performance - wrong index chosen
stage: "IXSCAN"
indexName: "timestamp_1"  // Should use userId_1
nReturned: 100
totalDocsExamined: 50000
Ratio: 500x (PROBLEM - stale statistics, wrong index!)
```

**Conclusion:** 

Checking for IXSCAN vs COLLSCAN is crucial, but examination ratio provides additional diagnostic value. All three metrics together tell the full story:
- **Stage type** → Are we using an index at all?
- **Examination ratio** → Is the index effective?
- **Index name** → Are we using the RIGHT index?

All three metrics matter for optimal query performance.

### MongoDB Query Examples: From Optimal to Problematic


![](/assets/img/2026-02-25-23-09-57.png)


Understanding what makes queries slow helps identify when statistics might be stale. Here are real-world query patterns that commonly suffer from performance issues:

**Document schema context:**
```javascript
{
  _id: ObjectId,
  messagesSessionId: String,
  success: Boolean,
  result: [  // Large array with 70+ subdocuments
    {
      issueId: String,
      summaryUuid: String,
      groupID: Number,
      lang: String,
      title: String,
      summary: String,
      originalScripts: Array,
      imgUrls: Array,
      assignee: Array,
      topic: Array,
      location: Array,
      // ... many more fields
    }
  ]
}
```

#### Baseline: Optimal Query Performance


Before examining slow queries, let's see what optimal performance looks like:

**Query:**
```javascript
db.llmsummaries.find({ _id: ObjectId("68abc7447d87776535cb4d04") })
  .explain("executionStats")
```

**Key findings from the output:**

**Execution Statistics:**
```javascript
executionStats: {
  executionSuccess: true,
  nReturned: 1,
  executionTimeMillis: 0,
  totalKeysExamined: 1,
  totalDocsExamined: 1
}
```

**Performance Analysis:**
- **Efficiency ratio:** `1 / 1 = 1.0x` (perfect!)
- **Execution time:** 0ms (sub-millisecond)
- **Index usage:** `EXPRESS_IXSCAN` on `_id_` index
- **No plan caching needed:** `isCached: false` - simple `_id` lookups don't require caching

**Query Plan:**
```javascript
winningPlan: {
  isCached: false,
  stage: 'EXPRESS_IXSCAN',        // Optimized index scan (MongoDB 8.0+)
  keyPattern: '{ _id: 1 }',
  indexName: '_id_'
}
rejectedPlans: []                  // No alternative plans considered
```

**Resource Usage:**
```javascript
operationMetrics: {
  docBytesRead: 68251,            // ~68KB document size
  idxEntryBytesRead: 14,          // Only 14 bytes read from index
  cpuNanos: 155102                // ~155 microseconds CPU time
}
```

**What makes this optimal:**
- **Perfect index utilization:** Index lookup required only 14 bytes, found exact document pointer immediately
- **Optimal execution path:** No rejected plans, no caching overhead, zero optimization time
- **No stale statistics concerns:** Direct `_id` lookup always uses primary index, no cardinality estimation needed

**This is what we aim for:**
- Examination ratio of 1.0x (perfect selectivity)
- Sub-millisecond execution
- Appropriate index usage
- No wasted scans

Now let's contrast this with problematic query patterns:

#### Potentially Slow Queries

##### Example 1: Scanning Nested Arrays Without Indexes

```javascript
// Query: Find all documents where any result has a specific assignee
db.llmsummaries.find({
  "result.assignee.userId": "5febb417-3f38-4894-8388-6f79585a5b72"
}).explain("executionStats")
```

**Actual execution statistics:**
```javascript{9,17-20}
{
  explainVersion: '1',
  queryPlanner: {
    namespace: 'BillieStorage-DEV.llmsummaries',
    parsedQuery: { 'result.assignee.userId': { '$eq': '5febb417-3f38-4894-8388-6f79585a5b72' } },
    indexFilterSet: false,
    winningPlan: {
      isCached: false,
      stage: 'COLLSCAN',
      filter: { 'result.assignee.userId': { '$eq': '5febb417-3f38-4894-8388-6f79585a5b72' } },
      direction: 'forward'
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 3,
    executionTimeMillis: 148,
    totalKeysExamined: 0,
    totalDocsExamined: 6319,
    executionStages: {
      isCached: false,
      stage: 'COLLSCAN',
      filter: { 'result.assignee.userId': { '$eq': '5febb417-3f38-4894-8388-6f79585a5b72' } },
      nReturned: 3,
      executionTimeMillisEstimate: 53,
      works: 6320,
      advanced: 3,
      needTime: 6316,
      needYield: 0,
      saveState: 0,
      restoreState: 0,
      isEOF: 1,
      direction: 'forward',
      docsExamined: 6319
    },
    operationMetrics: {
      docBytesRead: 22236748,
      docUnitsRead: 176868,
      cpuNanos: 25932069
    }
  },
  command: {
    find: 'llmsummaries',
    filter: { 'result.assignee.userId': '5febb417-3f38-4894-8388-6f79585a5b72' },
    '$db': 'BillieStorage-DEV'
  },
  serverInfo: {
    host: 'ac-i1i65op-shard-00-01.50i0ong.mongodb.net',
    port: 27017,
    version: '8.0.19',
    gitVersion: 'cc1adb6b0875cc3003854ac2489818e459686f0b'
  },
  ok: 1
}
```

**Performance analysis:**
- **Efficiency ratio:** 6319 / 3 = **2,106x inefficiency!**
- **Collection scan:** Examined every single document in the collection
- **No index usage:** `totalKeysExamined: 0` confirms no index helped
- **Resource waste:** Read 22MB of data to return 3 matching documents
- **Nested array overhead:** Must scan through `result` array in each document

**Why this is slow:**
- MongoDB must open and examine all 6,319 documents
- For each document, traverse the nested `result` array
- Check each `assignee` array element within each result
- No index on `result.assignee.userId` to shortcut this process

##### Example 2: Complex Text Search in Nested Documents

```javascript
// Query: Search for keywords in summaries within result array
db.llmsummaries.find({
  "result.summary": { $regex: /floor height|elevation/i }
}).explain("executionStats")
```

**Actual execution statistics:**
```javascript{9,17-20}
{
  explainVersion: '1',
  queryPlanner: {
    namespace: 'BillieStorage-DEV.llmsummaries',
    parsedQuery: { 'result.summary': { '$regex': 'floor height|elevation', '$options': 'i' } },
    indexFilterSet: false,
    winningPlan: {
      isCached: false,
      stage: 'COLLSCAN',
      filter: { 'result.summary': { '$regex': 'floor height|elevation', '$options': 'i' } },
      direction: 'forward'
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 6,
    executionTimeMillis: 24,
    totalKeysExamined: 0,
    totalDocsExamined: 6319,
    executionStages: {
      isCached: false,
      stage: 'COLLSCAN',
      filter: { 'result.summary': { '$regex': 'floor height|elevation', '$options': 'i' } },
      nReturned: 6,
      executionTimeMillisEstimate: 7,
      works: 6320,
      advanced: 6,
      needTime: 6313,
      needYield: 0,
      saveState: 0,
      restoreState: 0,
      isEOF: 1,
      direction: 'forward',
      docsExamined: 6319
    },
    operationMetrics: {
      docBytesRead: 22236748,
      docUnitsRead: 176868,
      cpuNanos: 24605620
    }
  },
  command: {
    find: 'llmsummaries',
    filter: { 'result.summary': { '$regex': 'floor height|elevation', '$options': 'i' } },
    '$db': 'BillieStorage-DEV'
  },
  serverInfo: {
    host: 'ac-i1i65op-shard-00-02.50i0ong.mongodb.net',
    port: 27017,
    version: '8.0.19',
    gitVersion: 'cc1adb6b0875cc3003854ac2489818e459686f0b'
  },
  ok: 1
}
```

**Performance analysis:**
- **Efficiency ratio:** 6319 / 6 = **1,053x inefficiency!**
- **Collection scan:** Full collection scan despite only 6 matches
- **Regex overhead:** Case-insensitive pattern matching (`/i` flag) on every document
- **Nested array scanning:** Must check `result.summary` in every array element
- **No text index:** Cannot leverage inverted index structure for text search

**Why this is particularly slow:**
- Case-insensitive regex (`/i`) prevents simple string comparison
- MongoDB evaluates regex pattern against every `summary` field in every `result` array
- With ~70 result elements per document: 6,319 docs × 70 elements = ~442,330 string matches!
- Pattern has alternation (`|`) requiring two substring checks per field
- No short-circuit: must scan entire collection even after finding matches

##### Example 3: Multiple Array Element Matching

```javascript
// Query: Find sessions with specific topic AND location
db.llmsummaries.find({
  "result": {
    $elemMatch: {
      "topic.name": "FLOORING",
      "location.detail": "2F"
    }
  }
}).explain("executionStats")
```

**Actual execution statistics:**
```javascript{18,34-37}
{
  explainVersion: '1',
  queryPlanner: {
    namespace: 'BillieStorage-DEV.llmsummaries',
    parsedQuery: {
      result: {
        '$elemMatch': {
          '$and': [
            { 'location.detail': { '$eq': '2F' } },
            { 'topic.name': { '$eq': 'FLOORING' } }
          ]
        }
      }
    },
    indexFilterSet: false,
    winningPlan: {
      isCached: false,
      stage: 'COLLSCAN',
      filter: {
        result: {
          '$elemMatch': {
            '$and': [
              { 'location.detail': { '$eq': '2F' } },
              { 'topic.name': { '$eq': 'FLOORING' } }
            ]
          }
        }
      },
      direction: 'forward'
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 0,
    executionTimeMillis: 10,
    totalKeysExamined: 0,
    totalDocsExamined: 6319,
    executionStages: {
      isCached: false,
      stage: 'COLLSCAN',
      filter: {
        result: {
          '$elemMatch': {
            '$and': [
              { 'location.detail': { '$eq': '2F' } },
              { 'topic.name': { '$eq': 'FLOORING' } }
            ]
          }
        }
      },
      nReturned: 0,
      executionTimeMillisEstimate: 4,
      works: 6320,
      advanced: 0,
      needTime: 6319,
      needYield: 0,
      saveState: 0,
      restoreState: 0,
      isEOF: 1,
      direction: 'forward',
      docsExamined: 6319
    },
    operationMetrics: {
      docBytesRead: 22236748,
      docUnitsRead: 176868,
      cpuNanos: 10192977
    }
  },
  queryShapeHash: '7AFB5DAD83629CECD2045DED8612797324E0D3DEC377A9369D11FD6CD0D3C81E',
  command: {
    find: 'llmsummaries',
    filter: {
      result: {
        '$elemMatch': {
          'topic.name': 'FLOORING',
          'location.detail': '2F'
        }
      }
    },
    '$db': 'BillieStorage-DEV'
  },
  serverInfo: {
    host: 'ac-i1i65op-shard-00-02.50i0ong.mongodb.net',
    port: 27017,
    version: '8.0.19',
    gitVersion: 'cc1adb6b0875cc3003854ac2489818e459686f0b'
  },
  ok: 1
}
```

**Performance analysis:**
- **Efficiency ratio:** Undefined (0 returned), but examined **all 6,319 documents** unnecessarily
- **Collection scan:** Cannot short-circuit even though no matches exist
- **No index usage:** `totalKeysExamined: 0` confirms no compound index available
- **$elemMatch complexity:** Must evaluate AND condition on nested arrays for every document
- **Resource waste:** Read 22MB to return zero results

**Why this is particularly inefficient:**
- **Compound condition overhead:** MongoDB evaluates both `topic.name = "FLOORING"` AND `location.detail = "2F"` for each result element
- **Nested array scanning:** With ~70 result elements per document: 6,319 docs × 70 = ~442,330 array element checks
- **No early termination:** Even though no matches found, must scan entire collection to confirm
- **Double nested arrays:** Both `topic` and `location` are arrays within `result` array (triple nesting!)
- **$elemMatch semantics:** Requires finding single array element matching ALL conditions - more complex than separate filters

##### Example 4: Aggregation Counting Array Elements

```javascript
// Query: Count total issues by groupID across all sessions
db.llmsummaries.aggregate([
  { $unwind: "$result" },
  { $group: { _id: "$result.groupID", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

**Actual execution statistics:**

```javascript {line-numbers}
// Performance measurement results:
Execution time: 638ms
Number of unique groups: 124
Total unwound documents: 12920
Input documents: 6319
Expansion factor: 2.04x (12920 / 6319)
```

**Pipeline stages:**
1. **$unwind**: Expands 6,319 documents into 12,920 documents (2.04x expansion)
2. **$group**: Aggregates 12,920 unwound documents into 124 unique groups
3. **$sort**: Sorts 124 groups in memory by count descending

**Performance analysis:**
- The aggregation processes **2.04x more documents** than the input collection size
- Each document's `result` array contains ~2 elements on average
- **638ms execution time** for processing 12,920 unwound documents
- Memory-intensive operation as all grouping and sorting happens in RAM
- Without `allowDiskUse: true`, large result sets could exceed memory limits

**Why this is slow:**
- **No index can help**, aggregation pipelines that start with `$unwind` must perform **full collection scan** (COLLSCAN) to access all documents
- Array unwinding creates intermediate result set **2x larger** than input
- Grouping and sorting operations consume significant memory
- For larger arrays or collections, execution time grows linearly with total unwound documents

##### Example 5: Date Range Query on Nested Timestamps

```javascript
// Query: Find sessions with results between date range
db.llmsummaries.find({
  "result.issueCreatedAt": {
    $gte: NumberLong("1756086000000"),
    $lte: NumberLong("1756090000000")
  }
}).explain("executionStats")
```

**Actual execution statistics:**
```javascript{34,54-57}
{
  explainVersion: '1',
  queryPlanner: {
    namespace: 'BillieStorage-DEV.llmsummaries',
    parsedQuery: {
      '$and': [
        {
          'result.issueCreatedAt': {
            '$lte': 1756090000000
          }
        },
        {
          'result.issueCreatedAt': {
            '$gte': 1756086000000
          }
        }
      ]
    },
    indexFilterSet: false,
    queryHash: '974F7C6A',
    planCacheShapeHash: '974F7C6A',
    planCacheKey: 'F1AE37C2',
    optimizationTimeMillis: 0,
    maxIndexedOrSolutionsReached: false,
    maxIndexedAndSolutionsReached: false,
    maxScansToExplodeReached: false,
    prunedSimilarIndexes: false,
    winningPlan: {
      isCached: false,
      stage: 'COLLSCAN',
      filter: {
        '$and': [
          {
            'result.issueCreatedAt': {
              '$lte': 1756090000000
            }
          },
          {
            'result.issueCreatedAt': {
              '$gte': 1756086000000
            }
          }
        ]
      },
      direction: 'forward'
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 1,
    executionTimeMillis: 10,
    totalKeysExamined: 0,
    totalDocsExamined: 6319,
    executionStages: {
      isCached: false,
      stage: 'COLLSCAN',
      filter: {
        '$and': [
          {
            'result.issueCreatedAt': {
              '$lte': 1756090000000
            }
          },
          {
            'result.issueCreatedAt': {
              '$gte': 1756086000000
            }
          }
        ]
      },
      nReturned: 1,
      executionTimeMillisEstimate: 10,
      works: 6320,
      advanced: 1,
      needTime: 6318,
      needYield: 0,
      saveState: 0,
      restoreState: 0,
      isEOF: 1,
      direction: 'forward',
      docsExamined: 6319
    },
    operationMetrics: {
      docBytesRead: 22236748,
      docUnitsRead: 176868,
      cpuNanos: 10846482
    }
  },
  queryShapeHash: '0E0E049F234A4E643217E2AFF74105762F0747D592C87669F9E1CBDB47FB24F0',
  command: {
    find: 'llmsummaries',
    filter: {
      'result.issueCreatedAt': {
        '$gte': 1756086000000,
        '$lte': 1756090000000
      }
    },
    '$db': 'BillieStorage-DEV'
  },
  serverInfo: {
    host: 'ac-i1i65op-shard-00-02.50i0ong.mongodb.net',
    port: 27017,
    version: '8.0.19',
    gitVersion: 'cc1adb6b0875cc3003854ac2489818e459686f0b'
  },
  ok: 1
}
```

**Performance analysis:**
- **Efficiency ratio:** 6319 / 1 = **6,319x inefficiency!**
- **Collection scan:** Examined every document for single match
- **No index usage:** `totalKeysExamined: 0` confirms no index on date field
- **Range query overhead:** Must evaluate `$gte` AND `$lte` conditions on nested arrays
- **Resource waste:** Read 22MB to return 1 matching document

**Why this is extremely inefficient:**
- **Date range comparisons:** MongoDB evaluates both conditions (`$gte` and `$lte`) on every nested `issueCreatedAt` field
- **Nested array scanning:** With ~70 result elements per document: 6,319 docs × 70 = ~442,330 date comparisons
- **NumberLong overhead:** Each comparison requires handling 64-bit integer values
- **No temporal index:** Cannot use B-tree range scan to quickly locate documents within time window
- **Worst efficiency ratio:** 6,319x is the highest among all examples - scanning entire collection for 1 result!

##### Example 6: Compound Query with OR Conditions

```javascript
// Query: Find urgent OR negative sentiment issues
db.llmsummaries.find({
  $or: [
    { "result.priority.name": "URGENT" },
    { "result.sentiment.name": "NEGATIVE" }
  ]
}).explain("executionStats")
```

**Actual execution statistics:**
```javascript{38-41}
{
  explainVersion: '1',
  queryPlanner: {
    namespace: 'BillieStorage-DEV.llmsummaries',
    parsedQuery: {
      '$or': [
        { 'result.priority.name': { '$eq': 'URGENT' } },
        { 'result.sentiment.name': { '$eq': 'NEGATIVE' } }
      ]
    },
    indexFilterSet: false,
    queryHash: 'A51BF552',
    planCacheShapeHash: 'A51BF552',
    planCacheKey: '85972E1A',
    optimizationTimeMillis: 0,
    maxIndexedOrSolutionsReached: false,
    maxIndexedAndSolutionsReached: false,
    maxScansToExplodeReached: false,
    prunedSimilarIndexes: false,
    winningPlan: {
      isCached: false,
      stage: 'SUBPLAN',
      inputStage: {
        stage: 'COLLSCAN',
        filter: {
          '$or': [
            { 'result.priority.name': { '$eq': 'URGENT' } },
            { 'result.sentiment.name': { '$eq': 'NEGATIVE' } }
          ]
        },
        direction: 'forward'
      }
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 1243,
    executionTimeMillis: 15,
    totalKeysExamined: 0,
    totalDocsExamined: 6319,
    executionStages: {
      isCached: false,
      stage: 'SUBPLAN',
      nReturned: 1243,
      executionTimeMillisEstimate: 7,
      works: 6320,
      advanced: 1243,
      needTime: 5076,
      needYield: 0,
      saveState: 0,
      restoreState: 0,
      isEOF: 1,
      inputStage: {
        stage: 'COLLSCAN',
        filter: {
          '$or': [
            { 'result.priority.name': { '$eq': 'URGENT' } },
            { 'result.sentiment.name': { '$eq': 'NEGATIVE' } }
          ]
        },
        nReturned: 1243,
        executionTimeMillisEstimate: 7,
        works: 6320,
        advanced: 1243,
        needTime: 5076,
        needYield: 0,
        saveState: 0,
        restoreState: 0,
        isEOF: 1,
        direction: 'forward',
        docsExamined: 6319
      }
    },
    operationMetrics: {
      docBytesRead: 22236748,
      docUnitsRead: 176868,
      cpuNanos: 15083626
    }
  },
  queryShapeHash: '06F16492B28860305AE761F7D4D06584BC6F6A47C7A55DBB3C9BAC7CFFE8A8D6',
  command: {
    find: 'llmsummaries',
    filter: {
      '$or': [
        { 'result.priority.name': 'URGENT' },
        { 'result.sentiment.name': 'NEGATIVE' }
      ]
    },
    '$db': 'BillieStorage-DEV'
  },
  serverInfo: {
    host: 'ac-i1i65op-shard-00-02.50i0ong.mongodb.net',
    port: 27017,
    version: '8.0.19',
    gitVersion: 'cc1adb6b0875cc3003854ac2489818e459686f0b'
  },
  ok: 1
}
```

**Performance analysis:**
- **Efficiency ratio:** 6319 / 1243 = **5.08x inefficiency**
- **Better selectivity:** Returns 1,243 documents (19.7% of collection) - best match rate among all examples!
- **Still collection scan:** `SUBPLAN` stage with `COLLSCAN` input - no indexes used
- **Fast execution:** Only 15ms despite scanning entire collection (benefit of higher match rate)
- **No index usage:** `totalKeysExamined: 0` confirms no indexes on either field

**Why this has better efficiency than other examples:**
- **Higher match rate:** OR condition is less selective - many documents match at least one condition
- **19.7% hit rate:** Returns 1,243 out of 6,319 documents examined
- **Less wasted work:** Compared to Example 5 (99.98% waste), this only wastes ~80% of examined data
- **Fast per-document:** 15ms / 1243 docs = ~0.012ms per returned document

**Why it still needs optimization:**
- **SUBPLAN with COLLSCAN:** MongoDB uses subplan optimization for OR but still scans all documents
- **Cannot short-circuit:** Must check both OR conditions on every nested array element
- **Nested array overhead:** With ~70 result elements per document: 6,319 docs × 70 × 2 fields = ~885,000 field checks
- **No index intersection:** Without indexes, cannot efficiently union results from separate index scans

#### Performance Improvement Strategies

**For the nested array query (Example 1 above):**
```javascript
// Create multikey index on nested array field
db.llmsummaries.createIndex({
  "result.assignee.userId": 1
})

// After index creation, the query should show:
// - stage: 'IXSCAN' instead of 'COLLSCAN'
// - totalKeysExamined: ~3 (only matching documents)
// - totalDocsExamined: 3 (exact matches only)
// - executionTimeMillis: <5ms (instead of 148ms)
// - Efficiency ratio: 1.0x (instead of 2106x)
```

**Expected improvement:**
- **Before index:** 148ms, examined 6,319 docs, read 22MB
- **After index:** <5ms, examined 3 docs, read ~40KB
- **Speedup:** 30-50x faster
- **Resource savings:** 99.95% less data read

**For compound queries on arrays:**
```javascript
// Create compound index for multiple common filters
db.llmsummaries.createIndex({
  "result.assignee.userId": 1,
  "result.groupID": 1
// Or denormalize if queries are critical
// Move frequently-queried array elements to root level
```

**For text searches (Example 2 above):**
```javascript
// Create text index on summary fields
db.llmsummaries.createIndex({
  "result.summary": "text",
  "result.title": "text"
})

// Query with text index (replaces regex)
db.llmsummaries.find({ 
  $text: { $search: "floor height elevation" } 
})

// After text index creation, the query should show:
// - stage: 'TEXT' instead of 'COLLSCAN'
// - Uses inverted index for efficient word matching
// - No case-sensitivity overhead (text indexes are case-insensitive by default)
// - executionTimeMillis: <10ms (instead of 24ms)
// - Efficiency ratio: Much closer to 1.0x
```

**Expected improvement:**
- **Before text index:** 24ms, examined 6,319 docs, ~442,330 regex operations
- **After text index:** <10ms, examined only matching docs, efficient word lookup
- **Speedup:** 2-5x faster
- **Note:** Text indexes work with `$text` operator, not `$regex`

**Alternative for regex patterns:**
```javascript
// If regex is required, consider filtering first
db.llmsummaries.find({
  success: true,  // Filter on indexed field first
  "result.summary": { $regex: /floor height|elevation/i }
})

// Or store commonly searched terms separately
db.llmsummaries.createIndex({ "result.keywords": 1 })
```

**For $elemMatch compound queries (Example 3 above):**
```javascript
// Option 1: Create compound multikey index
db.llmsummaries.createIndex({
  "result.topic.name": 1,
  "result.location.detail": 1
})

// Query remains the same - optimizer will use compound index
db.llmsummaries.find({
  "result": {
    $elemMatch: {
      "topic.name": "FLOORING",
      "location.detail": "2F"
    }
  }
})

// After compound index creation, the query should show:
// - stage: 'IXSCAN' instead of 'COLLSCAN'
// - totalKeysExamined: varies based on selectivity
// - executionTimeMillis: <5ms (instead of 10ms)
// - Can short-circuit when no matches exist
```

**Expected improvement:**
- **Before index:** 10ms, examined all 6,319 docs, read 22MB, 0 results
- **After compound index:** <5ms, examined only candidate docs, early termination
- **Speedup:** 2-3x faster even for non-matching queries
- **Resource savings:** 95%+ less data read when matches exist

**Alternative: Denormalize for critical queries**
```javascript
// If this query pattern is frequent, denormalize to root level
// Add aggregated fields during document creation:
{
  _id: ObjectId,
  messagesSessionId: String,
  hasFlooring2F: Boolean,  // Pre-computed flag
  topicLocations: [        // Flattened combinations
    { topic: "FLOORING", location: "2F" }
  ],
  result: [ /* original nested data */ ]
}

// Query becomes simple and fast:
db.llmsummaries.find({ hasFlooring2F: true })
// Or with index on topicLocations:
db.llmsummaries.find({
  topicLocations: { $elemMatch: { topic: "FLOORING", location: "2F" } }
})
```

**For date range queries (Example 5 above):**
```javascript
// Create index on nested date field
db.llmsummaries.createIndex({
  "result.issueCreatedAt": 1
})

// Query remains the same - optimizer will use index for range scan
db.llmsummaries.find({
  "result.issueCreatedAt": {
    $gte: NumberLong("1756086000000"),
    $lte: NumberLong("1756090000000")
  }
})

// After index creation, the query should show:
// - stage: 'IXSCAN' instead of 'COLLSCAN'
// - Uses B-tree range scan to quickly locate matching documents
// - executionTimeMillis: <5ms (instead of 10ms)
// - Efficiency ratio: Much closer to 1.0x (instead of 6319x!)
```

**Expected improvement:**
- **Before index:** 10ms, examined 6,319 docs, read 22MB, 1 result
- **After index:** <5ms, examined only docs within date range, minimal reads
- **Speedup:** 2-5x faster for typical date range queries
- **Resource savings:** 99%+ less data scanned

**Alternative: Denormalize for frequent date queries**
```javascript
// If date range queries are critical, add indexed date field at root level
{
  _id: ObjectId,
  messagesSessionId: String,
  earliestIssueDate: NumberLong,   // Min date from result array
  latestIssueDate: NumberLong,     // Max date from result array
  result: [ /* original nested data with issueCreatedAt */ ]
}

// Create simple index (faster than multikey index)
db.llmsummaries.createIndex({ 
  earliestIssueDate: 1, 
  latestIssueDate: 1 
})

// Query becomes more efficient:
db.llmsummaries.find({
  earliestIssueDate: { $lte: NumberLong("1756090000000") },
  latestIssueDate: { $gte: NumberLong("1756086000000") }
})
```

**For aggregation with `$unwind` (Example 4 above):**
```javascript
// Option 1: Add $match before $unwind to reduce documents processed
db.llmsummaries.aggregate([
  { $match: { success: true, messagesSessionId: { $in: relevantSessions } } },  // Filter early
  { $project: { result: 1 } },     // Project only needed fields
  { $unwind: "$result" },
  { $group: { _id: "$result.groupID", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
], { allowDiskUse: true })

// Option 2: Use $facet to run multiple aggregations efficiently
db.llmsummaries.aggregate([
  {
    $facet: {
      groupCounts: [
        { $unwind: "$result" },
        { $group: { _id: "$result.groupID", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ],
      totalDocs: [
        { $count: "total" }
      ]
    }
  }
])
```

**Expected improvement:**
- **Current performance:** 638ms, 6,319 input → 12,920 unwound (2.04x expansion)
- **With $match filter:** Reduces input document set, proportionally faster
- **With allowDiskUse:** Prevents memory errors for larger result sets
- **Note:** Indexes cannot optimize `$unwind` operations, but can speed up initial `$match`

**Alternative:** Pre-aggregate during data ingestion
```javascript
// If groupID counts are critical, maintain them at document level
{
  _id: ObjectId,
  messagesSessionId: String,
  groupCounts: {           // Pre-computed aggregation
    "group1": 3,
    "group2": 5
  },
  result: [ /* original nested data */ ]
}

// Query becomes a simple find + aggregation
db.llmsummaries.aggregate([
  { $project: { groupCounts: { $objectToArray: "$groupCounts" } } },
  { $unwind: "$groupCounts" },
  { $group: { 
      _id: "$groupCounts.k", 
      totalCount: { $sum: "$groupCounts.v" } 
  } },
  { $sort: { totalCount: -1 } }
])

// Or use materialized views for real-time aggregations
db.createView(
  "groupCountsView",
  "llmsummaries",
  [
    { $unwind: "$result" },
    { $group: { _id: "$result.groupID", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]
)

// Query the view with $merge for incremental updates
```

**Expected improvement with pre-aggregation:**
- **Before:** 638ms processing 12,920 unwound documents
- **After:** <50ms querying pre-computed counts from document root
- **Speedup:** 10-15x faster
- **Trade-off:** Additional storage and update complexity

**For `OR` queries (Example 6 above):**
```javascript
// Create separate indexes for each OR condition
db.llmsummaries.createIndex({
  "result.priority.name": 1
})

db.llmsummaries.createIndex({
  "result.sentiment.name": 1
})

// Query remains the same - optimizer will use index union
db.llmsummaries.find({
  $or: [
    { "result.priority.name": "URGENT" },
    { "result.sentiment.name": "NEGATIVE" }
  ]
})

// After index creation, the query should show:
// - Multiple index scans combined (index union)
// - Reduced documents examined (only candidates from each index)
// - executionTimeMillis: <10ms (instead of 15ms)
// - Better efficiency as collection grows
```

**Expected improvement:**
- **Before indexes:** 15ms, examined 6,319 docs, 5.08x efficiency, read 22MB
- **After indexes:** <10ms, examined only matching index entries, ~1.5-2x efficiency
- **Speedup:** 1.5-2x faster
- **Scalability:** Performance gain increases with collection size growth

**Alternative: Denormalize with boolean flags**
```javascript
// Add pre-computed flags at root level for frequent OR patterns
{
  _id: ObjectId,
  messagesSessionId: String,
  hasUrgentPriority: Boolean,      // Pre-computed flag
  hasNegativeSentiment: Boolean,   // Pre-computed flag
  result: [ /* original nested data */ ]
}

// Create simple indexes (non-multikey, faster)
db.llmsummaries.createIndex({ hasUrgentPriority: 1 })
db.llmsummaries.createIndex({ hasNegativeSentiment: 1 })

// Query becomes much more efficient:
db.llmsummaries.find({
  $or: [
    { hasUrgentPriority: true },
    { hasNegativeSentiment: true }
  ]
})
```

**Signs these queries need attention:**
- `explain()` shows `COLLSCAN` instead of `IXSCAN` (or `SUBPLAN` with `COLLSCAN` for OR queries)
- `totalDocsExamined / nReturned > 100` for low selectivity (Example 1: 2106x, Example 2: 1053x, Example 5: 6319x!)
- Even "good" selectivity can be improved (Example 6: 5.08x with 1,243 results, but still scans all docs)
- `executionTimeMillis > 100ms` for queries returning <10 documents
- **Aggregation pipelines taking > 500ms** for moderate data (Example 4: 638ms for 6,319 docs)
- `totalKeysExamined: 0` means no index was used at all (all five find() examples!)
- `docBytesRead` is disproportionately large (all examples read 22MB)
- High `cpuNanos` relative to actual work done
- Examining entire collection even when returning zero results (Example 3)
- Extremely high efficiency ratios for single-document results (Example 5: 6319x)
- **Large expansion factors in aggregations** (Example 4: 2.04x with $unwind)

**Threshold examples from above:**

**Example 1 (Nested array query).**
```javascript
Efficiency ratio: 6319 examined / 3 returned = 2106x
Execution time: 148ms for 3 documents = ~49ms per document
Data read: 22MB for result size likely <100KB = 220x overhead
```

**Example 2 (Regex text search).**
```javascript
Efficiency ratio: 6319 examined / 6 returned = 1053x
Execution time: 24ms for 6 documents = ~4ms per document
String operations: ~442,330 regex matches performed
CPU time: 24.6ms spent on pattern matching
```

**Example 3 (`$elemMatch` compound condition).**
```javascript
Efficiency ratio: Undefined (0 returned, 6319 examined)
Execution time: 10ms for 0 documents
Array element checks: ~442,330 compound condition evaluations (6319 × 70)
CPU time: 10.2ms spent on nested AND condition evaluation
```

**Example 4 (Aggregation pipeline with `$unwind`).**
```javascript
Expansion factor: 6319 input → 12920 unwound = 2.04x
Execution time: 638ms for aggregating into 124 groups = ~5.15ms per group
Processing overhead: 6319 docs → 12920 intermediate → 124 final (64x reduction)
Memory usage: In-memory grouping and sorting of 12920 documents
No index utility: Aggregations starting with $unwind require full COLLSCAN
```

**Example 5 (Date range query).**
```javascript
Efficiency ratio: 6319 examined / 1 returned = 6319x (WORST!)
Execution time: 10ms for 1 document
Date comparisons: ~442,330 range checks (6319 × 70 × 2 conditions)
CPU time: 10.8ms spent on NumberLong range comparisons
```

**Example 6 (OR query with SUBPLAN).**
```javascript
Efficiency ratio: 6319 examined / 1243 returned = 5.08x (BEST!)
Execution time: 15ms for 1,243 documents = ~0.012ms per document
Hit rate: 19.7% (1,243 / 6,319) - much higher match rate
Field checks: ~885,000 nested field evaluations (6319 × 70 × 2 OR conditions)
CPU time: 15.1ms spent on OR condition evaluation
```

**Summary from all examples.**
- **All scan entire collection** (6,319 docs) but different bottlenecks:
  - Example 1: Slowest per document (49ms) - nested array traversal overhead
  - Example 2: High CPU (24.6ms) - regex pattern matching complexity
  - Example 3: Fastest overall (10ms) - but still wasteful for zero results
  - Example 5: Same speed as Example 3 (10ms) - but worst efficiency ratio (6319x)
  - Example 6: Moderate speed (15ms) - but best efficiency ratio (5.08x) due to high match rate
- **Different inefficiency patterns:**
  - Example 6: Best efficiency (5.08x) - returns 19.7% of examined docs, but still scans everything
  - Example 1 & 2: Poor efficiency (2106x, 1053x) - waste 99.9% of examined data
  - Example 3: 100% waste (0 returned, but scanned all 6,319 docs)
  - Example 5: Worst efficiency (6319x) - 99.98% waste for single result
- **All need proper indexes** to avoid full collection scans

##### Check index statistics

```javascript
db.collection.aggregate([{ $indexStats: {} }])
```

Look for.
- **Very low `accesses` count.** Index exists but never used → might indicate optimizer choosing wrong path
- **High `accesses` with poor query performance.** Index is used but perhaps not selective enough anymore
- **Unused indexes.** `since` date shows last use was months ago


##### Monitor plan cache behavior

```javascript
// Not available in MongoDB Atlas
db.collection.getPlanCache().list()
```

**Key indicators (self-hosted MongoDB only).**
- **Old cached plans.** `timeOfCreation` shows plans cached for weeks/months on low-write collections
- **Multiple active plans for same query shape.** Indicates optimizer uncertainty
- **Plans with poor `works` values.** High work units suggest inefficient plan

**Example.** A plan cached 90 days ago on a collection that's grown 10x in size might be using a nested loop join when hash join would now be better.

**Atlas alternative.** Use Atlas Performance Advisor:
- Navigate to Atlas Console → Cluster → Performance Advisor
- Review "Slow Queries" to identify execution inefficiencies
- Check "Index Recommendations" for suggested indexes
- Monitor "Query Targeting" metric (scanned/returned ratio)

##### Compare collection statistics over time

```javascript
db.collection.stats()
```

**Monitor changes in.**
- `count` - total documents (significant growth?)
- `size` - data size in bytes
- `avgObjSize` - average document size (data shape changing?)
- `nindexes` - number of indexes
- `totalIndexSize` - index size growth

**When to suspect stale statistics.**
- Collection has grown >50% since last plan cache clear
- Index size has grown disproportionately to data size
- Query patterns have changed but performance hasn't adapted

##### Practical Detection Query

**For self-hosted MongoDB:**

```javascript
// Comprehensive staleness check (self-hosted only)
function checkCollectionStats(collectionName) {
  const coll = db.getCollection(collectionName);
  
  // Get basic stats
  const stats = coll.stats();
  console.log(`Collection: ${collectionName}`);
  console.log(`Documents: ${stats.count}`);
  console.log(`Avg doc size: ${stats.avgObjSize} bytes`);
  
  // Check plan cache age (not available in Atlas)
  try {
    const plans = coll.getPlanCache().list();
    console.log(`Cached plans: ${plans.length}`);
    
    plans.forEach(plan => {
      const ageHours = (Date.now() - plan.timeOfCreation.getTime()) / 3600000;
      console.log(`Plan age: ${ageHours.toFixed(1)} hours`);
      console.log(`Works: ${plan.works}`);
    });
  } catch (e) {
    console.log('Plan cache access restricted (Atlas or permissions)');
  }
  
  // Test a sample query (works in Atlas)
  const sampleQuery = coll.find().limit(1).explain("executionStats");
  console.log(`Sample query examined: ${sampleQuery.executionStats.totalDocsExamined}`);
  console.log(`Sample query returned: ${sampleQuery.executionStats.nReturned}`);
  
  const ratio = sampleQuery.executionStats.totalDocsExamined / 
                sampleQuery.executionStats.nReturned;
  console.log(`Examination ratio: ${ratio.toFixed(1)}x`);
  
  if (ratio > 10) {
    console.warn("High examination ratio - consider adding indexes");
  }
}
```

**For MongoDB Atlas:**

```javascript
// Atlas-compatible staleness check
function checkCollectionStatsAtlas(collectionName) {
  const coll = db.getCollection(collectionName);
  
  // Get basic stats (works in Atlas)
  const stats = coll.stats();
  console.log(`Collection: ${collectionName}`);
  console.log(`Documents: ${stats.count}`);
  console.log(`Avg doc size: ${stats.avgObjSize} bytes`);
  console.log(`Total size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  
  // Check indexes
  const indexes = coll.getIndexes();
  console.log(`\nIndexes: ${indexes.length}`);
  indexes.forEach(idx => {
    console.log(`- ${idx.name}: ${JSON.stringify(idx.key)}`);
  });
  
  // Test common query patterns
  const testQuery = coll.find().limit(100).explain("executionStats");
  const examined = testQuery.executionStats.totalDocsExamined;
  const returned = testQuery.executionStats.nReturned;
  const ratio = examined / returned;
  
  console.log(`\nQuery efficiency:`);
  console.log(`Documents examined: ${examined}`);
  console.log(`Documents returned: ${returned}`);
  console.log(`Examination ratio: ${ratio.toFixed(1)}x`);
  console.log(`Execution time: ${testQuery.executionStats.executionTimeMillis}ms`);
  
  if (ratio > 10) {
    console.warn("High examination ratio - check Atlas Performance Advisor");
  }
  
  // Suggest next steps
  console.log(`\nNext steps:`);
  console.log(`1. Check Atlas Performance Advisor for recommendations`);
  console.log(`2. Review slow query logs in Atlas UI`);
  console.log(`3. Run explain() on our actual queries`);
}
```

**Summary.** Since MongoDB lacks explicit staleness indicators, we must:
1. Monitor query performance trends over time
2. Analyze `explain()` output for inefficiencies
3. Track collection growth and index usage
4. Clear plan cache proactively after major data changes

#### Solutions in MongoDB

##### Clear Plan Cache

**Self-hosted MongoDB:**
```javascript
// Clear all cached plans for a collection
db.collection.getPlanCache().clear()

// Clear specific query shape
db.collection.getPlanCache().clearPlansByQuery(
  { field: value },
  { projection },
  { sort }
)
```

**MongoDB Atlas:**
```javascript
// Direct plan cache clearing not available in Atlas
// Atlas manages plan cache automatically

// Alternative: Force plan re-evaluation by:
// 1. Adding/modifying an index (triggers cache invalidation)
// 2. Waiting for automatic invalidation (~1000 writes)
// 3. Using hints to override cached plan selection

// Example: Rebuild index to clear related plans
db.collection.dropIndex("index_name")
db.collection.createIndex({ field: 1 }, { name: "index_name" })
```

##### Rebuild Indexes
```javascript
// Rebuild specific index
db.collection.reIndex()

// Drop and recreate index to update statistics
db.collection.dropIndex("index_name")
db.collection.createIndex({ field: 1 })
```

##### Use Index Hints
```javascript
// Force specific index usage
db.collection.find({ field: value }).hint({ field: 1 })

// Force collection scan
db.collection.find({ field: value }).hint({ $natural: 1 })
```

##### Analyze Query Performance
```javascript
// Get detailed execution statistics
db.collection.find({ field: value }).explain("executionStats")

// Monitor slow queries
db.setProfilingLevel(2)  // Profile all operations
db.system.profile.find().limit(10).sort({ ts: -1 })
```

##### Configure Plan Cache Settings

**Self-hosted MongoDB 5.0+:**
```javascript
// Plan cache is managed automatically
// But we can influence it through query settings

// Set query settings for specific operations
db.adminCommand({
  setQuerySettings: {
    filter: { field: { $eq: "value" } },
    settings: {
      indexHints: { allowedIndexes: ["index_name"] }
    }
  }
})
```

**MongoDB Atlas approach:**
- **Use Performance Advisor.** Atlas automatically suggests indexes and identifies slow queries
- **Enable Profiling.** Set profiling level via Atlas UI (Cluster → Configuration → Additional Settings)
- **Monitor Metrics.** Track query efficiency through Atlas monitoring dashboard
- **Create Alerts.** Set up alerts for high query execution times or scan ratios
- **Use Query Profiler.** Analyze historical query performance in Atlas UI

### Common Practices Across All Databases

#### Regular Maintenance Schedule

- **PostgreSQL.** Enable autovacuum and schedule periodic manual ANALYZE during maintenance windows
- **Oracle.** Use automatic statistics collection and supplement with manual gathering after large data changes
- **MongoDB.** Monitor query performance and clear plan cache after significant data changes

#### Monitor After Bulk Operations

All databases require statistics updates after.
- Large `INSERT`/`UPDATE`/`DELETE` operations
- Data imports or migrations
- Index creation or modification
- Schema changes

#### Test Query Plans

Always verify execution plans in development before deploying.

```sql
-- PostgreSQL
EXPLAIN ANALYZE SELECT ...;

-- Oracle
EXPLAIN PLAN FOR SELECT ...;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- MongoDB
db.collection.find(...).explain("executionStats")
```

#### Set Up Alerts

Monitor for performance degradation that might indicate stale statistics:
- Sudden increases in query execution time
- Changes in execution plan choices
- Resource utilization spikes

##### PostgreSQL alert setup
```sql
-- Using pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Query to find slow queries (run periodically via monitoring tool)
SELECT 
  query,
  calls,
  mean_exec_time,
  stddev_exec_time,
  (total_exec_time / 1000 / 60) as total_minutes
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- Alert if mean time > 1 second
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Set up alert via cron + monitoring system (e.g., Prometheus, Grafana)
-- Or use PostgreSQL log_min_duration_statement
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
SELECT pg_reload_conf();
```

##### MongoDB Atlas alert setup

**WHERE to configure these alerts:**

These alert configurations can be set up in three ways:

**Method 1: Atlas Web UI (Easiest - Visual Interface)**
1. Log into MongoDB Atlas Console: https://cloud.mongodb.com
2. Select your Project
3. Click "Alerts" in the left sidebar
4. Click "Add Alert" button
5. Choose alert type from dropdown (e.g., "Query Targeting: Scanned Objects / Returned")
6. Set threshold value (e.g., 1000)
7. Configure notification channels (email, Slack, PagerDuty, etc.)
8. Save the alert

**Method 2: Atlas Admin API (Programmatic - REST API)**
```bash
# Create alert via REST API
curl --user "{PUBLIC_KEY}:{PRIVATE_KEY}" --digest \
  --header "Content-Type: application/json" \
  --request POST \
  "https://cloud.mongodb.com/api/atlas/v2/groups/{PROJECT_ID}/alertConfigs" \
  --data '{
    "eventTypeName": "QUERY_TARGETING_SCANNED_OBJECTS_PER_RETURNED",
    "enabled": true,
    "threshold": {
      "operator": "GREATER_THAN",
      "threshold": 1000,
      "units": "RAW"
    },
    "notifications": [
      {
        "typeName": "EMAIL",
        "emailEnabled": true,
        "emailAddress": "alerts@example.com",
        "delayMin": 0
      }
    ]
  }'
```

**Method 3: Terraform (Infrastructure as Code)**
```hcl
resource "mongodbatlas_alert_configuration" "query_efficiency" {
  project_id = var.project_id
  
  event_type = "QUERY_TARGETING_SCANNED_OBJECTS_PER_RETURNED"
  enabled    = true

  threshold {
    operator  = "GREATER_THAN"
    threshold = 1000
    units     = "RAW"
  }

  notification {
    type_name     = "EMAIL"
    email_enabled = true
    email_address = "alerts@example.com"
    delay_min     = 0
  }
}
```

**The JSON configuration format shown below** represents the Atlas alert structure. These values correspond to what you enter in the UI or send via API:

```javascript
// ALERT CONFIGURATION EXAMPLES
// These are the settings you configure (via UI, API, or Terraform)

// 1. Query Efficiency Alert (Detects inefficient queries)
// WHERE: Atlas UI → Alerts → Add Alert → "Query Targeting: Scanned Objects / Returned"
// OR: Use in REST API request body
// OR: Use in Terraform resource definition
{
  eventTypeName: "QUERY_TARGETING_SCANNED_OBJECTS_PER_RETURNED",
  threshold: 1000,  // Alert if scanned/returned ratio > 1000
  operator: "GREATER_THAN"
}
// What it does: Monitors the ratio of documents scanned vs documents returned
// Why it matters: High ratio (e.g., 1000x) means query is examining 1000 docs to return 1
// Example: If this fires, you're likely seeing the problems in Examples 1-5 (2106x, 6319x inefficiency)
// Real-world: Would have caught Example 5 (6319x) and Example 1 (2106x)

// 2. Slow Query Alert (Detects long-running queries)
// WHERE: Atlas UI → Alerts → Add Alert → "Query Execution Time"
// OR: Use in REST API / Terraform with this configuration
{
  eventTypeName: "QUERY_EXECUTION_TIME",
  threshold: 100,   // Alert if query takes > 100ms
  operator: "GREATER_THAN"
}
// What it does: Triggers when any query takes longer than threshold (in milliseconds)
// Why it matters: Indicates missing indexes, stale statistics, or inefficient operations
// Example: Would catch Example 1 (148ms) and Example 4 aggregation (638ms)
// Real-world: Would have caught Example 4 (638ms aggregation)

// 3. Collection Scan Alert (Detects full table scans)
// WHERE: Atlas UI → Alerts → Add Alert → "Collection Scans"
// OR: Use in REST API / Terraform with this configuration
{
  eventTypeName: "COLLSCANS",
  threshold: 100,   // Alert if > 100 collection scans per minute
  operator: "GREATER_THAN"
}
// What it does: Counts how many COLLSCAN operations happen per time window
// Why it matters: COLLSCAN means no index used - reading entire collection
// Example: ALL our examples 1-6 would trigger this (all showed stage: 'COLLSCAN')
// Real-world: If you see this firing frequently, you need indexes on those collections

// WHERE DO THESE CONFIGURATIONS COME FROM?
// - eventTypeName: Predefined by MongoDB Atlas (see full list in Atlas documentation)
// - threshold: You choose based on your application's performance requirements
// - operator: Usually "GREATER_THAN" for performance alerts, can also be "LESS_THAN"
// 
// Complete list of available eventTypeNames:
// - QUERY_TARGETING_SCANNED_OBJECTS_PER_RETURNED (efficiency ratio)
// - QUERY_EXECUTION_TIME (query duration in ms)
// - COLLSCANS (full collection scans count)
// - OPCOUNTER_REPL_CMD, OPCOUNTER_REPL_UPDATE, etc. (operation counters)
// - HOST_DOWN, CLUSTER_MONGOS_IS_MISSING (availability alerts)
// - Many more in Atlas documentation: 
//   https://www.mongodb.com/docs/atlas/reference/alert-config-settings/

// SUMMARY: Where to use alert configurations
// 1. Atlas UI: Click through the web interface (easiest)
// 2. Atlas Admin API: Send POST request with JSON config (for automation)
// 3. Terraform: Define as resources in .tf files (infrastructure as code)
// All three methods use the same eventTypeName, threshold, and operator values

// ============================================================================
// OPTION 2: MongoDB Profiler (Different from Alerts - Captures Query Details)
// ============================================================================
// Note: Profiling is NOT an alert system. It's a diagnostic tool that records
// slow query details to help you understand WHAT queries are problematic.
// Use profiling AFTER alerts notify you of performance issues.

// WHERE: Run these commands in MongoDB Shell (mongosh) or your application code
// WHAT: Records detailed execution info in the system.profile collection
// WHY: Helps identify which specific queries triggered your Atlas alerts

// Enable profiling - captures slow queries for analysis
// Level 0 = off, Level 1 = slow queries only, Level 2 = all queries (expensive!)
db.setProfilingLevel(1, { slowms: 100 })  // Profile queries > 100ms

// Profiling captures:
// - Full query text
// - Execution time (millis)
// - Documents examined
// - Query plan used
// - Timestamp
// This helps identify WHICH queries are slow, not just that slowness exists

// Check profiled queries - find top 10 slowest recent queries
db.system.profile.find({
  millis: { $gt: 100 }  // Filter: only queries that took > 100ms
}).sort({ 
  ts: -1  // Sort by timestamp descending (most recent first)
}).limit(10)

// Output example:
// {
//   op: "query",
//   ns: "mydb.llmsummaries",
//   command: { find: "llmsummaries", filter: { "result.assignee.userId": "..." } },
//   millis: 148,  // Took 148ms - matches our Example 1!
//   ts: ISODate("2026-02-26T10:30:00Z"),
//   planSummary: "COLLSCAN",  // Shows it did full collection scan
//   docsExamined: 6319,
//   nreturned: 3
// }

// Advanced: Find queries with worst efficiency ratios
db.system.profile.aggregate([
  { $match: { millis: { $gt: 10 } } },
  { $project: {
      ns: 1,
      millis: 1,
      docsExamined: 1,
      nreturned: 1,
      ratio: { 
        $cond: {
          if: { $eq: ["$nreturned", 0] },
          then: "$docsExamined",
          else: { $divide: ["$docsExamined", "$nreturned"] }
        }
      }
  }},
  { $match: { ratio: { $gt: 100 } } },  // Only bad efficiency
  { $sort: { ratio: -1 } },
  { $limit: 10 }
])
// This would show Example 5 (6319x) at the top!
```

**Recommended workflow (Alerts + Profiling together):**
```javascript
// Step 1: Set up Atlas alerts (one-time setup)
// → Alerts notify you WHEN performance degrades

// Step 2: When alert fires, enable profiling to investigate
db.setProfilingLevel(1, { slowms: 100 })

// Step 3: Check profiled queries to find culprits
db.system.profile.find({ millis: { $gt: 100 } }).sort({ ts: -1 })

// Step 4: Use explain() on specific slow queries
db.collection.find(problematicQuery).explain("executionStats")

// Step 5: Fix the issue (add indexes, optimize query)
db.collection.createIndex({ field: 1 })

// Step 6: Verify fix with explain() again
// → Should see IXSCAN instead of COLLSCAN, lower executionTimeMillis

// Step 7: Turn off profiling (optional, to reduce overhead)
db.setProfilingLevel(0)
```

##### Self-Hosted MongoDB alert setup

For self-hosted MongoDB, you need to set up external monitoring since Atlas's built-in alerts aren't available.

**Option 1: Prometheus + Grafana + Alertmanager (Recommended)**

This is the most popular open-source stack for MongoDB monitoring:

```yaml
# docker-compose.yml for monitoring stack
version: '3.8'
services:
  # MongoDB Exporter - collects metrics from MongoDB
  mongodb-exporter:
    image: percona/mongodb_exporter:latest
    command:
      - '--mongodb.uri=mongodb://user:password@mongodb:27017'
      - '--collect-all'
    ports:
      - "9216:9216"
    environment:
      - MONGODB_URI=mongodb://user:password@mongodb:27017

  # Prometheus - stores metrics and evaluates alert rules
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alerts.yml:/etc/prometheus/alerts.yml
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  # Grafana - visualization dashboards
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana

  # Alertmanager - manages and routes alerts
  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  grafana-storage:
```

**Prometheus configuration (prometheus.yml):**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# Load alert rules
rule_files:
  - 'alerts.yml'

# Configure Alertmanager
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# Scrape MongoDB metrics
scrape_configs:
  - job_name: 'mongodb'
    static_configs:
      - targets: ['mongodb-exporter:9216']
```

**Alert rules (alerts.yml) - Equivalent to Atlas alerts:**
```yaml
groups:
  - name: mongodb_performance
    interval: 30s
    rules:
      # Alert 1: Query Efficiency (scanned/returned ratio)
      # Equivalent to: QUERY_TARGETING_SCANNED_OBJECTS_PER_RETURNED
      - alert: HighQueryScanRatio
        expr: |
          (
            rate(mongodb_ss_metrics_document_scanned[5m]) /
            rate(mongodb_ss_metrics_document_returned[5m])
          ) > 1000
        for: 5m
        labels:
          severity: warning
          category: query_efficiency
        annotations:
          summary: "High query scan ratio detected"
          description: "MongoDB is scanning {{ $value }}x more documents than returned (threshold: 1000x). This indicates missing indexes or inefficient queries."

      # Alert 2: Slow Query Operations
      # Equivalent to: QUERY_EXECUTION_TIME
      - alert: SlowQueryOperations
        expr: mongodb_ss_opcounters_query > 100
        for: 2m
        labels:
          severity: warning
          category: query_performance
        annotations:
          summary: "High number of query operations"
          description: "{{ $value }} queries per second detected. Check profiler for slow queries."

      # Alert 3: Collection Scans
      # Equivalent to: COLLSCANS
      - alert: HighCollectionScans
        expr: rate(mongodb_ss_metrics_operation_scan_and_order[5m]) > 100
        for: 2m
        labels:
          severity: critical
          category: index_missing
        annotations:
          summary: "High rate of collection scans"
          description: "{{ $value }} collection scans per minute. Queries are not using indexes efficiently."

      # Additional useful alerts
      - alert: ReplicationLagHigh
        expr: mongodb_mongod_replset_member_replication_lag > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Replication lag is high"
          description: "Replication lag is {{ $value }} seconds"

      - alert: ConnectionsHigh
        expr: mongodb_ss_connections{conn_type="current"} > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High number of connections"
          description: "{{ $value }} active connections to MongoDB"
```

**Alertmanager configuration (alertmanager.yml):**
```yaml
global:
  resolve_timeout: 5m

# Where to send alerts
route:
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  # Email notifications
  - name: 'default'
    email_configs:
      - to: 'team@example.com'
        from: 'alertmanager@example.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'your-email@gmail.com'
        auth_password: 'your-app-password'

  # Slack notifications for critical
  - name: 'critical-alerts'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#critical-alerts'
        title: 'MongoDB Critical Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  # PagerDuty for critical issues
  - name: 'warning-alerts'
    webhook_configs:
      - url: 'http://your-webhook-endpoint/alerts'
        send_resolved: true
```

**Deploy the stack:**
```bash
# Start all services
docker-compose up -d

# Access Grafana at http://localhost:3000 (admin/admin)
# Access Prometheus at http://localhost:9090
# Access Alertmanager at http://localhost:9093

# Import MongoDB dashboard in Grafana
# Dashboard ID: 2583 (Percona MongoDB Exporter)
```

**Option 2: MongoDB Enterprise Ops Manager (Commercial)**

If you have MongoDB Enterprise, use Ops Manager which provides Atlas-like features:

```bash
# Install Ops Manager
curl -OL https://downloads.mongodb.com/on-prem-mms/rpm/mongodb-mms-x.x.x.x86_64.rpm
sudo rpm -ivh mongodb-mms-x.x.x.x86_64.rpm

# Configure alerts in Ops Manager UI
# Navigate to: Ops Manager → Project → Alerts → Add Alert
# Same alert types as Atlas available
```

**Option 3: Custom Python/Node.js Monitoring Script**

For simpler setups, create a custom monitoring script:

```python
# monitor_mongodb.py
from pymongo import MongoClient
import time
import smtplib
from email.mime.text import MIMEText
from datetime import datetime

client = MongoClient('mongodb://localhost:27017/')
db = client.admin

def check_query_efficiency():
    """Monitor scanned vs returned documents"""
    stats = db.command('serverStatus')
    metrics = stats['metrics']['document']
    
    scanned = metrics.get('scanned', 0)
    returned = metrics.get('returned', 0)
    
    if returned > 0:
        ratio = scanned / returned
        if ratio > 1000:
            send_alert(
                f"High scan ratio detected: {ratio:.0f}x",
                f"Scanned: {scanned}, Returned: {returned}"
            )

def check_slow_queries():
    """Check profiler for slow queries"""
    profiler_db = client['your_database']
    slow_queries = profiler_db.system.profile.find({
        'millis': {'$gt': 100}
    }).sort('ts', -1).limit(10)
    
    count = profiler_db.system.profile.count_documents({
        'millis': {'$gt': 100},
        'ts': {'$gte': datetime.now() - timedelta(minutes=5)}
    })
    
    if count > 50:
        send_alert(
            f"High number of slow queries: {count} in last 5 minutes",
            f"Threshold: 50 queries > 100ms"
        )

def send_alert(subject, message):
    """Send email alert"""
    msg = MIMEText(message)
    msg['Subject'] = f'MongoDB Alert: {subject}'
    msg['From'] = 'monitor@example.com'
    msg['To'] = 'team@example.com'
    
    with smtplib.SMTP('smtp.gmail.com', 587) as server:
        server.starttls()
        server.login('your-email@gmail.com', 'your-password')
        server.send_message(msg)
    print(f"Alert sent: {subject}")

# Run monitoring loop
while True:
    try:
        check_query_efficiency()
        check_slow_queries()
    except Exception as e:
        print(f"Error: {e}")
    
    time.sleep(60)  # Check every minute
```

**Run the monitor:**
```bash
# Install dependencies
pip install pymongo

# Run as background service
nohup python3 monitor_mongodb.py > monitor.log 2>&1 &

# Or use systemd service
sudo systemctl enable mongodb-monitor
sudo systemctl start mongodb-monitor
```

**Option 4: Nagios/Zabbix Integration**

```bash
# For Nagios - install MongoDB plugin
cd /usr/lib64/nagios/plugins/
wget https://raw.githubusercontent.com/mzupan/nagios-plugin-mongodb/master/check_mongodb.py
chmod +x check_mongodb.py

# Configure check command in Nagios
# /etc/nagios/objects/commands.cfg
define command {
    command_name    check_mongodb_query_time
    command_line    $USER1$/check_mongodb.py -H $HOSTADDRESS$ -A query_time -W 100 -C 500
}

# Define service check
define service {
    use                     generic-service
    host_name               mongodb-server
    service_description     MongoDB Query Time
    check_command           check_mongodb_query_time
}
```

**Comparison of self-hosted monitoring solutions:**

| Solution | Setup Complexity | Features | Cost | Best For |
|----------|-----------------|----------|------|----------|
| Prometheus + Grafana | Medium | Excellent | Free | Production environments |
| Ops Manager | Low | Atlas-like | $$$$ | Enterprise with budget |
| Custom Scripts | Low | Basic | Free | Small deployments |
| Nagios/Zabbix | High | Good | Free | Existing monitoring |

**Recommended approach for self-hosted:**
1. **Start with:** Custom Python script (quick to set up)
2. **Scale to:** Prometheus + Grafana (production-ready)
3. **Enterprise:** Ops Manager (if budget allows)

##### Oracle alert setup
```sql
-- Using Oracle Enterprise Manager or custom monitoring
-- Create alert for SQL execution time variance

-- 1. Baseline query performance
BEGIN
  DBMS_WORKLOAD_REPOSITORY.CREATE_BASELINE(
    start_snap_id => 1000,
    end_snap_id   => 1100,
    baseline_name => 'NORMAL_WORKLOAD',
    expiration    => NULL
  );
END;
/

-- 2. Monitor for queries exceeding baseline by threshold
SELECT 
  sql_id,
  executions,
  elapsed_time/1000000 as elapsed_seconds,
  cpu_time/1000000 as cpu_seconds,
  buffer_gets,
  disk_reads
FROM v$sql
WHERE elapsed_time/executions > 1000000  -- > 1 second average
  AND executions > 10
ORDER BY elapsed_time DESC;

-- 3. Set up alert via DBMS_SERVER_ALERT
BEGIN
  DBMS_SERVER_ALERT.SET_THRESHOLD(
    metrics_id              => DBMS_SERVER_ALERT.SQL_ELAPSED_TIME,
    warning_operator        => DBMS_SERVER_ALERT.OPERATOR_GT,
    warning_value           => '5000',  -- 5 seconds
    critical_operator       => DBMS_SERVER_ALERT.OPERATOR_GT,
    critical_value          => '10000', -- 10 seconds
    observation_period      => 1,
    consecutive_occurrences => 1,
    instance_name           => NULL,
    object_type             => NULL,
    object_name             => NULL
  );
END;
/
```

**Generic monitoring approach (all databases):**
```bash
# Prometheus/Grafana alert rule example
groups:
  - name: database_performance
    interval: 1m
    rules:
      - alert: SlowQueryDetected
        expr: database_query_duration_seconds > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow query detected ({{ $value }}s)"
          
      - alert: HighScanRatio
        expr: database_rows_examined / database_rows_returned > 100
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Poor query efficiency: {{ $value }}x scan ratio"
```
