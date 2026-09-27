import { AxiosError } from "axios"
import { api, getApiBaseUrl } from "./api"
import { getToken } from "./auth"
import {
  AnalyzeResponse,
  ApplyResult,
  Column,
  ColumnDefinition,
  ConnectionStatus,
  CreateTableRequest,
  ForeignKey,
  ForeignKeyDefinition,
  ImportDecision,
  Index,
  TableWithColumns,
  IndexDefinition,
  QueryParams,
  QueryResult,
  RowsResult,
  Table,
  TableSecurity,
} from "@/types/db"

// Helper to extract error message
function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.error || error.response?.data?.message || error.message || "API error"
  }
  return "An unexpected error occurred"
}

// ============ CONNECTION ============

export async function testConnection(
  instanceId: string
): Promise<ConnectionStatus> {
  try {
    const response = await api.get(`/postgres/${instanceId}/connection`)
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// Tells PostgREST to reload its schema cache. Normally not needed — DDL
// operations run through this app already trigger a reload — but useful as
// a manual fallback (e.g. after DDL run directly against the database).
export async function reloadSchemaCache(instanceId: string): Promise<void> {
  try {
    await api.post(`/postgres/${instanceId}/reload-schema`)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ TABLES ============

export async function getTables(instanceId: string, schema = "public"): Promise<Table[]> {
  try {
    const response = await api.get(`/postgres/${instanceId}/schema/tables`, { params: { schema } })
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function createTable(
  instanceId: string,
  definition: CreateTableRequest,
  schema = "public"
): Promise<void> {
  try {
    await api.post(`/postgres/${instanceId}/schema/tables`, definition, { params: { schema } })
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function dropTable(
  instanceId: string,
  table: string,
  schema = "public"
): Promise<void> {
  try {
    await api.delete(`/postgres/${instanceId}/schema/tables/${table}`, { params: { schema } })
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function truncateTable(
  instanceId: string,
  table: string,
  schema = "public"
): Promise<void> {
  try {
    await api.post(`/postgres/${instanceId}/schema/tables/${table}/truncate`, null, { params: { schema } })
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ COLUMNS ============

export async function getColumns(
  instanceId: string,
  table: string,
  schema = "public"
): Promise<Column[]> {
  try {
    const response = await api.get(
      `/postgres/${instanceId}/schema/tables/${table}/columns`,
      { params: { schema } }
    )
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function addColumn(
  instanceId: string,
  table: string,
  column: ColumnDefinition,
  schema = "public"
): Promise<void> {
  try {
    await api.post(
      `/postgres/${instanceId}/schema/tables/${table}/columns`,
      column,
      { params: { schema } }
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function alterColumn(
  instanceId: string,
  table: string,
  column: string,
  changes: { default_value?: string | null; nullable?: boolean },
  schema = "public"
): Promise<void> {
  try {
    await api.patch(
      `/postgres/${instanceId}/schema/tables/${table}/columns/${column}`,
      changes,
      { params: { schema } }
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function dropColumn(
  instanceId: string,
  table: string,
  column: string,
  schema = "public"
): Promise<void> {
  try {
    await api.delete(
      `/postgres/${instanceId}/schema/tables/${table}/columns/${column}`,
      { params: { schema } }
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ INDEXES ============

export async function getIndexes(
  instanceId: string,
  table: string,
  schema = "public"
): Promise<Index[]> {
  try {
    const response = await api.get(
      `/postgres/${instanceId}/schema/tables/${table}/indexes`,
      { params: { schema } }
    )
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function createIndex(
  instanceId: string,
  table: string,
  index: IndexDefinition,
  schema = "public"
): Promise<void> {
  try {
    await api.post(
      `/postgres/${instanceId}/schema/tables/${table}/indexes`,
      index,
      { params: { schema } }
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function dropIndex(
  instanceId: string,
  table: string,
  index: string,
  schema = "public"
): Promise<void> {
  try {
    await api.delete(
      `/postgres/${instanceId}/schema/tables/${table}/indexes/${index}`,
      { params: { schema } }
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ FOREIGN KEYS ============

export async function getForeignKeys(
  instanceId: string,
  table: string,
  schema = "public"
): Promise<ForeignKey[]> {
  try {
    const response = await api.get(
      `/postgres/${instanceId}/schema/tables/${table}/foreign-keys`,
      { params: { schema } }
    )
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function addForeignKey(
  instanceId: string,
  table: string,
  fk: ForeignKeyDefinition,
  schema = "public"
): Promise<void> {
  try {
    await api.post(
      `/postgres/${instanceId}/schema/tables/${table}/foreign-keys`,
      fk,
      { params: { schema } }
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function dropForeignKey(
  instanceId: string,
  table: string,
  fk: string,
  schema = "public"
): Promise<void> {
  try {
    await api.delete(
      `/postgres/${instanceId}/schema/tables/${table}/foreign-keys/${fk}`,
      { params: { schema } }
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function getAllTablesWithColumns(
  instanceId: string,
  schema = "public"
): Promise<TableWithColumns[]> {
  try {
    const response = await api.get<TableWithColumns[]>(
      `/postgres/${instanceId}/schema/tables-with-columns`,
      { params: { schema } }
    )
    return response.data ?? []
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ DATA ============

export async function getRows(
  instanceId: string,
  table: string,
  params: QueryParams,
  schema = "public"
): Promise<RowsResult> {
  try {
    const response = await api.get(`/postgres/${instanceId}/tables/${table}/rows`, {
      params: { ...params, schema },
    })
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function insertRow(
  instanceId: string,
  table: string,
  data: Record<string, unknown>,
  schema = "public"
): Promise<Record<string, unknown>> {
  try {
    const response = await api.post(
      `/postgres/${instanceId}/tables/${table}/rows`,
      data,
      { params: { schema } }
    )
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function updateRow(
  instanceId: string,
  table: string,
  pk: string | number,
  data: Record<string, unknown>,
  schema = "public"
): Promise<Record<string, unknown>> {
  try {
    const response = await api.put(
      `/postgres/${instanceId}/tables/${table}/rows/${pk}`,
      data,
      { params: { schema } }
    )
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function deleteRow(
  instanceId: string,
  table: string,
  pk: string | number,
  schema = "public"
): Promise<void> {
  try {
    await api.delete(`/postgres/${instanceId}/tables/${table}/rows/${pk}`, { params: { schema } })
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function deleteRows(
  instanceId: string,
  table: string,
  pks: (string | number)[],
  schema = "public"
): Promise<void> {
  try {
    await api.post(
      `/postgres/${instanceId}/tables/${table}/rows/bulk-delete`,
      { pks },
      { params: { schema } }
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ SQL EDITOR ============

export async function runQuery(
  instanceId: string,
  sql: string
): Promise<QueryResult> {
  try {
    const response = await api.post(`/postgres/${instanceId}/query`, { sql })
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ SCHEMA INIT ============

export async function getSchemas(instanceId: string): Promise<string[]> {
  try {
    const response = await api.get(`/postgres/${instanceId}/schemas`)
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function initializeInstance(
  instanceId: string,
  schemas: string[]
): Promise<{ status: string; schemas: string[] }> {
  try {
    const response = await api.post(`/postgres/${instanceId}/initialize`, { schemas })
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ SECURITY ============

export async function getTableSecurity(instanceId: string): Promise<TableSecurity[]> {
  const result = await runQuery(instanceId, `
    SELECT
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled,
      COUNT(p.polname)::int AS policy_count
    FROM pg_class c
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'r'
    GROUP BY c.relname, c.relrowsecurity
    ORDER BY c.relname
  `)
  return (result.rows ?? []).map((row) => {
    const r = row as unknown[]
    return {
      table_name:   r[0] as string,
      rls_enabled:  r[1] as boolean,
      policy_count: r[2] as number,
    }
  })
}

export async function enableRLS(instanceId: string, tableName: string, schema = "public"): Promise<void> {
  try {
    await api.post(`/postgres/${instanceId}/schema/tables/${encodeURIComponent(tableName)}/rls`, null, {
      params: { schema },
    })
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ EXPORT / IMPORT ============

export function getExportSchemaUrl(instanceId: string): string {
  return `${getApiBaseUrl()}/postgres/${instanceId}/export/schema`
}

export function getExportFullUrl(instanceId: string): string {
  return `${getApiBaseUrl()}/postgres/${instanceId}/export/full`
}

export async function downloadExport(
  instanceId: string,
  type: 'schema' | 'full'
): Promise<void> {
  const url = type === 'schema'
    ? getExportSchemaUrl(instanceId)
    : getExportFullUrl(instanceId)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })

  if (!res.ok) throw new Error('Export failed')

  const disposition = res.headers.get('Content-Disposition') ?? ''
  const filenameMatch = disposition.match(/filename="(.+)"/)
  const filename = filenameMatch?.[1] ?? `export-${Date.now()}.sql`

  const blob = await res.blob()
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(downloadUrl)
}

export async function analyzeImport(
  instanceId: string,
  file: File
): Promise<AnalyzeResponse> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post(`/postgres/${instanceId}/import/analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function applyImport(
  instanceId: string,
  sessionId: string,
  decisions: ImportDecision[]
): Promise<ApplyResult> {
  try {
    const res = await api.post(`/postgres/${instanceId}/import/apply`, {
      session_id: sessionId,
      decisions,
    })
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}


