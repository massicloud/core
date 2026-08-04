"use client"

import {
  AlertCircle,
  Check,
  Clock,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import type { Backup } from "@/types"

const STATUS_BG: Record<string, string> = {
  completed: "#14291E",
  running: "#1D3461",
  pending: "#2D2510",
  failed: "#2D1414",
}

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

function formatDuration(start: string, end: string | null): string {
  if (!end) return ""
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m`
}

function BackupTypeBadge({ type }: { type: Backup["type"] }) {
  const isManual = type === "manual"
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
        isManual
          ? "bg-[#1D3461] text-[#3B82F6]"
          : "bg-[#14291E] text-[#22C55E]"
      )}
    >
      {isManual ? "Manual" : "Auto"}
    </span>
  )
}

interface BackupRowProps {
  backup: Backup
  isLast: boolean
  onRestore: () => void
  onDelete: () => void
}

export function BackupRow({ backup, isLast, onRestore, onDelete }: BackupRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 hover:bg-[#0D0D0D] transition-colors group",
        !isLast && "border-b border-[#1F1F23]"
      )}
    >
      {/* Status icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: STATUS_BG[backup.status] ?? STATUS_BG.failed }}
      >
        {backup.status === "completed" && (
          <Check size={16} className="text-[#22C55E]" />
        )}
        {backup.status === "running" && (
          <Loader2 size={16} className="text-[#3B82F6] animate-spin" />
        )}
        {backup.status === "pending" && (
          <Clock size={16} className="text-[#EAB308]" />
        )}
        {backup.status === "failed" && (
          <AlertCircle size={16} className="text-[#EF4444]" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white">
            {format(new Date(backup.started_at), "MMM d yyyy, HH:mm")}
          </span>
          <BackupTypeBadge type={backup.type} />
          {backup.expires_at && (
            <span className="text-xs text-[#52525B]">
              · expires{" "}
              {formatDistanceToNow(new Date(backup.expires_at), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-[#52525B]">
          {backup.status === "completed" && (
            <>
              <span className="font-mono">{formatBytes(backup.size_bytes)}</span>
              <span>·</span>
              <span>
                completed in{" "}
                {formatDuration(backup.started_at, backup.completed_at)}
              </span>
            </>
          )}
          {backup.status === "running" && (
            <span>
              Running… started{" "}
              {formatDistanceToNow(new Date(backup.started_at), {
                addSuffix: true,
              })}
            </span>
          )}
          {backup.status === "pending" && <span>Queued</span>}
          {backup.status === "failed" && (
            <span className="text-[#EF4444]">
              {backup.error || "Backup failed"}
            </span>
          )}
        </div>
      </div>

      {/* Actions — only for completed backups */}
      {backup.status === "completed" && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRestore}
            className="flex items-center gap-1.5 h-8 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] hover:border-[#22C55E]/40 rounded-md text-xs text-[#A1A1AA] hover:text-[#22C55E] transition-all"
          >
            <RotateCcw size={11} />
            Restore
          </button>
          <button
            onClick={onDelete}
            className="h-8 w-8 flex items-center justify-center text-[#52525B] hover:text-[#EF4444] hover:bg-[#2D1414] rounded-md transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  )
}
