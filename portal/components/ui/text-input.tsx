"use client"

import { FormField } from "./form-field"
import { cn } from "@/lib/utils"

interface TextInputProps {
  label?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  error?: string
  hint?: string
  type?: "text" | "email" | "password" | "number"
  disabled?: boolean
  className?: string
}

export function TextInput({
  label,
  placeholder,
  value,
  onChange,
  required,
  error,
  hint,
  type = "text",
  disabled,
  className,
}: TextInputProps) {
  const input = (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "w-full h-9 bg-[#1A1A1A] border border-[#27272A] rounded-md px-3 text-sm text-[#FAFAFA]",
        "placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors duration-150",
        error && "border-[#EF4444] focus:border-[#EF4444]",
        className
      )}
    />
  )

  if (!label) return input

  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      {input}
    </FormField>
  )
}
