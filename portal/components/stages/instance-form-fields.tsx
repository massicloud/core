"use client"

import { Database, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { FormField } from "@/components/ui/form-field"
import { TextInput } from "@/components/ui/text-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SchemaPreset, InstanceType } from "@/types"

const INSTANCE_TYPES = [
  { value: 'postgres' as const, label: 'Postgres', icon: Database, color: '#3B82F6', enabled: true },
  { value: 'mysql'    as const, label: 'MySQL',    icon: Database, color: '#F29111', enabled: true },
  { value: 'redis'    as const, label: 'Redis',    icon: Activity, color: '#EF4444', enabled: true },
  { value: 'mongo'    as const, label: 'MongoDB',  icon: Database, color: '#22C55E', enabled: false, hint: 'Coming soon' },
]

const MEMORY_OPTIONS = [
  { value: 256,  label: '256 MB' },
  { value: 512,  label: '512 MB' },
  { value: 1024, label: '1 GB'   },
  { value: 2048, label: '2 GB'   },
]

interface Props {
  type:           InstanceType
  onTypeChange:   (v: InstanceType) => void
  name:           string
  onNameChange:   (v: string) => void
  nameError?:     string | null
  memoryMB:       number
  onMemoryChange: (v: number) => void
  schemaPreset:   string
  onPresetChange: (v: string) => void
  presets:        SchemaPreset[]
}

export function InstanceFormFields({
  type, onTypeChange,
  name, onNameChange, nameError,
  memoryMB, onMemoryChange,
  schemaPreset, onPresetChange,
  presets,
}: Props) {
  return (
    <div className="space-y-3">
      {/* DB type selector */}
      <FormField label="Type" required>
        <div className="flex gap-2">
          {INSTANCE_TYPES.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.value}
                type="button"
                disabled={!t.enabled}
                title={t.hint}
                onClick={() => t.enabled && onTypeChange(t.value)}
                className={cn(
                  "flex-1 flex items-center gap-2 h-9 px-3 rounded-md border transition-all text-sm",
                  !t.enabled
                    ? "border-[#27272A] bg-[#141414] text-[#52525B] cursor-not-allowed"
                    : type === t.value
                    ? "border-[#D4A843] bg-[#2D2410] text-white"
                    : "border-[#27272A] bg-[#1A1A1A] text-[#A1A1AA] hover:border-[#3B3B3B]"
                )}
              >
                <Icon size={12} style={{ color: t.enabled ? t.color : undefined }} />
                {t.label}
                {t.hint && <span className="text-[10px] text-[#52525B]">({t.hint})</span>}
              </button>
            )
          })}
        </div>
      </FormField>

      {/* DB name */}
      <FormField
        label="Database name"
        required
        hint="Used in API URLs. Default is 'main'."
        error={nameError ?? undefined}
      >
        <TextInput
          value={name}
          onChange={(v) => onNameChange(v.toLowerCase().replace(/\s+/g, '-'))}
          placeholder="main"
        />
      </FormField>

      {/* Memory */}
      <FormField label="Memory">
        <Select value={String(memoryMB)} onValueChange={(v) => onMemoryChange(parseInt(v))}>
          <SelectTrigger className="h-9 bg-[#1A1A1A] border-[#27272A] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#111111] border-[#27272A]">
            {MEMORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {/* Schema preset — filtered to the selected database type */}
      {(() => {
        const typePresets = presets.filter((p) => p.database_type === type)
        if (typePresets.length === 0) return null
        return (
          <FormField label="Schema preset" hint="Sets up the initial database schema.">
            <Select value={schemaPreset} onValueChange={onPresetChange}>
              <SelectTrigger className="h-9 bg-[#1A1A1A] border-[#27272A] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#111111] border-[#27272A]">
                {typePresets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typePresets.find((p) => p.id === schemaPreset)?.description && (
              <p className="text-xs text-[#52525B] mt-1">
                {typePresets.find((p) => p.id === schemaPreset)?.description}
              </p>
            )}
          </FormField>
        )
      })()}
    </div>
  )
}
