const e=`---
title: "Personal Study for Company's Technology on k8s"
date: 2026-04-08
id: blog0481
tag: tech
toc: true
intro: "Study k8s"
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

### Kubernetes Operator

A **Kubernetes Operator** is a pattern for extending Kubernetes to manage complex, stateful applications by encoding operational knowledge into software.

### Standard \`service.yml\` / \`deployment.yml\`

These are **declarative resource manifests** for built-in Kubernetes resource types:

- \`Deployment\` — manages stateless app pods (rolling updates, replicas)
- \`Service\` — exposes pods via stable DNS/IP

Kubernetes' built-in controllers watch these resources and reconcile the actual state to match the desired state. The logic is baked into Kubernetes itself.

### Cluster Types: Stateless vs Stateful

| | Stateless | Stateful |
|---|---|---|
| Example | Web servers, APIs, workers | Databases, message queues, caches |
| Pod identity | Interchangeable | Each pod has a fixed identity (pod-0, pod-1...) |
| Storage | Ephemeral | Persistent volumes tied to each pod |
| Scale/Replace | Kill any pod, spin up new one | Must follow order; data must survive |

**Why "stateful"?** — Because each instance *holds data* that must persist. A PostgreSQL replica isn't interchangeable with the primary. Pod-0 might be the primary, pod-1 a replica — their roles and data differ. Kubernetes \`StatefulSet\` (the lower-level primitive) enforces stable network identity and ordered startup/shutdown for this reason.

### "Scale without data loss"

When you scale a database cluster from 3 → 5 replicas, you can't just spin up 2 blank pods. They need to:

1. **Receive a full data copy** (base backup) from the primary
2. **Start replication** from the correct WAL position
3. Only then serve read traffic

A plain \`Deployment\` has no idea how to do this. An Operator watches the \`replicas: 5\` change and executes that entire sequence automatically.

### Why use an Operator?

\`\`\`
Plain k8s = generic machinery (create pods, route traffic)
Operator  = generic machinery + domain expert baked in
\`\`\`

Without an Operator, *you* are the operator — you watch the cluster and manually run backup scripts, handle failover, coordinate upgrades. An Operator replaces that human toil with a controller that has the same knowledge encoded in code.

### CRD — Custom Resource Definition

Kubernetes ships with built-in resource types (\`Pod\`, \`Deployment\`, \`Service\`...). A **CRD is a schema registration** that teaches the Kubernetes API server about a *new* resource type you invented.

\`\`\`yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: postgresclusters.postgres-operator.crunchydata.com
spec:
  group: postgres-operator.crunchydata.com
  names:
    kind: PostgresCluster   # new type you're registering
    plural: postgresclusters
  scope: Namespaced
  versions: [...]
\`\`\`

Once registered, you can \`kubectl get postgresclusters\` just like \`kubectl get pods\`. The API server stores and validates these objects — but by itself it **does nothing with them**. That's the controller's job.

After installing a CRD + Operator, you write high-level intent:

\`\`\`yaml
apiVersion: postgres-operator.crunchydata.com/v1beta1
kind: PostgresCluster
metadata:
  name: my-db
spec:
  instances:
    - replicas: 3
  backups:
    pgbackrest: ...
\`\`\`

### Controller — the reconciliation loop

At its core, a controller is **just an event listener**. The Kubernetes API server emits events whenever a resource is created, updated, or deleted. Controllers subscribe to those events and react. Nothing more than that — no polling, no cron jobs, just event-driven reconciliation.

A **controller** is a long-running process (usually a \`Deployment\` inside the cluster) that:

1. **Listens** to events from the Kubernetes API server (create / update / delete)
2. **Compares** desired state (what you wrote in the YAML) vs actual state (what's running)
3. **Acts** to close the gap

\`\`\`
┌──────────────────────────────────────────────┐
│                Reconcile Loop                │
│                                              │
│  Watch PostgresCluster CR                    │
│         │                                    │
│         ▼                                    │
│  Desired: replicas=3, version=15             │
│  Actual:  replicas=1, version=14             │
│         │                                    │
│         ▼                                    │
│  → Create 2 more StatefulSet pods            │
│  → Trigger minor version upgrade procedure   │
└──────────────────────────────────────────────┘
\`\`\`

This loop runs **continuously** — if someone manually deletes a replica, the controller detects drift and recreates it.

**Common real-world Operators**: \`pg-operator\` (Postgres), \`strimzi\` (Kafka), \`elasticsearch-operator\`, \`redis-operator\`, \`cert-manager\` (TLS certs).


### Do we manage the controller?

No. When you install an operator (via Helm or OperatorHub), the controller comes **bundled with it** — it deploys itself as a \`Deployment\` in your cluster and runs automatically in the background.

Your only job is:

1. **Install** the operator (one-time \`helm install\`)
2. **Write** the custom resource YAML (\`PostgresCluster\`, \`KafkaCluster\`, etc.)
3. **Apply** it — the controller takes it from there

You never touch the controller code or manage its internals. It's the same mental model as using any managed tool — you don't manage the MySQL binary, you just write SQL.




### Do we write our own Operators?

No — the vast majority of the time you **install existing operators**, not write your own. The ecosystem is mature enough that almost every popular stateful system already has a production-grade operator:

| Need | Operator to install |
|---|---|
| PostgreSQL | Crunchy \`pg-operator\`, Zalando \`postgres-operator\` |
| Kafka | Strimzi |
| Elasticsearch / OpenSearch | ECK (Elastic), OpenSearch Operator |
| Redis | Redis Operator by Spotahome |
| MySQL | PlanetScale Vitess, Oracle MySQL Operator |
| TLS certificates | \`cert-manager\` |
| Prometheus + Grafana | \`kube-prometheus-stack\` |

You find and install them via **Helm** or **OperatorHub** (\`operatorhub.io\`), then just write the custom resource YAML.

**When would you write your own?** Only in niche situations:

- Your company has **proprietary internal software** with complex Day-2 ops that no existing operator covers
- You're a **software vendor** shipping your product *as* a k8s operator
- You're doing advanced **platform engineering** — e.g., auto-provisioning tenant databases per customer

For those cases, the **Operator SDK** (Go or Ansible) and **Kubebuilder** are the standard frameworks.

**In practice**: you write \`HelmRelease\` or \`PostgresCluster\` YAML, not controllers.

### Operator vs Controller

A common confusion: is an **Operator** just another name for a **Controller**?

- A **Controller** is the fundamental mechanism — a long-running process that listens to Kubernetes API events and reconciles state. Every built-in Kubernetes resource (\`Deployment\`, \`ReplicaSet\`, \`Node\`) has a corresponding built-in controller. A plain controller watches built-in resource types and requires no CRD.
- An **Operator** is a *pattern* built **on top of** a controller. It bundles three things together:
  1. A **CRD** — registers a new, domain-specific resource type
  2. A **Controller** — watches that CRD and acts on it
  3. **Domain knowledge** — operational logic specific to that application (backup, failover, upgrade ordering, etc.)

\`\`\`
Controller ──► fundamental mechanism (watches resources, reconciles state)
Operator   ──► Controller + CRD + domain knowledge (a higher-level pattern)
\`\`\`

**Every Operator is a Controller, but not every Controller is an Operator.**

The built-in \`Deployment\` controller is a plain controller — it watches \`Deployment\` objects (a built-in type, no CRD). The Postgres Operator is a controller *plus* a CRD (\`PostgresCluster\`) plus Postgres-specific operational knowledge. Operator ⊂ Controller.

### AWS Load Balancer Controller

The **AWS Load Balancer Controller** is a Kubernetes controller that runs inside your EKS cluster and **automates the creation of AWS load balancers** when you create Kubernetes \`Ingress\` or \`Service\` resources. It is the same controller/operator pattern — you declare intent in YAML, the controller reconciles it against real AWS infrastructure.

\`\`\`
Kubernetes Ingress/Service YAML
         │
         ▼
AWS Load Balancer Controller (running as a pod in EKS)
         │
         ▼
AWS API → creates/updates ALB or NLB automatically
\`\`\`

### \`Ingress\` → ALB (Application Load Balancer)

ALB operates at Layer 7 (HTTP/HTTPS) and supports path-based and host-based routing rules.

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /users
            backend:
              service: { name: user-svc, port: { number: 80 } }
          - path: /orders
            backend:
              service: { name: order-svc, port: { number: 80 } }
\`\`\`

The controller watches this \`Ingress\` and automatically creates an ALB, configures listeners and routing rules, and registers pods as target group targets — updating them as pods scale or restart.

### \`Service (type: LoadBalancer)\` → NLB (Network Load Balancer)

NLB operates at Layer 4 (TCP/UDP), offering lower latency for non-HTTP workloads.

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: external
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: ip
spec:
  type: LoadBalancer
  ports:
    - port: 443
\`\`\`


### Monitoring with Grafana + Prometheus

The standard Kubernetes monitoring stack is **Prometheus** (metrics collector) + **Grafana** (visualization), installed via the \`kube-prometheus-stack\` Helm chart.

\`\`\`
┌──────────────────────┐
│   Grafana (UI)       │
│   dashboards, alerts │
└──────────┬───────────┘
           │ queries
┌──────────▼───────────┐
│  Prometheus          │
│  scrapes /metrics    │
│  from pods/nodes     │
└──────────────────────┘
\`\`\`

\`\`\`bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \\
  -n monitoring --create-namespace
\`\`\`

This single chart installs:

- **Prometheus** — scrapes metrics from pods, nodes, and Kubernetes components
- **Alertmanager** — routes alerts to Slack, PagerDuty, etc.
- **Grafana** — pre-built dashboards for cluster health, pod CPU/memory, node status
- **kube-state-metrics** — exposes Kubernetes object state as metrics
- **node-exporter** — exposes per-node OS metrics

**Multi-cluster monitoring**: Run a separate Prometheus per cluster. Point all of them as data sources in a single Grafana instance, or federate via **Thanos** or **Grafana Mimir** for long-term storage and cross-cluster querying.

### Practical Walkthrough: Operator + Database Cluster

This section walks through the **exact steps** to go from a blank EKS cluster to a running 3-replica PostgreSQL cluster, using the Crunchy Data \`pg-operator\`.

#### Step 1 — Install the Operator via Helm

This is a one-time setup. Helm downloads the operator's Helm chart, which contains the CRD, controller \`Deployment\`, \`ServiceAccount\`, \`ClusterRole\`, etc. — all in one command.

\`\`\`bash
# Add the Crunchy Data Helm repo
helm repo add postgres-operator-charts \\
  https://charts.crunchydata.com/postgres-operator-charts

helm repo update

# Install the operator into its own namespace
helm install pgo postgres-operator-charts/pgo \\
  --namespace postgres-operator \\
  --create-namespace
\`\`\`

After this, verify it's running:

\`\`\`bash
kubectl get pods -n postgres-operator
# NAME                  READY   STATUS    RESTARTS
# pgo-xxxxxxxxx-xxxxx   1/1     Running   0
\`\`\`

And verify the CRD is now registered:

\`\`\`bash
kubectl get crd | grep postgres
# postgresclusters.postgres-operator.crunchydata.com
\`\`\`

The CRD was written by Crunchy Data and is now live in your cluster. **You did not write it.**

#### Step 2 — Write your CR to declare the database cluster

Now you write the only YAML you ever write — the **Custom Resource** (CR). This is your high-level intent: "I want a PostgreSQL 15 cluster with 3 replicas and 20Gi storage each."

\`\`\`yaml
# postgres-cluster.yml
apiVersion: postgres-operator.crunchydata.com/v1beta1
kind: PostgresCluster          # ← type registered by the CRD
metadata:
  name: my-db
  namespace: default
spec:
  postgresVersion: 15

  instances:
    - name: instance1
      replicas: 3              # 1 primary + 2 replicas
      dataVolumeClaimSpec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 20Gi

  backups:
    pgbackrest:
      repos:
        - name: repo1
          volume:
            volumeClaimSpec:
              accessModes: ["ReadWriteOnce"]
              resources:
                requests:
                  storage: 10Gi
\`\`\`

Apply it:

\`\`\`bash
kubectl apply -f postgres-cluster.yml
\`\`\`

#### Step 3 — The Operator takes over

The controller was already watching for \`PostgresCluster\` events. The moment you apply the CR, it reconciles:

\`\`\`
You apply CR
     │
     ▼
Controller detects new PostgresCluster event
     │
     ▼
Creates StatefulSet (3 pods: pod-0 primary, pod-1/pod-2 replicas)
Creates PersistentVolumeClaim per pod (20Gi each)
Configures streaming replication between pods
Sets up pgBackRest backup job
     │
     ▼
kubectl get pods -n default
# my-db-instance1-0   Running  ← primary
# my-db-instance1-1   Running  ← replica
# my-db-instance1-2   Running  ← replica
\`\`\`

You never wrote a \`StatefulSet\`, \`PersistentVolumeClaim\`, replication config, or backup job. The operator derived all of that from your 30-line CR.

#### Step 4 — Scale or modify by editing the CR

To scale from 3 → 5 replicas, just change the CR and re-apply:

\`\`\`yaml
instances:
  - name: instance1
    replicas: 5   # ← changed from 3
\`\`\`

\`\`\`bash
kubectl apply -f postgres-cluster.yml
\`\`\`

The controller detects the drift (desired: 5, actual: 3), provisions 2 new pods, performs base backup + replication setup automatically. No manual steps.

#### Summary: What you write vs what the operator writes

\`\`\`
You write:
  helm install pgo ...           ← install operator (one-time)
  postgres-cluster.yml (CR)      ← declare intent

Operator writes (auto-generated, you never touch):
  StatefulSet
  PersistentVolumeClaims (x3)
  Services (primary + replica endpoints)
  Replication config
  Backup CronJob
\`\`\`

| Layer | Tool | Your effort |
|---|---|---|
| Install operator + CRD | \`helm install\` | One command |
| Declare database cluster | CR YAML (\`postgres-cluster.yml\`) | ~30 lines |
| StatefulSet, PVC, replication, backups | Operator (auto) | Zero |

### GitOps — Git as the Single Source of Truth

Running \`helm install\` manually means the cluster state is not tracked in your repository. A new team member cloning the repo would have no idea what operators or resources are installed. This problem is solved by **GitOps**.

**GitOps** is the practice of declaring every cluster resource as a file in a Git repository. You never run \`helm install\` or \`kubectl apply\` manually — a GitOps tool inside the cluster does it for you by watching the repo.

\`\`\`
Git repo (source of truth)
       │
       │  push / merge
       ▼
  ArgoCD (running inside cluster)
       │
       │  detects diff, applies changes
       ▼
  Kubernetes cluster (always matches repo)
\`\`\`

**ArgoCD** is the most popular GitOps tool. It runs inside the cluster as an operator, watches your Git repo, and continuously reconciles the cluster state to match what's in the repo. It also has a built-in web UI showing sync status and diffs between desired vs actual state.

#### Step 1 — Install ArgoCD itself (one-time, manual bootstrap)

ArgoCD is the one thing you install manually — it's the bootstrapper that then manages everything else:

\`\`\`bash
kubectl create namespace argocd
kubectl apply -n argocd -f \\
  https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
\`\`\`

After this, ArgoCD runs as a set of pods in the \`argocd\` namespace and watches your repo.

#### Step 2 — Declare an \`Application\` instead of running \`helm install\`

In ArgoCD, the unit of deployment is an \`Application\` resource. Instead of running \`helm install pgo ...\` in a terminal, you commit this to your repo:

\`\`\`yaml
# k8s/apps/postgres-operator.yml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: postgres-operator
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://charts.crunchydata.com/postgres-operator-charts
    chart: pgo
    targetRevision: "5.x"
    helm:
      releaseName: pgo
  destination:
    server: https://kubernetes.default.svc
    namespace: postgres-operator
  syncPolicy:
    automated:
      prune: true       # delete resources removed from repo
      selfHeal: true    # revert manual cluster changes
    syncOptions:
      - CreateNamespace=true
\`\`\`

ArgoCD detects this file, installs the Helm chart, and keeps it in sync. If you bump \`targetRevision\`, ArgoCD upgrades it. If you delete the file, ArgoCD removes the operator.

#### Step 3 — Commit all your other resources too

Your CRs, Ingress, ConfigMaps — everything goes in the repo as plain YAML files. ArgoCD watches a directory and applies everything in it:

\`\`\`yaml
# k8s/apps/my-databases.yml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: databases
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/your-org/your-k8s-repo
    path: k8s/clusters          # ← applies everything in this folder
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
\`\`\`

\`\`\`
k8s/
├── apps/
│   ├── postgres-operator.yml    ← ArgoCD Application (installs pg-operator via Helm)
│   ├── monitoring.yml           ← ArgoCD Application (installs kube-prometheus-stack)
│   └── aws-load-balancer.yml    ← ArgoCD Application (installs AWS LBC)
├── clusters/
│   └── my-db.yml               ← your PostgresCluster CR (applied by ArgoCD)
└── ingress/
    └── api-ingress.yml          ← your Ingress (applied by ArgoCD)
\`\`\`

Anyone who clones this repo, installs ArgoCD, and applies the \`apps/\` folder gets an **identical cluster**. The repo is the complete, auditable, version-controlled record of everything.

#### The GitOps rule

> If it's not in the repo, it doesn't exist in the cluster.

With \`selfHeal: true\`, ArgoCD automatically reverts any manual \`kubectl apply\` or \`helm install\` done outside the repo — the cluster is always driven by Git.

| | Manual approach | ArgoCD GitOps |
|---|---|---|
| Install operator | \`helm install\` in terminal | Commit \`Application\` YAML |
| Apply CR | \`kubectl apply -f\` in terminal | Commit CR YAML, ArgoCD syncs it |
| Cluster reproducibility | ❌ undocumented | ✅ clone repo + bootstrap ArgoCD |
| Audit trail | ❌ terminal history | ✅ Git commit history |
| Rollback | Manual | \`git revert\` → ArgoCD reconciles |
| Drift detection | ❌ none | ✅ ArgoCD UI shows out-of-sync resources |
`;export{e as default};
