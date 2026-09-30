# MassiCloud monitoring (QA cluster)

Prometheus + Grafana + Alertmanager (kube-prometheus-stack) and Loki + Promtail,
in the `monitoring` namespace. A **separate release** from the `massicloud`
chart — upgrade either independently. Tier 1 + 2 coverage only (no tracing,
no SLO dashboards). Targets the single-node Contabo k3s QA cluster; Live
Algeria will need its own copies of the values files.

```
deploy/monitoring/
  kube-prometheus-stack/
    values.yaml            retention 2d, 5Gi PVC, Grafana ingress, Alertmanager -> Resend SMTP
    alerts.yaml            PrometheusRule (9 alerts + tenant namespace->slug recording rule)
    scrape-targets.yaml    ServiceMonitors/PodMonitors: MinIO, exporters, tenant PG, Traefik, cert-manager
    dashboards/*.json      Platform Health, Tenant Overview, API Detail
  loki/
    values.yaml            Loki single-binary, 2d retention, 5Gi PVC
    promtail-values.yaml   log shipper (see "Promtail is deprecated" below)
  exporters/exporters.yaml postgres_exporter + redis_exporter for the platform services
  install-dashboards.sh    loads dashboards/*.json into Grafana as labelled ConfigMaps
```

## Install (operator)

Make sure `kubectl` points at the **QA (Contabo) cluster** first:
`kubectl config current-context`.

1. **DNS (Cloudflare, manual):** add `grafana.massicloud.work` as a CNAME/A to
   the same target as `app.massicloud.work` (the Traefik entry point).

2. **Namespace + secrets**
   ```bash
   kubectl create namespace monitoring

   # Grafana admin (chart reads both keys). Do not commit the password.
   kubectl create secret generic grafana-admin -n monitoring \
     --from-literal=admin-user=admin \
     --from-literal=admin-password="$(openssl rand -base64 24)"
   #   read it back later: kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d

   # Resend key for Alertmanager. A Secret can't be mounted across namespaces,
   # so copy the existing resend-creds (same key the API uses) into monitoring:
   kubectl get secret resend-creds -n massicloud-system -o json \
     | jq 'del(.metadata.namespace,.metadata.resourceVersion,.metadata.uid,.metadata.creationTimestamp,.metadata.ownerReferences,.metadata.annotations,.metadata.labels,.metadata.managedFields)' \
     | kubectl apply -n monitoring -f -
   # Re-run this if the key is rotated.

   # MinIO scrape token (MinIO requires auth on /minio/v2/metrics):
   #   mc alias set qa http://<minio-host>:9000 <root-user> <root-password>
   #   mc admin prometheus generate qa cluster     # prints a bearer token
   kubectl create secret generic minio-prometheus-token -n monitoring \
     --from-literal=token=<token-from-mc>
   ```

3. **Helm repos**
   ```bash
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm repo add grafana https://grafana.github.io/helm-charts
   helm repo update
   ```

4. **kube-prometheus-stack**
   ```bash
   helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
     -n monitoring -f deploy/monitoring/kube-prometheus-stack/values.yaml
   ```

5. **Loki + Promtail** (the Grafana Loki datasource is already declared in step 4)
   ```bash
   helm upgrade --install loki grafana/loki -n monitoring -f deploy/monitoring/loki/values.yaml
   helm upgrade --install promtail grafana/promtail -n monitoring -f deploy/monitoring/loki/promtail-values.yaml
   ```

6. **Scrape targets, alerts, exporters, dashboards** (after the CRDs exist)
   ```bash
   kubectl apply -f deploy/monitoring/exporters/exporters.yaml            # namespace massicloud-system
   kubectl apply -f deploy/monitoring/kube-prometheus-stack/scrape-targets.yaml
   kubectl apply -f deploy/monitoring/kube-prometheus-stack/alerts.yaml
   ./deploy/monitoring/install-dashboards.sh
   ```

7. **Verify**
   ```bash
   kubectl -n monitoring get pods                     # all Running/Ready
   kubectl -n monitoring get pvc                      # prometheus 5Gi, alertmanager 1Gi, grafana 1Gi, loki 5Gi
   kubectl -n monitoring port-forward svc/kube-prometheus-stack-prometheus 9090
   #   http://localhost:9090/targets  -> massicloud-api, minio, redis, platform-postgres, traefik, cert-manager UP
   ```

8. **Use it:** https://grafana.massicloud.work (user `admin`, password from the
   `grafana-admin` Secret). Dashboards: *Platform Health*, *Tenant Overview*,
   *API Detail*. Logs: Explore -> Loki -> `{namespace="massicloud-system", app="massicloud-api"}`.

The API must be running a build that includes the metrics change (it serves
`/metrics` on `METRICS_PORT`, default 9090; nothing exposes that port outside
the cluster). Test alert email: `kubectl -n massicloud-system scale deploy/massicloud-api --replicas=0`,
wait ~3 minutes (2m `for` + 30s `group_wait`), then scale back.

## Tenant Postgres sidecar rollout (existing tenants)

Run this after the API 0.3.7 deploy, against the QA cluster (check
`kubectl config current-context` first). It patches each tenant Postgres
StatefulSet, **which restarts that tenant's Postgres pod** (brief downtime per
tenant), creates `pg_stat_statements`, and checks the exporter reports `pg_up 1`.
Safe to re-run; tenants that already have the sidecar are skipped.

```bash
./deploy/scripts/upgrade-tenant-postgres.sh --dry-run     # preview, changes nothing
./deploy/scripts/upgrade-tenant-postgres.sh               # all tenants
./deploy/scripts/upgrade-tenant-postgres.sh --tenant <project-id>   # just one
#   --skip-extension   skip CREATE EXTENSION (do it manually per database)
```

Then in Grafana: *Tenant Overview* should show per-tenant connections, size and
transactions/sec, and *API Detail -> Slowest queries* fills in once queries run.

## Things to know

- **API scrape uses `additionalScrapeConfigs`, not a ServiceMonitor.** The API
  Deployment doesn't declare the metrics containerPort and the massicloud chart
  is deliberately untouched, so Prometheus scrapes pod IP `:9090` for pods with
  label `app=massicloud-api` in `massicloud-system` (job `massicloud-api`).
- **Tenant Postgres sidecar.** New tenant Postgres instances get a
  `postgres_exporter` sidecar (port `metrics`/9187), `pg_stat_statements`, and a
  `allow-prometheus-scrape` NetworkPolicy automatically from **API 0.3.7+**. The
  `tenant-postgres` PodMonitor picks them up (label `component=postgres`).
  **Existing tenants need a separate one-time rollout** (see below); until it
  runs, their per-tenant Postgres panels stay empty.
- **Tenant-to-slug mapping.** Tenant namespaces are `tenant-{project-id}`; the
  API exports `massicloud_project_info{project_id,project_slug}` and
  `massicloud_bucket_info{bucket,project_slug}`, and the recording rule
  `massicloud:project_namespace_info` joins them onto namespaces. Loki gets
  `project_id` only (slug isn't derivable from the namespace name).
- **Promtail is deprecated** (chart is flagged `deprecated: true`; Grafana's
  replacement is Alloy). Used because it was specified; it still works. Migrating
  to Alloy later only touches `loki/promtail-values.yaml`.
- **Disk sizing:** Prometheus 2d retention capped at 3GB on a 5Gi PVC; Loki
  48h on 5Gi. Revisit once you see real ingest (`kubectl -n monitoring exec ... df -h`).
- **k3s specifics:** controller-manager / scheduler / proxy / etcd scraping is
  disabled (k3s doesn't expose them like kubeadm), otherwise their `*Down`
  alerts would fire permanently. Traefik's `metrics` port name and cert-manager's
  `http-metrics` port name are the standard ones but weren't verified against
  the live cluster; check `/targets` after installing.
- **Alerts** go to `tester1@massidigits.com` via `smtp.resend.com:465`
  (`smtp_auth_password_file` reads the mounted Secret at
  `/etc/alertmanager/secrets/resend-creds/api-key`). `Watchdog`/`InfoInhibitor`
  are routed to a null receiver so they don't email every 12h. Change the
  recipient in `values.yaml` under `alertmanager.config.receivers`.
- `pg_stat_statements` ("slowest queries") is empty unless that extension is
  installed and the exporter is started with `--collector.stat_statements`.
