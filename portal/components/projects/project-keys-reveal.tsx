"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Copy, Check, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { APIKeyWithSecret } from "@/types"

interface Props {
  projectName: string
  anonKey: APIKeyWithSecret
  serviceKey: APIKeyWithSecret
  onAcknowledge: () => void
}

export function ProjectKeysReveal({
  anonKey,
  serviceKey,
  onAcknowledge,
}: Props) {
  const [copied, setCopied] = useState<{ anon: boolean; service: boolean }>({
    anon: false,
    service: false,
  })
  const [acknowledged, setAcknowledged] = useState(false)

  function copy(text: string, which: "anon" | "service") {
    navigator.clipboard.writeText(text)
    setCopied((prev) => ({ ...prev, [which]: true }))
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied((prev) => ({ ...prev, [which]: false })), 2000)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Warning banner */}
      <div className="bg-[#2D2510]/40 border border-[#D4A843]/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-[#D4A843] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">
              These keys are shown once. Save them somewhere safe now.
            </p>
            <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">
              For security, MassiCloud stores only a hash of each key. If you
              lose them you&apos;ll need to rotate.
            </p>
          </div>
        </div>
      </div>

      {/* Anon key */}
      <KeyRevealCard
        label="Anonymous key"
        description="Safe to expose in browsers and mobile apps. Combine with Row Level Security policies to enforce access."
        fullKey={anonKey.full_key}
        accent="#3B82F6"
        copied={copied.anon}
        onCopy={() => copy(anonKey.full_key, "anon")}
      />

      {/* Service key */}
      <KeyRevealCard
        label="Service key"
        description="Bypasses Row Level Security. NEVER expose in browser or mobile code. Use only from trusted server environments."
        fullKey={serviceKey.full_key}
        accent="#EF4444"
        copied={copied.service}
        onCopy={() => copy(serviceKey.full_key, "service")}
        critical
      />

      {/* Acknowledgment checkbox */}
      <label className="flex items-center gap-2 cursor-pointer bg-[#0A0A0A] border border-[#27272A] rounded-lg p-3 hover:border-[#3B3B3B] transition-colors">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="rounded border-[#27272A] bg-[#1A1A1A] accent-[#D4A843]"
        />
        <span className="text-sm text-[#A1A1AA]">
          I have saved both keys somewhere safe
        </span>
      </label>

      <div className="flex justify-end">
        <Button disabled={!acknowledged} onClick={onAcknowledge}>
          Continue to project
        </Button>
      </div>
    </div>
  )
}

interface KeyRevealCardProps {
  label: string
  description: string
  fullKey: string
  accent: string
  copied: boolean
  onCopy: () => void
  critical?: boolean
}

function KeyRevealCard({
  label,
  description,
  fullKey,
  accent,
  copied,
  onCopy,
  critical,
}: KeyRevealCardProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div
      className="bg-[#0A0A0A] border rounded-lg overflow-hidden"
      style={{ borderColor: critical ? `${accent}40` : "#27272A" }}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: accent }}
          />
          <span className="text-sm font-semibold text-white">{label}</span>
          {critical && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: `${accent}20`, color: accent }}
            >
              Critical
            </span>
          )}
        </div>
        <p className="text-xs text-[#52525B] leading-relaxed mb-3">
          {description}
        </p>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[#111111] border border-[#1F1F23] rounded px-3 py-2 font-mono text-xs text-white overflow-x-auto whitespace-nowrap">
            {revealed ? fullKey : maskKey(fullKey)}
          </div>
          <button
            onClick={() => setRevealed((r) => !r)}
            title={revealed ? "Hide key" : "Show key"}
            className="shrink-0 h-9 w-9 flex items-center justify-center bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] rounded text-[#A1A1AA] hover:text-white transition-all"
          >
            {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button
            onClick={onCopy}
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
    </div>
  )
}

function maskKey(key: string): string {
  const visible = key.split("_").slice(0, 2).join("_") + "_"
  return visible + "•".repeat(Math.max(key.length - visible.length, 8))
}
