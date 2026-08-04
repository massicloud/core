"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Database, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PostgresCard } from "@/components/instances/postgres-card"
import { CreatePostgresModal } from "@/components/instances/create-postgres-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useProject } from "@/lib/project-context"
import { getPostgresInstances, deletePostgresInstance, getErrorMessage } from "@/lib/api"
import type { Instance } from "@/types"

function DatabasesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-64 bg-[#111111] border border-[#27272A] rounded-xl animate-pulse"
        />
      ))}
    </div>
  )
}

export default function DatabasesPage() {
  const queryClient = useQueryClient()
  const { currentProject } = useProject()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Instance | null>(null)

  const { data: instancesRaw, isLoading } = useQuery({
    queryKey: ["postgres", currentProject?.id],
    queryFn: () => getPostgresInstances(currentProject?.id),
    enabled: !!currentProject?.id,
  })
  const instances = Array.isArray(instancesRaw) ? instancesRaw : []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePostgresInstance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postgres", currentProject?.id] })
      toast.success(`Database "${deleteTarget?.name}" deleted`)
      setDeleteTarget(null)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  if (!currentProject) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center mb-4 border border-[#27272A]">
            <Database size={28} className="text-[#52525B]" />
          </div>
          <h3 className="text-white font-semibold mb-2">No project selected</h3>
          <p className="text-[#52525B] text-sm max-w-xs">
            Select or create a project to view databases
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Databases</h1>
          <p className="text-[#52525B] text-sm mt-0.5">
            PostgreSQL instances in {currentProject.name}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-2" />
          Create Database
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <DatabasesSkeleton />
      ) : instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center mb-4 border border-[#27272A]">
            <Database size={28} className="text-[#52525B]" />
          </div>
          <h3 className="text-white font-semibold mb-2">No databases yet</h3>
          <p className="text-[#52525B] text-sm max-w-xs mb-6">
            Create your first PostgreSQL database to get started
          </p>
          <Button onClick={() => setCreateOpen(true)}>Create database</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((instance: Instance) => (
            <PostgresCard
              key={instance.id}
              instance={instance}
              onDelete={() => setDeleteTarget(instance)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreatePostgresModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete database"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone and all data will be permanently lost.`}
        confirmLabel="Delete database"
        loading={deleteMutation.isPending}
        requiresTyping={deleteTarget?.name}
      />
    </div>
  )
}
