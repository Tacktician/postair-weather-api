#!/usr/bin/env bash
#
# Build & push the PostAir Weather API image to ECR, then deploy it to EKS.
# Run locally after `terraform apply` (see docs/DEPLOY-EKS.md).
#
# Required env:
#   WEATHER_API_KEY   value the API validates x-api-key against (e.g. 1234 for demos)
# Optional env (defaults read from `terraform output` when unset):
#   REGION            AWS region                 (default: terraform output region)
#   CLUSTER_NAME      EKS cluster name           (default: terraform output cluster_name)
#   ECR_REPO          ECR repository URL         (default: terraform output ecr_repository_url)
#   IMAGE_TAG         image tag to build/deploy  (default: current git short SHA, else "latest")
#   POSTMAN_INSIGHTS_API_KEY  Postman API key (write access to the target workspace).
#                     When set, creates the agent secret and applies the Insights
#                     DaemonSet. Workspace routing is configured by env vars on the app
#                     Deployment (infra/k8s/deployment.yaml), which the DaemonSet reads
#                     per-pod — not here. When unset, the agent step is skipped.
#
set -euo pipefail

# Resolve paths relative to this script so it works from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"
K8S_DIR="$REPO_ROOT/infra/k8s"

# Pull unset values from Terraform outputs.
tf_output() { terraform -chdir="$TF_DIR" output -raw "$1" 2>/dev/null || true; }
REGION="${REGION:-$(tf_output region)}"
CLUSTER_NAME="${CLUSTER_NAME:-$(tf_output cluster_name)}"
ECR_REPO="${ECR_REPO:-$(tf_output ecr_repository_url)}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo latest)}"

: "${WEATHER_API_KEY:?WEATHER_API_KEY must be set}"
: "${REGION:?REGION is empty (run terraform apply, or set REGION)}"
: "${CLUSTER_NAME:?CLUSTER_NAME is empty (run terraform apply, or set CLUSTER_NAME)}"
: "${ECR_REPO:?ECR_REPO is empty (run terraform apply, or set ECR_REPO)}"

IMAGE="$ECR_REPO:$IMAGE_TAG"
REGISTRY="${ECR_REPO%%/*}"

echo ">> Region:       $REGION"
echo ">> Cluster:      $CLUSTER_NAME"
echo ">> Image:        $IMAGE"

echo ">> Logging in to ECR ($REGISTRY)"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

echo ">> Building and pushing image (linux/amd64 to match EKS nodes)"
docker build --platform linux/amd64 -t "$IMAGE" "$REPO_ROOT"
docker push "$IMAGE"

echo ">> Updating kubeconfig"
aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$REGION"

echo ">> Applying namespace"
kubectl apply -f "$K8S_DIR/namespace.yaml"

echo ">> Creating/updating weather-api-secret"
kubectl -n postair create secret generic weather-api-secret \
  --from-literal=WEATHER_API_KEY="$WEATHER_API_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

# When an agent key is provided, also create it in the app namespace so the workload pods
# can expose POSTMAN_INSIGHTS_API_KEY — the DaemonSet reads it (plus the workspace/system-env
# vars) from each target pod. Must exist before the workload is applied.
if [ -n "${POSTMAN_INSIGHTS_API_KEY:-}" ]; then
  echo ">> Creating/updating postman-agent-secrets (postair)"
  kubectl -n postair create secret generic postman-agent-secrets \
    --from-literal=postman-api-key="$POSTMAN_INSIGHTS_API_KEY" \
    --dry-run=client -o yaml | kubectl apply -f -
fi

echo ">> Deploying service and workload"
kubectl apply -f "$K8S_DIR/service.yaml"
sed "s|__IMAGE__|$IMAGE|g" "$K8S_DIR/deployment.yaml" | kubectl apply -f -

# Postman Insights agent (workspace mode) — only when an agent key is provided.
# The DaemonSet runs `kube run` and reads POSTMAN_INSIGHTS_WORKSPACE_ID /
# POSTMAN_INSIGHTS_SYSTEM_ENV from each target app pod (set in deployment.yaml above) to
# route captured traffic to the right workspace. Here we just create the API key secret
# the DaemonSet references and apply the DaemonSet.
if [ -n "${POSTMAN_INSIGHTS_API_KEY:-}" ]; then
  echo ">> Ensuring postman-insights-namespace exists"
  kubectl create namespace postman-insights-namespace \
    --dry-run=client -o yaml | kubectl apply -f -

  echo ">> Creating/updating postman-agent-secrets"
  kubectl -n postman-insights-namespace create secret generic postman-agent-secrets \
    --from-literal=postman-api-key="$POSTMAN_INSIGHTS_API_KEY" \
    --dry-run=client -o yaml | kubectl apply -f -

  echo ">> Applying Postman Insights DaemonSet"
  kubectl apply -f "$K8S_DIR/postman-insights-agent-daemonset.yaml"
else
  echo ">> POSTMAN_INSIGHTS_API_KEY not set — skipping Insights agent (see docs/DEPLOY-EKS.md)"
fi

echo ">> Waiting for rollout"
kubectl -n postair rollout status deployment/postair-weather-api --timeout=180s

echo ">> Waiting for LoadBalancer hostname (may take a minute)"
LB=""
for _ in $(seq 1 30); do
  LB="$(kubectl -n postair get svc postair-weather-api -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
  [ -n "$LB" ] && break
  sleep 10
done

if [ -n "$LB" ]; then
  echo ">> Done. Endpoint: http://$LB"
  echo "   Health:   curl http://$LB/health"
  echo "   Airports: curl -H \"x-api-key: \$WEATHER_API_KEY\" http://$LB/v1/weather/airports"
else
  echo ">> Deployed, but the LoadBalancer hostname isn't ready yet."
  echo "   Check: kubectl -n postair get svc postair-weather-api"
fi
