import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface StatCardProps {
  label: string
  icon: ReactNode
  iconBg: string
  value: string | number | null  // null = loading skeleton
  subtitle: string
  accentColor: string
  trend?: number
}

export function StatCard({ label, icon, iconBg, value, subtitle, accentColor, trend }: StatCardProps) {
  return (
      <div className="bg-[#111111] border border-[#27272A] rounded-xl p-5 hover:border-[#3B82F6]/30 transition-all duration-200 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#52525B] text-xs font-medium uppercase tracking-wider">{label}</span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>
            {icon}
          </div>
        </div>
        <div className="flex items-end gap-2 mb-2">
          {value === null ? (
            <div className="h-9 w-14 rounded-md bg-[#1A1A1A] animate-pulse" />
          ) : (
            <>
              <span className="text-3xl font-bold text-white">{value}</span>
              {trend && (
                <span className={cn("text-xs font-medium mb-1", trend > 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                  {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}
                </span>
              )}
            </>
          )}
        </div>
        <span className="text-[#52525B] text-xs">{subtitle}</span>
        <div className="mt-4 h-0.5 rounded-full" style={{ background: accentColor, opacity: 0.3 }} />
      </div>
  )
}

// StatusBadge for instance status
interface StatusBadgeProps {
  status: string
  size?: "xs" | "sm"
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const color = status === "running" ? "#22C55E" : status === "stopped" ? "#EF4444" : "#EAB308"
  return (
      <span className={cn(
          "inline-block rounded-full",
          size === "xs" ? "w-2 h-2" : "w-3 h-3"
      )} style={{ background: color }} />
  )
}
