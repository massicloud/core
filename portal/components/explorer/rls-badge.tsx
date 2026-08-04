"use client"

import type { TableSecurity } from "@/types/db"

interface Props {
  security?: TableSecurity
  size?: "sm" | "md"
}

export function RLSBadge({ security, size = "sm" }: Props) {
  if (!security) return null

  const variant = security.rls_enabled
    ? security.policy_count > 0
      ? "secured"
      : "locked"
    : "open"

  const config = {
    secured: {
      bg: "#14291E",
      dot: "#22C55E",
      text: "#22C55E",
      label: `RLS · ${security.policy_count} ${security.policy_count === 1 ? "policy" : "policies"}`,
    },
    locked: {
      bg: "#2D2510",
      dot: "#EAB308",
      text: "#EAB308",
      label: "RLS · no policies",
    },
    open: {
      bg: "#2D1414",
      dot: "#EF4444",
      text: "#EF4444",
      label: "RLS off · public",
    },
  }[variant]

  const sizing = size === "sm" ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-xs"

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizing}`}
      style={{ background: config.bg, color: config.text }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: config.dot }}
      />
      {config.label}
    </div>
  )
}

/** Tiny 6px dot for ERD nodes — shows status at a glance. */
export function RLSDot({ security }: { security?: TableSecurity }) {
  if (!security) return null

  const color = security.rls_enabled
    ? security.policy_count > 0
      ? "#22C55E"
      : "#EAB308"
    : "#EF4444"

  const tooltip = security.rls_enabled
    ? security.policy_count > 0
      ? `RLS enabled · ${security.policy_count} ${security.policy_count === 1 ? "policy" : "policies"}`
      : "RLS enabled but no policies — all rows hidden"
    : "RLS disabled — table is publicly readable"

  return (
    <div
      title={tooltip}
      className="w-2 h-2 rounded-full shrink-0 cursor-help"
      style={{ background: color }}
    />
  )
}
