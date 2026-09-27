-- Baseline seed data, for reference and for manually re-seeding the test
-- project from the portal's SQL Console.
--
-- The test suite itself does NOT run this file — it has no way to run raw
-- SQL against the project (see fixtures/schema.sql for why). Instead
-- helpers/admin.ts reproduces this same baseline over REST via the service
-- key, using the row data in helpers/seed-data.ts, and resets it before each
-- test file. Keep the two in sync if you change one.

TRUNCATE TABLE orders, customers, products RESTART IDENTITY CASCADE;

INSERT INTO customers (name, email, country) VALUES
  ('Amine Kessar',  'amine@example.dz',  'DZ'),
  ('Sarah Belkacem', 'sarah@example.dz', 'DZ'),
  ('John Doe',      'john@example.com', 'US');

INSERT INTO products (name, price_dzd, stock) VALUES
  ('Widget',    1500.00, 100),
  ('Gadget',    4200.50, 40),
  ('Gizmo',     999.99,  0);

INSERT INTO orders (customer_id, product_id, quantity, total_dzd, status) VALUES
  (1, 1, 2, 3000.00,  'pending'),
  (1, 2, 1, 4200.50,  'shipped'),
  (2, 3, 3, 2999.97,  'cancelled');
