"use client"

import { useState, type ReactNode } from "react"
import { Sparkles, AlertCircle } from "lucide-react"
import { STARTER_CATEGORIES, type StarterCategory } from "@/lib/starter-queries"
import { cn } from "@/lib/utils"

interface Props {
  onPickQuery: (sql: string) => void
  categories?: StarterCategory[]
  footerNote?: ReactNode
}

export function SQLEditorHelp({
  onPickQuery,
  categories = STARTER_CATEGORIES,
  footerNote = (
    <>
      Queries run as <span className="font-mono text-[#52525B]">postgres</span> — RLS doesn&apos;t apply
    </>
  ),
}: Props) {
  const [activeCategory, setActiveCategory] = useState<StarterCategory["id"]>(categories[0]?.id ?? "common")
  const category = categories.find((c) => c.id === activeCategory) ?? categories[0]
  if (!category) return null

  return (
    <div className="shrink-0 border-b border-[#1E1E24] bg-[#0D0D10]">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <Sparkles size={11} className="text-[#D4A843]" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#52525B]">
          Quick start
        </span>
      </div>

      {/* Category tabs */}
      <div className="px-4 flex items-center gap-0 border-b border-[#1E1E24]">
        {STARTER_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              activeCategory === cat.id
                ? "text-white border-[#D4A843]"
                : "text-[#52525B] border-transparent hover:text-[#A1A1AA]"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Category description */}
      <p className="px-4 pt-2.5 pb-1 text-[11px] text-[#3F3F46]">{category.description}</p>

      {/* Query list */}
      <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[260px] overflow-y-auto">
        {category.queries.map((q) => (
          <button
            key={q.id}
            onClick={() => onPickQuery(q.sql)}
            className="group text-left p-2.5 rounded-md bg-[#0A0A0A] border border-[#1F1F23] hover:border-[#3B82F6]/40 hover:bg-[#111111] transition-all"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-medium text-[#A1A1AA] group-hover:text-[#3B82F6] transition-colors">
                {q.title}
              </span>
              {q.needsStatStatements && (
                <span
                  title="Requires pg_stat_statements extension"
                  className="flex items-center gap-0.5 text-[9px] text-[#EAB308] bg-[#2D2410] border border-[#EAB308]/30 rounded px-1 py-0.5 shrink-0"
                >
                  <AlertCircle size={8} />
                  ext
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#52525B] leading-relaxed">{q.description}</p>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 pb-2.5 pt-1 flex items-center justify-between border-t border-[#1E1E24] text-[10px] text-[#3F3F46]">
        <div className="flex items-center gap-1.5">
          <kbd className="bg-[#18181B] border border-[#27272A] rounded px-1.5 py-0.5 font-mono">
            ⌘
          </kbd>
          <span>+</span>
          <kbd className="bg-[#18181B] border border-[#27272A] rounded px-1.5 py-0.5 font-mono">
            ↵
          </kbd>
          <span>to run</span>
        </div>
        <span>{footerNote}</span>
      </div>
    </div>
  )
}
