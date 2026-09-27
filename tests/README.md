# MassiCloud integration tests

Integration tests for `@massicloud/client`, run against a real MassiCloud
tenant over the network (no mocking). Uses [Vitest](https://vitest.dev).

## Setup

These tests read and rewrite three tables in a real project's database, so
**use a dedicated test project, never one holding real data.**

1. **Create a test project** in the [MassiCloud portal](https://app.massicloud.work).
2. **Initialize the `auth` schema** on its database (Overview tab → "Add
   MassiCloud schemas" → check `auth`), even though these tests don't touch
   `auth.users`. This is what creates the `anon` / `service_role` Postgres
   roles and their default privileges — without it, the `GRANT`s in
   `fixtures/schema.sql` have no role to grant to, and every REST call from
   this suite fails with a Postgres role error, not a permissions one.
3. **Run `fixtures/schema.sql`** in that project's SQL Console (Database →
   SQL Editor). This creates `customers`, `products`, `orders`, and one
   extra `internal_audit` table used only by the RLS-blocked test — see the
   comments in that file for why.
4. **Get your keys**: project Settings → API Keys, for the anon and service
   keys. `MASSICLOUD_URL` is the project base URL shown there.
5. **Copy the env file** and fill it in:
   ```
   cp .env.test.example .env.test
   ```
6. `npm install`

## Running

```
npm test          # run everything once
npm run test:watch
npm run test:sdk   # just sdk/
npm run reset      # restore customers/products/orders to the seed baseline without running tests
npm run typecheck
```

A global setup step (`helpers/setup.ts`) checks the project is reachable and
that the schema exists before any test runs, so a missing/misconfigured
project fails once with one clear message instead of as forty confusing
"relation does not exist" test failures.

Suites run against one shared Postgres instance and reset the same tables,
so they run file-by-file rather than in parallel workers (see
`vitest.config.ts`) — otherwise two suites resetting `customers` at once
would clobber each other's fixtures mid-test.

## Structure

```
fixtures/
  schema.sql      One-time DDL — run manually in the portal (see Setup #3).
  seed.sql        Reference/manual copy of the baseline data. The suite
                  itself uses helpers/seed-data.ts instead — see below.
helpers/
  client.ts       makeAnonClient() / makeServiceClient(), reading .env.test.
  seed-data.ts    The baseline dataset, as plain objects.
  admin.ts        Resets customers/products/orders (and internal_audit) to
                  that baseline over REST, using the service key.
  setup.ts        Vitest global setup; re-exports resetSeed for test files.
  reset-schema.ts The `npm run reset` script.
  random.ts       Unique emails so rapid runs don't collide on UNIQUE email.
sdk/
  crud.test.ts          Insert / select / update / delete, plus error handling.
  filters.test.ts       eq, neq, gt, gte, lt, lte, in, is, like, ilike.
  ordering.test.ts      order, limit, offset, range, column selection.
  joins.test.ts         Resource embedding (PostgREST's `select=col,rel(cols)`).
  mutations.test.ts     Bulk insert, delete-with-filter, upsert.
  aggregations.test.ts  Count queries, including exact count via head: true.
```

### Why `admin.ts` doesn't run raw SQL

The original plan for `helpers/admin.ts` was "direct psql via the service
key" for setup/teardown. That doesn't match how MassiCloud actually exposes
Postgres:

- The service key only ever reaches the project through PostgREST (proxied
  by the MassiCloud API's `/v1/{slug}/{stage}/db/{db}/rest/*`), and
  PostgREST has no SQL/DDL endpoint — it's REST-over-existing-tables only.
- The tenant Postgres itself has no network path from outside the cluster
  (same reason Redis/Mongo connection strings are documented as
  cluster-internal-only in this release).

So schema setup (`fixtures/schema.sql`) is a one-time manual step (Setup
above), and all runtime resets go through `@massicloud/client` as
`service_role`, which bypasses RLS but still talks REST like any other key.

## What these tests do NOT cover yet

- **Auth flows** (sign up, sign in, sessions, `auth.uid()` in RLS) — separate
  suite later.
- **Provisioning** (creating projects/databases/stages) — platform-level,
  different suite.
- **Portal UI** — Playwright suite later.

`@massicloud/client` needs to be on `^0.4.0` for `mutations.test.ts`'s
upsert tests and `aggregations.test.ts`'s exact-count test to work — both
were added to the SDK in 0.4.0 (previously `.skip`ped here as client gaps).
`upsert`'s `onConflict` column also needs a real unique/exclusion
constraint in Postgres; `customers.email` already has one
(`fixtures/schema.sql`).
