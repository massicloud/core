"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Database, Layers, Play, Plus, RotateCcw, Search, Table2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getSchemas, getTableSecurity, reloadSchemaCache } from "@/lib/db-api"
import { Table } from "@/types/db"
import { useExplorer } from "@/lib/explorer-context"
import { RLSBadge } from "@/components/explorer/rls-badge"
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs"

interface LeftPanelProps {
  instanceId: string
  tables: Table[] | undefined
  loading: boolean
  onNewTable: () => void
  databaseName?: string
  databaseSize?: number
  breadcrumbs?: BreadcrumbItem[]
}

export function LeftPanel({
  instanceId,
  tables,
  loading,
  onNewTable,
  databaseName,
  databaseSize,
  breadcrumbs,
}: LeftPanelProps) {
  const [search, setSearch] = useState("")
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [reloading, setReloading] = useState(false)
  const { tabs, openTable, openSqlForTable, currentSchema, setSchema } = useExplorer()

  const handleReloadSchema = async () => {
    if (reloading) return
    setReloading(true)
    try {
      await reloadSchemaCache(instanceId)
      toast.success("PostgREST schema cache reloaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reload schema cache")
    } finally {
      setReloading(false)
    }
  }

  const { data: schemas = ["public"] } = useQuery({
    queryKey: ["db", instanceId, "schemas"],
    queryFn: () => getSchemas(instanceId),
    staleTime: 30_000,
  })

  const { data: securityData } = useQuery({
    queryKey: ["db-security", instanceId],
    queryFn: () => getTableSecurity(instanceId),
    staleTime: 60_000,
    enabled: currentSchema === "public",
  })

  const securityByTable = useMemo(
    () =>
      Object.fromEntries(
        (securityData ?? []).map((s) => [s.table_name, s])
      ),
    [securityData]
  )

  const openTableIds = new Set(
    tabs.filter((t) => t.type === "table").map((t) => t.id)
  )

  const filteredTables = useMemo(() => {
    if (!tables) return []
    return tables.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
  }, [tables, search])

  const formatBytes = (bytes: number | undefined | null): string => {
    if (bytes == null || isNaN(bytes)) return "0 B"
    const units = ["B", "KB", "MB", "GB"]
    let size = bytes
    let unitIdx = 0
    while (size >= 1024 && unitIdx < units.length - 1) {
      size /= 1024
      unitIdx++
    }
    return `${size.toFixed(1)} ${units[unitIdx]}`
  }

  return (
    <div className="md:w-[260px] md:min-w-[260px] md:basis-[260px] border-r border-[#1E1E24] bg-[#0D0D10] flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col border-b border-[#1E1E24] shrink-0">
        {breadcrumbs && breadcrumbs.length > 1 && (
          <div className="h-8 flex items-center px-3 border-b border-[#1E1E24]">
            <Breadcrumbs items={breadcrumbs.slice(0, -1)} />
          </div>
        )}
        <div className="flex h-[44px] items-center justify-between px-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-[#1D3461] flex items-center justify-center shrink-0">
              <Database size={12} className="text-[#3B82F6]" />
            </div>
            <span className="text-white text-sm font-semibold truncate">
              {databaseName}
            </span>
          </div>
          <button
            onClick={handleReloadSchema}
            disabled={reloading}
            title="Reload PostgREST schema cache"
            className="p-1 rounded hover:text-white hover:bg-[#18181B] transition-colors shrink-0 disabled:opacity-50"
          >
            <RotateCcw size={13} className={cn("text-[#52525B]", reloading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Schema selector */}
      <div className="px-3 pt-2 pb-1 shrink-0 relative">
        <button
          onClick={() => setSchemaOpen((o) => !o)}
          className={cn(
            "w-full flex items-center gap-2 h-8 px-2.5 rounded-md",
            "bg-[#141414] border border-[#1F1F23] hover:border-[#27272A]",
            "text-xs transition-all",
            schemaOpen && "border-[#27272A]"
          )}
        >
          <Layers size={12} className="text-[#52525B] shrink-0" />
          <span className="flex-1 text-left text-white font-mono truncate">
            {currentSchema}
          </span>
          <ChevronDown
            size={11}
            className={cn("text-[#52525B] transition-transform shrink-0", schemaOpen && "rotate-180")}
          />
        </button>

        {schemaOpen && (
          <div className="absolute left-3 right-3 top-full z-50 mt-1 bg-[#111111] border border-[#27272A] rounded-md shadow-xl overflow-hidden">
            {schemas.map((s) => (
              <button
                key={s}
                onClick={() => { setSchema(s); setSchemaOpen(false) }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors",
                  s === currentSchema
                    ? "bg-[#1D3461] text-[#3B82F6]"
                    : "text-[#A1A1AA] hover:bg-[#1A1A1A] hover:text-white"
                )}
              >
                <Layers size={11} className="shrink-0" />
                <span className="font-mono">{s}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search input */}
      <div className="px-4 pt-1 pb-0 shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
          <input
            placeholder="Search tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 bg-[#141414] border border-[#1F1F23] rounded-md pl-8 pr-3 text-xs text-white placeholder-[#52525B] focus:border-[#27272A] focus:outline-none"
          />
        </div>
      </div>

      {/* Tables label */}
      <div className="px-4 py-2 shrink-0">
        <span className="text-[10px] font-semibold text-[#3B3B3B] uppercase tracking-widest">
          Tables ({filteredTables.length})
        </span>
      </div>

      {/* Tables list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-1 mx-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 bg-[#141414] rounded" />
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Table2 size={24} className="text-[#27272A] mb-2" />
            <p className="text-[#52525B] text-xs">No tables yet</p>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredTables.map((table) => {
              const tabId = `${currentSchema}.${table.name}`
              const isOpen = openTableIds.has(tabId)
              return (
                <div
                  key={table.name}
                  className={cn(
                    "group flex items-center transition-colors",
                    isOpen
                      ? "border-r-2 border-[#3B82F6] bg-[#1D3461]/10"
                      : "border-r-2 border-transparent hover:bg-[#141414]"
                  )}
                >
                  <button
                    onClick={() => openTable(table.name, currentSchema)}
                    className="flex-1 flex items-center gap-2.5 px-4 py-2 min-w-0 text-left"
                  >
                    <Table2
                      size={13}
                      className={cn(
                        "shrink-0 transition-colors",
                        isOpen ? "text-[#3B82F6]" : "text-[#3B3B3B] group-hover:text-[#52525B]"
                      )}
                    />
                    <span className={cn(
                      "text-xs truncate transition-colors",
                      isOpen ? "text-[#3B82F6] font-medium" : "text-[#A1A1AA] group-hover:text-white"
                    )}>
                      {table.name}
                    </span>
                  </button>

                  {/* RLS badge + row count (collapse on hover to show SQL button) */}
                  <div className="flex items-center gap-1 pr-2 shrink-0">
                    <div className="flex items-center gap-1 group-hover:hidden">
                      {currentSchema === "public" && securityByTable[table.name] && (
                        <RLSBadge security={securityByTable[table.name]} size="sm" />
                      )}
                      <span className="text-[10px] text-[#3B3B3B] font-mono w-6 text-right">
                        {table.row_count > 0 ? table.row_count.toLocaleString() : ""}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openSqlForTable(table.name, currentSchema) }}
                      title={`Query ${table.name}`}
                      className="hidden group-hover:flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-medium bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 transition-colors"
                    >
                      <Play size={8} />
                      Query
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div className="border-t border-[#1F1F23] px-4 py-2 shrink-0">
        <button
          onClick={onNewTable}
          className="w-full flex items-center justify-center gap-2 h-8 rounded-md border border-dashed border-[#27272A] text-[#52525B] hover:text-[#3B82F6] hover:border-[#3B82F6]/40 hover:bg-[#1D3461]/10 transition-all text-xs"
        >
          <Plus size={12} />
          New Table
        </button>

        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-[#3B3B3B]">
            Database size
          </span>
          <span className="text-[10px] text-[#52525B] font-mono">
            {formatBytes(databaseSize)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
          <span className="text-[10px] text-[#22C55E]">
            Law 18-07 Compliant
          </span>
        </div>
      </div>
    </div>
  )
}