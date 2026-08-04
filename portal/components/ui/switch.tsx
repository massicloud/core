import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onCheckedChange, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150",
        checked ? "bg-[#3B82F6]" : "bg-[#27272A]",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full transition-transform duration-150 ease-in-out",
          checked ? "translate-x-4 bg-white" : "translate-x-0.5 bg-[#52525B]"
        )}
      />
    </button>
  )
}

