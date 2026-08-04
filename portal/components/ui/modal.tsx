"use client"

import { useEffect, useCallback, type ReactNode } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModalProps {
  open: boolean
  onClose?: () => void
  title: string
  description?: string
  size?: "sm" | "md" | "lg" | "xl"
  children: ReactNode
  footer?: ReactNode
}

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.()
    },
    [onClose]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [open, handleEscape])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose ? () => onClose() : undefined}
    >
      <div
        className={cn(
          "w-full bg-[#111111] border border-[#27272A] rounded-xl shadow-2xl flex flex-col max-h-[90vh]",
          "animate-in fade-in slide-in-from-bottom-2 duration-200",
          sizeMap[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#27272A] shrink-0">
          <div>
            <h2 className="text-white font-semibold text-base">{title}</h2>
            {description && (
              <p className="text-[#A1A1AA] text-sm mt-1">{description}</p>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[#52525B] hover:text-white transition-colors ml-4 shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-[#27272A] p-4 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
