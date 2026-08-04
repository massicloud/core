"use client"

import { ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SortBuilderProps {
  sortConfig: { column: string; order: "asc" | "desc" } | null
  onChange: (config: { column: string; order: "asc" | "desc" } | null) => void
}

export function SortBuilder({ sortConfig, onChange }: SortBuilderProps) {
  return (
    <div className="bg-[#111111] rounded border border-[#27272A] p-3 flex items-center gap-2">
      <Input
        placeholder="Column to sort by"
        value={sortConfig?.column || ""}
        onChange={(e) => {
          if (sortConfig) {
            onChange({ ...sortConfig, column: e.target.value })
          }
        }}
        className="h-8 text-xs flex-1"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={sortConfig?.order === "asc" ? "default" : "outline"}
          className="h-8 px-2"
          onClick={() => onChange(sortConfig ? { ...sortConfig, order: "asc" } : { column: "", order: "asc" })}
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant={sortConfig?.order === "desc" ? "default" : "outline"}
          className="h-8 px-2"
          onClick={() => onChange(sortConfig ? { ...sortConfig, order: "desc" } : { column: "", order: "desc" })}
        >
          <ArrowDown className="w-4 h-4" />
        </Button>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(null)}
        className="text-xs text-[#A1A1AA]"
      >
        Clear
      </Button>
    </div>
  )
}

