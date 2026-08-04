"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Table2, ChevronDown, ChevronRight, Check, Copy } from "lucide-react"
import { getColumns, getForeignKeys, getTableSecurity } from "@/lib/db-api"
import { buildOperationSnippets } from "@/lib/code-snippets"
import { RLSBadge } from "@/components/explorer/rls-badge"
import { OperationCard } from "./operation-card"
import type { Instance } from "@/types"
import type { Column, ForeignKey } from "@/types/db"

const API_ROOT = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface Props {
  instance: Instance
  tableName: string
  projectSlug: string
  stage: string
  anonKeyPrefix: string
  defaultOpen?: boolean
}

export function TableEndpointsBlock({ instance, tableName, projectSlug, stage, anonKeyPrefix, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [activeOp, setActiveOp] = useState<string | null>(null)

  const { data: columns = [] } = useQuery({
    queryKey: ["db-columns", instance.id, "public", tableName],
    queryFn: () => getColumns(instance.id, tableName, "public"),
    enabled: open,
  })

  const { data: foreignKeys = [] } = useQuery({
    queryKey: ["db-fks", instance.id, "public", tableName],
    queryFn: () => getForeignKeys(instance.id, tableName, "public"),
    enabled: open,
  })

  const { data: securityData = [] } = useQuery({
    queryKey: ["db-security", instance.id],
    queryFn: () => getTableSecurity(instance.id),
  })

  const security = securityData.find((s) => s.table_name === tableName)
  const primaryKey = columns.find((c) => c.is_primary_key)?.name ?? "id"

  const restURL = `${API_ROOT}/v1/${projectSlug}/${stage}/db/${instance.name}/rest/${tableName}`
  const restPath = restURL.replace(/^https?:\/\/[^/]+/, "")

  const ctx = {
    projectSlug,
    stage,
    dbName: instance.name,
    anonKeyDisplay: anonKeyPrefix,
    tableName,
    primaryKey,
    columns,
  }

  const operations = [
    { op: "read",     method: "GET",    path: `/rest/${tableName}`,                            label: "List rows" },
    { op: "read_one", method: "GET",    path: `/rest/${tableName}?${primaryKey}=eq.{id}`,      label: "Get a single row" },
    { op: "insert",   method: "POST",   path: `/rest/${tableName}`,                            label: "Insert a row" },
    { op: "update",   method: "PATCH",  path: `/rest/${tableName}?${primaryKey}=eq.{id}`,      label: "Update a row" },
    { op: "delete",   method: "DELETE", path: `/rest/${tableName}?${primaryKey}=eq.{id}`,      label: "Delete a row" },
  ] as const

  return (
    <div className="bg-[#111111] border border-[#27272A] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#0D0D0D] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] flex items-center justify-center shrink-0">
            <Table2 size={13} className="text-[#A1A1AA]" />
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white font-mono">{tableName}</h3>
              <RLSBadge security={security} size="sm" />
            </div>
            <p className="text-xs text-[#52525B] mt-0.5 font-mono truncate">{restPath}</p>
          </div>
        </div>
        {open
          ? <ChevronDown size={14} className="text-[#52525B] shrink-0" />
          : <ChevronRight size={14} className="text-[#52525B] shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-[#1F1F23] p-5 space-y-5">

          {/* Endpoint URL */}
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-[#0A0A0A] border border-[#1F1F23] rounded px-3 py-2 font-mono text-xs text-white overflow-x-auto whitespace-nowrap">
              {restURL}
            </code>
            <CopyButton text={restURL} />
          </div>

          {/* Columns */}
          {columns.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#52525B] mb-2">
                Columns
              </p>
              <ColumnsTable columns={columns} foreignKeys={foreignKeys} />
            </div>
          )}

          {/* Operations */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#52525B] mb-2">
              Operations
            </p>
            <div className="space-y-2">
              {operations.map((op) => (
                <OperationCard
                  key={op.op}
                  method={op.method}
                  path={op.path}
                  label={op.label}
                  isActive={activeOp === op.op}
                  onToggle={() => setActiveOp(activeOp === op.op ? null : op.op)}
                  snippets={buildOperationSnippets(ctx, op.op)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ColumnsTable ─────────────────────────────────────────────────────────────

function ColumnsTable({ columns, foreignKeys }: { columns: Column[]; foreignKeys: ForeignKey[] }) {
  const fkMap = new Map(foreignKeys.map((fk) => [fk.column, fk]))

  return (
    <div className="overflow-x-auto rounded-lg border border-[#1F1F23]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1F1F23] bg-[#0F0F0F]">
            <th className="px-3 py-2 text-left font-semibold text-[#52525B] uppercase tracking-wider">Column</th>
            <th className="px-3 py-2 text-left font-semibold text-[#52525B] uppercase tracking-wider">Type</th>
            <th className="px-3 py-2 text-left font-semibold text-[#52525B] uppercase tracking-wider">Nullable</th>
            <th className="px-3 py-2 text-left font-semibold text-[#52525B] uppercase tracking-wider">References</th>
          </tr>
        </thead>
        <tbody className="bg-[#050505] divide-y divide-[#111111]">
          {columns.map((col) => {
            const fk = fkMap.get(col.name)
            return (
              <tr key={col.name}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-white">{col.name}</span>
                    {col.is_primary_key && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20">
                        PK
                      </span>
                    )}
                    {col.is_unique && !col.is_primary_key && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">
                        UQ
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-[#A855F7]">{col.type}</td>
                <td className="px-3 py-2 text-[#52525B]">{col.nullable ? "yes" : "no"}</td>
                <td className="px-3 py-2 font-mono text-[#52525B]">
                  {fk ? `${fk.referenced_table}.${fk.referenced_column}` : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="shrink-0 h-9 w-9 flex items-center justify-center bg-[#0A0A0A] border border-[#1F1F23] rounded text-[#52525B] hover:text-white hover:border-[#27272A] transition-all"
    >
      {copied ? <Check size={12} className="text-[#22C55E]" /> : <Copy size={12} />}
    </button>
  )
}
