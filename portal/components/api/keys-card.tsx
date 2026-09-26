"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Globe, ShieldOff, RotateCw, Copy, Check, Eye, EyeOff } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { rotateAPIKey, getErrorMessage } from "@/lib/api"
import type { APIKey, APIKeyType, APIKeyWithSecret } from "@/types"

interface Props {
  type: APIKeyType
  keyRecord?: APIKey
  projectId: string
}

const CONFIG = {
  anon: {
    label: "Anonymous key",
    description:
      "Safe to ship in browsers and mobile apps. Combine with RLS policies for access control.",
    accent: "#3B82F6",
    Icon: Globe,
    critical: false,
  },
  service: {
    label: "Service key",
    description:
      "Bypasses RLS. Use only from trusted server-side code. Never expose in client code.",
    accent: "#EF4444",
    Icon: ShieldOff,
    critical: true,
  },
}

export function KeysCard({ type, keyRecord, projectId }: Props) {
  const [showRotate, setShowRotate] = useState(false)
  const [rotatedKey, setRotatedKey] = useState<APIKeyWithSecret | null>(null)
  const queryClient = useQueryClient()

  const { label, description, accent, Icon, critical } = CONFIG[type]

  const { mutate: rotate, isPending } = useMutation({
    mutationFn: () => rotateAPIKey(projectId, type),
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.full_key)
      toast.success("New key copied to clipboard")
      setRotatedKey(data)
      setShowRotate(false)
      queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (!keyRecord) {
    return (
      <div className="bg-[#111111] border border-[#27272A] rounded-xl p-6">
        <p className="text-sm text-[#52525B]">No {type} key exists.</p>
      </div>
    )
  }

  return (
    <>
      <div
        className="bg-[#111111] border rounded-xl overflow-hidden"
        style={{ borderColor: critical ? `${accent}25` : "#27272A" }}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${accent}15` }}
              >
                <Icon size={16} style={{ color: accent }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{label}</h3>
                  {critical && (
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: `${accent}20`, color: accent }}
                    >
                      Critical
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#52525B] mt-1 max-w-md leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRotate(true)}
              className="shrink-0 h-8 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] rounded text-xs font-medium text-[#A1A1AA] hover:text-white transition-all flex items-center gap-1.5"
            >
              <RotateCw size={11} />
              Rotate &amp; copy
            </button>
          </div>

          {/* Key display (prefix only, not a usable value) */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#0A0A0A] border border-[#1F1F23] rounded px-3 py-2.5 font-mono text-xs">
              <span className="text-[#A1A1AA]">{keyRecord.key_prefix}</span>
              <span className="text-[#3B3B3B]">…</span>
            </div>
          </div>

          {/* Hint */}
          <p className="text-[10px] text-[#3B3B3B] mt-1.5">
            This is only an identifying prefix, not the full key — MassiCloud never stores or
            displays it again. Click{" "}
            <span className="text-[#52525B]">Rotate &amp; copy</span> to generate a new usable key.
          </p>

          {/* Metadata */}
          <div className="mt-2 flex items-center gap-4 text-[10px] text-[#52525B]">
            <span>
              Created{" "}
              {formatDistanceToNow(new Date(keyRecord.created_at), {
                addSuffix: true,
              })}
            </span>
            {keyRecord.last_used_at && (
              <span>
                Last used{" "}
                {formatDistanceToNow(new Date(keyRecord.last_used_at), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rotation confirm */}
      <ConfirmDialog
        open={showRotate}
        onClose={() => setShowRotate(false)}
        title={`Rotate ${label.toLowerCase()}?`}
        message={
          critical
            ? "Existing servers using this key will FAIL immediately after rotation. Make sure you can update them in the next few minutes. You'll be shown the new key once to copy."
            : "Apps using this key will need to be updated. Existing user sessions stay valid (they use JWTs). You'll be shown the new full key once to copy."
        }
        confirmLabel="Rotate & show new key"
        loading={isPending}
        requiresTyping={critical ? "rotate" : undefined}
        onConfirm={() => rotate()}
      />

      {/* Show new key once */}
      {rotatedKey && (
        <Modal
          open={true}
          title="New key generated"
          description="Copy this key now. You won't see it again."
          size="md"
        >
          <RotatedKeyReveal
            apiKey={rotatedKey}
            accent={accent}
            onAcknowledge={() => setRotatedKey(null)}
          />
        </Modal>
      )}
    </>
  )
}

function RotatedKeyReveal({
  apiKey,
  accent,
  onAcknowledge,
}: {
  apiKey: APIKeyWithSecret
  accent: string
  onAcknowledge: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  function copy() {
    navigator.clipboard.writeText(apiKey.full_key)
    setCopied(true)
    toast.success("Copied")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#2D2510]/40 border border-[#D4A843]/30 rounded-lg p-3">
        <p className="text-xs text-white">
          The old key has been revoked. Update your apps now.
        </p>
      </div>

      <div
        className="bg-[#0A0A0A] border rounded-lg p-4"
        style={{ borderColor: `${accent}30` }}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[#111111] border border-[#1F1F23] rounded px-3 py-2 font-mono text-xs text-white overflow-x-auto whitespace-nowrap">
            {revealed ? apiKey.full_key : maskKey(apiKey.full_key)}
          </div>
          <button
            onClick={() => setRevealed((r) => !r)}
            title={revealed ? "Hide key" : "Show key"}
            className="shrink-0 h-9 w-9 flex items-center justify-center bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] rounded text-[#A1A1AA] hover:text-white transition-all"
          >
            {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button
            onClick={copy}
            className="shrink-0 h-9 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] rounded text-xs font-medium text-[#A1A1AA] hover:text-white transition-all flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check size={12} className="text-[#22C55E]" /> Copied
              </>
            ) : (
              <>
                <Copy size={12} /> Copy
              </>
            )}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer bg-[#0A0A0A] border border-[#27272A] rounded-lg p-3 hover:border-[#3B3B3B] transition-colors">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="rounded border-[#27272A] bg-[#1A1A1A] accent-[#D4A843]"
        />
        <span className="text-sm text-[#A1A1AA]">
          I have saved the new key
        </span>
      </label>

      <div className="flex justify-end">
        <Button disabled={!acknowledged} onClick={onAcknowledge}>
          Done
        </Button>
      </div>
    </div>
  )
}

function maskKey(key: string): string {
  const visible = key.split("_").slice(0, 2).join("_") + "_"
  return visible + "•".repeat(Math.max(key.length - visible.length, 8))
}

export function KeysCardSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="bg-[#111111] border border-[#27272A] rounded-xl p-5"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-[#1A1A1A] animate-pulse shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-3 w-32 bg-[#1A1A1A] rounded animate-pulse" />
              <div className="h-2 w-64 bg-[#1A1A1A] rounded animate-pulse" />
            </div>
          </div>
          <div className="h-9 bg-[#0A0A0A] border border-[#1F1F23] rounded" />
        </div>
      ))}
    </div>
  )
}
