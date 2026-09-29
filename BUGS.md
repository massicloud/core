# Known issues

Bugs surfaced during testing that are tracked but not yet fixed, with enough
detail to pick up and fix later. This file covers the platform (`api/`,
`massicloud-js/`, `tests/`) — `@massicloud/cli`'s own bug log is at
`cli/BUGS.md`.

## Open

### Password reset's session invalidation is a no-op (end-user tokens are stateless JWTs)

- **Found in:** implementing password reset (2026-09-28), specifically
  `ConfirmPasswordReset`'s `DELETE FROM auth.sessions WHERE user_id = $1`
  step in `api/internal/handlers/project_auth.go`.
- **Symptom:** after a password reset, an access token issued *before* the
  reset keeps authenticating requests until it naturally expires (up to
  `projectauth.AccessTokenTTL`). There's no way to force-invalidate it.
- **Cause:** end-user access tokens are stateless JWTs —
  `middleware.RequireEndUserToken` only verifies the signature against
  `project.JWTSigningSecret` and never looks anything up in the database.
  `auth.sessions` is provisioned in the schema
  (`api/internal/initschemas/sql/auth.sql`) but nothing — not signup, not
  login, not refresh — has ever written a row into it. Deleting from it on
  password reset is therefore real SQL against a real table, but it deletes
  zero rows and has no effect on whether the old token still works.
- **Impact:** low-to-medium — a stolen/leaked access token survives a
  password reset that a user would reasonably expect to invalidate it,
  though the blast radius is capped at the token's own TTL.
- **Suggested fix:** either (a) add a `token_version` (or
  `password_changed_at`) column on `auth.users`, embed it as a JWT claim at
  issuance, and check it in `RequireEndUserToken` on every request, or (b)
  build out real server-side session storage and check `auth.sessions` in
  that same middleware. Either is a change to the shared token-verification
  path used by every authenticated end-user route (storage, REST proxy,
  etc.), not just auth — bigger than a single bug fix, so it's logged here
  rather than folded into the password-reset work.
- **Test impact:** `tests/sdk/auth.test.ts`'s "Auth: password reset" describe
  block has `it.skip("after reset, the old access_token no longer works")`
  with a comment pointing here, rather than asserting something false.
- **Priority:** medium.

## Fixed

### No platform-wide rate limiting on end-user endpoints — added 2026-09-29

- **What shipped:** every end-user (project API key gated) endpoint under
  `/v1/{slug}/...` is now rate-limited per API key via a token bucket in
  three categories — reads 300 req/sec, writes 100 req/sec, auth 10
  req/sec (same limits for anon and service keys). New package
  `api/internal/ratelimit`: `bucket.go` (pure token-bucket math, unit
  tested), `redis.go` (Redis-backed, atomic via an embedded Lua script),
  `memory.go` (`sync.Map` fallback), `limiter.go` (`Hybrid`: tries Redis,
  falls through to in-memory on error or a 50ms timeout, logs a throttled
  WARN). Middleware: `middleware.RequireCategory` in
  `api/internal/middleware/ratelimit.go`, wired onto every reads/writes/auth
  route in `api/main.go`. A 429 carries `Retry-After`,
  `X-RateLimit-Limit`, `X-RateLimit-Category` headers and a structured
  body (`{"error": "rate_limit_exceeded", "category", "retry_after_seconds"}`).
- **Deploy:** needs a new `platform-redis` service
  (`deploy/helm/massicloud/templates/platform-redis.yaml` + `redis:` block
  in values files) — see that chart's `CHANGELOG.md` for the exact command.
  `REDIS_URL` is optional; without it (or if Redis is unreachable at
  runtime) the API runs the in-memory fallback per pod rather than
  refusing to start or letting requests through unchecked.
- **Superseded by this:** the ad-hoc `/query` limiter
  (`middleware.RateLimitPerProject`, 10 req/min per project) and password
  reset's own `resetRequestLimiter` (3/hour per email) — both removed; see
  the strikethrough note on the password-reset entry below.
- Regression tests: `tests/sdk/ratelimit.test.ts` (reads/writes/auth
  category limits, cross-category and cross-key independence, the 429
  response shape, and confirming the old 3/hour reset-password cap is
  gone) — not yet run against a live deployment; requires the API
  redeploy this change depends on.
- Unit tests: `api/internal/ratelimit/bucket_test.go` (refill math,
  take/deny, retry-after) — pure, no I/O, run with `go test`.

### Duplicate end-user signup race: SELECT-then-INSERT wasn't atomic — 500 instead of 409 — fixed 2026-09-28

- **Symptom:** two concurrent `auth.signUp()` calls for the same email
  correctly left exactly one user created and one call failing, but the
  loser got `500 Internal Server Error` with a raw Postgres error message
  in the body, instead of a clean `409 Conflict`.
- **Cause:** `SignUpEndUser` did a `SELECT id FROM auth.users WHERE email =
  $1` existence check, then (only if that found nothing) an `INSERT`.
  Between those two statements there was no lock, so two concurrent
  requests for the same email could both pass the SELECT; the second
  `INSERT` then hit `auth.users`' `UNIQUE(email)` constraint and the
  handler's generic error path turned that into a 500 that also leaked the
  raw Postgres error text to the client.
- **Fix:** `api/internal/handlers/project_auth.go`'s `SignUpEndUser` no
  longer pre-checks; it inserts directly and a new `isPgUniqueViolation(err)`
  helper (checks for Postgres SQLSTATE `23505`) turns a unique-constraint
  violation into a clean `409` with a structured body
  (`{"error": "email already registered", "code": "email_taken"}`) instead
  of the generic 500 path.
- Regression test: `tests/sdk/auth.test.ts` — "rejects duplicate email with
  a clean 409 and structured error" (sequential) and "racing signups for
  the same email: exactly one succeeds, the other gets a clean 409"
  (concurrent, `Promise.all`).

### End-user signup email validation only checked for "@" — fixed 2026-09-28

- **Symptom:** `auth.signUp({ email: "malformed-<ts>@", password: ... })`
  (and similar: `a@`, `@b`, `a@b`) succeeded and created a user, even with
  no domain or TLD.
- **Cause:** `SignUpEndUser` validated email with
  `!strings.Contains(req.Email, "@")` — any string containing an `@`
  anywhere passed.
- **Fix:** `SignUpEndUser` now uses a new `isValidEmail(email)` helper:
  `net/mail.ParseAddress` for RFC 5322 syntax, plus an explicit check that
  the domain part contains a `.` — `net/mail` alone isn't sufficient since
  it doesn't require a TLD (`mail.ParseAddress("test@nodomain")` parses
  without error). SDK side (`massicloud-js/src/auth/index.ts`) also
  pre-checks client-side in `signUp()` with
  `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` before ever hitting the network, per the
  task spec, and the same regex now guards `requestPasswordReset()` too.
- Regression test: `tests/sdk/auth.test.ts` — `it.each` over
  `["not-an-email", "test@", "test@nodomain", "@example.com", "test
  @example.com"]` in "Auth: signUp".

### Password reset was not implemented end-to-end — fixed 2026-09-28

- **What shipped:**
  - API: `POST /v1/{slug}/{stage}/db/{db}/auth/reset-password` (looks up
    the email, generates a 32-byte random token, stores its SHA-256 hash in
    `auth.password_reset_tokens.token` with a 1-hour expiry, and returns
    the *raw* token plus a `note` marking that TEMPORARY — see below) and
    `POST .../auth/reset-password/confirm` (atomically validates-and-
    consumes the token via a single `UPDATE ... RETURNING user_id`, so two
    concurrent confirms for the same token can't both succeed — same
    atomicity fix as the signup race above — then updates
    `auth.users.encrypted_password` and best-effort clears
    `auth.sessions`). Both in `api/internal/handlers/project_auth.go`,
    routed in `api/main.go`.
  - ~~Rate limiting: `resetRequestLimiter` (same file) caps `reset-password`
    requests at 3 per hour per `(project, email)`~~ — **superseded
    2026-09-29** by the platform-wide rate limiter (`internal/ratelimit`,
    see its own Fixed entry below): `resetRequestLimiter` was removed, and
    `reset-password`/`reset-password/confirm` now share the generic 10
    req/sec "auth" category per API key with every other auth endpoint,
    same as everything else under `/v1/{slug}`.
  - Anti-enumeration: the endpoint returns the identical 200 response shape
    for a registered and an unregistered email, differing only in whether
    `reset_token` is present.
  - SDK: `AuthClient.requestPasswordReset(email)` and
    `AuthClient.confirmPasswordReset({ token, new_password })`
    (`massicloud-js/src/auth/index.ts`), returning
    `MassiResponse<PasswordResetResult>` /
    `MassiResponse<PasswordResetConfirmResult>` (new types in
    `massicloud-js/src/types.ts`). SDK version bumped to 0.5.0.
  - **Explicitly deferred (separate follow-up, not part of this fix):**
    email delivery. `reset_token` rides directly in the API response until
    that lands — flagged with a `note` field and loud code comments at both
    call sites so it isn't mistaken for the final design.
  - **Known limitation, not fixed here:** password reset does not actually
    invalidate already-issued access tokens — see the new Open item above.
- Regression tests: `tests/sdk/auth.test.ts`'s "Auth: password reset"
  describe block (request for existing/non-existent user, confirm with
  valid/expired/already-used/unknown token, confirm's own password
  validation, sign-in with the new password after reset, and the 4th-
  request rate-limit check). The expired-token case backdates a row via the
  service-key `/query` admin endpoint since there's no other way to mint an
  already-expired token in this suite.
