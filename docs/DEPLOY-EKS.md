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
- A Postman API key and an API Catalog project (for the Insights step at the end)

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

## 3. Attach the Postman Insights agent (via API Catalog)

In Postman, open your API Catalog project and follow the **Connect → Insights Agent →
Kubernetes** flow. It generates an inject command with your project id, e.g.:

```bash
kubectl -n postair get deployment/postair-weather-api -o yaml \
  | POSTMAN_API_KEY=<your-key> postman-insights-agent kube inject \
      --project <projectId> --repro-mode -s=true -f - \
  | kubectl apply -f -
```

This adds the agent as a **sidecar** to the pods (the committed Deployment is left plain
so it can be injected here). Docs:
- https://learning.postman.com/docs/insights/get-started/kubernetes/sidecar/
- https://learning.postman.com/docs/api-catalog/connect/insights

## 4. Generate traffic and observe

Send traffic to the ELB URL so the agent has something to see — e.g. point the existing
Postman collection/monitor's base URL at `http://<elb-host>` and run it, or loop the
`curl` calls above. After ~5–8 minutes, the discovered endpoints appear in the service
detail **production** tab in the API Catalog.

## 5. Tear down

```bash
cd infra/terraform
terraform destroy
```

`force_delete` is set on the ECR repo so pushed images don't block destroy.
