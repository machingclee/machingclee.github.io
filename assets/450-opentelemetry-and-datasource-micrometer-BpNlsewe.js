const n=`---
title: "OpenTelemetry Tracing Setup for Spring Boot Applications"
date: 2026-01-04
id: blog0450
tag: logging, opentelemetry, spring
toc: true
intro: "A complete guide to instrument our Spring Boot application with OpenTelemetry tracing to identify performance bottlenecks in our REST APIs and database queries."
img: /assets/img/2026-01-04-19-16-07.png
scale: 1.4
offsetx: 35
offsety: 10
---



### Motivation


After watching the video  
- [THIS ONE Trick Made My Database Query 400x FASTER! (Cursor Pagination EXPOSED)](https://www.youtube.com/watch?v=U3LcKY19z_4) 

from Milan Jovanović, I realize that I need a service to trace my database query to identify performance bottleneck like:
1. Am I missing an index? 
2. What is the execution plan that is being used? 
3. Or is the created index actaully being used?

and more importantly:

4. Is ***adding an index*** making the query ***worse***? (it does in some cases like paging using offset and limit, that's why people invented [***cursor pagination***](https://www.youtube.com/watch?v=U3LcKY19z_4))

In Spring, we don't have Aspire from the dotnet world as an observability monitoring tool, but we have tight integration of datasource-micrometer with opentelemetry:

**Terminology.** Span $\\stackrel{\\Delta}{=}$ Single Unit of Work

\`\`\`text
HTTP Request comes in
        ↓
[Micrometer Tracing] creates root span
        ↓
[OpenTelemetry] instruments the request
        ↓
Database query executes
        ↓
[datasource-micrometer] intercepts JDBC calls
        ↓
    Creates child spans:
    - connection
    - query execution  
    - result-set processing
        ↓
[OpenTelemetry] collects all spans
        ↓
[Your TreeSpanExporter] formats and prints them
        ↓
[OTLP Exporter] sends to Jaeger (if endpoint configured)
\`\`\`

### Logging Example

#### Logging Which Indicates the N+1 Problem

\`\`\`text
════════════════════════════════════════════════════════════════════════════════════════════════════
📊 TRACE: 7ef5c9d8681e2093e8d9c5ebe8179f43
════════════════════════════════════════════════════════════════════════════════════════════════════
🔴 🌐 http get /scripts/history (118ms)
🔴   🔌 connection (103ms)
🟢     📝 query (6ms)
🟡     📊 result-set (16ms)
🟢       📝 query (0ms)
🟢       📊 result-set (3ms)
🟢       📝 query (0ms)
🟢       📊 result-set (0ms)
────────────────────────────────────────────────────────────────────────────────────────────────────
📝 QUERIES & EXECUTION PLANS:

┌─ Query #1 (6ms) ─────────────────────────────────────────────────────────────────
│
│ 📝 SQL:
│    select hss1_0.id,hss1_0.created_at,hss1_0.created_at_hk,hss1_0.execution_time,ss1_0.id,ss1_0.command,ss1_0.created_at,ss1_0.created_at_hk,ss1_0.is_markdown,ss1_0.locked,ss1_0.name,ss1_0.ordering,ss1_0.show_shell,ss1_2.script_ai_config_id,ss1_1.scripts_folder_id,pf1_0.id,pf1_0.created_at,pf1_0.created_at_hk,pf1_0.name,pf1_0.ordering,pf1_1.parent_folder_id,pf2_0.id,pf2_0.created_at,pf2_0.created_at_hk,pf2_0.name,pf2_0.ordering,pf2_1.parent_folder_id,pf2_2.workspace_id,pf1_2.workspace_id,hss1_0.shell_script_id
│      FROM historical_shell_script hss1_0
│      LEFT JOIN (shell_script ss1_0
│      LEFT JOIN rel_scriptsfolder_shellscript ss1_1 on ss1_0.id=ss1_1.shell_script_id
│      LEFT JOIN rel_shellscript_aiconfig ss1_2 on ss1_0.id=ss1_2.shell_script_id) on ss1_0.id=hss1_0.shell_script_id
│      LEFT JOIN (scripts_folder pf1_0
│      LEFT JOIN rel_folder_folder pf1_1 on pf1_0.id=pf1_1.child_folder_id
│      LEFT JOIN rel_workspace_folder pf1_2 on pf1_0.id=pf1_2.folder_id) on pf1_0.id=ss1_1.scripts_folder_id
│      LEFT JOIN (scripts_folder pf2_0
│      LEFT JOIN rel_folder_folder pf2_1 on pf2_0.id=pf2_1.child_folder_id
│      LEFT JOIN rel_workspace_folder pf2_2 on pf2_0.id=pf2_2.folder_id) on pf2_0.id=pf1_1.parent_folder_id
│      ORDER BY hss1_0.execution_time desc
│      LIMIT 10
│
│ 📋 Execution Plan:
│       MATERIALIZE (join-1)
│       SCAN ss1_0
│       SEARCH ss1_1 USING INDEX rel_scriptsfolder_shellscript_shell_script_id_idx (shell_script_id=?) LEFT-JOIN
│       BLOOM FILTER ON ss1_2 (shell_script_id=?)
│       SEARCH ss1_2 USING AUTOMATIC COVERING INDEX (shell_script_id=?) LEFT-JOIN
│       MATERIALIZE (join-2)
│       SCAN pf1_0
│       SEARCH pf1_1 USING INDEX rel_folder_folder_child_folder_id_idx (child_folder_id=?) LEFT-JOIN
│       SEARCH pf1_2 USING INDEX rel_workspace_folder_folder_id_idx (folder_id=?) LEFT-JOIN
│       MATERIALIZE (join-3)
│       SCAN pf2_0
│       SEARCH pf2_1 USING INDEX rel_folder_folder_child_folder_id_idx (child_folder_id=?) LEFT-JOIN
│       SEARCH pf2_2 USING INDEX rel_workspace_folder_folder_id_idx (folder_id=?) LEFT-JOIN
│       SCAN hss1_0
│       BLOOM FILTER ON (join-1) (id=?)
│       SEARCH (join-1) USING AUTOMATIC COVERING INDEX (id=?) LEFT-JOIN
│       BLOOM FILTER ON (join-2) (id=?)
│       SEARCH (join-2) USING AUTOMATIC COVERING INDEX (id=?) LEFT-JOIN
│       BLOOM FILTER ON (join-3) (id=?)
│       SEARCH (join-3) USING AUTOMATIC COVERING INDEX (id=?) LEFT-JOIN
│       USE TEMP B-TREE FOR ORDER BY
│    
│
│    ⚠️  📦 Temporary B-tree created. Query might benefit from an index.
│    ⚠️  📊 Sorting without index. Consider adding index on ORDER BY column.
└───────────────────────────────────────────────────────────────────────────────────────────────────

┌─ Query #2 (0ms) ─────────────────────────────────────────────────────────────────
│
│ 📝 SQL:
│    select w1_0.id,w1_0.created_at,w1_0.created_at_hk,w1_0.name,w1_0.ordering
│      FROM workspace w1_0
│      WHERE w1_0.id=?
│
│ 📋 Execution Plan:
│       SEARCH w1_0 USING INTEGER PRIMARY KEY (rowid=?)
│    
└───────────────────────────────────────────────────────────────────────────────────────────────────

┌─ Query #3 (0ms) ─────────────────────────────────────────────────────────────────
│
│ 📝 SQL:
│    select w1_0.id,w1_0.created_at,w1_0.created_at_hk,w1_0.name,w1_0.ordering
│      FROM workspace w1_0
│      WHERE w1_0.id=?
│
│ 📋 Execution Plan:
│       SEARCH w1_0 USING INTEGER PRIMARY KEY (rowid=?)
│    
└───────────────────────────────────────────────────────────────────────────────────────────────────

────────────────────────────────────────────────────────────────────────────────────────────────────
⚠️  N+1 QUERY PROBLEM DETECTED!

   🔴 Query executed 2 times:
      select w1_0.id,w1_0.created_at,w1_0.created_at_hk,w1_0.name,w1_0.ordering
      FROM workspace w1_0
      WHERE w1_0.id=?

      📋 Execution Plan for this repeated query:
         SEARCH w1_0 USING INTEGER PRIMARY KEY (rowid=?)
      

      💡 Tip: Use JOIN FETCH or @EntityGraph to load related data in one query
────────────────────────────────────────────────────────────────────────────────────────────────────
📈 Summary: Total 8 spans, 118ms total time
🐌 Slow queries (>1ms): 1 queries
   → 6ms: select hss1_0.id,hss1_0.created_at,hss1_0.created_at_hk,hss1_0.execution_time,ss...
💾 Query plan cache: 2 unique queries cached
════════════════════════════════════════════════════════════════════════════════════════════════════
\`\`\`


#### After N+1 Problem is Resolved

**Remark.** The connection time is reduced simply because I make a second request (so there is a connection warmed-up in the connection pool).

\`\`\`text
════════════════════════════════════════════════════════════════════════════════════════════════════
 📊 TRACE: da3252cf2bb102a912bad8bca18570b8
 ════════════════════════════════════════════════════════════════════════════════════════════════════
 🟡 🌐 http get /scripts/history (19ms)
 🟡   🔌 connection (15ms)
 🟢     📝 query (1ms)
 🟢     📊 result-set (6ms)
 ────────────────────────────────────────────────────────────────────────────────────────────────────
 📝 QUERIES & EXECUTION PLANS:
 
 ┌─ Query #1 (1ms) ─────────────────────────────────────────────────────────────────
 │
 │ 📝 SQL:
 │    select hss1_0.id,hss1_0.created_at,hss1_0.created_at_hk,hss1_0.execution_time,ss1_0.id,ss1_0.command,ss1_0.created_at,ss1_0.created_at_hk,ss1_0.is_markdown,ss1_0.locked,ss1_0.name,ss1_0.ordering,ss1_0.show_shell,ss1_2.script_ai_config_id,ss1_1.scripts_folder_id,pf1_0.id,pf1_0.created_at,pf1_0.created_at_hk,pf1_0.name,pf1_0.ordering,pf1_2.parent_folder_id,pf2_0.id,pf2_0.created_at,pf2_0.created_at_hk,pf2_0.name,pf2_0.ordering,pf2_2.parent_folder_id,pf2_1.workspace_id,pw2_0.id,pw2_0.created_at,pw2_0.created_at_hk,pw2_0.name,pw2_0.ordering,pf1_1.workspace_id,pw1_0.id,pw1_0.created_at,pw1_0.created_at_hk,pw1_0.name,pw1_0.ordering,hss1_0.shell_script_id
 │      FROM historical_shell_script hss1_0
 │      LEFT JOIN (shell_script ss1_0
 │      LEFT JOIN rel_scriptsfolder_shellscript ss1_1 on ss1_0.id=ss1_1.shell_script_id
 │      LEFT JOIN rel_shellscript_aiconfig ss1_2 on ss1_0.id=ss1_2.shell_script_id) on ss1_0.id=hss1_0.shell_script_id
 │      LEFT JOIN (scripts_folder pf1_0
 │      LEFT JOIN rel_workspace_folder pf1_1 on pf1_0.id=pf1_1.folder_id
 │      LEFT JOIN rel_folder_folder pf1_2 on pf1_0.id=pf1_2.child_folder_id) on pf1_0.id=ss1_1.scripts_folder_id
 │      LEFT JOIN workspace pw1_0 on pw1_0.id=pf1_1.workspace_id
 │      LEFT JOIN (scripts_folder pf2_0
 │      LEFT JOIN rel_workspace_folder pf2_1 on pf2_0.id=pf2_1.folder_id
 │      LEFT JOIN rel_folder_folder pf2_2 on pf2_0.id=pf2_2.child_folder_id) on pf2_0.id=pf1_2.parent_folder_id
 │      LEFT JOIN workspace pw2_0 on pw2_0.id=pf2_1.workspace_id
 │      ORDER BY hss1_0.execution_time desc
 │      LIMIT 10
 │
 │ 📋 Execution Plan:
 │       MATERIALIZE (join-1)
 │       SCAN ss1_0
 │       SEARCH ss1_1 USING INDEX rel_scriptsfolder_shellscript_shell_script_id_idx (shell_script_id=?) LEFT-JOIN
 │       BLOOM FILTER ON ss1_2 (shell_script_id=?)
 │       SEARCH ss1_2 USING AUTOMATIC COVERING INDEX (shell_script_id=?) LEFT-JOIN
 │       MATERIALIZE (join-2)
 │       SCAN pf1_0
 │       SEARCH pf1_1 USING INDEX rel_workspace_folder_folder_id_idx (folder_id=?) LEFT-JOIN
 │       SEARCH pf1_2 USING INDEX rel_folder_folder_child_folder_id_idx (child_folder_id=?) LEFT-JOIN
 │       MATERIALIZE (join-3)
 │       SCAN pf2_0
 │       SEARCH pf2_1 USING INDEX rel_workspace_folder_folder_id_idx (folder_id=?) LEFT-JOIN
 │       SEARCH pf2_2 USING INDEX rel_folder_folder_child_folder_id_idx (child_folder_id=?) LEFT-JOIN
 │       SCAN hss1_0
 │       BLOOM FILTER ON (join-1) (id=?)
 │       SEARCH (join-1) USING AUTOMATIC COVERING INDEX (id=?) LEFT-JOIN
 │       BLOOM FILTER ON (join-2) (id=?)
 │       SEARCH (join-2) USING AUTOMATIC COVERING INDEX (id=?) LEFT-JOIN
 │       SEARCH pw1_0 USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN
 │       BLOOM FILTER ON (join-3) (id=?)
 │       SEARCH (join-3) USING AUTOMATIC COVERING INDEX (id=?) LEFT-JOIN
 │       SEARCH pw2_0 USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN
 │       USE TEMP B-TREE FOR ORDER BY
 │    
 │
 │    ⚠️  📦 Temporary B-tree created. Query might benefit from an index.
 │    ⚠️  📊 Sorting without index. Consider adding index on ORDER BY column.
 └───────────────────────────────────────────────────────────────────────────────────────────────────
 
 ────────────────────────────────────────────────────────────────────────────────────────────────────
 📈 Summary: Total 4 spans, 19ms total time
 💾 Query plan cache: 1 unique queries cached
 ════════════════════════════════════════════════════════════════════════════════════════════════════
\`\`\`


### Configuration

#### Gradle Dependencies

\`\`\`kotlin
// Core Dependency
implementation("io.micrometer:micrometer-core")

// Micrometer Tracing with OpenTelemetry
implementation("io.micrometer:micrometer-tracing-bridge-otel")

// For logging traces to console (development)
implementation("io.opentelemetry:opentelemetry-sdk:1.33.0")
implementation("io.opentelemetry:opentelemetry-exporter-logging:1.33.0")

// For database query tracing
implementation("net.ttddyy.observation:datasource-micrometer-spring-boot:1.0.3")
\`\`\`

#### \`application.yml\`
##### Logging in Console {#logging_in_console}
\`\`\`yml-1{13}
logging:
  pattern:
    console: '%d{HH:mm:ss.SSS} %-5level %logger{35} - %msg%n'
  level:
    com.scriptmanager.common.config.BetterTreeSpanExporter: INFO

management:
  tracing:
    sampling:
      probability: 1.0
  otlp:
    tracing:
      endpoint: ""
\`\`\`
##### Logging in External Service
Note that \`management.otlp.tracing.endpoint\` (line-13 in [#logging_in_console]) is an ***empty string***, which means logging everything in the console.

We need to set up a non-empty OTLP endpoint to trigger sending logs to:
- Jaeger
- Zipkin
- or a vendor like Datadog/New Relic

Let's take Jaeger as an exmaple. In \`build.gradle.kts\` we add 
\`\`\`kotlin
implementation("io.opentelemetry:opentelemetry-exporter-otlp:1.42.1")
\`\`\`
and update to:
\`\`\`kotlin
  otlp:
    tracing:
      endpoint: "http://localhost:4318/v1/traces" 
\`\`\`
Now spin up a logging service at port 4318:
\`\`\`yml
version: '3.8'

services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger
    restart: unless-stopped
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "16686:16686"   # Jaeger UI
      - "4317:4317"     # OTLP gRPC receiver
      - "4318:4318"     # OTLP HTTP receiver
    networks:
      - observability

networks:
  observability:
    driver: bridge
\`\`\`

#### The \`TracingConfig\` Class

The following is vibed via trial-and-error until I got satisfactory logging result:


\`\`\`kotlin
package com.scriptmanager.common.config

import io.opentelemetry.api.common.AttributeKey
import io.opentelemetry.sdk.common.CompletableResultCode
import io.opentelemetry.sdk.trace.data.SpanData
import io.opentelemetry.sdk.trace.export.SpanExporter
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import javax.sql.DataSource


@Configuration
class TracingConfig(
    private val dataSource: DataSource
) {

    @Bean
    fun betterTreeSpanExporter(): SpanExporter {
        return BetterTreeSpanExporter(dataSource)
    }
}


class BetterTreeSpanExporter(
    private val dataSource: DataSource
) : SpanExporter {
    private val logger = LoggerFactory.getLogger(BetterTreeSpanExporter::class.java)
    private val traceBuffer = ConcurrentHashMap<String, MutableList<SpanData>>()
    private val queryPlanCache = ConcurrentHashMap<String, QueryPlanInfo>()

    data class QueryPlanInfo(
        val plan: String,
        val warnings: List<String>
    )

    override fun export(spans: Collection<SpanData>): CompletableResultCode {
        spans.forEach { span ->
            traceBuffer.getOrPut(span.traceId) { mutableListOf() }.add(span)

            if (span.parentSpanId == "0000000000000000" && span.kind.name == "SERVER") {
                printCompleteTrace(span.traceId)
                traceBuffer.remove(span.traceId)
            }
        }

        return CompletableResultCode.ofSuccess()
    }

    private fun printCompleteTrace(traceId: String) {
        val allSpans = traceBuffer[traceId] ?: return

        logger.info("\\n\\n" + "═".repeat(100))
        logger.info("📊 TRACE: $traceId")
        logger.info("═".repeat(100))

        val spanMap = allSpans.associateBy { it.spanId }
        val rootSpan = allSpans.find {
            it.parentSpanId == "0000000000000000" && it.kind.name == "SERVER"
        }

        if (rootSpan != null) {
            printSpanTree(rootSpan, spanMap, 0)

            // Show all queries WITH execution plans grouped together
            logger.info("─".repeat(100))
            logger.info("📝 QUERIES & EXECUTION PLANS:")
            logger.info("")

            allSpans.filter { it.name == "query" }.forEachIndexed { index, span ->
                val duration = TimeUnit.NANOSECONDS.toMillis(span.endEpochNanos - span.startEpochNanos)
                val query = span.attributes.get(AttributeKey.stringKey("jdbc.query[0]")) ?: "unknown"
                val rowsAffected = span.attributes.get(AttributeKey.longKey("jdbc.row-affected"))

                // Format SQL nicely
                val formattedQuery = query
                    .replace(Regex("\\\\s+"), " ")
                    .replace(" from ", "\\n  FROM ")
                    .replace(" left join ", "\\n  LEFT JOIN ")
                    .replace(" inner join ", "\\n  INNER JOIN ")
                    .replace(" where ", "\\n  WHERE ")
                    .replace(" order by ", "\\n  ORDER BY ")
                    .replace(" limit ", "\\n  LIMIT ")
                    .replace(" group by ", "\\n  GROUP BY ")

                // Get execution plan
                = getQueryPlanInfo(query)

                // Print everything together in a box
                logger.info("┌─ Query #\${index + 1} (\${duration}ms) " + "─".repeat(80 - "Query #\${index + 1} (\${duration}ms) ".length))
                logger.info("│")
                logger.info("│ 📝 SQL:")
                formattedQuery.lines().forEach { line ->
                    logger.info("│    $line")
                }

                if (rowsAffected != null) {
                    logger.info("│    → Affected: $rowsAffected rows")
                }

                logger.info("│")
                logger.info("│ 📋 Execution Plan:")
                if (planInfo.plan.isNotBlank()) {
                    planInfo.plan.lines().forEach { line ->
                        logger.info("│    $line")
                    }

                    // Show warnings immediately after the plan
                    if (planInfo.warnings.isNotEmpty()) {
                        logger.info("│")
                        planInfo.warnings.forEach { warning ->
                            logger.warn("│    ⚠️  $warning")
                        }
                    }
                } else {
                    logger.info("│    (No plan available)")
                }

                logger.info("└" + "─".repeat(99))
                logger.info("")
            }

            // Detect N+1
            detectNPlusOne(allSpans)

            val totalTime = TimeUnit.NANOSECONDS.toMillis(
                rootSpan.endEpochNanos - rootSpan.startEpochNanos
            )
            logger.info("─".repeat(100))
            logger.info("📈 Summary: Total \${allSpans.size} spans, \${totalTime}ms total time")

            val slowQueries = allSpans
                .filter { it.name == "query" }
                .map {
                    val duration = TimeUnit.NANOSECONDS.toMillis(it.endEpochNanos - it.startEpochNanos)
                    Pair(it, duration)
                }
                .filter { it.second > 1 }
                .sortedByDescending { it.second }

            if (slowQueries.isNotEmpty()) {
                logger.info("🐌 Slow queries (>1ms): \${slowQueries.size} queries")
                slowQueries.take(3).forEach { (span, duration) ->
                    val query = span.attributes.get(AttributeKey.stringKey("jdbc.query[0]"))
                        ?.take(80) ?: "unknown"
                    logger.info("   → \${duration}ms: $query...")
                }
            }

            // Show query plan cache stats
            logger.info("💾 Query plan cache: \${queryPlanCache.size} unique queries cached")
        }

        logger.info("═".repeat(100) + "\\n")
    }

    {
        if (sql == "unknown" || sql.startsWith("EXPLAIN", ignoreCase = true)) {
            return QueryPlanInfo("", emptyList())
        }

        val normalizedSql = normalizeSql(sql)

        return queryPlanCache.computeIfAbsent(normalizedSql) {
            try {
                val plan = executeExplainQuery(sql)
                val warnings = analyzeQueryPlan(plan)
                QueryPlanInfo(plan, warnings)
            } catch (e: Exception) {
                logger.debug("Could not get query plan for query: \${e.message}")
                QueryPlanInfo("   Unable to get query plan: \${e.message}", emptyList())
            }
        }
    }

    private fun executeExplainQuery(sql: String): String {
        return dataSource.connection.use { conn ->
            conn.createStatement().use { stmt ->
                // SQLite uses "EXPLAIN QUERY PLAN"
                val explainSql = "EXPLAIN QUERY PLAN $sql"
                val rs = stmt.executeQuery(explainSql)

                buildString {
                    while (rs.next()) {
                        // SQLite EXPLAIN QUERY PLAN returns: id, parent, notused, detail
                        val detail = rs.getString("detail")
                        appendLine("   $detail")
                    }
                }
            }
        }
    }

    private fun normalizeSql(sql: String): String {
        // Remove parameter values and extra whitespace to create cache key
        return sql
            .replace(Regex("=\\\\s*'[^']*'"), "= ?")  // Remove string literals
            .replace(Regex("=\\\\s*\\\\d+"), "= ?")      // Remove numbers
            .replace(Regex("=\\\\s*\\\\?"), "= ?")       // Normalize placeholders
            .replace(Regex("\\\\s+"), " ")             // Normalize whitespace
            .trim()
    }

    private fun analyzeQueryPlan(plan: String): List<String> {
        val warnings = mutableListOf<String>()

        // Check for full table scan
        if (plan.contains("SCAN TABLE", ignoreCase = true) &&
            !plan.contains("USING INDEX", ignoreCase = true)
        ) {
            warnings.add("🐌 Full table scan detected! Consider adding an index.")
        }

        // Check for temporary B-tree
        if (plan.contains("TEMP B-TREE", ignoreCase = true)) {
            warnings.add("📦 Temporary B-tree created. Query might benefit from an index.")
        }

        // Check for sorting without index
        if (plan.contains("USE TEMP B-TREE FOR ORDER BY", ignoreCase = true)) {
            warnings.add("📊 Sorting without index. Consider adding index on ORDER BY column.")
        }

        // Check for grouping without index
        if (plan.contains("USE TEMP B-TREE FOR GROUP BY", ignoreCase = true)) {
            warnings.add("📊 Grouping without index. Consider adding index on GROUP BY column.")
        }

        // Check for multiple table scans
        val scanCount = Regex("SCAN TABLE", RegexOption.IGNORE_CASE)
            .findAll(plan)
            .count()
        if (scanCount > 2) {
            warnings.add("⚠️  Multiple table scans ($scanCount) detected. Performance may be poor.")
        }

        return warnings
    }

    private fun detectNPlusOne(spans: List<SpanData>) {
        val queries = spans.filter { it.name == "query" }

        val queryGroups = queries.groupBy { span ->
            span.attributes.get(AttributeKey.stringKey("jdbc.query[0]"))
                ?.replace(Regex("\\\\s+"), " ")
        }

        val repeatedQueries = queryGroups.filter { it.value.size > 1 }

        if (repeatedQueries.isNotEmpty()) {
            logger.info("─".repeat(100))
            logger.info("⚠️  N+1 QUERY PROBLEM DETECTED!")
            repeatedQueries.forEach { (query, spanList) ->
                logger.info("")
                logger.info("   🔴 Query executed \${spanList.size} times:")

                val formatted = query?.replace(Regex("\\\\s+"), " ")
                    ?.replace(" from ", "\\n      FROM ")
                    ?.replace(" where ", "\\n      WHERE ") ?: "unknown"

                logger.info("      $formatted")

                // Show execution plan for repeated query
                = getQueryPlanInfo(query ?: "")
                if (planInfo.plan.isNotBlank()) {
                    logger.info("")
                    logger.info("      📋 Execution Plan for this repeated query:")
                    planInfo.plan.lines().forEach { line ->
                        logger.info("      $line")
                    }
                }

                logger.info("")
                logger.info("      💡 Tip: Use JOIN FETCH or @EntityGraph to load related data in one query")
            }
        }
    }

    private fun printSpanTree(
        span: SpanData,
        spanMap: Map<String, SpanData>,
        level: Int
    ) {
        val durationMs = TimeUnit.NANOSECONDS.toMillis(
            span.endEpochNanos - span.startEpochNanos
        )

        val indent = "  ".repeat(level)
        val emoji = when {
            span.kind.name == "SERVER" -> "🌐"
            span.name == "connection" -> "🔌"
            span.name == "query" -> "📝"
            span.name == "result-set" -> "📊"
            else -> "  "
        }

        val rowCount = span.attributes.get(AttributeKey.longKey("jdbc.row-count"))

        val colorCode = when {
            durationMs > 50 -> "🔴"
            durationMs > 10 -> "🟡"
            else -> "🟢"
        }

        = buildString {
            append("$colorCode $indent$emoji \${span.name}")
            append(" (\${durationMs}ms)")

            if (rowCount != null) {
                append(" → $rowCount rows")
            }
        }

        logger.info(info)

        val children = spanMap.values
            .filter { it.parentSpanId == span.spanId }
            .sortedBy { it.startEpochNanos }

        children.forEach { child ->
            printSpanTree(child, spanMap, level + 1)
        }
    }

    override fun flush(): CompletableResultCode = CompletableResultCode.ofSuccess()
    override fun shutdown(): CompletableResultCode = CompletableResultCode.ofSuccess()
}
\`\`\`



`;export{n as default};
