import type { StarterCategory } from "./starter-queries"

// MySQL quick-start queries. Table names default to "users" (created by the
// users_basic preset) — same convention as the Postgres starter queries.
export const MYSQL_STARTER_CATEGORIES: StarterCategory[] = [
  {
    id: "common",
    label: "Common",
    description: "Everyday queries to inspect your database.",
    queries: [
      {
        id: "show-tables",
        title: "List all tables",
        description: "Every table in this database.",
        sql: "SHOW TABLES;",
      },
      {
        id: "describe-users",
        title: "Describe a table",
        description: 'Replace "users" with your table name.',
        sql: "DESCRIBE users;",
      },
      {
        id: "select-users",
        title: "Preview rows",
        description: "First 20 rows of a table.",
        sql: "SELECT * FROM users LIMIT 20;",
      },
      {
        id: "count-users",
        title: "Count rows",
        description: "Row count for a table.",
        sql: "SELECT COUNT(*) FROM users;",
      },
      {
        id: "version",
        title: "Server version",
        sql: "SELECT VERSION();",
        description: "MySQL server version string.",
      },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    description: "Inspect indexes, query plans, and server activity.",
    queries: [
      {
        id: "show-index",
        title: "Show indexes",
        description: 'Replace "users" with your table name.',
        sql: "SHOW INDEX FROM users;",
      },
      {
        id: "explain",
        title: "Query plan",
        description: "EXPLAIN a filtered SELECT.",
        sql: "EXPLAIN SELECT * FROM users WHERE email = 'someone@example.com';",
      },
      {
        id: "innodb-status",
        title: "InnoDB engine status",
        description: "Deep engine internals — deadlocks, buffer pool, etc.",
        sql: "SHOW ENGINE INNODB STATUS;",
      },
      {
        id: "processlist",
        title: "Active connections",
        description: "Currently running queries and connections.",
        sql: "SHOW PROCESSLIST;",
      },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    description: "Table upkeep and replication log inspection.",
    queries: [
      {
        id: "optimize",
        title: "Optimize table",
        description: 'Replace "users" with your table name.',
        sql: "OPTIMIZE TABLE users;",
      },
      {
        id: "analyze",
        title: "Analyze table",
        description: "Refreshes index cardinality statistics.",
        sql: "ANALYZE TABLE users;",
      },
      {
        id: "check",
        title: "Check table",
        description: "Checks a table for errors.",
        sql: "CHECK TABLE users;",
      },
      {
        id: "binlogs",
        title: "Show binary logs",
        description: "Replication/point-in-time-recovery logs.",
        sql: "SHOW BINARY LOGS;",
      },
    ],
  },
]
