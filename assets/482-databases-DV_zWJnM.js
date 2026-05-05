const e=`---
title: "Personal Study for Company's Technology on Databases"
date: 2026-04-09
id: blog0482
tag: tech
toc: true
intro: "Study databases"
indent: true
wip: true
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table td:first-child, table th:first-child {
    min-width: 120px;
  }
</style>


### Why a Database Cluster?

A single database pod is a **single point of failure** — if it crashes, the entire application goes down. A cluster solves three problems:

| Problem | Solution |
|---|---|
| Pod crash → app down | Replica promoted to primary automatically |
| Too many read queries | Replicas absorb read traffic |
| Data loss on node failure | Each pod has its own PersistentVolume |

A typical setup is **1 primary + 2 replicas**:

- **Primary (pod-0)** — handles all writes
- **Replica (pod-1, pod-2)** — sync from primary, handle read queries, ready to be promoted

---

### Primary/Replica Failover

When the primary crashes, the operator runs **leader election** — one replica (say pod-1) is promoted to primary. The operator updates the \`my-db-primary\` Service selector so it now points to pod-1. pod-2 starts replicating from pod-1. When the old pod-0 restarts, it rejoins as a **replica**.

\`\`\`
Normal:     pod-0 (primary) ← pod-1 (replica) ← pod-2 (replica)
pod-0 dies:
Failover:   pod-1 (new primary) ← pod-2 (replica)
pod-0 back: pod-1 (primary) ← pod-0 (now replica) ← pod-2 (replica)
\`\`\`

The key insight: StatefulSet gives **stable identity** (\`pod-0\`, \`pod-1\`, \`pod-2\`) but the **role** (primary vs replica) is decided by the operator at runtime, not by the pod number.

---

### YAML: Creating a 1-Primary + 2-Replica PostgreSQL Cluster

The PGO (Crunchy Data Postgres Operator) uses the \`PostgresCluster\` CR. First install the operator:

\`\`\`bash
# Install the PGO operator into its own namespace
kubectl apply -k https://github.com/CrunchyData/postgres-operator-examples/kustomize/install/namespace
kubectl apply --server-side -k https://github.com/CrunchyData/postgres-operator-examples/kustomize/install/default
\`\`\`

Then declare your cluster:

\`\`\`yaml
# pg-cluster.yaml
apiVersion: postgres-operator.crunchydata.com/v1beta1
kind: PostgresCluster
metadata:
  name: my-db
  namespace: default
spec:
  postgresVersion: 15
  instances:
    - name: instance1
      replicas: 3          # 1 primary + 2 replicas (operator decides who is primary)
      dataVolumeClaimSpec:
        accessModes:
          - ReadWriteOnce
        resources:
          requests:
            storage: 10Gi
  backups:
    pgbackrest:
      image: registry.developers.crunchydata.com/crunchydata/crunchy-pgbackrest:ubi8-2.47-2
      repos:
        - name: repo1
          volume:
            volumeClaimSpec:
              accessModes:
                - ReadWriteOnce
              resources:
                requests:
                  storage: 20Gi
\`\`\`

\`\`\`bash
kubectl apply -f pg-cluster.yaml
\`\`\`

The operator automatically creates:
- A \`StatefulSet\` with 3 pods
- A \`my-db-primary\` Service (always points to current primary)
- A \`my-db-replicas\` Service (load-balances across replicas)

---

### YAML: What the Auto-Created Services Look Like

The operator manages these, but conceptually they look like this:

\`\`\`yaml
# Primary service — operator keeps selector updated on failover
apiVersion: v1
kind: Service
metadata:
  name: my-db-primary
  namespace: default
spec:
  selector:
    postgres-operator.crunchydata.com/role: primary   # operator updates this on failover
  ports:
    - port: 5432
      targetPort: 5432
---
# Replicas service — load-balances across all replicas
apiVersion: v1
kind: Service
metadata:
  name: my-db-replicas
  namespace: default
spec:
  selector:
    postgres-operator.crunchydata.com/role: replica
  ports:
    - port: 5432
      targetPort: 5432
\`\`\`

The DNS names inside the cluster are:
- \`my-db-primary.default.svc.cluster.local:5432\` for writes
- \`my-db-replicas.default.svc.cluster.local:5432\` for reads

---

### YAML: Backend Deployment Connecting to the Cluster

\`\`\`yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-backend
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-backend
  template:
    metadata:
      labels:
        app: my-backend
    spec:
      containers:
        - name: backend
          image: my-backend:latest
          env:
            - name: DATABASE_WRITE_URL
              value: "postgresql://user:pass@my-db-primary.default.svc.cluster.local:5432/mydb"
            - name: DATABASE_READ_URL
              value: "postgresql://user:pass@my-db-replicas.default.svc.cluster.local:5432/mydb"
\`\`\`

The connection strings **never change** even after a failover — the operator updates the Service selector, not the DNS name.

---

### Database Sharding

**Sharding** splits data **horizontally** across multiple independent clusters. Each shard owns a subset of the rows (e.g., by user ID range or hash). This is different from primary/replica:

| | Primary/Replica | Sharding |
|---|---|---|
| Purpose | High availability + read scaling | Write scaling + data volume scaling |
| Each node holds | Same data | Different subset of data |
| Solves | Single point of failure | Write bottleneck, data too large for one node |

A single table \`users\` could be split as:
- **shard-0**: user_id 0–999,999
- **shard-1**: user_id 1,000,000–1,999,999
- **shard-2**: user_id 2,000,000–2,999,999

Each shard is its own \`PostgresCluster\` with its own primary + replicas.

---

### YAML: Three-Shard Setup

\`\`\`yaml
# shard-0.yaml
apiVersion: postgres-operator.crunchydata.com/v1beta1
kind: PostgresCluster
metadata:
  name: db-shard-0
  namespace: shard-0
spec:
  postgresVersion: 15
  instances:
    - name: instance1
      replicas: 3
      dataVolumeClaimSpec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 10Gi
  backups:
    pgbackrest:
      image: registry.developers.crunchydata.com/crunchydata/crunchy-pgbackrest:ubi8-2.47-2
      repos:
        - name: repo1
          volume:
            volumeClaimSpec:
              accessModes: [ReadWriteOnce]
              resources:
                requests:
                  storage: 20Gi
---
# shard-1.yaml — identical structure, different namespace
apiVersion: postgres-operator.crunchydata.com/v1beta1
kind: PostgresCluster
metadata:
  name: db-shard-1
  namespace: shard-1
spec:
  postgresVersion: 15
  instances:
    - name: instance1
      replicas: 3
      dataVolumeClaimSpec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 10Gi
  backups:
    pgbackrest:
      image: registry.developers.crunchydata.com/crunchydata/crunchy-pgbackrest:ubi8-2.47-2
      repos:
        - name: repo1
          volume:
            volumeClaimSpec:
              accessModes: [ReadWriteOnce]
              resources:
                requests:
                  storage: 20Gi
---
# shard-2.yaml — same again
apiVersion: postgres-operator.crunchydata.com/v1beta1
kind: PostgresCluster
metadata:
  name: db-shard-2
  namespace: shard-2
spec:
  postgresVersion: 15
  instances:
    - name: instance1
      replicas: 3
      dataVolumeClaimSpec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 10Gi
  backups:
    pgbackrest:
      image: registry.developers.crunchydata.com/crunchydata/crunchy-pgbackrest:ubi8-2.47-2
      repos:
        - name: repo1
          volume:
            volumeClaimSpec:
              accessModes: [ReadWriteOnce]
              resources:
                requests:
                  storage: 20Gi
\`\`\`

Each shard gets its own Services:
- \`db-shard-0-primary.shard-0.svc.cluster.local:5432\`
- \`db-shard-1-primary.shard-1.svc.cluster.local:5432\`
- \`db-shard-2-primary.shard-2.svc.cluster.local:5432\`

---

### Shard Routing

K8s does **not** handle routing logic. A middleware layer decides which shard a query goes to. Two common options:

**Option 1 — Application-level routing** (simple, works for small shard count):

\`\`\`typescript
// In your backend code
function getShardConnection(userId: number) {
  const shardIndex = Math.floor(userId / 1_000_000); // 0, 1, or 2
  const hosts = [
    "db-shard-0-primary.shard-0.svc.cluster.local",
    "db-shard-1-primary.shard-1.svc.cluster.local",
    "db-shard-2-primary.shard-2.svc.cluster.local",
  ];
  return hosts[shardIndex];
}
\`\`\`

**Option 2 — Vitess operator** (production-grade, transparent to the application):

\`\`\`yaml
# VitessCluster CR — Vitess operator creates vtgate (proxy) + vttablets (shards)
apiVersion: planetscale.dev/v2
kind: VitessCluster
metadata:
  name: my-vitess
  namespace: default
spec:
  cells:
    - name: zone1
      gateway:
        replicas: 2           # vtgate pods — application connects here
  keyspaces:
    - name: commerce
      turndownPolicy: Immediate
      partitionings:
        - equal:
            parts: 3          # auto-split into 3 shards
            shardTemplate:
              databaseInitScriptSecret:
                name: example-cluster-config
                key: init_db.sql
              tabletPools:
                - cell: zone1
                  type: replica
                  replicas: 3  # 3 pods per shard (1 primary + 2 replicas)
                  dataVolumeClaimTemplate:
                    accessModes: [ReadWriteOnce]
                    resources:
                      requests:
                        storage: 10Gi
\`\`\`

The application then only talks to the vtgate Service — it looks like a single MySQL endpoint:

\`\`\`yaml
# Backend env — only one connection string, vtgate routes to the right shard
env:
  - name: DATABASE_URL
    value: "mysql://user:pass@my-vitess-zone1-vtgate.default.svc.cluster.local:3306/commerce"
\`\`\`

---

### Querying Sharded Data

There are three query scenarios with different performance characteristics:

**Case 1 — Filter by shard key (fast, single shard)**

\`\`\`sql
SELECT * FROM users WHERE user_id = 1500000;
-- Router: user_id 1500000 → shard-1. Query hits exactly one shard.
\`\`\`

**Case 2 — Filter by non-shard key (scatter-gather)**

\`\`\`sql
SELECT * FROM users WHERE email = 'foo@bar.com';
-- No shard key → router must query ALL shards in parallel and merge results.
\`\`\`

Vitess vtgate does this transparently. App-level routing requires manual merging:

\`\`\`typescript
const results = await Promise.all(
  shardHosts.map(host => query(host, "SELECT * FROM users WHERE email = $1", [email]))
);
const merged = results.flat();
\`\`\`

**Case 3 — Cross-shard JOIN (very expensive, avoid if possible)**

\`\`\`sql
SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id;
-- If users and orders are on different shards, there is no efficient solution.
\`\`\`

The fix is **data co-location**: design \`users\` and \`orders\` to use the same shard key (\`user_id\`) so they always land on the same shard, making the JOIN local.

**Query type summary:**

| Query type | Performance | Solution |
|---|---|---|
| Filter by shard key | Fast (1 shard) | Design queries around the shard key |
| Filter by non-shard key | Slow (scatter-gather) | Vitess vtgate or manual parallel queries |
| Cross-shard JOIN | Very slow | Co-locate data with the same shard key |
| Aggregation (COUNT, SUM) | Slow (scatter then merge) | Pre-aggregate with a cron job or stream processor |

The key rule: **choose a shard key that makes your most frequent queries hit only one shard**. Sharding trades query flexibility for write scalability.

---

### Dynamic Shard Connection in Node.js / TypeScript

The backend holds a **pool of connections** (one per shard), all opened at startup. Per-request it picks the right pool — no open/close overhead.

\`\`\`typescript
import { Pool } from "pg";

// Created once at startup — all connections stay open (pooled, reused)
const shards: Pool[] = [
  new Pool({ connectionString: "postgresql://user:pass@db-shard-0-primary.shard-0.svc.cluster.local:5432/mydb" }),
  new Pool({ connectionString: "postgresql://user:pass@db-shard-1-primary.shard-1.svc.cluster.local:5432/mydb" }),
  new Pool({ connectionString: "postgresql://user:pass@db-shard-2-primary.shard-2.svc.cluster.local:5432/mydb" }),
];

function getShard(userId: number): Pool {
  const index = Math.floor(userId / 1_000_000) % shards.length;
  return shards[index];
}

// Usage — pick the right shard at call time
async function getUser(userId: number) {
  const db = getShard(userId);
  return db.query("SELECT * FROM users WHERE id = $1", [userId]);
}
\`\`\`

**Connection count at scale:**

| Setup | Connections |
|---|---|
| 3 shards × 10 app pods | 30 pools |
| 20 shards × 50 app pods | 1000 pools — use Vitess instead |

---

### Dynamic Shard Connection in Spring Boot

Spring's \`AbstractRoutingDataSource\` lets all JPA/JDBC code stay untouched. A \`ThreadLocal\` stores the shard key per request; Spring intercepts the connection acquisition and delegates to the right \`HikariPool\`.

\`\`\`java
// ShardContextHolder.java — ThreadLocal store, one value per thread/request
public class ShardContextHolder {
    private static final ThreadLocal<Integer> CONTEXT = new ThreadLocal<>();

    public static void setShard(long userId) {
        CONTEXT.set((int)(userId / 1_000_000));  // 0, 1, or 2
    }

    public static Integer getShard() {
        return CONTEXT.get();
    }

    public static void clear() {
        CONTEXT.remove();  // must clear after request to avoid leaking to next request
    }
}
\`\`\`

\`\`\`java
// ShardRoutingDataSource.java — picks DataSource by key in ThreadLocal
public class ShardRoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        return ShardContextHolder.getShard();  // returns 0, 1, or 2
    }
}
\`\`\`

\`\`\`java
// DataSourceConfig.java — register all shard DataSources as one routing bean
@Configuration
public class DataSourceConfig {

    @Bean
    public DataSource dataSource() {
        Map<Object, Object> targets = new HashMap<>();
        targets.put(0, buildDataSource("jdbc:postgresql://db-shard-0-primary.shard-0.svc.cluster.local:5432/mydb"));
        targets.put(1, buildDataSource("jdbc:postgresql://db-shard-1-primary.shard-1.svc.cluster.local:5432/mydb"));
        targets.put(2, buildDataSource("jdbc:postgresql://db-shard-2-primary.shard-2.svc.cluster.local:5432/mydb"));

        ShardRoutingDataSource routing = new ShardRoutingDataSource();
        routing.setTargetDataSources(targets);
        routing.setDefaultTargetDataSource(targets.get(0));
        return routing;
    }

    private DataSource buildDataSource(String url) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername("user");
        config.setPassword("pass");
        config.setMaximumPoolSize(10);
        return new HikariDataSource(config);
    }
}
\`\`\`

\`\`\`java
// UserService.java — set shard key before calling repository, always clear after
@Service
public class UserService {
    private final UserRepository userRepository;

    public User getUser(long userId) {
        ShardContextHolder.setShard(userId);
        try {
            return userRepository.findById(userId).orElseThrow();
        } finally {
            ShardContextHolder.clear();  // critical — prevents shard leaking across requests
        }
    }
}
\`\`\`

\`application.properties\` has **no datasource config** — all connection strings live in \`DataSourceConfig\`. JPA, \`JdbcTemplate\`, and all repositories continue working without modification.

---

### Summary

| Concept | What it solves | K8s mechanism |
|---|---|---|
| Primary/Replica | HA + read scaling | StatefulSet + operator-managed Services |
| Failover | Primary crash → replica promoted | Operator updates Service selector |
| Backend routing | Stable connection strings | Service DNS unchanged across failovers |
| Sharding | Write scaling + huge data volumes | Multiple StatefulSets, one per shard |
| Shard routing | Which shard for this query | App logic or Vitess vtgate proxy |
| Scatter-gather | Non-shard-key queries | Vitess vtgate (auto) or \`Promise.all\` (manual) |
| Dynamic connection (Node) | Pick shard pool per request | Pre-built \`Pool[]\` array, index by shard key |
| Dynamic connection (Spring) | Pick shard pool per request | \`AbstractRoutingDataSource\` + \`ThreadLocal\` |

`;export{e as default};
