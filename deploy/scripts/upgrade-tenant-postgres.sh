#!/usr/bin/env bash
# Retrofits every existing tenant Postgres StatefulSet with the postgres_exporter
# sidecar and pg_stat_statements (new tenants get both from the API, 0.3.7+).
#
# Per tenant Postgres StatefulSet (label component=postgres in a tenant-* namespace):
#   1. skip if it already has the pg-exporter container (safe to re-run)
#   2. apply the allow-prometheus-scrape NetworkPolicy (tenant namespaces deny
#      ingress from `monitoring` otherwise)
#   3. strategic-merge patch: add pg-exporter sidecar, add the pg_stat_statements
#      server args, ensure component=postgres + prometheus.io annotations
#   4. wait for the rollout   (THIS RESTARTS the tenant's Postgres pod: brief downtime)
#   5. CREATE EXTENSION pg_stat_statements in template1 and every database
#   6. port-forward the exporter and check `pg_up 1`
#
# Usage: upgrade-tenant-postgres.sh [--dry-run] [--tenant <project-id>] [--skip-extension]
#
# Keep the container spec / NetworkPolicy in sync with
# api/internal/k8s/postgres.go and policies.go.
set -uo pipefail

EXPORTER_IMAGE="quay.io/prometheuscommunity/postgres-exporter:v0.15.0"
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-300s}"
LOCAL_PORT="${LOCAL_PORT:-19187}"   # local end of the port-forward (remote is 9187)

DRY_RUN=0
ONLY_TENANT=""
SKIP_EXT=0

usage() { sed -n '2,/^set -uo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --skip-extension) SKIP_EXT=1 ;;
    --tenant)
      [ $# -ge 2 ] || { echo "--tenant needs a project id" >&2; exit 2; }
      ONLY_TENANT="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

command -v kubectl >/dev/null || { echo "kubectl not found" >&2; exit 2; }
command -v curl >/dev/null || { echo "curl not found" >&2; exit 2; }

log() { printf '%s\n' "$*"; }

netpol_yaml() {
  cat <<YAML
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-prometheus-scrape
  namespace: $1
spec:
  podSelector:
    matchLabels:
      component: postgres
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - protocol: TCP
          port: 9187
YAML
}

patch_json() {
  local sts="$1"
  cat <<JSON
{"spec":{"template":{
  "metadata":{
    "labels":{"component":"postgres"},
    "annotations":{"prometheus.io/scrape":"true","prometheus.io/port":"9187"}},
  "spec":{
    "containers":[
      {"name":"postgres","args":["-c","shared_preload_libraries=pg_stat_statements","-c","pg_stat_statements.max=10000","-c","pg_stat_statements.track=all"]},
      {"name":"pg-exporter","image":"$EXPORTER_IMAGE",
       "args":["--collector.stat_statements"],
       "ports":[{"name":"metrics","containerPort":9187}],
       "env":[
         {"name":"POSTGRES_PASSWORD","valueFrom":{"secretKeyRef":{"name":"${sts}-creds","key":"POSTGRES_PASSWORD"}}},
         {"name":"DATA_SOURCE_NAME","value":"postgresql://postgres:\$(POSTGRES_PASSWORD)@localhost:5432/postgres?sslmode=disable"}],
       "resources":{"requests":{"cpu":"10m","memory":"20Mi"},"limits":{"cpu":"100m","memory":"100Mi"}},
       "livenessProbe":{"httpGet":{"path":"/metrics","port":9187},"initialDelaySeconds":15,"periodSeconds":30,"timeoutSeconds":5},
       "readinessProbe":{"httpGet":{"path":"/metrics","port":9187},"initialDelaySeconds":5,"periodSeconds":10,"timeoutSeconds":5}}]}}}}
JSON
}

FAILED=()
UPGRADED=0
SKIPPED=0

fail() { # fail <ns/sts> <reason>
  log "  FAILED: $2"
  FAILED+=("$1: $2")
}

create_extensions() {
  local ns="$1" pod="$2" dbs db
  dbs="$(kubectl -n "$ns" exec "$pod" -c postgres -- psql -U postgres -At \
    -c "SELECT datname FROM pg_database WHERE NOT datistemplate AND datallowconn")" || return 1
  # template1 too, so databases created later inherit the extension.
  for db in template1 $dbs; do
    kubectl -n "$ns" exec "$pod" -c postgres -- psql -U postgres -d "$db" -v ON_ERROR_STOP=1 \
      -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements" >/dev/null || return 1
    log "    extension ensured in $db"
  done
}

verify_exporter() {
  local ns="$1" pod="$2" pf_pid i out=""
  kubectl -n "$ns" port-forward "pod/$pod" "$LOCAL_PORT:9187" >/dev/null 2>&1 &
  pf_pid=$!
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    out="$(curl -fsS --max-time 5 "http://localhost:$LOCAL_PORT/metrics" 2>/dev/null | grep '^pg_up ')" && break
    out=""
  done
  kill "$pf_pid" 2>/dev/null || true
  wait "$pf_pid" 2>/dev/null || true
  [ "$out" = "pg_up 1" ] || { log "    exporter reported: '${out:-no response}'"; return 1; }
}

upgrade_sts() {
  local ns="$1" sts="$2" id="$ns/$sts" containers pod="$2-0"

  log "-- $id"
  containers="$(kubectl -n "$ns" get statefulset "$sts" -o jsonpath='{.spec.template.spec.containers[*].name}')" \
    || { fail "$id" "cannot read statefulset"; return; }
  case " $containers " in
    *" pg-exporter "*) log "  already has pg-exporter, skipping"; SKIPPED=$((SKIPPED+1)); return ;;
  esac

  log "  current pods:"
  kubectl -n "$ns" get pods -l "app=$sts" --no-headers 2>&1 | sed 's/^/    /'

  if [ "$DRY_RUN" -eq 1 ]; then
    log "  [dry-run] apply NetworkPolicy allow-prometheus-scrape in $ns"
    log "  [dry-run] kubectl -n $ns patch statefulset $sts --type strategic -p '$(patch_json "$sts" | tr -d '\n ')'"
    log "  [dry-run] kubectl -n $ns rollout status statefulset/$sts --timeout=$ROLLOUT_TIMEOUT"
    [ "$SKIP_EXT" -eq 1 ] || log "  [dry-run] CREATE EXTENSION IF NOT EXISTS pg_stat_statements in template1 + every database of $pod"
    log "  [dry-run] port-forward $pod $LOCAL_PORT:9187 and expect 'pg_up 1'"
    return
  fi

  netpol_yaml "$ns" | kubectl apply -f - >/dev/null || { fail "$id" "applying NetworkPolicy"; return; }

  patch_json "$sts" | kubectl -n "$ns" patch statefulset "$sts" --type strategic --patch-file /dev/stdin >/dev/null \
    || { fail "$id" "patching statefulset"; return; }
  log "  patched; waiting for rollout (Postgres restarts)..."
  kubectl -n "$ns" rollout status "statefulset/$sts" --timeout="$ROLLOUT_TIMEOUT" \
    || { fail "$id" "rollout did not finish within $ROLLOUT_TIMEOUT"; return; }

  if [ "$SKIP_EXT" -eq 0 ]; then
    create_extensions "$ns" "$pod" || { fail "$id" "CREATE EXTENSION pg_stat_statements"; return; }
  else
    log "  --skip-extension: not creating pg_stat_statements"
  fi

  verify_exporter "$ns" "$pod" || { fail "$id" "exporter did not report pg_up 1"; return; }
  log "  OK (pg_up 1)"
  UPGRADED=$((UPGRADED+1))
}

if [ -n "$ONLY_TENANT" ]; then
  NAMESPACES="tenant-$ONLY_TENANT"
  kubectl get namespace "$NAMESPACES" >/dev/null 2>&1 || { echo "namespace $NAMESPACES not found" >&2; exit 2; }
else
  NAMESPACES="$(kubectl get namespaces -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | grep '^tenant-' || true)"
fi
[ -n "$NAMESPACES" ] || { echo "no tenant-* namespaces found (wrong cluster? kubectl config current-context: $(kubectl config current-context))"; exit 0; }

log "cluster: $(kubectl config current-context)"
if [ "$DRY_RUN" -eq 0 ]; then
  log "WARNING: each tenant's Postgres pod will restart (brief downtime). Ctrl-C within 5s to abort."
  sleep 5
fi

for ns in $NAMESPACES; do
  stss="$(kubectl -n "$ns" get statefulset -l component=postgres -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null)"
  if [ -z "$stss" ]; then log "-- $ns: no postgres statefulset"; continue; fi
  for sts in $stss; do upgrade_sts "$ns" "$sts"; done
done

log
log "== summary: $UPGRADED upgraded, $SKIPPED already upgraded, ${#FAILED[@]} failed"
if [ "${#FAILED[@]}" -gt 0 ]; then
  printf '   - %s\n' "${FAILED[@]}"
  exit 1
fi
