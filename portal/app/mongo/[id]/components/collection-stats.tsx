"use client"

import { useQuery } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { getMongoCollections } from "@/lib/mongo-api"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function CollectionStats({ instanceId, collection }: { instanceId: string; collection: string }) {
  // Stats cost DB time to compute (collStats), so this is manual-refresh
  // only — no polling/auto-refresh.
  const { data: collections = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["mongo-collections", instanceId],
    queryFn: () => getMongoCollections(instanceId),
  })

  const stats = collections.find((c) => c.name === collection)

  const tiles = stats
    ? [
        { label: "Documents", value: stats.count.toLocaleString() },
        { label: "Storage size", value: formatBytes(stats.size) },
        { label: "Avg. document size", value: formatBytes(stats.avgObjSize) },
        { label: "Indexes", value: String(stats.indexes) },
      ]
    : []

  return (
    <div className="p-4 h-full overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#E4E4E7]">Collection stats</h3>
        <button
          onClick={() => refetch()}
          className="h-7 px-3 flex items-center gap-1.5 rounded-md border border-[#27272A] text-xs text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1A]"
        >
          <RefreshCw size={11} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[#111111] border border-[#1E1E24] animate-pulse" />
          ))}
        </div>
      ) : !stats ? (
        <p className="text-sm text-[#52525B]">No stats available for this collection.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-[#1E1E24] bg-[#111111] px-4 py-3">
              <p className="text-[10px] text-[#52525B] uppercase tracking-wide mb-1">{t.label}</p>
              <p className="text-lg font-mono text-[#E4E4E7] font-medium">{t.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
