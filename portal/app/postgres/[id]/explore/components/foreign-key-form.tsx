"use client"

import { AlertTriangle, Info, Key, Link2, Trash2, ArrowRight } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { isTypeCompatible } from "@/lib/db-types"
import type { TableWithColumns, ForeignKeyDefinition } from "@/types/db"

type FKAction = "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION"

const FK_ACTIONS: { value: FKAction; label: string; hint: string }[] = [
  { value: "NO ACTION",   label: "NO ACTION",   hint: "Error if row is referenced" },
  { value: "RESTRICT",    label: "RESTRICT",    hint: "Block the operation immediately" },
  { value: "CASCADE",     label: "CASCADE",     hint: "Propagate change to this row" },
  { value: "SET NULL",    label: "SET NULL",    hint: "Set this column to NULL" },
  { value: "SET DEFAULT", label: "SET DEFAULT", hint: "Set this column to its default" },
]

export interface FKFormValue {
  column: string
  referenced_table: string
  referenced_column: string
  on_delete: FKAction
  on_update: FKAction
}

interface ForeignKeyFormProps {
  /** The column this FK comes from (name + type). */
  sourceColumn: { name: string; type: string }
  /** All tables available as FK targets. */
  availableTables: TableWithColumns[]
  value: FKFormValue | null
  onChange: (fk: FKFormValue | null) => void
  onRemove?: () => void
}

export function ForeignKeyForm({
  sourceColumn,
  availableTables,
  value,
  onChange,
  onRemove,
}: ForeignKeyFormProps) {
  const compatibleTables = availableTables.filter((t) =>
    t.columns.some((c) => isTypeCompatible(sourceColumn.type, c.type))
  )

  const targetTable = value?.referenced_table
    ? availableTables.find((t) => t.name === value.referenced_table)
    : null

  const compatibleColumns = targetTable
    ? targetTable.columns.filter((c) => isTypeCompatible(sourceColumn.type, c.type))
    : []

  const targetCol = value?.referenced_column
    ? targetTable?.columns.find((c) => c.name === value.referenced_column)
    : null

  const typeMismatch =
    targetCol && targetCol.type.toLowerCase() !== sourceColumn.type.toLowerCase()
  const notPK = targetCol && !targetCol.is_primary_key

  const set = (partial: Partial<FKFormValue>) =>
    onChange({
      column: sourceColumn.name,
      referenced_table: "",
      referenced_column: "",
      on_delete: "NO ACTION",
      on_update: "NO ACTION",
      ...value,
      ...partial,
    })

  const previewSQL = value?.referenced_table && value.referenced_column
    ? `FOREIGN KEY (${sourceColumn.name}) REFERENCES ${value.referenced_table}(${value.referenced_column})${
        value.on_delete !== "NO ACTION" ? ` ON DELETE ${value.on_delete}` : ""
      }${value.on_update !== "NO ACTION" ? ` ON UPDATE ${value.on_update}` : ""}`
    : null

  return (
    <div className="rounded-lg border border-[#1F1F23] bg-[#0D0D0D] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 size={13} className="text-[#3B82F6] shrink-0" />
          <span className="text-sm font-medium text-white font-mono">{sourceColumn.name}</span>
          <ArrowRight size={11} className="text-[#52525B] shrink-0" />
          <span className="text-xs text-[#52525B] font-mono">{sourceColumn.type}</span>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[#52525B] hover:text-[#EF4444] transition-colors ml-2 shrink-0"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Reference pickers */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[#A1A1AA] mb-1 block">
            References table <span className="text-[#3B82F6]">*</span>
          </Label>
          <Select
            value={value?.referenced_table ?? ""}
            onValueChange={(tbl) => {
              const t = availableTables.find((x) => x.name === tbl)
              const firstCompat = t?.columns.find((c) =>
                isTypeCompatible(sourceColumn.type, c.type)
              )
              set({
                referenced_table: tbl,
                referenced_column: firstCompat?.name ?? "",
              })
            }}
          >
            <SelectTrigger className="h-9 text-xs font-mono">
              <SelectValue placeholder="Select table…" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-[#27272A]">
              {compatibleTables.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[#52525B]">
                  No tables with compatible columns
                </div>
              ) : (
                compatibleTables.map((t) => (
                  <SelectItem key={t.name} value={t.name} className="font-mono text-xs">
                    {t.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-[#A1A1AA] mb-1 block">
            References column <span className="text-[#3B82F6]">*</span>
          </Label>
          <Select
            value={value?.referenced_column ?? ""}
            onValueChange={(col) => set({ referenced_column: col })}
            disabled={!value?.referenced_table}
          >
            <SelectTrigger className="h-9 text-xs font-mono">
              <SelectValue placeholder={value?.referenced_table ? "Select column…" : "Pick table first"} />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-[#27272A]">
              {compatibleColumns.map((c) => (
                <SelectItem key={c.name} value={c.name} className="text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    {c.is_primary_key && <Key size={10} className="text-[#F59E0B]" />}
                    <span>{c.name}</span>
                    <span className="text-[#52525B] ml-1">{c.type}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Warnings */}
      {typeMismatch && (
        <div className="flex items-start gap-2 text-xs text-[#EAB308] bg-[#2D2510]/50 border border-[#EAB308]/20 rounded-md px-3 py-2">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>
            Types differ ({sourceColumn.type} vs {targetCol?.type}) but are compatible.
            Values must match at runtime.
          </span>
        </div>
      )}
      {!typeMismatch && notPK && (
        <div className="flex items-start gap-2 text-xs text-[#52525B] bg-[#1A1A1A] border border-[#27272A] rounded-md px-3 py-2">
          <Info size={11} className="mt-0.5 shrink-0" />
          <span>{targetCol?.name} is not a primary key. FKs to non-PK columns require a unique index.</span>
        </div>
      )}

      {/* ON DELETE / ON UPDATE */}
      <div className="grid grid-cols-2 gap-3">
        {(["on_delete", "on_update"] as const).map((key) => (
          <div key={key}>
            <Label className="text-xs text-[#A1A1AA] mb-1 block">
              {key === "on_delete" ? "On Delete" : "On Update"}
            </Label>
            <Select
              value={value?.[key] ?? "NO ACTION"}
              onValueChange={(v) => set({ [key]: v as FKAction })}
              disabled={!value?.referenced_table}
            >
              <SelectTrigger className="h-9 text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-[#27272A]">
                {FK_ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value} className="text-xs">
                    <div>
                      <span className="font-mono">{a.label}</span>
                      <p className="text-[10px] text-[#52525B] mt-0.5">{a.hint}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* SQL preview */}
      {previewSQL && (
        <div className="rounded-md border border-[#27272A] bg-[#0A0A0A] px-3 py-2.5">
          <p className="text-[10px] text-[#52525B] uppercase tracking-wider font-medium mb-1">SQL</p>
          <code className="text-xs font-mono text-[#A1A1AA] break-all">{previewSQL}</code>
        </div>
      )}
    </div>
  )
}
