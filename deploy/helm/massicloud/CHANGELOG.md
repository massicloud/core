# Chart changelog

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
  --values ./deploy/helm/massicloud/values-live.yaml
```

(Algeria production: swap in `values-production-algeria.yaml` +
`values-production-algeria-live.yaml`, per the command already documented
at the top of `values-production-algeria.yaml`.)

This creates `platform-redis-creds` (Secret), `platform-redis` (Service +
StatefulSet + PVC) alongside the existing platform services, and adds
`platform-redis-creds` to the API Deployment's `envFrom` — no manual wiring
needed beyond the usual `helm upgrade`.

### New values

Both `values.yaml` (dev/test default) and `values-live.yaml` (gitignored,
real secret for the massicloud.work test environment) got a new `redis:`
block:

```yaml
redis:
  password: "..."   # committed here for values.yaml/values-live.yaml, same
                     # convention as platformPostgres.password and
                     # minio.rootPassword; values-production-algeria.yaml's
                     # copy is a REPLACE_WITH_STRONG_PASSWORD placeholder
  storage: 1Gi
  resources: { ... }
```

Verified with `helm lint` and `helm template` (both pass) — not deployed
from this session; that's on the operator.
