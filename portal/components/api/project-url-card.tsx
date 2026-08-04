"use client"

import { useState } from "react"
import { Database, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { getApiBaseUrl } from "@/lib/api"

interface Props {
  slug: string
  dbName: string
}

export function DatabaseUrlCard({ slug, dbName }: Props) {
  const [copied, setCopied] = useState(false)
  const base = typeof window !== "undefined"
    ? getApiBaseUrl()
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080")
  const url = `${base}/v1/${slug}/db/${dbName}`

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("Copied")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-[#1D3461]/40 flex items-center justify-center shrink-0">
          <Database size={14} className="text-[#3B82F6]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Database URL</h3>
          <p className="text-xs text-[#52525B] mt-0.5">
            Base URL for all REST and auth calls to{" "}
            <span className="font-mono text-[#A1A1AA]">{dbName}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-[#0A0A0A] border border-[#1F1F23] rounded px-3 py-2 font-mono text-xs text-white overflow-x-auto whitespace-nowrap">
          {url}
        </div>
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
  )
}
