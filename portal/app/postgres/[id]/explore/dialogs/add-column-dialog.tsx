"use client"

import { AlertCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { addColumn, addForeignKey, getAllTablesWithColumns } from "@/lib/db-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DefaultValueInput } from "../components/default-value-input"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ForeignKeyForm, type FKFormValue } from "../components/foreign-key-form"
import { COLUMN_TYPE_CATEGORIES } from "../components/column-types"
import { SlideOverPanel } from "../components/slide-over-panel"
import { SqlPreview } from "../components/sql-preview"
import { useExplorer } from "@/lib/explorer-context"
import type { ColumnDefinition, ForeignKeyDefinition } from "@/types/db"

interface AddColumnDialogProps {
  instanceId: string
  tableName: string
  schema: string
  open: boolean
  onOpenChange: (open: boolean) => void
  hasPrimaryKey: boolean
}

export function AddColumnDialog({
  instanceId,
  tableName,
  schema,
  open,
  onOpenChange,
  hasPrimaryKey,
}: AddColumnDialogProps) {
  const queryClient = useQueryClient()
  const { currentSchema } = useExplorer()

  const [name,         setName]         = useState("")
  const [type,         setType]         = useState("text")
  const [length,       setLength]       = useState("")
  const [nullable,     setNullable]     = useState(true)
  const [defaultVal,   setDefaultVal]   = useState("")
  const [isUnique,     setIsUnique]     = useState(false)
  const [isPrimaryKey, setIsPrimaryKey] = useState(false)
  const [isFk,         setIsFk]         = useState(false)
  const [fkValue,      setFkValue]      = useState<FKFormValue | null>(null)
  const [loading,      setLoading]      = useState(false)

  const { data: availableTables = [] } = useQuery({
    queryKey: ["db", instanceId, "tables-with-columns", currentSchema],
    queryFn: () => getAllTablesWithColumns(instanceId, currentSchema),
    enabled: open && isFk,
    staleTime: 30_000,
  })

  const nameError = useMemo(() => {
    if (!name) return ""
    return /^[a-z0-9_]+$/.test(name) ? "" : "Lowercase letters, numbers and underscores only"
  }, [name])

  const previewSQL = useMemo(() => {
    const colName = name || "column_name"
    const colType = ["varchar", "char"].includes(type) && length ? `${type}(${length})` : type
    const tokens = [`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType}`]
    if (!nullable)        tokens.push("NOT NULL")
    if (defaultVal.trim()) tokens.push(`DEFAULT ${defaultVal.trim()}`)
    if (isUnique)         tokens.push("UNIQUE")
    if (isPrimaryKey)     tokens.push("PRIMARY KEY")

    const lines = [`${tokens.join(" ")};`]

    if (isFk && fkValue?.referenced_table && fkValue?.referenced_column) {
      const constraintName = `fk_${tableName}_${colName}`
      let fkLine = `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${colName}) REFERENCES ${fkValue.referenced_table}(${fkValue.referenced_column})`
      if (fkValue.on_delete !== "NO ACTION") fkLine += ` ON DELETE ${fkValue.on_delete}`
      if (fkValue.on_update !== "NO ACTION") fkLine += ` ON UPDATE ${fkValue.on_update}`
      lines.push(fkLine + ";")
    }

    return lines.join("\n")
  }, [defaultVal, isFk, fkValue, isPrimaryKey, isUnique, length, name, nullable, tableName, type])

  const reset = () => {
    setName(""); setType("text"); setLength(""); setNullable(true)
    setDefaultVal(""); setIsUnique(false); setIsPrimaryKey(false)
    setIsFk(false); setFkValue(null)
  }

  const handleCreate = async () => {
    if (!name.trim() || nameError) { toast.error("Column name is required"); return }

    setLoading(true)
    try {
      const col: ColumnDefinition = {
        name,
        type,
        length: length ? Number(length) : undefined,
        nullable,
        default: defaultVal || undefined,
        is_primary_key: isPrimaryKey,
        is_unique: isUnique,
      }
      await addColumn(instanceId, tableName, col, schema)

      // Optionally add the FK constraint in a second statement
      if (isFk && fkValue?.referenced_table && fkValue?.referenced_column) {
        const fk: ForeignKeyDefinition = {
          column: name,
          referenced_table: fkValue.referenced_table,
          referenced_column: fkValue.referenced_column,
          on_delete: fkValue.on_delete as ForeignKeyDefinition["on_delete"],
          on_update: fkValue.on_update as ForeignKeyDefinition["on_update"],
        }
        await addForeignKey(instanceId, tableName, fk, schema)
      }

      toast.success(`Column "${name}" added`)
      queryClient.invalidateQueries({ queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "columns"] })
      queryClient.invalidateQueries({ queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "foreign-keys"] })
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add column")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}
      title="Add Column"
      subtitle={`Add a new column to ${tableName}`}
      footer={
        <>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim() || Boolean(nameError)}>
            {loading ? "Adding…" : "Add Column"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Name */}
        <div>
          <Label>Column Name <span className="text-[#3B82F6]">*</span></Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            placeholder="column_name"
            aria-invalid={Boolean(nameError)}
            className="font-mono"
          />
          <p className="mt-1 text-xs text-[#52525B]">Lowercase letters, numbers and underscores only</p>
          {nameError && (
            <p className="mt-1 flex items-center gap-1 text-xs text-[#EF4444]">
              <AlertCircle className="h-3.5 w-3.5" />{nameError}
            </p>
          )}
        </div>

        {/* Type */}
        <div>
          <Label>Data Type <span className="text-[#3B82F6]">*</span></Label>
          <Select value={type} onValueChange={(v) => { setType(v); setFkValue(null) }}>
            <SelectTrigger className="h-9 font-mono"><SelectValue /></SelectTrigger>
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
        </div>

        {/* Length */}
        {["varchar", "char"].includes(type) && (
          <div>
            <Label>Length</Label>
            <Input type="number" value={length} onChange={(e) => setLength(e.target.value)} className="font-mono" />
          </div>
        )}

        {/* Default value */}
        <div>
          <Label className="mb-1.5 block">Default Value</Label>
          <DefaultValueInput type={type} value={defaultVal} onChange={setDefaultVal} />
        </div>

        {/* Toggles */}
        <div className="space-y-4">
          {[
            { checked: nullable,     onChange: setNullable,     label: "Allow Nullable",  hint: "Allow this column to store NULL values" },
            { checked: isUnique,     onChange: setIsUnique,     label: "Unique",           hint: "Enforce unique values across all rows" },
            {
              checked: isPrimaryKey, onChange: setIsPrimaryKey, label: "Primary Key",
              hint: hasPrimaryKey ? "This table already has a primary key" : "Set as primary key for this table",
              disabled: hasPrimaryKey,
            },
          ].map(({ checked, onChange, label, hint, disabled }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center gap-3">
                <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
                <p className="text-sm text-[#FAFAFA]">{label}</p>
              </div>
              <p className="pl-14 text-xs text-[#52525B]">{hint}</p>
            </div>
          ))}
        </div>

        {/* ── Foreign Key section ─────────────────────────────────────────── */}
        <div className="border-t border-[#1F1F23] pt-4 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Switch
                checked={isFk}
                onCheckedChange={(v) => { setIsFk(v); if (!v) setFkValue(null) }}
              />
              <p className="text-sm text-[#FAFAFA]">Foreign Key</p>
            </div>
            <p className="pl-14 text-xs text-[#52525B]">
              Reference a column in another table to enforce referential integrity
            </p>
          </div>

          {isFk && name.trim() && (
            <ForeignKeyForm
              sourceColumn={{ name: name || "column_name", type }}
              availableTables={availableTables}
              value={fkValue}
              onChange={setFkValue}
            />
          )}

          {isFk && !name.trim() && (
            <p className="text-xs text-[#52525B] pl-14">Enter a column name above first</p>
          )}
        </div>

        <SqlPreview sql={previewSQL} />
      </div>
    </SlideOverPanel>
  )
}
