"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Database, ChevronDown, ChevronRight } from "lucide-react"
import { getAllTablesWithColumns } from "@/lib/db-api"
import { buildAuthSnippets, buildOperationSnippets } from "@/lib/code-snippets"
import { CodeSnippetTabs } from "@/components/ui/code-snippet-tabs"
import type { Instance } from "@/types"
import type { TableWithColumns, TableColumn } from "@/types/db"

// ─── ColumnsTable ─────────────────────────────────────────────────────────────

function ColumnsTable({ columns }: { columns: TableColumn[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#1F1F23]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1F1F23] bg-[#0F0F0F]">
            <th className="px-3 py-2 text-left font-semibold text-[#52525B] uppercase tracking-wider">Column</th>
            <th className="px-3 py-2 text-left font-semibold text-[#52525B] uppercase tracking-wider">Type</th>
            <th className="px-3 py-2 text-left font-semibold text-[#52525B] uppercase tracking-wider">Key</th>
          </tr>
        </thead>
        <tbody className="bg-[#050505] divide-y divide-[#111111]">
          {columns.map((col) => (
            <tr key={col.name}>
              <td className="px-3 py-2 font-mono text-white">{col.name}</td>
              <td className="px-3 py-2 font-mono text-[#A855F7]">{col.type}</td>
              <td className="px-3 py-2">
                {col.is_primary_key && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20">
                    PK
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── OperationBlock ───────────────────────────────────────────────────────────

type Op = "read" | "read_one" | "insert" | "update" | "delete"

const OP_META: Record<Op, { label: string; method: string; color: string }> = {
  read:     { label: "List rows",       method: "GET",    color: "#3B82F6" },
  read_one: { label: "Get single row",  method: "GET",    color: "#3B82F6" },
  insert:   { label: "Insert row",      method: "POST",   color: "#22C55E" },
  update:   { label: "Update rows",     method: "PATCH",  color: "#D4A843" },
  delete:   { label: "Delete rows",     method: "DELETE", color: "#EF4444" },
}

function OperationBlock({
  op,
  ctx,
}: {
  op: Op
  ctx: Parameters<typeof buildOperationSnippets>[0]
}) {
  const [open, setOpen] = useState(op === "read")
  const meta = OP_META[op]

  const snippets = buildOperationSnippets(ctx, op)

  return (
    <div className="border border-[#1F1F23] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[#0F0F0F] hover:bg-[#111111] transition-colors text-left"
      >
        <span
          className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
          style={{ color: meta.color, backgroundColor: `${meta.color}18`, border: `1px solid ${meta.color}30` }}
        >
          {meta.method}
        </span>
        <span className="text-sm font-medium text-white flex-1">{meta.label}</span>
        {open
          ? <ChevronDown size={13} className="text-[#52525B]" />
          : <ChevronRight size={13} className="text-[#52525B]" />}
      </button>
      {open && (
        <div className="p-4 bg-[#050505]">
          <CodeSnippetTabs snippets={snippets} defaultLang="sdk" installHint="npm install @massicloud/client" />
        </div>
      )}
    </div>
  )
}

// ─── TableSection ─────────────────────────────────────────────────────────────

function TableSection({
  table,
  dbName,
  projectSlug,
  anonKeyDisplay,
}: {
  table: TableWithColumns
  dbName: string
  projectSlug: string
  anonKeyDisplay: string
}) {
  const pk = table.columns.find((c) => c.is_primary_key)?.name ?? "id"
  const ctx = {
    projectSlug,
    stage: 'production',
    dbName,
    anonKeyDisplay,
    tableName: table.name,
    primaryKey: pk,
    columns: table.columns.map(c => ({
      name: c.name,
      type: c.type,
      is_primary_key: c.is_primary_key,
      nullable: true,
      default: null,
      length: null,
      is_unique: false,
    })),
  }

  return (
    <div id={`table-${dbName}-${table.name}`} className="scroll-mt-20 space-y-4">
      <div className="flex items-center gap-2">
        <code className="text-base font-bold text-white font-mono">{table.name}</code>
        <span className="text-[10px] text-[#52525B] uppercase tracking-wider">table</span>
      </div>

      <ColumnsTable columns={table.columns} />

      <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">Operations</h4>
      <div className="space-y-2">
        {(["read", "read_one", "insert", "update", "delete"] as Op[]).map((op) => (
          <OperationBlock key={op} op={op} ctx={ctx} />
        ))}
      </div>
    </div>
  )
}

// ─── DatabaseSection ──────────────────────────────────────────────────────────

function DatabaseSection({
  instance,
  projectSlug,
  anonKeyDisplay,
}: {
  instance: Instance
  projectSlug: string
  anonKeyDisplay: string
}) {
  const { data: tablesData = [], isLoading } = useQuery({
    queryKey: ["all-tables-with-cols", instance.id],
    queryFn: () => getAllTablesWithColumns(instance.id),
  })

  return (
    <div id={`db-${instance.name}`} className="scroll-mt-20 space-y-8">
      <div className="flex items-center gap-2.5 pb-3 border-b border-[#1F1F23]">
        <Database size={16} className="text-[#3B82F6]" />
        <h2 className="text-lg font-bold text-white font-mono">{instance.name}</h2>
        <span className="text-xs text-[#52525B]">postgres</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-[#111111] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tablesData.length === 0 ? (
        <p className="text-sm text-[#52525B]">No tables in this database.</p>
      ) : (
        <div className="space-y-10">
          {tablesData.map((t) => (
            <TableSection
              key={t.name}
              table={t}
              dbName={instance.name}
              projectSlug={projectSlug}
              anonKeyDisplay={anonKeyDisplay}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Overview & Auth prose ────────────────────────────────────────────────────

function OverviewSection({ projectSlug, baseURL }: { projectSlug: string; baseURL: string }) {
  return (
    <div id="overview" className="scroll-mt-20 space-y-4">
      <h2 className="text-xl font-bold text-white">Overview</h2>
      <p className="text-sm text-[#A1A1AA] leading-relaxed">
        Every MassiCloud project exposes a PostgREST-compatible HTTP API for each database.
        Send requests to the endpoint below and include your anon or service key in the{" "}
        <code className="text-[#D4A843] bg-[#2D2410]/30 px-1 py-0.5 rounded text-[11px]">
          X-MassiCloud-Key
        </code>{" "}
        header.
      </p>
      <div className="bg-[#0F0F0F] border border-[#1F1F23] rounded-lg p-4">
        <p className="text-[10px] text-[#52525B] uppercase tracking-wider mb-2">Base URL</p>
        <code className="text-sm text-white font-mono">{baseURL}/v1/{projectSlug}/db/{"<database>"}</code>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {[
          { badge: "REST", color: "#3B82F6", desc: "PostgREST on /rest/<table>" },
          { badge: "Auth", color: "#A855F7", desc: "JWT-based auth on /auth/*" },
          { badge: "RLS",  color: "#22C55E", desc: "Row Level Security enforced per table" },
          { badge: "Keys", color: "#D4A843", desc: "Anon key for client-side access" },
        ].map(({ badge, color, desc }) => (
          <div key={badge} className="flex items-start gap-2.5 bg-[#0F0F0F] border border-[#1F1F23] rounded-lg p-3">
            <span
              className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono mt-0.5"
              style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
            >
              {badge}
            </span>
            <span className="text-[#A1A1AA]">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AuthSection({
  projectSlug,
  anonKeyDisplay,
  instances,
}: {
  projectSlug: string
  anonKeyDisplay: string
  instances: Instance[]
}) {
  const firstDB = instances[0]?.name ?? "my-database"
  const snippets = buildAuthSnippets({ projectSlug, stage: 'production', dbName: firstDB, anonKeyDisplay })

  return (
    <div id="authentication" className="scroll-mt-20 space-y-4">
      <h2 className="text-xl font-bold text-white">Authentication</h2>
      <p className="text-sm text-[#A1A1AA] leading-relaxed">
        End-user authentication runs through{" "}
        <code className="text-[#D4A843] bg-[#2D2410]/30 px-1 py-0.5 rounded text-[11px]">/auth/signup</code>{" "}
        and{" "}
        <code className="text-[#D4A843] bg-[#2D2410]/30 px-1 py-0.5 rounded text-[11px]">/auth/login</code>.
        The returned <code className="text-[#D4A843] bg-[#2D2410]/30 px-1 py-0.5 rounded text-[11px]">access_token</code>{" "}
        is passed in the <code className="text-[#D4A843] bg-[#2D2410]/30 px-1 py-0.5 rounded text-[11px]">Authorization: Bearer</code> header alongside the anon key for
        all data requests.
      </p>
      <CodeSnippetTabs snippets={snippets} defaultLang="sdk" installHint="npm install @massicloud/client" />
    </div>
  )
}

function FilteringSection() {
  return (
    <div id="filtering" className="scroll-mt-20 space-y-4">
      <h2 className="text-xl font-bold text-white">Filtering & Sorting</h2>
      <p className="text-sm text-[#A1A1AA] leading-relaxed">
        The REST layer uses PostgREST query-string syntax. Append filters directly to the URL.
      </p>
      <div className="overflow-x-auto rounded-lg border border-[#1F1F23]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1F1F23] bg-[#0F0F0F]">
              <th className="px-3 py-2 text-left font-semibold text-[#52525B] uppercase tracking-wider">Operator</th>
              <th className="px-3 py-2 text-left font-semibold text-[#52525B] uppercase tracking-wider">Meaning</th>
              <th className="px-3 py-2 text-left font-semibold text-[#52525B] uppercase tracking-wider">Example</th>
            </tr>
          </thead>
          <tbody className="bg-[#050505] divide-y divide-[#111111]">
            {[
              ["eq", "equals", "?id=eq.123"],
              ["neq", "not equals", "?status=neq.inactive"],
              ["gt / gte", "greater than (or equal)", "?price=gte.100"],
              ["lt / lte", "less than (or equal)", "?age=lt.30"],
              ["like", "pattern match (use * for wildcard)", "?name=like.*john*"],
              ["is", "NULL check", "?deleted_at=is.null"],
              ["order", "sort", "?order=created_at.desc"],
              ["limit", "page size", "?limit=20&offset=0"],
            ].map(([op, meaning, ex]) => (
              <tr key={op}>
                <td className="px-3 py-2 font-mono text-[#A855F7]">{op}</td>
                <td className="px-3 py-2 text-[#A1A1AA]">{meaning}</td>
                <td className="px-3 py-2 font-mono text-[#52525B]">{ex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Content ─────────────────────────────────────────────────────────────

interface Props {
  projectSlug: string
  anonKeyDisplay: string
  instances: Instance[]
  baseURL: string
}

export function APIDocsContent({ projectSlug, anonKeyDisplay, instances, baseURL }: Props) {
  return (
    <div className="flex-1 min-w-0 space-y-14 py-4">
      <OverviewSection projectSlug={projectSlug} baseURL={baseURL} />
      <hr className="border-[#1F1F23]" />
      <AuthSection projectSlug={projectSlug} anonKeyDisplay={anonKeyDisplay} instances={instances} />
      <hr className="border-[#1F1F23]" />
      <FilteringSection />

      {instances.length > 0 && (
        <>
          <hr className="border-[#1F1F23]" />
          <div className="space-y-14">
            {instances.map((inst) => (
              <DatabaseSection
                key={inst.id}
                instance={inst}
                projectSlug={projectSlug}
                anonKeyDisplay={anonKeyDisplay}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
