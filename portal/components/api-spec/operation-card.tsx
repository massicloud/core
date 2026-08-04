"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { CodeSnippetTabs } from "@/components/ui/code-snippet-tabs"
import type { Snippets } from "@/lib/code-snippets"

const METHOD_COLORS: Record<string, string> = {
  GET:    "#3B82F6",
  POST:   "#22C55E",
  PATCH:  "#EAB308",
  DELETE: "#EF4444",
}

interface Props {
  method: string
  path: string
  label: string
  isActive: boolean
  onToggle: () => void
  snippets: Snippets
}

export function OperationCard({ method, path, label, isActive, onToggle, snippets }: Props) {
  const color = METHOD_COLORS[method] ?? "#A1A1AA"

  return (
    <div className="bg-[#0A0A0A] border border-[#1F1F23] rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#0D0D0D] transition-colors text-left"
      >
        <span
          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono shrink-0"
          style={{ background: color + "20", color }}
        >
          {method}
        </span>
        <code className="text-xs font-mono text-[#A1A1AA] truncate flex-1">{path}</code>
        <span className="ml-auto text-xs text-[#52525B] hidden sm:inline shrink-0">{label}</span>
        <span className="text-[#52525B] shrink-0">
          {isActive ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      {isActive && (
        <div className="border-t border-[#1F1F23]">
          <CodeSnippetTabs
            snippets={snippets}
            defaultLang="sdk"
            installHint="npm install @massicloud/client"
            className="border-0 rounded-none"
          />
        </div>
      )}
    </div>
  )
}
