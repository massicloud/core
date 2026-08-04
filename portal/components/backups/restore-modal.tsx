"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Archive, Info, RotateCcw } from "lucide-react"
import { format } from "date-fns"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { TextInput } from "@/components/ui/text-input"
import { restoreBackup } from "@/lib/api"
import { useProject } from "@/lib/project-context"
import { cn } from "@/lib/utils"
import type { Backup } from "@/types"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

const MEMORY_OPTIONS = [512, 1024, 2048, 4096]

interface RestoreModalProps {
  backup: Backup | null
  instanceId: string
  open: boolean
  onClose: () => void
}

export function RestoreModal({
  backup,
  instanceId,
  open,
  onClose,
}: RestoreModalProps) {
  const queryClient = useQueryClient()
  const { currentProject } = useProject()
  const [newName, setNewName] = useState("")
  const [memory, setMemory] = useState(512)

  const handleClose = () => {
    setNewName("")
    setMemory(512)
    onClose()
  }

  const { mutate: handleRestore, isPending } = useMutation({
    mutationFn: () =>
      restoreBackup(instanceId, backup!.id, newName, memory),
    onSuccess: () => {
      toast.success("Restore started — new instance will appear shortly", {
        duration: 5000,
      })
      queryClient.invalidateQueries({
        queryKey: ["postgres", currentProject?.id],
      })
      handleClose()
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast.error(axiosErr?.response?.data?.error ?? "Restore failed")
    },
  })

  if (!backup) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Restore from Backup"
      description="A new database instance will be created from this backup. Your current database is not affected."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => handleRestore()}
            disabled={isPending || !newName.trim()}
          >
            <RotateCcw size={13} className="mr-1.5" />
            {isPending ? "Creating…" : "Create instance"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Source backup info */}
        <div className="bg-[#0A0A0A] border border-[#1F1F23] rounded-lg p-3">
          <p className="text-[10px] text-[#52525B] uppercase tracking-wider font-medium mb-2">
            Restoring from
          </p>
          <div className="flex items-center gap-3">
            <Archive size={14} className="text-[#3B82F6] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">
                {format(new Date(backup.started_at), "MMM d yyyy, HH:mm")}
              </p>
              <p className="text-xs text-[#52525B] mt-0.5">
                {formatBytes(backup.size_bytes)} · {backup.type}
              </p>
            </div>
          </div>
        </div>

        <TextInput
          label="New instance name"
          required
          placeholder="restored-db"
          value={newName}
          onChange={setNewName}
          hint="A new postgres instance with this name will be created"
        />

        <FormField label="Memory allocation" required>
          <div className="grid grid-cols-4 gap-2">
            {MEMORY_OPTIONS.map((mb) => (
              <button
                key={mb}
                type="button"
                onClick={() => setMemory(mb)}
                className={cn(
                  "flex flex-col items-center justify-center h-16 rounded-lg border text-sm font-medium transition-all",
                  memory === mb
                    ? "border-[#3B82F6] bg-[#1D3461] text-[#3B82F6]"
                    : "border-[#27272A] bg-[#1A1A1A] text-[#A1A1AA] hover:border-[#3B82F6] hover:text-[#3B82F6]"
                )}
              >
                <span className="font-mono font-bold">
                  {mb >= 1024 ? `${mb / 1024}GB` : `${mb}MB`}
                </span>
                <span className="text-xs opacity-60 mt-0.5">RAM</span>
              </button>
            ))}
          </div>
        </FormField>

        {/* Info box */}
        <div className="flex items-start gap-2 p-3 bg-[#1D3461]/20 border border-[#3B82F6]/20 rounded-md">
          <Info size={13} className="text-[#3B82F6] shrink-0 mt-0.5" />
          <div className="text-xs text-[#A1A1AA] leading-relaxed">
            <p className="font-medium text-white mb-1">What happens next:</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>A new postgres container will be created</li>
              <li>The backup will be restored into it</li>
              <li>Your original database stays untouched</li>
              <li>Restore can take a few minutes for large backups</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  )
}
