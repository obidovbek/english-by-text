#!/bin/bash

set -e  # Exit on error

NAMESPACE=linguatext

echo "🧹 Resetting namespace..."
kubectl delete namespace ${NAMESPACE} --ignore-not-found || true
kubectl create namespace ${NAMESPACE}

echo "🧹 Resetting PersistentVolume..."
kubectl patch pv postgres-pv-linguatext -p '{"spec":{"claimRef": null}}' || true

echo "🚀 Building backend..."
cd ./application/backend
# Build production and migrator images
docker build -t linguatext-backend:latest --target production .
docker build -t linguatext-backend:migrator --target migrator .
# Load into k3s containerd if applicable
if command -v k3s >/dev/null 2>&1; then
  docker save linguatext-backend:latest -o linguatext-backend.tar
  docker save linguatext-backend:migrator -o linguatext-backend-migrator.tar
  k3s ctr images import linguatext-backend.tar
  k3s ctr images import linguatext-backend-migrator.tar
fi

echo "🚀 Building frontend..."
cd ../frontend/
docker build --target production -t linguatext-frontend:latest .
if command -v k3s >/dev/null 2>&1; then
  docker save linguatext-frontend:latest -o linguatext-frontend.tar
  k3s ctr images import linguatext-frontend.tar
fi

echo "📦 Applying K8s manifests..."
cd ../../k8s/overlays/linguatext/
kubectl apply -k .

echo "✅ Done."

#kubectl get pods -n fstu
#kubectl exec -it -n fstu <pod-name> -- sh
#kubectl exec -it -n fstu <pod-name> -- bash
#kubectl logs -f <pod-name> -n fstu