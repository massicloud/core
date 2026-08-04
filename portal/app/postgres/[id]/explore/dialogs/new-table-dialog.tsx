"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Link2, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { createTable, getAllTablesWithColumns } from "@/lib/db-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { COLUMN_TYPE_CATEGORIES } from "../components/column-types"
import { SqlPreview } from "../components/sql-preview"
import { ForeignKeyForm, type FKFormValue } from "../components/foreign-key-form"
import { isTypeCompatible } from "@/lib/db-types"
import { useExplorer } from "@/lib/explorer-context"
import type { CreateTableRequest } from "@/types/db"

// ─── Draft types ─────────────────────────────────────────────────────────────

type DraftColumn = {
  id: string
  name: string
  type: string
  length: string
  nullable: boolean
  default: string
  isUnique: boolean
  isPrimaryKey: boolean
  suggested?: boolean
  /** undefined = FK section hidden; FKFormValue = active (may be incomplete) */
  fk?: FKFormValue
}

const makeColumn = (overrides?: Partial<DraftColumn>): DraftColumn => ({
  id: `col_${Math.random().toString(36).slice(2, 9)}`,
  name: "", type: "text", length: "", nullable: true,
  default: "", isUnique: false, isPrimaryKey: false,
  ...overrides,
})

const initialColumns = (): DraftColumn[] => [
  makeColumn({ name: "id", type: "uuid", nullable: false, isPrimaryKey: true, suggested: true }),
]

type Step = 1 | 2 | 3 | 4

// ─── Stepper ─────────────────────────────────────────────────────────────────

function StepItem({ index, label, active, complete, optional }: {
  index: number; label: string; active: boolean; complete: boolean; optional?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
        complete ? "border-[#22C55E] bg-[#22C55E]/10 text-[#22C55E]"
          : active ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]"
          : "border-[#27272A] text-[#71717A]"
      )}>
        {complete ? <Check className="h-3.5 w-3.5" /> : index}
      </div>
      <div>
        <span className={active ? "text-[#FAFAFA]" : complete ? "text-[#22C55E]" : "text-[#71717A]"}>
          {label}
        </span>
        {optional && <span className="ml-1.5 text-[10px] text-[#52525B]">(optional)</span>}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NewTableDialogProps {
  instanceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NewTableDialog({ instanceId, open, onOpenChange }: NewTableDialogProps) {
  const queryClient = useQueryClient()
  const { currentSchema } = useExplorer()

  const [step,      setStep]      = useState<Step>(1)
  const [tableName, setTableName] = useState("")
  const [comment,   setComment]   = useState("")
  const [enableRls, setEnableRls] = useState(false)
  const [columns,   setColumns]   = useState<DraftColumn[]>(initialColumns)
  const [loading,   setLoading]   = useState(false)

  // Fetch available tables once we reach step 2 (needed for inline FK pickers)
  const { data: availableTables = [] } = useQuery({
    queryKey: ["db", instanceId, "tables-with-columns", currentSchema],
    queryFn: () => getAllTablesWithColumns(instanceId, currentSchema),
    enabled: open && step >= 2,
    staleTime: 30_000,
  })

  // ── Derived FK list (from column.fk) ─────────────────────────────────────

  const activeFKs = columns.filter((c) => c.name.trim() && c.fk?.referenced_table && c.fk?.referenced_column)

  // ── SQL preview ──────────────────────────────────────────────────────────

  const generatedSQL = useMemo(() => {
    if (!tableName.trim()) return "-- Name your table to generate SQL"

    const validCols = columns.filter((c) => c.name.trim())

    const colDefs = validCols.map((c) => {
      let def = `${c.name} ${c.type}`
      if (["varchar", "char"].includes(c.type) && c.length.trim()) def += `(${c.length})`
      if (c.isPrimaryKey) def += " PRIMARY KEY"
      if (!c.nullable)    def += " NOT NULL"
      if (c.default.trim()) def += ` DEFAULT ${c.default.trim()}`
      if (c.isUnique)     def += " UNIQUE"
      return def
    })

    const fkDefs = validCols
      .filter((c) => c.fk?.referenced_table && c.fk?.referenced_column)
      .map((c) => {
        const fk = c.fk!
        let def = `CONSTRAINT fk_${tableName}_${c.name} FOREIGN KEY (${c.name}) REFERENCES ${fk.referenced_table}(${fk.referenced_column})`
        if (fk.on_delete !== "NO ACTION") def += ` ON DELETE ${fk.on_delete}`
        if (fk.on_update !== "NO ACTION") def += ` ON UPDATE ${fk.on_update}`
        return def
      })

    return `CREATE TABLE ${tableName} (\n  ${[...colDefs, ...fkDefs].join(",\n  ")}\n);`
  }, [columns, tableName])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const resetState = () => {
    setStep(1); setTableName(""); setComment("")
    setEnableRls(false); setColumns(initialColumns()); setLoading(false)
  }
  const close = () => { resetState(); onOpenChange(false) }

  const updateColumn = (id: string, updates: Partial<DraftColumn>) =>
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c))

  const handleCreate = async () => {
    if (!tableName.trim()) { toast.error("Table name is required"); return }
    const validCols = columns.filter((c) => c.name.trim())
    if (validCols.length === 0) { toast.error("Add at least one column"); return }
    if (validCols.some((c) => !/^[a-z0-9_]+$/.test(c.name))) {
      toast.error("Column names must be lowercase letters, numbers and underscores"); return
    }

    setLoading(true)
    try {
      const payload: CreateTableRequest = {
        name: tableName,
        comment: comment || undefined,
        rls_enabled: enableRls,
        columns: validCols.map((c) => ({
          name: c.name, type: c.type,
          length: c.length.trim() ? Number(c.length) : undefined,
          nullable: c.nullable,
          default: c.default.trim() || undefined,
          is_unique: c.isUnique,
          is_primary_key: c.isPrimaryKey,
        })),
        foreign_keys: validCols
          .filter((c) => c.fk?.referenced_table && c.fk?.referenced_column)
          .map((c) => ({
            column: c.name,
            referenced_table: c.fk!.referenced_table,
            referenced_column: c.fk!.referenced_column,
            on_delete: c.fk!.on_delete,
            on_update: c.fk!.on_update,
          })),
      }

      await createTable(instanceId, payload, currentSchema)
      await queryClient.invalidateQueries({ queryKey: ["db", instanceId, "tables", currentSchema] })
      await queryClient.invalidateQueries({ queryKey: ["db-security", instanceId] })
      toast.success(`Table "${tableName}" created`)
      close()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create table")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 md:p-8">
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={close} />

      <div className="relative mx-auto flex h-[min(92dvh,900px)] w-[calc(100%-48px)] max-w-4xl flex-col overflow-hidden rounded-xl border border-[#27272A] bg-[#111111] shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="border-b border-[#27272A] px-6 py-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[#FAFAFA]">Create new table</h2>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <StepItem index={1} label="Table Details" active={step === 1} complete={step > 1} />
            <div className="h-px w-6 bg-[#27272A]" />
            <StepItem index={2} label="Columns"       active={step === 2} complete={step > 2} />
            <div className="h-px w-6 bg-[#27272A]" />
            <StepItem index={3} label="Foreign Keys"  active={step === 3} complete={step > 3} optional />
            <div className="h-px w-6 bg-[#27272A]" />
            <StepItem index={4} label="Review"        active={step === 4} complete={false} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Step 1: Table Details ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label>Table Name <span className="text-[#3B82F6]">*</span></Label>
                <Input
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  placeholder="users" className="font-mono"
                />
                <p className="mt-1 text-xs text-[#52525B]">Lowercase letters, numbers and underscores only</p>
              </div>
              <div>
                <Label>Table Comment</Label>
                <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional description" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <Switch checked={enableRls} onCheckedChange={setEnableRls} />
                  <p className="text-sm text-[#FAFAFA]">Enable Row Level Security</p>
                </div>
                <p className="pl-14 text-xs text-[#52525B]">Enable row-level policies after table creation</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Columns + inline FK ───────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="overflow-x-auto rounded-md border border-[#27272A] px-3">
                <div className="min-w-[940px]">
                  {/* Header row */}
                  <div className="grid [grid-template-columns:2fr_1.5fr_80px_100px_1.5fr_80px_80px] items-center gap-2 border-b border-[#27272A] py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#52525B]">
                    <p>Name</p><p>Type</p><p>Length</p>
                    <p className="text-center">Nullable</p>
                    <p>Default</p>
                    <p className="text-center">Unique</p>
                    <p className="text-center">Actions</p>
                  </div>

                  {columns.map((col) => {
                    const nameInvalid = col.name.length > 0 && !/^[a-z0-9_]+$/.test(col.name)
                    const lengthEnabled = ["varchar", "char"].includes(col.type)
                    const hasFk = col.fk !== undefined
                    const hasCompatibleTarget = availableTables.some((t) =>
                      t.columns.some((c) => isTypeCompatible(col.type, c.type))
                    )

                    return (
                      <div key={col.id}>
                        {/* Main row */}
                        <div className={cn(
                          "grid min-h-[64px] [grid-template-columns:2fr_1.5fr_80px_100px_1.5fr_80px_80px] items-center gap-2 border-b py-[10px]",
                          hasFk ? "border-[#1D3461]/60 bg-[#141414]" : "border-[#1F1F23]",
                          col.suggested && !hasFk && "bg-[#141414]"
                        )}>
                          <div className="relative">
                            <Input
                              value={col.name}
                              onChange={(e) => updateColumn(col.id, { name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                              placeholder="column_name"
                              className="h-[34px] font-mono"
                              aria-invalid={nameInvalid}
                            />
                            {col.suggested && !hasFk && (
                              <span className="absolute -bottom-4 left-1 rounded-[10px] border border-[#D4A84340] bg-[#2D2410] px-1.5 py-[1px] text-[10px] text-[#D4A843]">suggested</span>
                            )}
                          </div>

                          <Select value={col.type} onValueChange={(v) => updateColumn(col.id, { type: v, length: ["varchar","char"].includes(v) ? col.length : "", fk: undefined })}>
                            <SelectTrigger className="h-[34px] font-mono"><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-[300px] overflow-y-auto border-[#27272A] bg-[#1A1A1A]">
                              {COLUMN_TYPE_CATEGORIES.map((cat) => (
                                <SelectGroup key={cat.label}>
                                  <SelectLabel>{cat.label}</SelectLabel>
                                  {cat.types.map((t) => (
                                    <SelectItem key={t} value={t} className="font-mono text-[13px] text-[#FAFAFA]">{t}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>

                          <Input
                            type="number" value={col.length}
                            onChange={(e) => updateColumn(col.id, { length: e.target.value })}
                            disabled={!lengthEnabled}
                            placeholder={col.type === "char" ? "1" : "255"}
                            className={cn("h-[34px] font-mono", !lengthEnabled && "opacity-30 cursor-not-allowed")}
                          />

                          <div className="flex justify-center">
                            <Switch checked={col.nullable} onCheckedChange={(v) => updateColumn(col.id, { nullable: v })} />
                          </div>

                          <Input value={col.default} onChange={(e) => updateColumn(col.id, { default: e.target.value })} placeholder="NULL" className="h-[34px] font-mono" />

                          <div className="flex justify-center">
                            <label className="flex h-4 w-4 cursor-pointer items-center justify-center">
                              <input type="checkbox" checked={col.isUnique} onChange={(e) => updateColumn(col.id, { isUnique: e.target.checked })} className="peer sr-only" />
                              <span className="flex h-4 w-4 items-center justify-center rounded-[4px] border-[1.5px] border-[#27272A] bg-transparent text-[10px] text-transparent peer-checked:border-[#3B82F6] peer-checked:bg-[#3B82F6] peer-checked:text-white">✓</span>
                            </label>
                          </div>

                          {/* Actions: FK toggle + delete */}
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              title={
                                !col.name.trim()       ? "Enter a column name first"
                                : !hasCompatibleTarget ? `No compatible FK targets for type ${col.type}`
                                : hasFk                ? "Remove foreign key"
                                                       : "Add foreign key"
                              }
                              disabled={!col.name.trim() || !hasCompatibleTarget}
                              onClick={() => updateColumn(col.id, {
                                fk: hasFk ? undefined : {
                                  column: col.name,
                                  referenced_table: "",
                                  referenced_column: "",
                                  on_delete: "NO ACTION",
                                  on_update: "NO ACTION",
                                },
                              })}
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded transition-colors",
                                hasFk
                                  ? "text-[#3B82F6] bg-[#1D3461]/30 hover:bg-[#1D3461]/50"
                                  : "text-[#52525B] hover:text-[#3B82F6] hover:bg-[#1D3461]/20",
                                (!col.name.trim() || !hasCompatibleTarget) && "opacity-30 cursor-not-allowed"
                              )}
                            >
                              <Link2 size={13} />
                            </button>
                            <Button
                              type="button" variant="ghost" size="icon"
                              className="h-7 w-7 text-[#52525B] hover:text-[#EF4444]"
                              onClick={() => setColumns((prev) => prev.filter((c) => c.id !== col.id))}
                            >
                              <Trash2 className="h-[13px] w-[13px]" />
                            </Button>
                          </div>
                        </div>

                        {/* Inline FK expansion */}
                        {hasFk && (
                          <div className="border-b border-[#1D3461]/40 bg-[#0D0D0D] px-4 py-3">
                            <p className="text-[10px] text-[#3B82F6] font-medium uppercase tracking-wider mb-2">
                              Foreign Key — {col.name}
                            </p>
                            <ForeignKeyForm
                              sourceColumn={{ name: col.name || "column_name", type: col.type }}
                              availableTables={availableTables}
                              value={col.fk!}
                              onChange={(fk) => updateColumn(col.id, { fk: fk ?? undefined })}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <Button
                type="button" variant="outline"
                className="h-10 w-full border-dashed border-[#27272A] bg-transparent text-[#A1A1AA] hover:border-[#3B82F6] hover:bg-[#1D346120] hover:text-[#3B82F6]"
                onClick={() => setColumns((prev) => [...prev, makeColumn()])}
              >
                <Plus className="h-4 w-4" /> Add column
              </Button>

              <SqlPreview sql={generatedSQL} />
            </div>
          )}

          {/* ── Step 3: Foreign Keys overview ─────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-white font-semibold text-base">Foreign Keys</h3>
                <p className="text-[#52525B] text-sm mt-1">
                  Review and adjust relationships. Foreign keys can also be added later from the Schema tab.
                </p>
              </div>

              {availableTables.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center bg-[#0A0A0A] border border-dashed border-[#27272A] rounded-lg">
                  <Link2 size={24} className="text-[#27272A] mb-3" />
                  <p className="text-[#A1A1AA] text-sm font-medium mb-1">No other tables yet</p>
                  <p className="text-[#52525B] text-xs">Create more tables first to establish relationships</p>
                </div>
              ) : (
                <>
                  {/* Columns with FK active */}
                  {columns.filter(c => c.name.trim()).map((col) => {
                    const hasCompatibleTarget = availableTables.some((t) =>
                      t.columns.some((c) => isTypeCompatible(col.type, c.type))
                    )
                    const hasFk = col.fk !== undefined

                    return (
                      <div key={col.id} className="rounded-lg border border-[#1F1F23] bg-[#0D0D0D] p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-white">{col.name}</span>
                            <span className="text-[10px] text-[#52525B] font-mono">{col.type}</span>
                          </div>
                          <button
                            type="button"
                            disabled={!hasCompatibleTarget}
                            onClick={() => updateColumn(col.id, {
                              fk: hasFk ? undefined : {
                                column: col.name,
                                referenced_table: "",
                                referenced_column: "",
                                on_delete: "NO ACTION",
                                on_update: "NO ACTION",
                              },
                            })}
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                              hasFk
                                ? "bg-[#1D3461]/30 text-[#3B82F6] hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
                                : "bg-[#1A1A1A] text-[#52525B] hover:text-[#3B82F6] hover:bg-[#1D3461]/20",
                              !hasCompatibleTarget && "opacity-30 cursor-not-allowed"
                            )}
                            title={!hasCompatibleTarget ? `No compatible FK targets for ${col.type}` : undefined}
                          >
                            <Link2 size={11} />
                            {hasFk ? "Remove FK" : "Add FK"}
                          </button>
                        </div>

                        {hasFk && (
                          <ForeignKeyForm
                            sourceColumn={{ name: col.name, type: col.type }}
                            availableTables={availableTables}
                            value={col.fk!}
                            onChange={(fk) => updateColumn(col.id, { fk: fk ?? undefined })}
                          />
                        )}

                        {!hasFk && (
                          <p className="text-xs text-[#3B3B3B]">No foreign key</p>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* ── Step 4: Review ────────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              {activeFKs.length > 0 && (
                <div className="rounded-md bg-[#0D0D0D] border border-[#1F1F23] px-4 py-3">
                  <p className="text-[10px] text-[#52525B] uppercase tracking-wider font-medium mb-2">
                    Foreign Keys ({activeFKs.length})
                  </p>
                  {activeFKs.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs font-mono text-[#A1A1AA] py-0.5">
                      <span className="text-white">{c.name}</span>
                      <span className="text-[#52525B]">→</span>
                      <span>{c.fk!.referenced_table}.{c.fk!.referenced_column}</span>
                      {c.fk!.on_delete !== "NO ACTION" && (
                        <span className="text-[#52525B]">ON DELETE {c.fk!.on_delete}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-[#A1A1AA]">Review the generated SQL before creating the table.</p>
              <SqlPreview sql={generatedSQL} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-[#27272A] bg-[#111111] px-6 py-4 shrink-0">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep((p) => (p - 1) as Step)}>
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {step === 3 && (
              <Button type="button" variant="outline" onClick={() => setStep(4)}>Skip</Button>
            )}
            {step < 4 ? (
              <Button
                type="button"
                onClick={() => setStep((p) => (p + 1) as Step)}
                disabled={step === 1 && !tableName.trim()}
              >
                {step === 3 ? "Next → Review" : "Next"}
              </Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={loading}>
                {loading ? "Creating…" : "Create table"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
