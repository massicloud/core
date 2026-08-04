"use client"

import { useState } from "react"
import {
  FolderArchive,
  Globe,
  Lock,
  FolderOpen,
  Trash2,
  Pencil,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
} from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CodeSnippetTabs } from "@/components/ui/code-snippet-tabs"
import { RenameBucketModal } from "./rename-bucket-modal"
import { formatBytes, formatRelativeTime } from "./helpers"
import { deleteBucket, getErrorMessage, getApiBaseUrl } from "@/lib/api"
import { buildStorageSnippets } from "@/lib/code-snippets"
import type { Bucket } from "@/types"
import { cn } from "@/lib/utils"

const STORAGE_OPS = [
  { id: "list" as const, label: "List" },
  { id: "upload" as const, label: "Upload" },
  { id: "download" as const, label: "Download" },
  { id: "signedUrl" as const, label: "Signed URL" },
  { id: "remove" as const, label: "Remove" },
]
type StorageOp = (typeof STORAGE_OPS)[number]["id"]

interface BucketCardProps {
  bucket: Bucket
  projectSlug: string
  anonKeyPrefix: string
  onClick: () => void
}

export function BucketCard({ bucket, projectSlug, anonKeyPrefix, onClick }: BucketCardProps) {
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [sdkOpen, setSdkOpen] = useState(false)
  const [op, setOp] = useState<StorageOp>("list")
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => deleteBucket(bucket.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buckets"] })
      toast.success(`Bucket "${bucket.name}" deleted`)
      setDeleteOpen(false)
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err))
    },
  })

  function copyField(value: string, field: string) {
    navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const bucketURL = `${typeof window !== "undefined" ? getApiBaseUrl() : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080")}/v1/${projectSlug}/storage/buckets/${bucket.name}`

  const snippets = buildStorageSnippets(
    {
      projectSlug,
      anonKeyDisplay: anonKeyPrefix,
      bucketName: bucket.name,
      apiBaseURL: typeof window !== "undefined" ? getApiBaseUrl() : undefined,
    },
    op
  )

  return (
    <>
      <div
        className={cn(
          "bg-[#111111] border border-[#27272A] rounded-xl",
          "hover:border-[#A855F7]/30 transition-all duration-200",
          "flex flex-col"
        )}
      >
        {/* ── Clickable body ── */}
        <div
          onClick={onClick}
          className="p-5 cursor-pointer group flex-1"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#2D1A4A] flex items-center justify-center shrink-0">
                <FolderArchive size={18} className="text-[#A855F7]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-semibold text-sm truncate">
                  {bucket.name}
                </h3>
                <p className="text-[#52525B] text-xs mt-0.5">
                  Created {formatRelativeTime(bucket.created_at)}
                </p>
              </div>
            </div>

            {bucket.public ? (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#14291E] border border-[#22C55E]/20 shrink-0">
                <Globe size={10} className="text-[#22C55E]" />
                <span className="text-[10px] text-[#22C55E] font-medium">
                  Public
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1F1F23] border border-[#27272A] shrink-0">
                <Lock size={10} className="text-[#A1A1AA]" />
                <span className="text-[10px] text-[#A1A1AA] font-medium">
                  Private
                </span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0A0A0A] rounded-lg p-2.5 text-center">
              <p className="text-[#52525B] text-xs mb-1">Files</p>
              <p className="text-[#A1A1AA] text-xs font-mono font-medium">
                {bucket.file_count.toLocaleString()}
              </p>
            </div>
            <div className="bg-[#0A0A0A] rounded-lg p-2.5 text-center">
              <p className="text-[#52525B] text-xs mb-1">Size</p>
              <p className="text-[#A1A1AA] text-xs font-mono font-medium">
                {formatBytes(bucket.size_bytes)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Connection info ── */}
        <div className="border-t border-[#1A1A1A] px-5 py-3">
          <div className="flex flex-col gap-1.5">
            <ConnectRow
              label="API URL"
              value={bucketURL}
              field="bucketURL"
              copiedField={copiedField}
              onCopy={copyField}
            />
            <ConnectRow
              label="Bucket"
              value={bucket.name}
              field="bucket"
              copiedField={copiedField}
              onCopy={copyField}
            />
          </div>

          {/* SDK snippet toggle */}
          <button
            onClick={() => setSdkOpen((v) => !v)}
            className="flex items-center gap-1.5 mt-3 text-[11px] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
          >
            <Code2 size={11} />
            Code snippets
            {sdkOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {sdkOpen && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              {/* Operation tabs */}
              <div className="flex gap-1 mb-2 flex-wrap">
                {STORAGE_OPS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setOp(o.id)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                      op === o.id
                        ? "bg-[#2D1A4A] text-[#A855F7]"
                        : "text-[#52525B] hover:text-[#A1A1AA]"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <CodeSnippetTabs
                snippets={snippets}
                defaultLang="sdk"
                installHint="npm install @massicloud/client"
              />
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div
          className="border-t border-[#1A1A1A] px-5 py-3 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClick}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md bg-[#1A1A1A] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white text-xs font-medium border border-[#27272A] transition-all"
          >
            <FolderOpen size={13} />
            Browse
          </button>
          <button
            onClick={() => setRenameOpen(true)}
            title="Rename bucket"
            className="h-8 w-8 flex items-center justify-center rounded-md bg-[#1A1A1A] hover:bg-[#1D3461]/40 border border-[#27272A] hover:border-[#3B82F6]/40 text-[#52525B] hover:text-[#3B82F6] transition-all"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            title="Delete bucket"
            className="h-8 w-8 flex items-center justify-center rounded-md bg-[#1A1A1A] hover:bg-[#2D1414] border border-[#27272A] hover:border-[#EF4444]/40 text-[#52525B] hover:text-[#EF4444] transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <RenameBucketModal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        currentName={bucket.name}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete bucket"
        message={`Delete "${bucket.name}"? The bucket must be empty first. This cannot be undone.`}
        confirmLabel="Delete bucket"
        loading={deleteMutation.isPending}
        requiresTyping={bucket.name}
      />
    </>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────

interface ConnectRowProps {
  label: string
  value: string
  field: string
  copiedField: string | null
  onCopy: (value: string, field: string) => void
}

function ConnectRow({
  label,
  value,
  field,
  copiedField,
  onCopy,
}: ConnectRowProps) {
  return (
    <div className="flex items-center gap-2 group/row">
      <span className="text-[10px] text-[#3B3B3B] font-medium uppercase tracking-wider w-14 shrink-0">
        {label}
      </span>
      <span className="text-[11px] text-[#52525B] font-mono truncate flex-1">
        {value}
      </span>
      <button
        onClick={() => onCopy(value, field)}
        className="opacity-0 group-hover/row:opacity-100 transition-opacity text-[#3B3B3B] hover:text-white"
      >
        {copiedField === field ? (
          <Check size={11} className="text-[#22C55E]" />
        ) : (
          <Copy size={11} />
        )}
      </button>
    </div>
  )
}
