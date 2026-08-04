export interface StarterQuery {
  id: string
  title: string
  description: string
  sql: string
  needsStatStatements?: boolean
}

export interface StarterCategory {
  id: "common" | "performance" | "security" | "maintenance"
  label: string
  description: string
  queries: StarterQuery[]
}

export const STARTER_CATEGORIES: StarterCategory[] = [
  // ─────────── COMMON ───────────
  {
    id: "common",
    label: "Common",
    description: "Everyday queries to inspect your database.",
    queries: [
      {
        id: "list-tables",
        title: "List all tables",
        description: "Every table in the public schema.",
        sql: `-- All tables in the public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;`,
      },
      {
        id: "show-columns",
        title: "Show columns of a table",
        description: 'Replace "users" with your table name.',
        sql: `-- Columns of a specific table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;`,
      },
      {
        id: "recent-rows",
        title: "Recent rows from a table",
        description: "Last 20 rows from a table.",
        sql: `-- Most recent rows (assumes 'id' is sortable)
SELECT * FROM users
ORDER BY id DESC
LIMIT 20;`,
      },
      {
        id: "row-counts",
        title: "Count rows per table",
        description: "Approximate row count for every table.",
        sql: `-- Approximate row count per table (fast, uses statistics)
SELECT
  schemaname, relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;`,
      },
      {
        id: "database-size",
        title: "Database size",
        description: "Total disk size of this database.",
        sql: `-- Database size, formatted
SELECT
  pg_database.datname AS database,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = current_database();`,
      },
      {
        id: "extensions",
        title: "List installed extensions",
        description: "Postgres extensions enabled in this database.",
        sql: `-- Installed extensions
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;`,
      },
    ],
  },

  // ─────────── PERFORMANCE ───────────
  {
    id: "performance",
    label: "Performance",
    description: "Find slow queries, missing indexes, and other bottlenecks.",
    queries: [
      {
        id: "fk-without-index",
        title: "Foreign keys without indexes",
        description:
          "A FK column without an index can make joins slow. This is one of the most common performance issues.",
        sql: `-- Foreign key columns missing an index.
-- Each row is a potential performance problem.
SELECT
  c.conrelid::regclass    AS table_name,
  a.attname               AS column_name,
  c.confrelid::regclass   AS references_table
FROM pg_constraint c
JOIN pg_attribute a
  ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY(i.indkey)
  )
ORDER BY c.conrelid::regclass::text;`,
      },
      {
        id: "largest-tables",
        title: "Largest tables by disk size",
        description: "Tables sorted by total size including indexes and toast.",
        sql: `-- Largest tables (total size including indexes)
SELECT
  schemaname || '.' || relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid))       AS table_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;`,
      },
      {
        id: "seq-vs-index",
        title: "Sequential scans vs index scans",
        description: "High seq_scan / low idx_scan ratio means missing indexes.",
        sql: `-- For each table: how often it's read sequentially vs via index.
-- High seq_scan with low idx_scan = missing index candidate.
SELECT
  schemaname || '.' || relname AS table,
  seq_scan,
  idx_scan,
  CASE WHEN seq_scan + idx_scan = 0 THEN 0
       ELSE round(100.0 * idx_scan / (seq_scan + idx_scan), 1)
  END AS pct_index_usage,
  n_live_tup AS approx_rows
FROM pg_stat_user_tables
ORDER BY seq_scan DESC
LIMIT 20;`,
      },
      {
        id: "cache-hit-ratio",
        title: "Cache hit ratio",
        description: "Should be above 99% for a healthy database.",
        sql: `-- Buffer cache effectiveness.
-- A ratio below 99% means Postgres is going to disk too often.
SELECT
  sum(heap_blks_hit)                    AS heap_hit,
  sum(heap_blks_read)                   AS heap_read,
  CASE WHEN sum(heap_blks_hit) + sum(heap_blks_read) = 0 THEN 0
       ELSE round(
         100.0 * sum(heap_blks_hit) /
         (sum(heap_blks_hit) + sum(heap_blks_read)),
         2)
  END AS cache_hit_pct
FROM pg_statio_user_tables;`,
      },
      {
        id: "unused-indexes",
        title: "Unused indexes",
        description: "Indexes that have never been used. Candidates for removal.",
        sql: `-- Indexes that pg_stat says have never been scanned.
-- These cost disk and write performance for no benefit.
-- Wait at least a few days of real traffic before removing.
SELECT
  schemaname || '.' || relname AS table,
  indexrelname                  AS unused_index,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;`,
      },
      {
        id: "slow-queries",
        title: "Slowest queries",
        description:
          "Queries with the highest total runtime. May error if extension not enabled.",
        needsStatStatements: true,
        sql: `-- Slowest queries by total time spent.
-- Requires the pg_stat_statements extension:
--   CREATE EXTENSION pg_stat_statements;
SELECT
  substring(query, 1, 80)         AS query_preview,
  calls,
  round(total_exec_time::numeric, 0) AS total_ms,
  round((total_exec_time / calls)::numeric, 1) AS avg_ms,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;`,
      },
      {
        id: "most-frequent-queries",
        title: "Most frequently run queries",
        description: "Queries called most often. Optimizing these has the biggest impact.",
        needsStatStatements: true,
        sql: `-- Queries called most often.
-- Optimizing these gives the highest total payoff.
SELECT
  substring(query, 1, 80)            AS query_preview,
  calls,
  round((total_exec_time / calls)::numeric, 1) AS avg_ms,
  round(total_exec_time::numeric, 0)           AS total_ms
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;`,
      },
    ],
  },

  // ─────────── SECURITY ───────────
  {
    id: "security",
    label: "Security",
    description: "Audit RLS policies, role permissions, and access patterns.",
    queries: [
      {
        id: "rls-status",
        title: "RLS status of every table",
        description: "Which tables have RLS enabled, and which are exposed.",
        sql: `-- RLS status of every public table.
-- "rls_enabled = false" means the table is wide open to anyone
-- with the project's anon key.
SELECT
  schemaname || '.' || tablename AS table,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;`,
      },
      {
        id: "all-policies",
        title: "All RLS policies",
        description: "Every policy in this database.",
        sql: `-- Every RLS policy and what it allows.
SELECT
  schemaname || '.' || tablename AS table,
  policyname,
  permissive,
  roles,
  cmd        AS for_command,
  qual       AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
ORDER BY schemaname, tablename, policyname;`,
      },
      {
        id: "tables-no-policies",
        title: "Tables with RLS but no policies",
        description: "These tables block ALL access (except service_role).",
        sql: `-- Tables with RLS on but no policies.
-- Result: nothing can read or write them except service_role.
-- Usually NOT what you want.
SELECT
  t.schemaname || '.' || t.tablename AS table,
  t.rowsecurity AS rls_enabled
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename
  )
ORDER BY t.tablename;`,
      },
      {
        id: "roles-and-grants",
        title: "Roles and grants on public schema",
        description: "Which roles can do what on which tables.",
        sql: `-- Privilege grants on public tables.
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ') AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;`,
      },
      {
        id: "auth-users-count",
        title: "Count of end-users",
        description: "How many end-users have signed up.",
        sql: `-- Number of end-users registered against this database.
SELECT count(*) AS user_count,
       count(*) FILTER (WHERE last_sign_in_at IS NOT NULL) AS users_who_logged_in
FROM auth.users;`,
      },
    ],
  },

  // ─────────── MAINTENANCE ───────────
  {
    id: "maintenance",
    label: "Maintenance",
    description: "Vacuum status, dead tuples, and other housekeeping.",
    queries: [
      {
        id: "vacuum-status",
        title: "Vacuum status per table",
        description: "When each table was last vacuumed and analyzed.",
        sql: `-- Last vacuum / analyze times per table.
-- Anything older than a few days for a write-heavy table
-- is worth investigating.
SELECT
  schemaname || '.' || relname AS table,
  n_live_tup,
  n_dead_tup,
  CASE WHEN n_live_tup + n_dead_tup = 0 THEN 0
       ELSE round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 1)
  END AS dead_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;`,
      },
      {
        id: "bloated-tables",
        title: "Tables with most dead tuples",
        description: "High dead-tuple count = vacuum overdue, slower scans.",
        sql: `-- Tables ranked by dead tuple count.
-- Run VACUUM ANALYZE <table>; on top offenders.
SELECT
  schemaname || '.' || relname AS table,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  CASE WHEN n_live_tup + n_dead_tup = 0 THEN 0
       ELSE round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 1)
  END AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 20;`,
      },
      {
        id: "active-queries",
        title: "Currently running queries",
        description: "What is happening RIGHT NOW on the database.",
        sql: `-- All currently active queries.
SELECT
  pid,
  usename                    AS user,
  state,
  now() - query_start        AS duration,
  substring(query, 1, 100)   AS query
FROM pg_stat_activity
WHERE state != 'idle'
  AND pid != pg_backend_pid()
ORDER BY duration DESC;`,
      },
      {
        id: "long-transactions",
        title: "Long-running transactions",
        description: "Open transactions older than 5 minutes block vacuum and lock rows.",
        sql: `-- Transactions held open for more than 5 minutes.
-- These can block VACUUM and create lock contention.
SELECT
  pid,
  usename,
  state,
  now() - xact_start AS transaction_age,
  substring(query, 1, 100) AS last_query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
  AND now() - xact_start > interval '5 minutes'
ORDER BY xact_start;`,
      },
      {
        id: "lock-waits",
        title: "Queries waiting on locks",
        description: "Queries currently blocked by another query.",
        sql: `-- Queries blocked by locks.
-- The "blocked_by" pid is the one holding the lock.
SELECT
  blocked.pid              AS blocked_pid,
  blocked.usename          AS blocked_user,
  blocking.pid             AS blocked_by,
  blocking.usename         AS blocker_user,
  substring(blocked.query, 1, 60)  AS blocked_query,
  substring(blocking.query, 1, 60) AS blocker_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid));`,
      },
      {
        id: "index-bloat",
        title: "Largest indexes",
        description: "Indexes ranked by size. Useful when planning REINDEX.",
        sql: `-- Largest indexes by disk size.
SELECT
  schemaname || '.' || relname AS table,
  indexrelname                  AS index,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size,
  idx_scan                      AS times_used
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;`,
      },
    ],
  },
]
