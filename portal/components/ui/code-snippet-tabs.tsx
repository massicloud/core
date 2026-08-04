"use client"

import { useState } from "react"
import { Check, Copy, Package } from "lucide-react"
import { cn } from "@/lib/utils"

export type SnippetLang = "sdk" | "curl" | "cli" | "js" | "py" | "go"

const DEFAULT_LABELS: Record<SnippetLang, string> = {
  sdk: "SDK",
  curl: "cURL",
  cli: "CLI",
  js: "JavaScript",
  py: "Python",
  go: "Go",
}

const DEFAULT_ORDER: SnippetLang[] = ["sdk", "curl", "cli", "js", "py", "go"]

interface CodeSnippetTabsProps {
  /** Only languages with a defined snippet render a tab. */
  snippets: Partial<Record<SnippetLang, string>>
  /** Override display labels per language, e.g. { js: "Node.js (ioredis)" }. */
  labels?: Partial<Record<SnippetLang, string>>
  /** Override tab order. Defaults to sdk, curl, cli, js, py, go. */
  order?: SnippetLang[]
  defaultLang?: SnippetLang
  /** Shown above the code body only while the "sdk" tab is active, e.g. "npm install @massicloud/client". */
  installHint?: string
  className?: string
}

/** Shared tabbed code-snippet viewer — the one place every page renders a multi-language snippet block from. */
export function CodeSnippetTabs({
  snippets,
  labels,
  order = DEFAULT_ORDER,
  defaultLang,
  installHint,
  className,
}: CodeSnippetTabsProps) {
  const available = order.filter((l) => snippets[l] !== undefined)
  const initial = defaultLang && snippets[defaultLang] !== undefined ? defaultLang : available[0]
  const [lang, setLang] = useState<SnippetLang | undefined>(initial)
  const [copied, setCopied] = useState(false)

  if (available.length === 0 || !lang) return null

  function copy() {
    navigator.clipboard.writeText(snippets[lang!] ?? "")
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn("rounded-lg border border-[#1F1F23] overflow-hidden bg-[#0A0A0A]", className)}>
      <div className="flex items-center justify-between border-b border-[#1F1F23] px-3 py-1.5">
        <div className="flex gap-0.5">
          {available.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "h-6 px-2.5 rounded text-[11px] font-medium transition-all",
                lang === l ? "bg-[#1A1A1A] text-white" : "text-[#52525B] hover:text-[#9CA3AF]"
              )}
            >
              {labels?.[l] ?? DEFAULT_LABELS[l]}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-[#9CA3AF] transition-all"
        >
          {copied ? <Check size={11} className="text-[#22C55E]" /> : <Copy size={11} />}
        </button>
      </div>

      {lang === "sdk" && installHint && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#0D0D0D] border-b border-[#1F1F23]">
          <Package size={11} className="text-[#D4A843] shrink-0" />
          <code className="text-[10px] font-mono text-[#52525B]">{installHint}</code>
        </div>
      )}

      <pre className="p-4 text-xs overflow-x-auto bg-[#050505] max-h-96 leading-relaxed whitespace-pre">
        <code className="font-mono text-[#D4D4D8]">{snippets[lang]}</code>
      </pre>
    </div>
  )
}
