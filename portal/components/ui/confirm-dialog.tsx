"use client"

import { useState, useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Modal } from "./modal"
import { Button } from "./button"

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
  requiresTyping?: string
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  loading,
  requiresTyping,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState("")

  useEffect(() => {
    if (!open) setTypedValue("")
  }, [open])

  const canConfirm = !requiresTyping || typedValue === requiresTyping

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading || !canConfirm}
          >
            {loading ? "Deleting..." : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-[#2D1414] flex items-center justify-center shrink-0">
          <AlertTriangle size={20} className="text-[#EF4444]" />
        </div>
        <div className="flex-1">
          <p className="text-[#A1A1AA] text-sm leading-relaxed">{message}</p>
          {requiresTyping && (
            <div className="mt-4">
              <p className="text-xs text-[#52525B] mb-2">
                Type{" "}
                <span className="font-mono text-white">{requiresTyping}</span>{" "}
                to confirm
              </p>
              <input
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                className="w-full h-9 bg-[#1A1A1A] border border-[#27272A] rounded-md px-3 text-sm text-white font-mono focus:border-[#EF4444] focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
