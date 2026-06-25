# Comprehensive Documentation
## NAGP 2026 — Kubernetes, DevOps & FinOps | Sahil Singh (3175225)

---

## 1. Requirement Understanding

This assignment was intented to assess the concepts of containerization and deploying a end to end multi-tier architecture involving one microservice and one database.

- **Service API Tier** — A stateless microservice exposing HTTP endpoints that fetch and return data from the database. For this demo, I have choose simple API endpoints
which returns customers data.
- **Database Tier** — A persistent database which persists data stored and is only assessible within the cluster.

Key functional requirements:

| Requirement | Details |
|---|---|
| External accessibility | API tier exposed outside the cluster via Ingress |
| Internal-only DB | Database has no external Service; accessible via DNS only |
| 4 API replicas | Deployment with 4 pods |
| 1 DB replica | StatefulSet with 1 pod |
| Rolling updates | Zero-downtime deployments for API |
| Self-healing | Pods auto-restart on failure |
| Persistent storage | Database data survives pod deletion |
| ConfigMap | DB connection config externalised from pod spec and code |
| Secrets | DB credentials stored as Kubernetes Secrets |
| HPA | Horizontal Pod Autoscaler on API tier |
| FinOps considerations

---

## 2. Assumptions

1. **Cloud Provider:** Azure Kubernetes Service (AKS) is used as the Kubernetes host, with an NGINX Ingress Controller provisioned.
2. **Database:** PostgreSQL was selected as the relational database due to its native Kubernetes support via the official Docker image, and built-in init script support. I also have a little experience working with PostgreSQL.
3. **API Runtime:** Node.js with Express was chosen for the API service. The `pg` library provides connection pooling out of the box.
4. **Namespace isolation:** All resources are deployed under the `nagpdemo` namespace to logically isolate this workload.
5. **No TLS in demo:** The Ingress is HTTP-only for the purpose of this demo. In production, TLS termination would be added at the Ingress level.
6. **Init data via ConfigMap:** The database is initialised using a SQL script mounted from a ConfigMap, eliminating the need for a separate migration job.

---

## 3. Solution Overview

### Architecture Diagram

```
    User
     │
     ▼
[NGINX Ingress Controller]  ← external IP
     │  
     ▼
[api-service]
     │
  ┌──┴──────────────┐
  │  API Deployment  │  ← 4 replicas
  │  Node.js/Express │
  │  Port 3000       │
  └──┬──────────────┘
     │  DNS: postgres-db-svc.nagpdemo.svc.cluster.local:5432
     ▼
[postgres-db-svc Headless Service]
     │
     ▼
[postgres-db StatefulSet]   ← 1 replica
     │
     ▼
[PersistentVolumeClaim] → [PersistentVolume] (1Gi, standard-rwo)
```

### Namespace

All objects live in the `nagpdemo` namespace:

```
nagpdemo/
├── Deployments/        api-service (4 replicas)
├── StatefulSets/       postgres-db (1 replica)
├── Services/           api-service (ClusterIP), postgres-db-svc (Headless)
├── Ingress/            api-service-ingress
├── HPA/                api-service-hpa (min 3, max 5, CPU 20%)
├── ConfigMaps/         db-config, postgres-config
├── Secrets/            api-db-credentials, postgres-credentials
├── PersistentVolume/   postgres-pv (1Gi)
└── PersistentVolumeClaim/ postgres-pvc (1Gi, bound)
```

### API Tier

- **Language:** Node.js + Express
- **Endpoints:**
  - `GET /records` — Returns all customer records as JSON
  - `GET /formatted-records` — Returns records as an HTML table with pagination
- **Config:** All DB connection params (`DB_HOST`, `DB_PORT`, `DB_NAME`) come from a ConfigMap; credentials (`DB_USER`, `DB_PASS`) come from a secret.
- **Deployment strategy:** RollingUpdate with `maxUnavailable: 1`, `maxSurge: 1`

### Database Tier

- **Engine:** PostgreSQL
- **Deployment type:** StatefulSet
- **Access:** Headless Service (`ClusterIP: None`) — DNS resolves directly to pod IP, no kube-proxy load balancing needed for single-replica
- **Init data:** `init.sql` mounted via ConfigMap
- **Persistence:** PVC bound to a PV using `storageClassName: standard-rwo` with `Retain` reclaim policy which ensures data persistence.

---

## 4. Justification for Resources Utilised

### Why Azure cloud?
Because of my familiarity with the Azure cloud in past learnings.

### Why Node.js?
Lightweight, fast startup time, excellent for I/O-bound workloads like database queries.

### Why PostgreSQL?
Native support for JSONB, better ACID compliance for transactional workloads, and strong Kubernetes community tooling. The official image supports automatic init via mounted SQL scripts.

### Why StatefulSet for DB?
StatefulSets provide stable pod identity.

### Why Headless Service for DB?
A standard ClusterIP Service adds kube-proxy load balancing — unnecessary for a single-replica StatefulSet. A Headless Service (`ClusterIP: None`) lets clients resolve directly to the pod IP via DNS.

### Why ConfigMap for DB config?
ConfigMaps let update DB host, port, or name without rebuilding the image or modifying the deployment YAML.

### Why Secrets for credentials?
Kubernetes Secrets prevent credentials from appearing as plaintext in YAML files, version history, or logs. Values are base64-encoded.

---

## 5. FinOps - Cost Optimisation Opportunities

#### Opportunity 1 — Enable horizontal pod auto-scaler

Scaling based on demand prevents:

Over-provisioned replicas
Idle CPU usage

**Idea:** HPA with `minReplicas: 3`, `maxReplicas: 5`, target CPU 20%. Here 20% is quite low limit and can trigger unnecessary threholds, this is only kept intentionally for demo purpose. It should be ideal average value in production.

```yaml
minReplicas: 3
maxReplicas: 5
metrics:
- type: Resource
  resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 20
```

**Outcome:** At idle, the cluster runs 3 pods instead of 4 — a 25% reduction in API tier compute costs. Under peak, it scales to 5, capped to prevent runaway spend.

---

#### Opportunity 2 — Observing the right limits for CPU and memory

**Problem:** Default resource requests mean the scheduler reserves more CPU/memory than pods actually use, forcing the cluster to provision more nodes than necessary. More resouces means overpaying for the limits which might not be required.

**Idea:** Requests were updated as per workload.

**Outcome:** Reduce the unnecessary consumption and costing.

---

#### Opportunity 3 — Using spot instances

**Idea:** Since this was a demo only environment, I choose spot instances when provisioning VM.

**Outcome:** It becomes upto 60-70% cheaper and can save cost in learning or dev instances.

---

#### Opportunity 4 — Delete Cluster After Demo

**Idea:** The assignment explicitly notes: *"You may delete your Kubernetes cluster after the deliveries have been captured."* AKS cluster nodes incur compute cost continuously. Deleting the cluster after screen recording eliminates ongoing charges.

---

#### Opportunity 5 — Isolating resources using namespaces

**Idea:** I have isolated the resources used in this demo to a specific namespace (nagpdemo), so it becomes easier to track resources for specific purpose and manage efficiently.

---
