-- Schema for the MassiCloud integration test project.
--
-- Run this ONCE, manually, in the target test project's SQL Console in the
-- portal (Database > SQL Editor) — NOT by the test suite itself. The anon
-- and service API keys the suite runs with only reach the project through
-- PostgREST (proxied by the MassiCloud API), and PostgREST has no DDL
-- endpoint: it only ever does CRUD against tables that already exist. There
-- is also no direct network path to the tenant Postgres from outside the
-- cluster (see docs/concepts/projects-databases.md). So schema setup is a
-- one-time manual step per test project; everything the suite does at test
-- time is plain REST reads/writes via @massicloud/client, handled by
-- helpers/admin.ts.

DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS internal_audit CASCADE;

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  country TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price_dzd NUMERIC(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  total_dzd NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON orders(customer_id);
CREATE INDEX ON orders(status);

GRANT ALL ON customers, products, orders TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- service_role gets table DML on new tables automatically (see the
-- ALTER DEFAULT PRIVILEGES ... TO service_role set up when the "auth"
-- schema was initialized on this database — see README "Setup"), but that
-- only covers TABLES, not SEQUENCES. Without this, helpers/admin.ts
-- inserting seed rows as service_role would fail with "permission denied
-- for sequence customers_id_seq" on every SERIAL column.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Extra table used only by sdk/crud.test.ts's "RLS blocked" case. It is not
-- part of the customers/products/orders example above — RLS is enabled with
-- zero policies for anon, so anon SELECTs come back empty and anon INSERTs
-- are rejected with a row-level-security error (42501), while service_role
-- (which bypasses RLS) can use it freely. That's the only way to exercise a
-- genuine RLS-denied response with this fixture set, since the three main
-- tables above are deliberately wide open to anon.
CREATE TABLE internal_audit (
  id SERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE internal_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON internal_audit TO anon;
GRANT USAGE, SELECT ON SEQUENCE internal_audit_id_seq TO anon;
-- (No policy is created for anon — RLS with no matching policy denies by
-- default. service_role bypasses RLS entirely, so it still needs no policy.)

NOTIFY pgrst, 'reload schema';
