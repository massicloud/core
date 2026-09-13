"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { getMongoIndexes, dropMongoIndex } from "@/lib/mongo-api"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CreateIndexDialog } from "./create-index-dialog"

export function IndexManager({ instanceId, collection }: { instanceId: string; collection: string }) {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const { data: indexes = [], isLoading } = useQuery({
    queryKey: ["mongo-indexes", instanceId, collection],
    queryFn: () => getMongoIndexes(instanceId, collection),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["mongo-indexes", instanceId, collection] })
  }

  const dropMutation = useMutation({
    mutationFn: (name: string) => dropMongoIndex(instanceId, collection, name),
    onSuccess: () => {
      toast.success("Index dropped")
      invalidate()
      setDropTarget(null)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to drop index"),
  })

  return (
    <div className="p-4 overflow-auto h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[#E4E4E7]">Indexes</h3>
        <button
          onClick={() => setCreateOpen(true)}
          className="h-7 px-3 flex items-center gap-1.5 rounded-md bg-[#D4A843] hover:bg-[#C39936] text-black text-xs font-medium"
        >
          <Plus size={11} />
          Create index
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 rounded-md bg-[#111111] border border-[#1E1E24] animate-pulse" />
          ))}
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1E1E24] text-[#71717A]">
              <th className="text-left font-medium px-3 py-2">Name</th>
              <th className="text-left font-medium px-3 py-2">Keys</th>
              <th className="text-left font-medium px-3 py-2">Unique</th>
              <th className="text-left font-medium px-3 py-2">Sparse</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {indexes.map((idx) => (
              <tr key={idx.name} className="border-b border-[#1E1E24]">
                <td className="px-3 py-2 font-mono text-[#E4E4E7]">{idx.name}</td>
                <td className="px-3 py-2 font-mono text-[#A1A1AA]">{JSON.stringify(idx.keys)}</td>
                <td className="px-3 py-2 text-[#A1A1AA]">{idx.unique ? "yes" : "—"}</td>
                <td className="px-3 py-2 text-[#A1A1AA]">{idx.sparse ? "yes" : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setDropTarget(idx.name)}
                    disabled={idx.name === "_id_"}
                    className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-[#2D1414] text-[#52525B] hover:text-[#EF4444] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#52525B]"
                    title={idx.name === "_id_" ? "The _id_ index cannot be dropped" : "Drop index"}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <CreateIndexDialog
        instanceId={instanceId}
        collection={collection}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <ConfirmDialog
        open={!!dropTarget}
        onClose={() => setDropTarget(null)}
        onConfirm={() => dropTarget && dropMutation.mutate(dropTarget)}
        title="Drop index"
        message={`Are you sure you want to drop index "${dropTarget}"?`}
        confirmLabel="Drop index"
        loading={dropMutation.isPending}
      />
    </div>
  )
}
