#!/bin/bash

set -e  # Exit on error

NAMESPACE=englishbytext

echo "🧹 Resetting namespace..."
kubectl delete namespace ${NAMESPACE} --ignore-not-found
kubectl create namespace ${NAMESPACE}

echo "🧹 Resetting PersistentVolume..."
kubectl patch pv postgres-pv-englishbytext -p '{"spec":{"claimRef": null}}' || true

echo "🚀 Building backend..."
cd ./application/backend
# Build production image
docker build -t englishbytext-backend:latest --target production .
# Load into k3s containerd if applicable
if command -v k3s >/dev/null 2>&1; then
  docker save englishbytext-backend:latest -o englishbytext-backend.tar
  k3s ctr images import englishbytext-backend.tar
fi

echo "🚀 Building frontend..."
cd ../frontend/
docker build --target production -t englishbytext-frontend:latest .
if command -v k3s >/dev/null 2>&1; then
  docker save englishbytext-frontend:latest -o englishbytext-frontend.tar
  k3s ctr images import englishbytext-frontend.tar
fi

echo "📦 Applying K8s manifests..."
cd ../../k8s/overlays/englishbytext/
kubectl apply -k .

echo "✅ Done."

#kubectl get pods -n fstu
#kubectl exec -it -n fstu <pod-name> -- sh
#kubectl exec -it -n fstu <pod-name> -- bash
#kubectl logs -f <pod-name> -n fstu