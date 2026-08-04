"use client"

import { useEffect, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SlideOverPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export function SlideOverPanel({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
}: SlideOverPanelProps) {
  const [isMounted, setIsMounted] = useState(open)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setIsMounted(true)
      requestAnimationFrame(() => setIsVisible(true))
      return
    }

    setIsVisible(false)
    const timeout = window.setTimeout(() => setIsMounted(false), 300)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  if (!isMounted) return null

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Close panel overlay"
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
        onClick={() => onOpenChange(false)}
      />
      <div className={`absolute inset-y-0 right-0 w-full max-w-[420px] border-l border-[#27272A] bg-[#111111] shadow-2xl shadow-black/60 transition-transform duration-300 ease-in-out ${isVisible ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-[#27272A] px-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-[#FAFAFA]">{title}</h3>
            <p className="truncate text-xs text-[#A1A1AA]">{subtitle}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-[calc(100%-8rem)] overflow-y-auto px-5 py-6">{children}</div>

        <div className="flex h-16 items-center justify-between border-t border-[#27272A] px-5">{footer}</div>
      </div>
    </div>
  )
}



