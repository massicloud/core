"use client"

import { Loader2 } from "lucide-react"
import { usePendingInstanceProvisions, instanceTypeLabel } from "@/lib/instance-provisioning"

export function ProvisioningBanner() {
  const pending = usePendingInstanceProvisions()

  if (pending.length === 0) return null

  const first = pending[0]
  const label = first.isNewStage
    ? `Creating stage "${first.stageName}" with a ${instanceTypeLabel(first.type)} database "${first.name}"…`
    : `Creating ${instanceTypeLabel(first.type)} database "${first.name}" in ${first.stageName}…`

  return (
    <div className="sticky top-[52px] z-30 h-9 flex items-center gap-2 px-4 bg-[#1A140A] border-b border-[#D4A843]/30 text-[#D4A843] text-xs font-medium">
      <Loader2 size={13} className="animate-spin shrink-0" />
      <span className="truncate">{label}</span>
      {pending.length > 1 && (
        <span className="text-[#D4A843]/60 shrink-0">+{pending.length - 1} more</span>
      )}
    </div>
  )
}
