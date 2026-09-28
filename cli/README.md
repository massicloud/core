# @massicloud/cli

A migration runner for [MassiCloud](https://massicloud.work) — scoped to
the platform's `/query` endpoint, similar in spirit to `dbmate`.

## Install

```sh
npm install -g @massicloud/cli
```

## Quick start

```sh
massicloud init
massicloud migrate new create_users
massicloud migrate up --stage development
massicloud migrate status
```

## Model: one set of migration files, many (stage, db) targets

The same `*.sql` migration files are shared across every stage — a
migration is a single piece of SQL that gets *promoted* from
`development` → `staging` → `production` as you apply it to each in
turn. What's applied where is tracked independently per (stage,
database) pair, in a `massicloud.migrations` table that lives in that
stage's own tenant Postgres instance.

A project can also have more than one **database** — most projects have
just `main`, but you can add others (e.g. `analytics`), each with its
own `migrations_dir` and its own independent migration history across
the same stages.

## Config

`massicloud.config.json` at your project root:

```json
{
  "url": "https://api.massicloud.work/v1/{slug}",
  "service_key": "${MASSICLOUD_SERVICE_KEY}",
  "stages": ["development", "staging", "production"],
  "databases": {
    "main": {
      "migrations_dir": "./migrations"
    }
  }
}
```

- `stages` is an ordered list (used as the column order in `migrate
  status`); it doesn't need to match your MassiCloud project's full
  stage list, just the ones you want this CLI to manage.
- `databases` is a map — most projects need only `"main"`. Add more
  entries (e.g. `"analytics"`) for premium multi-db projects; each gets
  its own `migrations_dir`.

`service_key` supports `${ENV_VAR}` interpolation so you don't have to
commit real keys. `url` and `service_key` can also be overridden by an
environment variable, which always wins over the config file:

| Field         | Env var                  |
|---------------|---------------------------|
| `url`         | `MASSICLOUD_URL`          |
| `service_key` | `MASSICLOUD_SERVICE_KEY`  |

Every command accepts `--config <path>` to use a config file other than
`./massicloud.config.json`.

### Migrating an existing single-stage config

The pre-multi-stage shape (`{ "stage", "db", "migrations_dir" }`) still
loads — the CLI adapts it into `{ stages: [stage], databases: { [db]:
{ migrations_dir } } }` and prints a deprecation warning. Run
`massicloud init` again (or edit the file by hand) to move to the new
shape; support for the legacy shape may be removed in a future version.

## `--stage` and `--db`

Config no longer carries a single default stage/db — every command that
targets a specific database instance takes `--stage`/`--db` explicitly
(or `MASSICLOUD_STAGE`/`MASSICLOUD_DB` as env fallbacks):

| Command                    | `--stage`                        | `--db`                                   |
|----------------------------|-----------------------------------|-------------------------------------------|
| `migrate new <name>`       | n/a (files aren't stage-specific) | defaults to the sole configured db, else required |
| `migrate up`               | required                          | defaults to the sole configured db, else required |
| `migrate down`             | required                          | defaults to the sole configured db, else required |
| `migrate status`           | n/a (shows every stage as a column) | defaults to **all** configured dbs   |
| `migrate verify`           | defaults to **all** configured stages | defaults to **all** configured dbs |
| `migrate check-orphans`    | n/a (checks every stage per file) | defaults to **all** configured dbs   |

## Migration files

`<migrations_dir>/YYYYMMDDHHMMSS_NNN_name.sql`, created via
`massicloud migrate new <name> [--db <db>]`:

```sql
-- +migrate Up
CREATE TABLE users (id SERIAL PRIMARY KEY);

-- +migrate Down
DROP TABLE users;
```

`NNN` auto-increments from the highest sequence number already present in
that database's `migrations_dir`. SQL runs exactly as written — the CLI
does not wrap statements in a transaction, so multi-statement DDL that
needs atomicity must handle that itself.

## State

Applied migrations are tracked per (stage, db) in `massicloud.migrations`
in that stage's tenant Postgres, created automatically on first run:

```sql
CREATE SCHEMA IF NOT EXISTS massicloud;
CREATE TABLE IF NOT EXISTS massicloud.migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER NOT NULL,
  checksum TEXT NOT NULL
);
```

## Commands

- `massicloud init` — interactively create `massicloud.config.json`
  (prompts for stages, an initial db name, and its `migrations_dir`).
- `massicloud migrate new <name> [--db <db>]` — generate a new migration
  file.
- `massicloud migrate up --stage <stage> [--db <db>] [--to <version>]` —
  apply pending migrations to one (stage, db) target.
- `massicloud migrate down --stage <stage> [--db <db>] [--to <version>]`
  — rollback the most recent migration on that target, or everything
  after `--to` (exclusive).
- `massicloud migrate status [--db <db>]` — one table per database, one
  row per migration version, one column per stage.
- `massicloud migrate verify [--stage <stage>] [--db <db>]` — exit
  non-zero on divergence anywhere in the selected (stage, db) targets;
  for CI.
- `massicloud migrate check-orphans [--db <db>]` — for each local
  migration file, list whether it's still applied in any stage.

### The promotion workflow

```sh
massicloud migrate new add_orders_index
# edit the file, then:
massicloud migrate up --stage development
# ...test it...
massicloud migrate up --stage staging
# ...test it there too...
massicloud migrate up --stage production
massicloud migrate status   # confirm all three columns show ✓
```

### The experimental workflow

Try something on `development`, decide against it, and clean up without
leaving a stray file around:

```sh
massicloud migrate new try_new_column
massicloud migrate up --stage development
# ...didn't like it...
massicloud migrate down --stage development
massicloud migrate check-orphans   # confirms it's not applied anywhere else
rm migrations/<the file>.sql
```

`check-orphans` prints two lists:

```
Safe to delete (not applied anywhere):
  - 20260927150000_004_try_new_column.sql

In use (applied in at least one stage):
  - 20260927120000_001_users.sql (development, staging, production)
  - 20260927140000_003_index.sql (development)
```

Only delete a file once it shows up under "safe to delete" — if it's
"in use", some stage still has it applied and deleting the file would
turn that stage's row into `MISSING` in `migrate status`.

### Divergence: `MISSING` and `MISMATCH`

Before applying or rolling back anything, `up`/`down`/`verify` check
that every migration a target's server has recorded as applied still:

1. has a local file (otherwise the cell/row is `MISSING` — the file was
   deleted locally after being applied there), and
2. has a SHA256 checksum matching what was recorded when it was applied
   (otherwise `MISMATCH` — the local file was edited after being
   applied).

Both are treated as fatal for `up`/`down` on the affected target, and as
a non-zero exit for `status`/`verify`. Fix the divergence (restore the
missing/edited file, or accept the drift and update
`massicloud.migrations` by hand if the change was intentional) before
continuing.

### A configured stage that isn't provisioned yet

If `stages` names a stage that hasn't actually been provisioned in the
project (e.g. `staging` is on the roadmap but doesn't exist yet),
`migrate status` shows `—` in that stage's column — distinct from
`pending` (provisioned, migration not applied) and `✓` (applied). This is
not treated as divergence: `migrate verify` prints a one-line notice
(`[stage/db] NOT PROVISIONED — skipped`) for that (stage, db) pair and
does not fail because of it.

## Development

```sh
npm install
npm test
npm run typecheck
npm run build
```
