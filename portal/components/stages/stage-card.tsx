"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Layers, Lock, LockOpen, Plus, Trash2,
  Database, Activity, Code2, ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import * as api from "@/lib/api"
import type { Stage, Instance } from "@/types"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AddInstanceModal } from "./add-instance-modal"
import { useIsProvisioningInstance } from "@/lib/instance-provisioning"

interface Props {
  stage:       Stage
  projectId:   string
}

export function StageCard({ stage, projectId }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isProvisioning = useIsProvisioningInstance()

  const [addingInstance,       setAddingInstance]       = useState(false)
  const [confirmDelete,        setConfirmDelete]        = useState(false)
  const [confirmDeleteInst,    setConfirmDeleteInst]    = useState<Instance | null>(null)

  const { mutate: toggleProtection, isPending: togglingProtection } = useMutation({
    mutationFn: () => api.setStageProtected(projectId, stage.name, !stage.is_protected),
    onSuccess:  () => {
      toast.success(stage.is_protected ? 'Protection removed' : 'Stage protected')
      queryClient.invalidateQueries({ queryKey: ['stages', projectId] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  })

  const { mutate: doDeleteStage, isPending: deletingStage } = useMutation({
    mutationFn: () => api.deleteStage(projectId, stage.name),
    onSuccess:  () => {
      toast.success(`Stage "${stage.name}" deleted`)
      queryClient.invalidateQueries({ queryKey: ['stages', projectId] })
      setConfirmDelete(false)
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to delete stage'),
  })

  const { mutate: doDeleteInstance } = useMutation({
    mutationFn: (instanceName: string) =>
      api.removeInstanceFromStage(projectId, stage.name, instanceName),
    onSuccess: () => {
      toast.success('Database deleted')
      queryClient.invalidateQueries({ queryKey: ['stages', projectId] })
      setConfirmDeleteInst(null)
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to delete database'),
  })

  const instances = stage.instances ?? []

  return (
    <>
      <div className="bg-[#111111] border border-[#27272A] rounded-xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1F1F23] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#2D2410] flex items-center justify-center shrink-0">
              <Layers size={14} className="text-[#D4A843]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">{stage.name}</h3>
                {stage.is_protected && (
                  <div className="flex items-center gap-1 text-[10px] text-[#D4A843]">
                    <Lock size={9} />
                    <span className="font-bold uppercase tracking-wider">Protected</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-[#52525B] font-mono mt-0.5">
                Created {format(new Date(stage.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push(`/projects/${projectId}/api?stage=${stage.name}`)}
            className="h-8 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] hover:border-[#3B82F6]/40 rounded text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1.5 transition-all"
          >
            <Code2 size={11} />
            API Spec
          </button>
        </div>

        {/* Instance list */}
        <div className="p-5">
          {instances.length === 0 ? (
            <div className="bg-[#0A0A0A] border border-dashed border-[#27272A] rounded-lg p-6 text-center">
              <p className="text-xs text-[#52525B] mb-3">No databases in this stage yet</p>
              <button
                onClick={() => setAddingInstance(true)}
                disabled={isProvisioning}
                title={isProvisioning ? 'A database is already being created' : undefined}
                className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] rounded text-xs text-[#A1A1AA] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#1A1A1A] disabled:hover:text-[#A1A1AA]"
              >
                <Plus size={11} />
                {isProvisioning ? 'Creating…' : 'Add the first database'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {instances.map((inst) => (
                <InstanceRow
                  key={inst.id}
                  instance={inst}
                  onOpen={() => {
                    if (inst.type === 'postgres') router.push(`/postgres/${inst.id}/explore`)
                    if (inst.type === 'mysql') router.push(`/mysql/${inst.id}`)
                  }}
                  onDelete={() => setConfirmDeleteInst(inst)}
                />
              ))}
              <button
                onClick={() => setAddingInstance(true)}
                disabled={isProvisioning}
                title={isProvisioning ? 'A database is already being created' : undefined}
                className="w-full h-8 border border-dashed border-[#27272A] hover:border-[#3B3B3B] rounded text-xs text-[#52525B] hover:text-[#A1A1AA] flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#27272A] disabled:hover:text-[#52525B]"
              >
                <Plus size={11} />
                {isProvisioning ? 'Creating…' : 'Add database'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1F1F23] bg-[#0D0D0D] flex items-center justify-between gap-2">
          <button
            onClick={() => toggleProtection()}
            disabled={togglingProtection}
            className="h-7 px-2.5 text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {stage.is_protected ? <LockOpen size={11} /> : <Lock size={11} />}
            {stage.is_protected ? 'Remove protection' : 'Protect'}
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            disabled={stage.is_protected}
            title={stage.is_protected ? 'Remove protection first' : undefined}
            className={cn(
              "h-7 px-2.5 text-xs flex items-center gap-1.5 transition-colors",
              stage.is_protected
                ? "text-[#52525B] opacity-30 cursor-not-allowed"
                : "text-[#A1A1AA] hover:text-[#EF4444]"
            )}
          >
            <Trash2 size={11} />
            Delete stage
          </button>
        </div>
      </div>

      <AddInstanceModal
        open={addingInstance}
        onClose={() => setAddingInstance(false)}
        projectId={projectId}
        stageName={stage.name}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete stage "${stage.name}"?`}
        message={`This will permanently delete the stage and its ${instances.length} database${instances.length === 1 ? '' : 's'}. All data will be lost. This cannot be undone.`}
        confirmLabel="Delete stage"
        requiresTyping={stage.name}
        onConfirm={() => doDeleteStage()}
        loading={deletingStage}
      />

      <ConfirmDialog
        open={!!confirmDeleteInst}
        onClose={() => setConfirmDeleteInst(null)}
        title={`Delete "${confirmDeleteInst?.name}"?`}
        message="The database and all its data will be deleted. This cannot be undone."
        confirmLabel="Delete database"
        onConfirm={() => confirmDeleteInst && doDeleteInstance(confirmDeleteInst.name)}
      />
    </>
  )
}

function InstanceRow({
  instance,
  onOpen,
  onDelete,
}: {
  instance: Instance
  onOpen:   () => void
  onDelete: () => void
}) {
  const Icon       = instance.type === 'redis' ? Activity : Database
  const colorClass =
    instance.type === 'postgres' ? 'text-[#3B82F6]' :
    instance.type === 'mysql'    ? 'text-[#F29111]' :
    'text-[#EF4444]'
  const isExplorable = instance.type === 'postgres' || instance.type === 'mysql'

  return (
    <div className="group flex items-center justify-between gap-3 bg-[#0A0A0A] border border-[#1F1F23] hover:border-[#27272A] rounded-lg px-3 py-2.5 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Icon size={13} className={cn(colorClass, 'shrink-0')} />
        <span className="font-mono text-xs text-white truncate">{instance.name}</span>
        <span className="text-[9px] uppercase tracking-wider text-[#52525B] font-mono shrink-0">
          {instance.type}
        </span>
        <span className="text-[10px] text-[#52525B] shrink-0">{instance.memory_mb} MB</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
          <span className="text-[10px] text-[#22C55E]">running</span>
        </div>

        {isExplorable && (
          <button
            onClick={onOpen}
            className="h-7 px-2 text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1 transition-colors"
          >
            <ExternalLink size={10} />
            Open
          </button>
        )}

        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center text-[#52525B] hover:text-[#EF4444] rounded hover:bg-[#2D1414]"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
