"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, RefreshCw } from "lucide-react"
import { getMongoDocuments } from "@/lib/mongo-api"
import { DocumentEditor } from "./document-editor"

const PAGE_SIZE = 20
const MAX_VISIBLE_COLUMNS = 5

function cellValue(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export function DocumentGrid({ instanceId, collection }: { instanceId: string; collection: string }) {
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" } | null>(null)
  const [filterText, setFilterText] = useState("")
  const [filterError, setFilterError] = useState<string | null>(null)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined) // undefined = closed

  // Reset to page 0 whenever the collection changes.
  const [lastCollection, setLastCollection] = useState(collection)
  if (lastCollection !== collection) {
    setLastCollection(collection)
    setPage(0)
    setSort(null)
    setFilterText("")
    setFilterError(null)
  }

  let filter: string | undefined
  if (filterText.trim()) {
    try {
      JSON.parse(filterText)
      filter = filterText
      if (filterError) setFilterError(null)
    } catch {
      filter = undefined
    }
  }

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["mongo-documents", instanceId, collection, page, sort, filter],
    queryFn: () =>
      getMongoDocuments(instanceId, collection, {
        limit: PAGE_SIZE,
        skip: page * PAGE_SIZE,
        sort: sort ? `${sort.field}:${sort.dir}` : undefined,
        filter,
      }),
  })

  const documents = data?.documents ?? []
  const total = data?.total ?? 0

  const columns = useMemo(() => {
    const keys = new Set<string>()
    for (const doc of documents) {
      for (const k of Object.keys(doc)) {
        if (k !== "_id") keys.add(k)
      }
    }
    const rest = Array.from(keys)
    const visible = showAllColumns ? rest : rest.slice(0, MAX_VISIBLE_COLUMNS)
    return { visible, hiddenCount: rest.length - visible.length }
  }, [documents, showAllColumns])

  function toggleSort(field: string) {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: "asc" }
      if (prev.dir === "asc") return { field, dir: "desc" }
      return null
    })
  }

  function handleFilterChange(v: string) {
    setFilterText(v)
    if (!v.trim()) {
      setFilterError(null)
      return
    }
    try {
      JSON.parse(v)
      setFilterError(null)
    } catch {
      setFilterError("Invalid JSON")
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-[#1E1E24] shrink-0">
        <input
          value={filterText}
          onChange={(e) => handleFilterChange(e.target.value)}
          placeholder='Filter e.g. {"status": "active"}'
          className="flex-1 h-8 px-3 rounded-md bg-[#111111] border border-[#27272A] text-xs font-mono text-[#E4E4E7] placeholder:text-[#3F3F46] focus:outline-none focus:border-[#3B82F6]"
        />
        <button
          onClick={() => refetch()}
          className="h-8 w-8 flex items-center justify-center rounded-md border border-[#27272A] text-[#52525B] hover:text-white hover:bg-[#1A1A1A]"
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
        </button>
        <button
          onClick={() => setEditing(null)}
          className="h-8 px-3 flex items-center gap-1.5 rounded-md bg-[#D4A843] hover:bg-[#C39936] text-black text-xs font-medium"
        >
          <Plus size={12} />
          New document
        </button>
      </div>
      {filterError && <p className="text-[11px] text-red-400 px-3 pt-1.5">{filterError}</p>}

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 rounded-md bg-[#111111] border border-[#1E1E24] animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <p className="text-[#52525B] text-sm">No documents match this query</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0D0D10] border-b border-[#1E1E24]">
              <tr>
                <th className="text-left font-medium text-[#71717A] px-3 py-2">_id</th>
                {columns.visible.map((col) => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className="text-left font-medium text-[#71717A] px-3 py-2 cursor-pointer hover:text-white select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {sort?.field === col &&
                        (sort.dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                    </span>
                  </th>
                ))}
                {columns.hiddenCount > 0 && (
                  <th className="text-left font-medium text-[#71717A] px-3 py-2">
                    <button
                      onClick={() => setShowAllColumns((v) => !v)}
                      className="text-[#D4A843] hover:underline"
                    >
                      {showAllColumns ? "Show fewer" : `+${columns.hiddenCount} more`}
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, i) => (
                <tr
                  key={typeof doc._id === "string" ? doc._id : i}
                  onClick={() => setEditing(doc)}
                  className="border-b border-[#1E1E24] hover:bg-[#111113] cursor-pointer"
                >
                  <td className="px-3 py-2 font-mono text-[#D4A843] truncate max-w-[140px]">
                    {cellValue(doc._id)}
                  </td>
                  {columns.visible.map((col) => (
                    <td key={col} className="px-3 py-2 text-[#A1A1AA] truncate max-w-[220px]">
                      {cellValue(doc[col])}
                    </td>
                  ))}
                  {columns.hiddenCount > 0 && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-[#1E1E24] shrink-0 text-xs text-[#52525B]">
        <span>
          {total} document{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-7 w-7 flex items-center justify-center rounded border border-[#27272A] disabled:opacity-30 hover:bg-[#1A1A1A]"
          >
            <ChevronLeft size={12} />
          </button>
          <span>Page {page + 1}</span>
          <button
            onClick={() => setPage((p) => ((p + 1) * PAGE_SIZE < total ? p + 1 : p))}
            disabled={(page + 1) * PAGE_SIZE >= total}
            className="h-7 w-7 flex items-center justify-center rounded border border-[#27272A] disabled:opacity-30 hover:bg-[#1A1A1A]"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {editing !== undefined && (
        <DocumentEditor
          instanceId={instanceId}
          collection={collection}
          document={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  )
}
