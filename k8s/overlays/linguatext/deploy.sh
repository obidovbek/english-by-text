#!/bin/bash

set -euo pipefail

MODE="${1:-quick}"
NAMESPACE=linguatext

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Required command not found: $1" >&2
    exit 1
  fi
}

import_image_to_k3s() {
  local image="$1"
  if command -v k3s >/dev/null 2>&1; then
    echo "📥 Importing $image into k3s..."
    docker save "$image" | k3s ctr images import - >/dev/null
  fi
}

build_backend() {
  echo "🚀 Building backend images..."
  (
    cd ./application/backend
    docker build -t linguatext-backend:latest --target production .
    docker build -t linguatext-backend:migrator --target migrator .
    import_image_to_k3s "linguatext-backend:latest"
    import_image_to_k3s "linguatext-backend:migrator"
  )
}

build_frontend() {
  echo "🚀 Building frontend image..."
  (
    cd ./application/frontend/
    docker build --target production -t linguatext-frontend:latest .
    import_image_to_k3s "linguatext-frontend:latest"
  )
}

apply_manifests() {
  echo "📦 Applying K8s manifests..."
  (
    cd ./k8s/overlays/linguatext/
    kubectl apply -k .
  )
}

restart_rollouts() {
  echo "🔁 Restarting deployments..."
  kubectl rollout restart deployment/linguatext-backend -n "$NAMESPACE" || true
  kubectl rollout restart deployment/linguatext-frontend -n "$NAMESPACE" || true
  echo "⏳ Waiting for rollouts to complete..."
  kubectl rollout status deployment/linguatext-backend -n "$NAMESPACE" --timeout=180s || true
  kubectl rollout status deployment/linguatext-frontend -n "$NAMESPACE" --timeout=180s || true
}

full_reset() {
  echo "🧹 Resetting namespace..."
  kubectl delete namespace "$NAMESPACE" --ignore-not-found || true
  kubectl create namespace "$NAMESPACE"
  echo "🧹 Resetting PersistentVolume..."
  kubectl patch pv postgres-pv-linguatext -p '{"spec":{"claimRef": null}}' || true
}

usage() {
  cat <<EOF
Usage: $0 [quick|full|images|backend|frontend|rollout|apply]

Modes:
  quick     Build images (in parallel), apply manifests, rollout restart (default)
  full      Reset namespace and PV, then build (in parallel) and apply
  images    Only build images (in parallel), no kubectl actions
  backend   Build backend only, apply manifests, rollout restart
  frontend  Build frontend only, apply manifests, rollout restart
  rollout   Only rollout-restart deployments and wait for readiness
  apply     Only apply manifests (no builds or restarts)
EOF
}

require_cmd docker
require_cmd kubectl

case "$MODE" in
  full)
    full_reset
    build_backend &
    build_frontend &
    wait
    apply_manifests
    ;;
  quick|fast)
    build_backend &
    build_frontend &
    wait
    apply_manifests
    restart_rollouts
    ;;
  images)
    build_backend &
    build_frontend &
    wait
    ;;
  backend)
    build_backend
    apply_manifests
    restart_rollouts
    ;;
  frontend)
    build_frontend
    apply_manifests
    restart_rollouts
    ;;
  rollout)
    restart_rollouts
    ;;
  apply)
    apply_manifests
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "❌ Unknown mode: $MODE" >&2
    usage
    exit 1
    ;;
endcase

echo "✅ Done."