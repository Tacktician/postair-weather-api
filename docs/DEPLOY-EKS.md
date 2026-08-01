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

The agent runs as a **DaemonSet** (`infra/k8s/postman-insights-agent-daemonset.yaml`) —
one pod per node — configured in **workspace mode**. Workspace mode binds the agent to a
workspace and system environment you already have in Postman, rather than **discovery
mode**, which auto-creates new services from Kubernetes metadata. Because our workspace is
already git-linked, workspace mode is what keeps the observed traffic attached to the
existing service instead of spawning duplicates.

> **Workspace mode vs. discovery mode:** exactly one of `--discovery-mode`,
> `--workspace-id`, or `--project` (legacy) may be set. This manifest uses
> `--workspace-id` + `--system-env`, sourced from the `POSTMAN_INSIGHTS_WORKSPACE_ID` and
> `POSTMAN_INSIGHTS_SYSTEM_ENV` env vars.

**a. Get the IDs from Postman.** In the git-linked workspace, create (or select) an API
Catalog **system environment**, then copy both the **workspace ID** and **system
environment ID** from **API Catalog → Integrated Services**. Both are UUIDs. Set them in
the manifest's `env` block (`POSTMAN_INSIGHTS_WORKSPACE_ID`, `POSTMAN_INSIGHTS_SYSTEM_ENV`).

**b. Deploy the agent via `deploy.sh`.** When you set `POSTMAN_INSIGHTS_API_KEY`, the same
`scripts/deploy.sh` from step 2 also creates the `postman-agent-secrets` secret and applies
the DaemonSet (workspace mode). You can pass it alongside `WEATHER_API_KEY`:

```bash
POSTMAN_INSIGHTS_API_KEY=<your-key> WEATHER_API_KEY=1234 ./scripts/deploy.sh
```

If `POSTMAN_INSIGHTS_API_KEY` is unset, the script skips the agent entirely and only the
API workload is deployed. The key must have **write access** to the workspace (see
prerequisites).

**c. Verify the agent came up:**

```bash
kubectl -n postman-insights-namespace get pods
kubectl -n postman-insights-namespace logs -l name=postman-insights-agent
```

The DaemonSet requires EC2 nodes (for the `NET_RAW` capability) and mounts the host
containerd socket — see the "Why EC2 nodes" note above. Docs:
- https://learning.postman.com/docs/insights/reference/agent/api-catalog#get-started-with-workspace-mode
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
