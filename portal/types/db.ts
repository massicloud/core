export interface Table {
  name: string
  row_count: number
  size_bytes: number
  comment: string
}

export interface Column {
  name: string
  type: string
  length: number | null
  nullable: boolean
  default: string | null
  is_primary_key: boolean
  is_unique: boolean
}

export interface Index {
  name: string
  type: string
  columns: string[]
  unique: boolean
  primary: boolean
  size_bytes: number
}

export interface ForeignKey {
  name: string
  column: string
  referenced_table: string
  referenced_column: string
  on_delete: string
  on_update: string
}

export interface Filter {
  column: string
  operator:
    | "eq"
    | "neq"
    | "contains"
    | "starts_with"
    | "ends_with"
    | "is_null"
    | "is_not_null"
    | "gt"
    | "lt"
    | "gte"
    | "lte"
  value: string
}

export interface ColumnDefinition {
  name: string
  type: string
  length?: number
  nullable: boolean
  default?: string
  is_primary_key?: boolean
  is_unique?: boolean
}

export interface CreateTableRequest {
  name: string
  comment?: string
  columns: ColumnDefinition[]
  foreign_keys?: { column: string; referenced_table: string; referenced_column: string; on_delete: string; on_update: string }[]
  rls_enabled?: boolean
}

export interface IndexDefinition {
  name: string
  columns: string[]
  type: "btree" | "hash" | "gin" | "gist" | "brin"
  unique: boolean
  concurrent: boolean
}

export interface ForeignKeyDefinition {
  column: string
  referenced_table: string
  referenced_column: string
  on_delete: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION"
  on_update: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION"
}

export interface QueryParams {
  limit: number
  offset: number
  sort?: string
  order?: "asc" | "desc"
  filters?: Filter[]
}

export interface RowsResult {
  rows: Record<string, unknown>[]
  total: number
}

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  row_count: number
  execution_time_ms: number
  error?: string
}

export interface ConnectionStatus {
  connected: boolean
  version: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: string
}

export interface ColumnChange {
  name: string
  current: ColumnInfo
  incoming: ColumnInfo
}

export interface TableDiff {
  added_columns: ColumnInfo[]
  removed_columns: ColumnInfo[]
  changed_columns: ColumnChange[]
}

export interface ImportTable {
  name: string
  status: 'new' | 'same' | 'conflict'
  has_data: boolean
  row_count: number
  diff?: TableDiff
  ddl: string
}

export interface ImportAnalysis {
  tables: ImportTable[]
  errors: string[]
}

export interface AnalyzeResponse {
  session_id: string
  expires_at: string
  analysis: ImportAnalysis
}

export interface ImportDecision {
  table_name: string
  action: 'create' | 'skip' | 'replace' | 'merge'
  include_data: boolean
}

export interface ApplyResult {
  successful: string[]
  failed: Array<{ table_name: string; error: string }>
  total_rows_imported: number
}

export interface TableColumn {
  name: string
  type: string
  is_primary_key: boolean
}

export interface TableWithColumns {
  schema: string
  name: string
  columns: TableColumn[]
}

export interface TableSecurity {
  table_name: string
  rls_enabled: boolean
  policy_count: number
}

