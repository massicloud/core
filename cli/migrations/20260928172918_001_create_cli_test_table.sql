-- +migrate Up
CREATE TABLE cli_test (
  id SERIAL PRIMARY KEY,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON cli_test TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- +migrate Down
DROP TABLE cli_test;
