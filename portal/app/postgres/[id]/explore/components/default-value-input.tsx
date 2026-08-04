"use client"

import { useRef, useState } from "react"
import { ChevronDown, Wand2 } from "lucide-react"
import { isArrayType, isEnumType } from "./column-types"

interface Suggestion {
  label: string
  value: string
  hint?: string
}

function getSuggestions(type: string): Suggestion[] {
  const t = type.toLowerCase().replace(/\s+/g, " ").trim()
  const isArr = isArrayType(t)
  const base = isArr ? t.slice(0, -2).trim() : t

  if (isArr) {
    return [
      { label: "'{}'", value: "'{}'", hint: "Empty Postgres array literal" },
      { label: "ARRAY[]", value: `ARRAY[]::${base}[]`, hint: "Empty typed array" },
      { label: "NULL", value: "NULL" },
    ]
  }

  if (base === "uuid") {
    return [
      { label: "gen_random_uuid()", value: "gen_random_uuid()", hint: "Random UUID — pgcrypto" },
      { label: "uuid_generate_v4()", value: "uuid_generate_v4()", hint: "Random UUID — uuid-ossp" },
      { label: "NULL", value: "NULL" },
    ]
  }

  if (["timestamp","timestamptz","timestamp with time zone","timestamp without time zone"].includes(base)) {
    return [
      { label: "NOW()", value: "NOW()", hint: "Current date + time" },
      { label: "CURRENT_TIMESTAMP", value: "CURRENT_TIMESTAMP", hint: "SQL standard equivalent" },
      { label: "NULL", value: "NULL" },
    ]
  }

  if (base === "date") {
    return [
      { label: "CURRENT_DATE", value: "CURRENT_DATE", hint: "Today's date" },
      { label: "NULL", value: "NULL" },
    ]
  }

  if (["time","timetz"].includes(base)) {
    return [
      { label: "CURRENT_TIME", value: "CURRENT_TIME" },
      { label: "NULL", value: "NULL" },
    ]
  }

  if (["boolean","bool"].includes(base)) {
    return [
      { label: "true", value: "true" },
      { label: "false", value: "false" },
      { label: "NULL", value: "NULL" },
    ]
  }

  if (["integer","int","int2","int4","int8","bigint","smallint","numeric","decimal","float4","float8","real","double precision"].includes(base)) {
    return [
      { label: "0", value: "0" },
      { label: "1", value: "1" },
      { label: "NULL", value: "NULL" },
    ]
  }

  if (["text","varchar","char","character varying","character","bpchar"].includes(base) || base.startsWith("varchar")) {
    return [
      { label: "'' (empty string)", value: "''", hint: "Empty text" },
      { label: "NULL", value: "NULL" },
    ]
  }

  if (["json","jsonb"].includes(base)) {
    return [
      { label: "'{}'", value: "'{}'", hint: "Empty object" },
      { label: "'[]'", value: "'[]'", hint: "Empty array" },
      { label: "NULL", value: "NULL" },
    ]
  }

  if (isEnumType(t)) {
    return [
      { label: "NULL", value: "NULL", hint: "Type an enum value like 'pending'" },
    ]
  }

  return [{ label: "NULL", value: "NULL" }]
}

interface DefaultValueInputProps {
  type: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** If provided, show a "regenerate" button for UUID defaults */
  allowRegenerate?: boolean
}

export function DefaultValueInput({
  type,
  value,
  onChange,
  placeholder = "Leave empty to remove default",
  allowRegenerate,
}: DefaultValueInputProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const suggestions = getSuggestions(type)
  const isUuid = type.toLowerCase().includes("uuid")

  const isArr = isArrayType(type)
  const isEnum = isEnumType(type)

  function handleSelect(suggestion: Suggestion) {
    onChange(suggestion.value)
    setOpen(false)
  }

  function handleRegenerate() {
    onChange(crypto.randomUUID())
  }

  return (
    <div className="space-y-1.5">
      {/* Input row */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-9 bg-[#1A1A1A] border border-[#27272A] rounded-md px-3 pr-8 text-sm font-mono text-[#FAFAFA] placeholder-[#3B3B3B] focus:border-[#3B82F6] focus:outline-none"
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {/* chevron toggle */}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA]"
          >
            <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Regenerate UUID button */}
        {allowRegenerate && isUuid && (
          <button
            type="button"
            onClick={handleRegenerate}
            title="Generate new UUID"
            className="h-9 px-2.5 rounded-md bg-[#1A1A1A] border border-[#27272A] text-[#52525B] hover:text-[#A1A1AA] hover:border-[#3B82F6]/40 transition-colors flex items-center"
          >
            <Wand2 size={13} />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div
          ref={containerRef}
          className="rounded-md border border-[#27272A] bg-[#141414] shadow-lg overflow-hidden z-50"
        >
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-[#1F1F23]">
            <span className="text-[10px] font-semibold text-[#3B3B3B] uppercase tracking-wider">
              Suggestions for{" "}
              <span className="text-[#52525B] font-mono">{type}</span>
            </span>
          </div>

          {suggestions.map((s) => (
            <button
              key={s.value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#1F1F23] transition-colors group"
            >
              <span className="font-mono text-sm text-[#FAFAFA]">{s.label}</span>
              {s.hint && (
                <span className="text-xs text-[#3B3B3B] group-hover:text-[#52525B]">{s.hint}</span>
              )}
            </button>
          ))}

          {/* Custom text hint */}
          <div className="px-3 py-1.5 border-t border-[#1F1F23]">
            <span className="text-[10px] text-[#3B3B3B]">
              {isEnum
                ? "Type an enum label, e.g. 'pending'"
                : isArr
                ? "Or type any valid Postgres array literal"
                : "Or type any valid SQL expression"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
