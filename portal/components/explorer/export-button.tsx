"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ChevronDown,
  Code2,
  Database,
  Download,
  Loader2,
  Upload,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { downloadExport } from "@/lib/db-api"
import { ImportWizard } from "./import-wizard"

interface ExportButtonProps {
  instanceId: string
}

export function ExportButton({ instanceId }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState<"schema" | "full" | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleExport = async (type: "schema" | "full") => {
    setOpen(false)
    setExporting(type)
    try {
      await downloadExport(instanceId, type)
      toast.success("Export downloaded")
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      <div ref={ref} className="relative flex items-center">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5",
            "bg-[#141414] hover:bg-[#1A1A1A]",
            "border border-[#1F1F23] hover:border-[#27272A]",
            "rounded-md text-xs text-[#A1A1AA] hover:text-white",
            "transition-all select-none",
            open && "bg-[#1A1A1A] border-[#27272A] text-white"
          )}
        >
          {exporting ? (
            <Loader2 size={11} className="animate-spin text-[#3B82F6]" />
          ) : (
            <Download size={11} />
          )}
          Export
          <ChevronDown
            size={10}
            className={cn(
              "text-[#52525B] transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-72 bg-[#111111] border border-[#27272A] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
            {/* Schema only */}
            <button
              onClick={() => handleExport("schema")}
              className="flex flex-col gap-0.5 w-full text-left p-3 hover:bg-[#1A1A1A] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Code2 size={13} className="text-[#3B82F6] shrink-0" />
                <span className="text-sm font-medium text-white">
                  Schema only
                </span>
              </div>
              <p className="text-[10px] text-[#52525B] ml-5">
                CREATE TABLE statements without data
              </p>
            </button>

            {/* Full database */}
            <button
              onClick={() => handleExport("full")}
              className="flex flex-col gap-0.5 w-full text-left p-3 hover:bg-[#1A1A1A] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Database size={13} className="text-[#22C55E] shrink-0" />
                <span className="text-sm font-medium text-white">
                  Full database
                </span>
              </div>
              <p className="text-[10px] text-[#52525B] ml-5">
                Schema + all data as SQL inserts
              </p>
            </button>

            {/* Divider */}
            <div className="h-px bg-[#27272A] mx-2" />

            {/* Import */}
            <button
              onClick={() => {
                setOpen(false)
                setImportOpen(true)
              }}
              className="flex items-center gap-2 w-full text-left p-3 hover:bg-[#1A1A1A] transition-colors"
            >
              <Upload size={13} className="text-[#A855F7] shrink-0" />
              <span className="text-sm font-medium text-white">
                Import SQL file…
              </span>
            </button>
          </div>
        )}
      </div>

      <ImportWizard
        instanceId={instanceId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </>
  )
}
