"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Archive, ArrowLeft, Loader2 } from "lucide-react"
import {
  listBackups,
  createBackup,
  deleteBackup,
  getPostgresInstances,
} from "@/lib/api"
import { BackupSettingsCard } from "@/components/backups/backup-settings-card"
import { BackupRow } from "@/components/backups/backup-row"
import { RestoreModal } from "@/components/backups/restore-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useProject } from "@/lib/project-context"
import type { Backup } from "@/types"

interface BackupsPageProps {
  params: { id: string }
}

function BackupListSkeleton() {
  return (
    <div className="bg-[#111111] border border-[#27272A] rounded-xl overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`flex items-center gap-4 p-4 ${i < 2 ? "border-b border-[#1F1F23]" : ""}`}
        >
          <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

function BackupEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-12">
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-[#27272A] flex items-center justify-center mb-4">
          <Archive size={28} className="text-[#52525B]" />
        </div>
        <h3 className="text-white font-semibold mb-2">No backups yet</h3>
        <p className="text-[#52525B] text-sm max-w-xs mb-6">
          Daily backups will start automatically. You can also create a manual
          backup right now.
        </p>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 h-9 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium rounded-md transition-colors"
        >
          <Archive size={14} />
          Backup now
        </button>
      </div>
    </div>
  )
}

export default function BackupsPage({ params }: BackupsPageProps) {
  const { id: instanceId } = params
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentProject } = useProject()

  const [restoringBackup, setRestoringBackup] = useState<Backup | null>(null)
  const [deletingBackup, setDeletingBackup] = useState<Backup | null>(null)

  // Fetch instance metadata (for name + backup settings)
  const { data: instances } = useQuery({
    queryKey: ["postgres", currentProject?.id],
    queryFn: () => getPostgresInstances(currentProject?.id),
    enabled: !!currentProject?.id,
  })
  const instance = instances?.find((i) => i.id === instanceId)

  // Fetch backups — auto-refresh while any are pending/running
  const { data: backups, isLoading } = useQuery({
    queryKey: ["backups", instanceId],
    queryFn: () => listBackups(instanceId),
    refetchInterval: (query) => {
      const data = query.state.data as Backup[] | undefined
      const hasActive = data?.some(
        (b) => b.status === "pending" || b.status === "running"
      )
      return hasActive ? 3000 : false
    },
  })

  const { mutate: triggerBackup, isPending: backingUp } = useMutation({
    mutationFn: () => createBackup(instanceId),
    onSuccess: () => {
      toast.success("Backup started")
      queryClient.invalidateQueries({ queryKey: ["backups", instanceId] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast.error(axiosErr?.response?.data?.error ?? "Failed to start backup")
    },
  })

  const { mutate: confirmDelete, isPending: deleting } = useMutation({
    mutationFn: () => deleteBackup(instanceId, deletingBackup!.id),
    onSuccess: () => {
      toast.success("Backup deleted")
      queryClient.invalidateQueries({ queryKey: ["backups", instanceId] })
      setDeletingBackup(null)
    },
    onError: () => {
      toast.error("Failed to delete backup")
    },
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => router.back()}
          className="text-[#52525B] hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-2xl font-bold text-white">Backups</h1>
      </div>
      <p className="text-[#52525B] text-sm mb-6 ml-7">
        {instance?.name ?? instanceId} · Automatic daily backups with
        point-in-time restore
      </p>

      {/* Settings card */}
      {instance && (
        <BackupSettingsCard
          instance={instance}
          onUpdate={() =>
            queryClient.invalidateQueries({
              queryKey: ["postgres", currentProject?.id],
            })
          }
        />
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between mt-6 mb-4">
        <h2 className="text-base font-semibold text-white">Recent Backups</h2>
        <button
          onClick={() => triggerBackup()}
          disabled={backingUp}
          className="flex items-center gap-2 h-9 px-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
        >
          {backingUp ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Archive size={14} />
          )}
          Backup Now
        </button>
      </div>

      {/* Backup list */}
      {isLoading ? (
        <BackupListSkeleton />
      ) : backups && backups.length > 0 ? (
        <div className="bg-[#111111] border border-[#27272A] rounded-xl overflow-hidden">
          {backups.map((b, idx) => (
            <BackupRow
              key={b.id}
              backup={b}
              isLast={idx === backups.length - 1}
              onRestore={() => setRestoringBackup(b)}
              onDelete={() => setDeletingBackup(b)}
            />
          ))}
        </div>
      ) : (
        <BackupEmptyState onCreate={() => triggerBackup()} />
      )}

      {/* Restore modal */}
      <RestoreModal
        backup={restoringBackup}
        instanceId={instanceId}
        open={!!restoringBackup}
        onClose={() => setRestoringBackup(null)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingBackup}
        onClose={() => setDeletingBackup(null)}
        onConfirm={() => confirmDelete()}
        title="Delete this backup?"
        message="This permanently removes the backup file from storage. You will not be able to restore from it after deletion."
        confirmLabel="Delete backup"
        loading={deleting}
      />
    </div>
  )
}
