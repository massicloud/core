"use client"

import type { ReactNode } from "react"
import { AlertCircle } from "lucide-react"

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}

export function FormField({
  label,
  required,
  error,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1 text-sm font-medium text-[#A1A1AA]">
        {label}
        {required && <span className="text-[#3B82F6]">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[#52525B]">{hint}</p>}
      {error && (
        <p className="text-xs text-[#EF4444] flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  )
}
