"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Leaf, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { MongoCard } from "@/components/instances/mongo-card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useProject } from "@/lib/project-context"
import { getMongoInstances, deleteMongoInstance, getErrorMessage } from "@/lib/api"
import type { MongoInstance } from "@/types"

function MongoSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-64 bg-[#111111] border border-[#27272A] rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

export default function MongoPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { currentProject } = useProject()
  const [deleteTarget, setDeleteTarget] = useState<MongoInstance | null>(null)

  const { data: instancesRaw, isLoading } = useQuery({
    queryKey: ["mongo", currentProject?.id],
    queryFn: () => getMongoInstances(currentProject?.id),
    enabled: !!currentProject?.id,
  })
  const instances = Array.isArray(instancesRaw) ? instancesRaw : []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMongoInstance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mongo", currentProject?.id] })
      toast.success(`MongoDB instance "${deleteTarget?.name}" deleted`)
      setDeleteTarget(null)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  // Instances are always created from a stage (Stages → Add database) —
  // there's no standalone top-level creation endpoint, so "Create" here
  // takes you to the stage view rather than opening a modal that has
  // nowhere to submit to.
  function goToStages() {
    if (currentProject) router.push(`/projects/${currentProject.id}/stages`)
  }

  if (!currentProject) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center mb-4 border border-[#27272A]">
            <Leaf size={28} className="text-[#52525B]" />
          </div>
          <h3 className="text-white font-semibold mb-2">No project selected</h3>
          <p className="text-[#52525B] text-sm max-w-xs">
            Select or create a project to view MongoDB instances
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
          <h1 className="text-xl font-bold text-white">MongoDB Instances</h1>
          <p className="text-[#52525B] text-sm mt-0.5">
            MongoDB instances in {currentProject.name}
          </p>
        </div>
        <Button onClick={goToStages}>
          <Plus size={16} className="mr-2" />
          Add database
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <MongoSkeleton />
      ) : instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center mb-4 border border-[#27272A]">
            <Leaf size={28} className="text-[#52525B]" />
          </div>
          <h3 className="text-white font-semibold mb-2">No MongoDB instances yet</h3>
          <p className="text-[#52525B] text-sm max-w-xs mb-6">
            Add a MongoDB instance from one of your stages to get started
          </p>
          <Button onClick={goToStages}>Add database</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((instance) => (
            <MongoCard
              key={instance.id}
              instance={instance}
              onDelete={() => setDeleteTarget(instance)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete MongoDB instance"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone and all data will be permanently lost.`}
        confirmLabel="Delete instance"
        loading={deleteMutation.isPending}
        requiresTyping={deleteTarget?.name}
      />
    </div>
  )
}
