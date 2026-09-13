"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Layers } from "lucide-react"
import { getMongoCollections } from "@/lib/mongo-api"
import { cn } from "@/lib/utils"
import { CreateCollectionDialog } from "./create-collection-dialog"

export function CollectionList({
  instanceId,
  selected,
  onSelect,
}: {
  instanceId: string
  selected?: string
  onSelect: (name: string) => void
}) {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["mongo-collections", instanceId],
    queryFn: () => getMongoCollections(instanceId),
    staleTime: 15_000,
  })

  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[10px] font-semibold text-[#52525B] uppercase tracking-widest">
          Collections
        </span>
        <button
          onClick={() => setCreateOpen(true)}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-white transition-colors"
          aria-label="Create collection"
        >
          <Plus size={12} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded-md bg-[#111111] border border-[#1E1E24] animate-pulse" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-6 px-2">
          <Layers size={18} className="text-[#3F3F46] mx-auto mb-2" />
          <p className="text-[11px] text-[#52525B]">No collections yet</p>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {collections.map((c) => (
            <li key={c.name}>
              <button
                onClick={() => onSelect(c.name)}
                className={cn(
                  "w-full flex items-center justify-between h-8 px-2.5 rounded-md text-[12px] transition-colors",
                  selected === c.name
                    ? "bg-[#0F2417] text-[#22C55E] ring-1 ring-inset ring-[#22C55E]/20"
                    : "text-[#A1A1AA] hover:bg-[#161616] hover:text-white"
                )}
              >
                <span className="truncate font-mono">{c.name}</span>
                <span className="text-[10px] text-[#52525B] shrink-0 ml-2">{c.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <CreateCollectionDialog
        instanceId={instanceId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) => {
          queryClient.invalidateQueries({ queryKey: ["mongo-collections", instanceId] })
          onSelect(name)
        }}
      />
    </div>
  )
}
