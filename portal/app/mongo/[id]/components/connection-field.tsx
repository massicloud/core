"use client"

import { useState } from "react"
import { Eye, EyeOff, Copy, Check } from "lucide-react"
import { toast } from "sonner"

function maskDSN(dsn: string): string {
  try {
    const url = new URL(dsn)
    if (!url.password) return dsn
    return dsn.replace(`:${url.password}@`, ":••••••••••••@")
  } catch {
    return dsn
  }
}

export function ConnectionField({ label, dsn }: { label: string; dsn: string }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(dsn)
    setCopied(true)
    toast.success(`${label} connection string copied`)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-lg border border-[#1E1E24] bg-[#111111] px-2.5 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-[#52525B] uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShow((v) => !v)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-[#A1A1AA]"
          >
            {show ? <EyeOff size={10} /> : <Eye size={10} />}
          </button>
          <button
            onClick={copy}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-[#A1A1AA]"
          >
            {copied ? <Check size={10} className="text-[#22C55E]" /> : <Copy size={10} />}
          </button>
        </div>
      </div>
      <p className="text-[10px] font-mono text-[#A1A1AA] truncate">{show ? dsn : maskDSN(dsn)}</p>
    </div>
  )
}
