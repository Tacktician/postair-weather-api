# Deploying PostAir Weather API to EKS (Postman Insights demo)

This runbook stands the API up as a simple microservice on **AWS EKS** so the
**Postman Insights agent** can observe its traffic and populate the **production tab**
of the service detail view in the API Catalog.

The infra is intentionally minimal — a demo you spin up and tear down on demand. All
steps run **locally**; nothing is deployed by CI.

## What gets created

| Piece | Where | Notes |
| --- | --- | --- |
| Container image | `Dockerfile` | `node:20-alpine`, non-root, `/health` probe |
| VPC + EKS + ECR | `infra/terraform/` | EKS uses an **EC2 managed node group** (see below) |
| Deployment / Service / Namespace | `infra/k8s/` | `LoadBalancer` Service → public ELB endpoint |
| Deploy script | `scripts/deploy.sh` | build → push to ECR → apply manifests |

> **Why EC2 nodes and not Fargate?** The Insights agent captures packets and needs the
> `NET_RAW` capability, which AWS Fargate does not allow. The Terraform therefore
> provisions an EC2 managed node group.

## Prerequisites

- AWS CLI configured with credentials that can create VPC/EKS/ECR (`aws sts get-caller-identity` works)
- `terraform` (>= 1.3), `kubectl`, `docker`
- A Postman API key belonging to a user with **write access** (workspace Admin or Super Admin) to the target workspace
- An existing (git-linked) Postman workspace and an API Catalog **system environment** in it (for the Insights step at the end)

## 1. Provision infrastructure

```bash
cd infra/terraform
terraform init
terraform apply        # ~15 min for the cluster; incurs AWS cost while running
```

Note the outputs (`ecr_repository_url`, `cluster_name`, `region`). Standing up the
control plane + nodes costs roughly $0.10+/hr while running — see teardown below.

## 2. Build, push, and deploy

`deploy.sh` reads the Terraform outputs automatically. Set `WEATHER_API_KEY` to the
value the API should validate `x-api-key` against (`1234` is fine for a demo):

```bash
cd <repo root>
WEATHER_API_KEY=1234 ./scripts/deploy.sh
```

The script logs in to ECR, builds/pushes the image (`linux/amd64`), points `kubectl`
at the cluster, creates the `weather-api-secret`, applies the manifests, and prints the
LoadBalancer URL when ready.

Verify the live endpoint:

```bash
curl http://<elb-host>/health                                   # {"status":"ok"}
curl -H "x-api-key: 1234" http://<elb-host>/v1/weather/airports  # data
```

## 3. Attach the Postman Insights agent (DaemonSet, workspace mode)

The agent runs as a **DaemonSet** (`infra/k8s/postman-insights-agent-daemonset.yaml`) — one
pod per node — in **workspace mode**. Workspace mode links captured traffic to a workspace
and system environment you already have in Postman, rather than **discovery mode**, which
auto-creates new services from Kubernetes metadata (spawning duplicate services). Because our
workspace is git-linked, workspace mode keeps the observed traffic attached to the existing
service.

> **How the DaemonSet knows the workspace.** `kube run` takes no `--workspace-id` /
> `--system-env` flags — those are `kube inject` (sidecar) flags. In DaemonSet workspace
> mode, the agent instead reads three vars from **each observed application pod's**
> environment — `POSTMAN_INSIGHTS_WORKSPACE_ID`, `POSTMAN_INSIGHTS_SYSTEM_ENV`, and
> `POSTMAN_INSIGHTS_API_KEY` — and routes that pod's traffic to the matching workspace. So
> those vars live on the app Deployment, **not** on the agent DaemonSet. (Setting them on
> the agent pod does nothing; the agent logs `Missing env vars: [...]` for any pod that
> lacks them.)

**a. Get the IDs from Postman.** In the git-linked workspace, create (or select) an API
Catalog **system environment**, then copy both the **workspace ID** and **system environment
ID** from **API Catalog → Integrated Services**. Both are UUIDs.

**b. Put the config on the app Deployment.** `infra/k8s/deployment.yaml` sets
`POSTMAN_INSIGHTS_WORKSPACE_ID` and `POSTMAN_INSIGHTS_SYSTEM_ENV` in the container `env`
(this demo's values are already there — update them if your workspace/system-env differ),
plus `POSTMAN_INSIGHTS_API_KEY` from the `postman-agent-secrets` secret (`optional: true`,
so the workload still starts when the agent isn't in use). `deploy.sh` creates that secret
in the `postair` namespace when `POSTMAN_INSIGHTS_API_KEY` is set.

**c. Deploy via `deploy.sh`.** When you set `POSTMAN_INSIGHTS_API_KEY`, the same
`scripts/deploy.sh` from step 2 also creates the `postman-agent-secrets` secret and applies
the DaemonSet. Pass it alongside `WEATHER_API_KEY`:

```bash
POSTMAN_INSIGHTS_API_KEY=<your-key> WEATHER_API_KEY=1234 ./scripts/deploy.sh
```

The key must have **write access** to the workspace (see prerequisites). If
`POSTMAN_INSIGHTS_API_KEY` is unset, the script skips the agent and only the API workload is
deployed. No local `postman-insights-agent` CLI is needed — the DaemonSet is a plain manifest.

**d. Verify the agent came up:**

```bash
kubectl -n postman-insights-namespace get pods    # one Running pod per node
kubectl -n postman-insights-namespace logs -l name=postman-insights-agent --tail=20
```

The DaemonSet requires EC2 nodes (for the `NET_RAW` capability) and mounts the host
containerd socket — see the "Why EC2 nodes" note above. Docs:
- https://learning.postman.com/docs/insights/reference/agent/api-catalog#onboarding-approaches
- https://learning.postman.com/docs/api-catalog/connect/insights

## 4. Generate traffic and observe

Send traffic to the ELB URL so the agent has something to see — e.g. point the existing
Postman collection/monitor's base URL at `http://<elb-host>` and run it, or loop the
`curl` calls above. After ~5–8 minutes, the observed endpoints appear in the service
detail **production** tab of the git-linked workspace in the API Catalog.

## 5. Tear down

```bash
cd infra/terraform
terraform destroy
```

`force_delete` is set on the ECR repo so pushed images don't block destroy.

## Key concepts & common pitfalls

The steps above are the happy path. This section explains the decisions behind them and the
mistakes that are easy to make — most of them cost real debugging time to figure out.

### Pick the mode first: discovery vs. workspace

> **Already have a git-linked workspace? Use workspace mode.**

- **Discovery mode** auto-creates services from Kubernetes metadata. Good for greenfield, but
  if you *already* have a workspace/service, it spawns **duplicate** services alongside the
  existing ones — you end up with two copies and traffic split across them.
- **Workspace mode** binds captured traffic to a workspace + system environment you already
  have, keeping everything attached to the existing (git-linked) service.

This demo uses workspace mode for exactly that reason. Exactly one selection applies at a
time (`--discovery-mode`, workspace mode, or legacy `--project`).

### `kube run` and `kube inject` configure workspace mode in *different places*

Both the DaemonSet (`kube run`) and the sidecar (`kube inject`) support workspace mode, but
you configure them differently — this is the single biggest trap:

| Deployment model | Where workspace config lives |
| --- | --- |
| Sidecar (`kube inject`) | CLI **flags** at inject time: `--workspace-id`, `--system-env` |
| DaemonSet (`kube run`) | **env vars on the target app pods** — the agent reads them per-pod |

The trap: `kube run` has **no** `--workspace-id` flag, so it's tempting to conclude the
DaemonSet can't do workspace mode. It can — the config just lives on the observed pods, not
on the agent. Setting those vars on the agent DaemonSet itself does nothing.

### The DaemonSet needs *three* env vars on each observed pod

In DaemonSet workspace mode, every application pod the agent should capture must expose all
three (see `infra/k8s/deployment.yaml`):

```yaml
- name: POSTMAN_INSIGHTS_WORKSPACE_ID   # which workspace
- name: POSTMAN_INSIGHTS_SYSTEM_ENV     # which system environment
- name: POSTMAN_INSIGHTS_API_KEY        # authenticates that pod's data
```

Miss any one and the agent logs `Missing env vars: [...]` for that pod and captures nothing
for it.

### Security: the deployment model decides where your API key lives

Workspace mode authenticates **per observed pod**, so the Postman API key ends up outside the
agent itself:

- **DaemonSet** → the (write-access) key is an env var on **every observed application pod**.
- **Sidecar** → the key rides in the injected sidecar container.

Either way, treat this deliberately: use a **dedicated key scoped to just this workspace**,
source it from a Kubernetes Secret (never inline in a manifest), and rotate it. "The agent
needs org write access" is a real decision, not a default to wave through.

### Troubleshooting: read the agent logs

```bash
kubectl -n postman-insights-namespace logs -l name=postman-insights-agent --tail=50
```

| Log signal | Meaning |
| --- | --- |
| `Missing env vars: [POSTMAN_INSIGHTS_API_KEY]` | Target pod is under-configured — add the missing var(s) to the app Deployment |
| `Created new trace on Postman Cloud: akita://[<env>] <service>:trace:...` | Working — and it names the workspace/env, so you can confirm it's the *right* one |
| `The cluster name is missing. Telemetry will not be sent...` | Harmless in workspace mode — only affects the agent's own telemetry/cluster listing |
| Agent Running, but Production tab empty | Almost always "no traffic yet" — the tab is populated only by observed requests. Generate load (step 4). |

Two more that save time:

- **`--help` from the running binary beats the published docs.** Flags differ by agent version
  and subcommand; the docs can conflate `kube run` and `kube inject`. Check the source of
  truth: `kubectl -n postman-insights-namespace exec <agent-pod> -- \
  postman-insights-agent kube run --help`.
- **EC2 nodes, not Fargate.** The agent captures packets and needs the `NET_RAW` capability,
  which Fargate disallows — see the "Why EC2 nodes" note near the top.
