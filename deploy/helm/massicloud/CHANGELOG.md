# Chart changelog

## 2026-09-30 — Values file convention: QA vs Algeria

There are two environments: **QA** (Contabo k3s, massicloud.work — where
every deploy goes today) and **Live Algeria** (future, no provider yet).
`values.yaml` is the QA config. `values-live.yaml` was renamed
`values-qa-secrets.yaml` (gitignored; secrets only). The committed
`values-production-algeria.yaml` became the placeholder `values-algeria.yaml`.
QA deploy:

```
helm upgrade --install massicloud ./deploy/helm/massicloud -n massicloud-system \
  -f ./deploy/helm/massicloud/values.yaml \
  -f ./deploy/helm/massicloud/values-qa-secrets.yaml
```

Do not deploy with `values.yaml` alone against the running cluster: its
committed secrets differ from the deployed ones (see values-qa-secrets.yaml).

## 2026-09-30 — Platform password reset (Resend email)

New endpoints `POST /auth/reset-password` and `POST /auth/reset-password/confirm`
for platform (portal) users, plus portal pages `/forgot-password` and `/reset`.
The API auto-creates the `platform_password_reset_tokens` table on startup.
New chart values: `email.from`, `email.portalURL`; new Secret template
`resend-creds`.

Operator must create resend-creds secret with actual API key before password reset works: kubectl create secret generic resend-creds --from-literal=api-key=<key>

(That command only works if the chart hasn't created the placeholder yet. If
`helm upgrade` already created it, `create` fails with AlreadyExists — use
`kubectl create secret generic resend-creds --from-literal=api-key=<key>
--dry-run=client -o yaml -n massicloud-system | kubectl apply -f -` instead,
then `kubectl -n massicloud-system rollout restart deploy/api`. The template
preserves a populated key across later upgrades.)

## 2026-09-29 — Platform Redis added (rate limiting)

The API now rate-limits every end-user endpoint (per API key, token
bucket) via a Redis-backed limiter with an in-memory fallback — see
`api/internal/ratelimit` and `BUGS.md`/task notes for the design. This adds
a new always-on platform service, `platform-redis` (`templates/platform-
redis.yaml`): a single-instance `redis:7-alpine` StatefulSet with a 1Gi PVC
and password auth, matching this chart's existing `platform-postgres` /
`minio` pattern (plain manifests, no subchart dependency).

**Nothing in this chart is a breaking change** — `REDIS_URL` is optional
from the API's point of view (`internal/config`); if the Secret or Service
were somehow missing, the API falls back to in-memory-only rate limiting
per pod (see `internal/ratelimit.Hybrid`) rather than failing to start.
Deploying `platform-redis` is what makes rate limits shared across API
replicas instead of independent per pod.

### To deploy

Same install/upgrade command as any other chart change — no new steps,
no separate release:

```
helm upgrade --install massicloud ./deploy/helm/massicloud \
  --namespace massicloud-system \
  --values ./deploy/helm/massicloud/values.yaml \
  --values ./deploy/helm/massicloud/values-qa-secrets.yaml
```

(Live Algeria doesn't exist yet; its future command is documented at the top
of `values-algeria.yaml`.)

This creates `platform-redis-creds` (Secret), `platform-redis` (Service +
StatefulSet + PVC) alongside the existing platform services, and adds
`platform-redis-creds` to the API Deployment's `envFrom` — no manual wiring
needed beyond the usual `helm upgrade`.

### New values

Both `values.yaml` (QA default) and `values-qa-secrets.yaml` (gitignored,
real secrets for the QA cluster, formerly `values-live.yaml`) got a new `redis:`
block:

```yaml
redis:
  password: "..."   # committed here for values.yaml/values-live.yaml, same
                     # convention as platformPostgres.password and
                     # minio.rootPassword; values-algeria.yaml is
                     # placeholder-only
  storage: 1Gi
  resources: { ... }
```

Verified with `helm lint` and `helm template` (both pass) — not deployed
from this session; that's on the operator.
