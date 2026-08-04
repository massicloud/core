"use client"

import { useEffect, useRef, useState } from "react"
import { Database, Lock, BookOpen, Filter, Hash } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SidebarSection {
  id: string
  label: string
  icon?: React.ElementType
  children?: { id: string; label: string }[]
}

interface Props {
  sections: SidebarSection[]
}

export function APIDocsSidebar({ sections }: Props) {
  const [active, setActive] = useState<string>("")
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const allIds = sections.flatMap(s => [s.id, ...(s.children?.map(c => c.id) ?? [])])

    const entries = new Map<string, number>()

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (obs) => {
        for (const e of obs) {
          entries.set(e.target.id, e.intersectionRatio)
        }
        let best = ""
        let bestRatio = 0
        for (const id of allIds) {
          const r = entries.get(id) ?? 0
          if (r > bestRatio) {
            bestRatio = r
            best = id
          }
        }
        if (best) setActive(best)
      },
      { rootMargin: "-64px 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] }
    )

    for (const id of allIds) {
      const el = document.getElementById(id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [sections])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }

  return (
    <nav className="sticky top-[68px] h-[calc(100vh-68px)] overflow-y-auto py-4 pr-2 shrink-0 w-[220px]">
      <p className="px-3 pb-2 text-[10px] font-semibold tracking-widest uppercase text-[#374151]">
        Contents
      </p>
      <div className="space-y-0.5">
        {sections.map((s) => {
          const Icon = s.icon
          const isActive = active === s.id
          return (
            <div key={s.id}>
              <button
                onClick={() => scrollTo(s.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 h-8 px-3 rounded-lg text-xs font-medium text-left transition-all",
                  isActive
                    ? "bg-[#2D2410]/60 text-[#D4A843]"
                    : "text-[#6B7280] hover:text-[#E4E4E7] hover:bg-[#161616]"
                )}
              >
                {Icon && <Icon size={12} className={cn("shrink-0", isActive ? "text-[#D4A843]" : "text-[#4B5563]")} />}
                <span className="truncate">{s.label}</span>
              </button>
              {s.children?.map((c) => {
                const childActive = active === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => scrollTo(c.id)}
                    className={cn(
                      "w-full flex items-center gap-2 h-7 pl-8 pr-3 rounded-lg text-xs text-left transition-all",
                      childActive
                        ? "text-[#D4A843]"
                        : "text-[#52525B] hover:text-[#9CA3AF] hover:bg-[#161616]"
                    )}
                  >
                    <span className="truncate font-mono">{c.label}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

export function buildSidebarSections(
  dbGroups: { dbName: string; tables: { name: string }[] }[]
): SidebarSection[] {
  const sections: SidebarSection[] = [
    { id: "overview", label: "Overview", icon: BookOpen },
    { id: "authentication", label: "Authentication", icon: Lock },
    { id: "filtering", label: "Filtering & Sorting", icon: Filter },
  ]

  for (const g of dbGroups) {
    sections.push({
      id: `db-${g.dbName}`,
      label: g.dbName,
      icon: Database,
      children: g.tables.map(t => ({ id: `table-${g.dbName}-${t.name}`, label: t.name })),
    })
  }

  return sections
}
