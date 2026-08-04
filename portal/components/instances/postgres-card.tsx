"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Archive, Database, Eye, EyeOff, Copy, Check, Trash2, Table2 } from "lucide-react"
import { toast } from "sonner"
import { ConnectionRow } from "./connection-row"
import type { Instance } from "@/types"
import { cn } from "@/lib/utils"

function StatusBadge({ status }: { status: string }) {
  const config = {
    running: {
      bg: "bg-[#14291E]",
      text: "text-[#22C55E]",
      border: "border-[#22C55E20]",
      dot: "bg-[#22C55E]",
    },
    stopped: {
      bg: "bg-[#2D1414]",
      text: "text-[#EF4444]",
      border: "border-[#EF444420]",
      dot: "bg-[#EF4444]",
    },
    error: {
      bg: "bg-[#2D2510]",
      text: "text-[#EAB308]",
      border: "border-[#EAB30820]",
      dot: "bg-[#EAB308]",
    },
  }
  const style = config[status as keyof typeof config] || config.stopped
  return (
      <span
          className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full border",
              style.bg,
              style.text,
              style.border
          )}
      >
      <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
      <span className="capitalize">{status}</span>
    </span>
  )
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const extractPassword = (dsn: string): string => {
  try {
    const url = new URL(dsn)
    return url.password
  } catch {
    return ""
  }
}
const maskPassword = (dsn: string): string => {
  try {
    const url = new URL(dsn)
    return dsn.replace(`:${url.password}@`, ":••••••••••••@")
  } catch {
    return dsn
  }
}

export function PostgresCard({
                               instance,
                               onDelete,
                             }: {
  instance: Instance
  onDelete: () => void
}) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showDSN, setShowDSN] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyField = async (field: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    toast.success(`${field} copied to clipboard`, {
      duration: 1500,
      position: "bottom-right",
    })
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
      <div className="bg-[#111111] border border-[#27272A] rounded-xl p-5 hover:border-[#3B82F6]/30 transition-all duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1D3461] flex items-center justify-center shrink-0">
              <Database size={18} className="text-[#3B82F6]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-white font-semibold text-sm">{instance.name}</h3>
                <button
                    onClick={() => copyField("name", instance.name)}
                    className="text-[#52525B] hover:text-[#A1A1AA] transition-colors opacity-0 group-hover:opacity-100"
                >
                  {copiedField === "name" ? (
                      <Check size={10} className="text-[#22C55E]" />
                  ) : (
                      <Copy size={10} />
                  )}
                </button>
              </div>
              <p className="text-[#52525B] text-xs mt-0.5">
                PostgreSQL 16 · {instance.memory_mb}MB RAM
              </p>
            </div>
          </div>
          <StatusBadge status={instance.status} />
        </div>

        {/* Quick info row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[#0A0A0A] rounded-lg p-2.5 text-center">
            <p className="text-[#52525B] text-xs mb-1">Created</p>
            <p className="text-[#A1A1AA] text-xs font-medium">
              {formatRelativeTime(instance.created_at)}
            </p>
          </div>
          <div className="bg-[#0A0A0A] rounded-lg p-2.5 text-center">
            <p className="text-[#52525B] text-xs mb-1">Port</p>
            <p className="text-[#A1A1AA] text-xs font-mono font-medium">{instance.port}</p>
          </div>
          <div className="bg-[#0A0A0A] rounded-lg p-2.5 text-center">
            <p className="text-[#52525B] text-xs mb-1">Memory</p>
            <p className="text-[#A1A1AA] text-xs font-medium">{instance.memory_mb}MB</p>
          </div>
        </div>

        {/* Connection details */}
        <div className="bg-[#0A0A0A] border border-[#1F1F23] rounded-lg px-3 py-2 mb-4 flex-1 flex flex-col">
          <p className="text-[#52525B] text-[11px] uppercase tracking-wider font-medium mb-3" style={{ letterSpacing: "0.05em" }}>
            Connection Details
          </p>
          <ConnectionRow
              label="Host"
              value={instance.host}
              onCopy={() => copyField("Host", instance.host)}
              copied={copiedField === "Host"}
          />
          <ConnectionRow
              label="Port"
              value={String(instance.port)}
              onCopy={() => copyField("Port", String(instance.port))}
              copied={copiedField === "Port"}
          />
          <ConnectionRow
              label="Database"
              value={instance.name}
              onCopy={() => copyField("Database", instance.name)}
              copied={copiedField === "Database"}
          />
          <ConnectionRow
              label="Username"
              value={instance.name}
              onCopy={() => copyField("Username", instance.name)}
              copied={copiedField === "Username"}
          />
          {/* Password row */}
          <div className="flex items-center justify-between py-1.5 border-b border-[#1F1F23]">
            <span className="text-[#52525B] text-xs w-20 shrink-0">Password</span>
            <span className="text-[#A1A1AA] text-xs font-mono flex-1 mx-3">
            {showPassword ? extractPassword(instance.dsn) : "••••••••••••"}
          </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                  onClick={() => setShowPassword((v) => !v)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
              >
                {showPassword ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
              <button
                  onClick={() => copyField("Password", extractPassword(instance.dsn))}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
              >
                {copiedField === "Password" ? (
                    <Check size={11} className="text-[#22C55E]" />
                ) : (
                    <Copy size={11} />
                )}
              </button>
            </div>
          </div>
          {/* URL row */}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[#52525B] text-xs w-20 shrink-0">URL</span>
            <span className="text-[#A1A1AA] text-xs font-mono flex-1 mx-3 truncate">
            {showDSN ? instance.dsn : maskPassword(instance.dsn)}
          </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                  onClick={() => setShowDSN((v) => !v)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
              >
                {showDSN ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
              <button
                  onClick={() => copyField("URL", instance.dsn)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
              >
                {copiedField === "URL" ? (
                    <Check size={11} className="text-[#22C55E]" />
                ) : (
                    <Copy size={11} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          <button
              onClick={() => router.push(`/postgres/${instance.id}/explore`)}
              className="flex-1 flex items-center justify-center gap-2 h-8 rounded-md bg-[#1A1A1A] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white text-xs font-medium border border-[#27272A] transition-all"
          >
            <Table2 size={13} />
            Explore
          </button>
          <button
              onClick={() => router.push(`/postgres/${instance.id}/backups`)}
              className="flex-1 flex items-center justify-center gap-2 h-8 rounded-md bg-[#1A1A1A] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white text-xs font-medium border border-[#27272A] transition-all"
          >
            <Archive size={13} />
            Backups
          </button>
          <button
              onClick={onDelete}
              className="h-8 w-8 flex items-center justify-center rounded-md bg-[#1A1A1A] hover:bg-[#2D1414] border border-[#27272A] hover:border-[#EF4444]/40 text-[#52525B] hover:text-[#EF4444] transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
  )
}
