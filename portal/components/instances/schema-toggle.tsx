"use client"

import { Check, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SchemaToggleProps {
  id: string
  checked: boolean
  onChange: (id: string) => void
  icon: LucideIcon
  iconBg: string
  iconColor: string
  title: string
  description: string
  tables: string[]
  badge?: string
  recommended?: boolean
}

export function SchemaToggle({
  id,
  checked,
  onChange,
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  tables,
  badge,
  recommended,
}: SchemaToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(id)}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-all",
        checked ? "" : "border-[#27272A] bg-[#1A1A1A] hover:border-[#3B82F6]/40"
      )}
      style={
        checked
          ? {
              borderColor: `${iconColor}80`,
              backgroundColor: `${iconColor}0d`,
            }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
          style={{ background: iconBg }}
        >
          <Icon size={14} style={{ color: iconColor }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-medium text-white">{title}</span>
            {badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2D2410] text-[#D4A843] border border-[#D4A843]/20">
                {badge}
              </span>
            )}
            {recommended && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#14291E] text-[#22C55E] border border-[#22C55E]/20">
                Recommended
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-[#A1A1AA] leading-relaxed mb-2">
            {description}
          </p>

          {/* Tables list */}
          <div className="flex flex-wrap gap-1">
            {tables.map((t) => (
              <span
                key={t}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0A0A0A] text-[#52525B] border border-[#1F1F23]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Checkbox indicator */}
        <div
          className={cn(
            "w-4 h-4 rounded border-2 shrink-0 mt-0.5",
            "flex items-center justify-center transition-all",
            checked ? "border-transparent" : "border-[#27272A]"
          )}
          style={checked ? { backgroundColor: iconColor } : undefined}
        >
          {checked && <Check size={11} className="text-white" strokeWidth={3} />}
        </div>
      </div>
    </button>
  )
}
