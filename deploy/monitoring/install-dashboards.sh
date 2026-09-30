#!/usr/bin/env bash
# Publishes dashboards/*.json as ConfigMaps labelled grafana_dashboard=1 in the
# monitoring namespace; the Grafana sidecar picks them up within ~a minute.
# Re-run after editing a dashboard JSON. Idempotent.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/kube-prometheus-stack/dashboards"
for f in *.json; do
  name="grafana-dashboard-${f%.json}"
  kubectl -n monitoring create configmap "$name" --from-file="$f" --dry-run=client -o yaml \
    | kubectl label --local -f - grafana_dashboard=1 -o yaml \
    | kubectl apply -f -
done
