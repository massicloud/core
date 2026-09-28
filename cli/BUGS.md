# Known issues

Bugs surfaced during testing that are tracked but not yet fixed, with enough
detail to pick up and fix later.

## Fixed

### fetchAppliedMigrations mis-cast positional rows as objects — fixed, critical

- **Symptom:** every downstream comparison against `AppliedMigration`
  fields (`.version`, `.checksum`, ...) silently read `undefined`, so
  local files showed as `pending` while the server's own rows rendered as
  `MISSING`/`(unknown)`, and `migrate down` failed with "Server has
  applied migration(s) with no local file" listing an empty version.
- **Cause:** the `/query` endpoint returns result sets like a raw Postgres
  client would — `{ columns: string[], rows: unknown[][] }`, each row a
  *positional* array aligned with `columns` — not an array of `{version,
  name, ...}` objects. `lib/state.ts`'s `fetchAppliedMigrations` did
  `(result.rows ?? []) as AppliedMigration[]`, an `as` cast that lied to
  the compiler: at runtime each element stayed `["v1", "n1", ...]`, so
  `applied.version` was `undefined` everywhere it was read.
- **This is almost certainly the real root cause behind the "single-stage
  status crash" and "version key mismatch" reports above** — both were
  reported from testing against the real API, never reproduced against
  this session's own mocks, because every mock in this repo (built on the
  same wrong assumption as the code) returned rows as objects, masking
  the exact bug those reports were describing.
- **Fix:** `lib/state.ts`'s `fetchAppliedMigrations` now zips `columns`
  against each positional row into an object. `lib/client.ts`'s response
  type (renamed `QuerySuccess` → `QueryResponse`) now declares
  `rows?: unknown[][]` and `columns?: string[]` instead of the vaguer
  shape that let the bad cast go unnoticed.
- **Also fixed:** every test in this repo that faked a `/query` SELECT
  response (`tests/report.test.ts`, `tests/status.test.ts`,
  `tests/up-down.test.ts`) was returning object rows and has been
  corrected to return `columns` + positional `rows`, so this class of bug
  can't hide behind the test suite again.
- Regression tests: `tests/state.test.ts` ("zips columns and positional
  rows into AppliedMigration objects", "zips multiple rows
  independently", "returns an empty array when there are no applied
  migrations").

### status/verify crash on unprovisioned stages — fixed in v0.1.2

- **Symptom:** `Request error (404): no stage named X in this project`,
  uncaught, killing the whole command.
- **Cause:** `lib/report.ts`'s `fetchAppliedByStage()` (shared by
  `migrate status` and `migrate check-orphans`) and `verify.ts`'s
  per-(stage, db) loop called the `/query` endpoint for every configured
  stage with no error handling; a stage that isn't provisioned yet 404s,
  and that propagated as an uncaught `NotFoundError`.
- **Fix:** `fetchAppliedByStage` now catches `NotFoundError` per stage and
  records it as `null` (vs. an empty `Map` for "provisioned, nothing
  applied"); `buildDbStatusReport` renders that stage's cell as `—`
  (distinct from `pending`/`✓`/`MISSING`/`MISMATCH`); `buildOrphanReport`
  treats it as "not applied there"; `verify.ts` prints
  `[stage/db] NOT PROVISIONED — skipped` and moves on. None of these count
  as divergence (exit 0) — not being provisioned yet is a normal
  deployment state, not corruption.
- Regression tests: `tests/report.test.ts` ("marks an unprovisioned stage
  as not_provisioned...", "treats an unprovisioned stage as 'not applied
  there'..."), `tests/status.test.ts` ("renders NOT PROVISIONED ('—')...").

### status crash on single-stage config ("Cannot read properties of undefined (reading 'length')") — investigated twice, not reproduced; hardened regardless

- **Reported repro:** config with `stages: ["production"]`, then
  `massicloud migrate status --db main`.
- **Investigated (twice, across two rounds of this report):** tried the
  literal repro plus variants — empty migrations dir, with migrations,
  with an already-applied migration, 2 databases × 1 stage, single stage
  entirely unprovisioned (combined with the bug above), and a full
  command-level test (`tests/status.test.ts`, not just the `lib/report.ts`
  data layer) exercising `runStatus` → `buildDbStatusReport` →
  `printReport` → `logger.table` end to end. None crash against current
  source.
- **Hardened anyway:** `lib/logger.ts`'s `table()` previously computed
  column widths from `rows[0].length` and indexed `row[col].length`
  unconditionally — a row shorter than the header would have hit exactly
  this error. It now treats a missing cell as `''` and sizes columns from
  the widest row present, so this failure mode can't happen regardless of
  what upstream code produced the ragged row. Covered by
  `tests/logger.test.ts`.
- **If this recurs:** paste the exact `massicloud.config.json` and full
  stack trace (not just the message) — the stack trace is the only way to
  find a call site this investigation hasn't already ruled out.

### version key mismatch between `migrate up` and `migrate down`/`status`/`verify` — fixed

- **Symptom:** right after a successful `migrate up`, `migrate down`
  reported `Server has applied migration(s) with no local file:` with an
  empty version in the message.
- **Fix:** `lib/migrations.ts`'s `parseFilename()` (the single place that
  derives `version` from a filename, used by `loadMigrations`,
  `createMigrationFile`, and therefore by every command) now uses the
  full filename without its `.sql` extension as the version — e.g.
  `20260928110519_001_create_cli_test_table` instead of just
  `20260928110519_001`. This is the value `up` stores in
  `massicloud.migrations.version` and the value every other command
  compares against, so there's exactly one derivation, used everywhere.
  `nextSequence()` still finds the right sequence number since it reads
  `version.split('_')[1]`, which is stable regardless of how many
  underscores the name itself has (timestamps are pure digits, so the
  second `_`-delimited token is always the sequence). State table schema
  and file naming format are unchanged — only what string goes into the
  `version` column.
- Regression test: `tests/up-down.test.ts` — `migrate up` then
  `migrate down` on the same file, asserting the exact stored version
  string and that `down` finds and removes it.

## Open

### URL validator doesn't detect unexpanded shell variables

- **Found in:** v0.1.1
- **Example:** a value like `https://api.massicloud.work/v1/$SLUG` passes
  all checks in `validateUrl()` (`src/commands/init.ts`) — valid scheme,
  no `{curly braces}` — but `$SLUG` is an unexpanded shell variable, not a
  real URL segment.
- **Impact:** users copy-pasting a URL from docs/tutorials that use `$VAR`
  style placeholders (as opposed to the `{slug}`-style placeholder already
  guarded against) will get the literal `$VAR` string stored in
  `massicloud.config.json`, then hit confusing errors later.
- **Fix:** add a check to `validateUrl()` for
  `/\$\{?[A-Z_][A-Z0-9_]*\}?/` to catch both `$VAR` and `${VAR}` patterns
  and reject with a message like `URL contains an unexpanded shell
  variable — paste the real value`.
- **Priority:** low — worth catching before v1.0, but no user has hit this
  in practice yet.
