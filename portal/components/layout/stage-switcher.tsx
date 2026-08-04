"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Layers, ChevronDown, Lock, Plus, Check } from "lucide-react"
import { useStage } from "@/lib/stage-context"
import { useProject } from "@/lib/project-context"
import { cn } from "@/lib/utils"

export function StageSwitcher() {
  const { currentProject } = useProject()
  const { currentStage, setCurrentStage, stages, isLoading } = useStage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  if (!currentProject || isLoading) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-[#1A1A1A] transition-colors group"
      >
        <Layers size={13} className="text-[#D4A843] shrink-0" />
        <span className="text-[#FAFAFA] text-sm font-medium max-w-[120px] truncate">
          {currentStage?.name ?? "Select stage"}
        </span>
        <ChevronDown
          size={13}
          className={cn(
            "text-[#52525B] group-hover:text-[#A1A1AA] transition-all",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[220px] bg-[#111113] border border-[#27272A] rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.7)] z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-1 max-h-[240px] overflow-y-auto">
            {stages.length === 0 ? (
              <p className="px-3 py-4 text-center text-[#52525B] text-sm">
                No stages yet
              </p>
            ) : (
              stages.map((stage) => (
                <button
                  key={stage.name}
                  onClick={() => {
                    setCurrentStage(stage)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 rounded-md hover:bg-[#18181B] transition-colors text-left",
                    currentStage?.name === stage.name && "bg-[#18181B]"
                  )}
                >
                  <Layers size={13} className="text-[#D4A843] shrink-0" />
                  <span className="flex-1 text-sm text-[#FAFAFA] font-medium truncate">
                    {stage.name}
                  </span>
                  {stage.is_protected && (
                    <Lock size={10} className="text-[#52525B] shrink-0" />
                  )}
                  {currentStage?.name === stage.name && (
                    <Check size={13} className="text-[#D4A843] shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-[#27272A] p-1">
            <Link
              href={`/projects/${currentProject.id}/stages`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 text-[#3B82F6] hover:bg-[#1D3461]/40 rounded-md transition-colors text-sm"
            >
              <Plus size={13} />
              Manage stages
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
