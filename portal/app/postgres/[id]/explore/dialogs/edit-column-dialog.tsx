"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { alterColumn } from "@/lib/db-api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SlideOverPanel } from "../components/slide-over-panel"
import { SqlPreview } from "../components/sql-preview"
import { DefaultValueInput } from "../components/default-value-input"
import { Column } from "@/types/db"

interface EditColumnDialogProps {
  instanceId: string
  tableName: string
  schema: string
  column: Column | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditColumnDialog({
  instanceId,
  tableName,
  schema,
  column,
  open,
  onOpenChange,
}: EditColumnDialogProps) {
  const queryClient = useQueryClient()
  const [defaultVal, setDefaultVal] = useState("")
  const [nullable, setNullable] = useState(true)
  const [loading, setLoading] = useState(false)

  // Sync form state when the column changes
  useEffect(() => {
    if (column) {
      setDefaultVal(column.default ?? "")
      setNullable(column.nullable)
    }
  }, [column])

  if (!column) return null

  const defaultChanged = (column.default ?? "") !== defaultVal
  const nullableChanged = column.nullable !== nullable
  const hasChanges = defaultChanged || nullableChanged

  const previewSQL: string[] = []
  if (defaultChanged) {
    if (defaultVal.trim() === "") {
      previewSQL.push(`ALTER TABLE ${tableName} ALTER COLUMN ${column.name} DROP DEFAULT;`)
    } else {
      previewSQL.push(`ALTER TABLE ${tableName} ALTER COLUMN ${column.name} SET DEFAULT ${defaultVal.trim()};`)
    }
  }
  if (nullableChanged) {
    previewSQL.push(
      nullable
        ? `ALTER TABLE ${tableName} ALTER COLUMN ${column.name} DROP NOT NULL;`
        : `ALTER TABLE ${tableName} ALTER COLUMN ${column.name} SET NOT NULL;`
    )
  }

  const handleSave = async () => {
    if (!hasChanges) { onOpenChange(false); return }

    setLoading(true)
    try {
      const changes: { default_value?: string | null; nullable?: boolean } = {}
      if (defaultChanged) {
        // "" means DROP DEFAULT (pass empty string to signal removal)
        changes.default_value = defaultVal.trim() === "" ? "" : defaultVal.trim()
      }
      if (nullableChanged) {
        changes.nullable = nullable
      }

      await alterColumn(instanceId, tableName, column.name, changes, schema)
      toast.success(`Column "${column.name}" updated`)

      // Invalidate so the schema tab and insert form both get fresh data
      queryClient.invalidateQueries({
        queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "columns"],
      })
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update column")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit column: ${column.name}`}
      subtitle={`${column.type}${column.length ? `(${column.length})` : ""} · ${tableName}`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !hasChanges}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Read-only info */}
        <div className="rounded-md bg-[#1A1A1A] border border-[#27272A] px-4 py-3 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#52525B]">Name</span>
            <span className="font-mono text-[#FAFAFA]">{column.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#52525B]">Type</span>
            <span className="font-mono text-[#FAFAFA]">
              {column.type}{column.length ? `(${column.length})` : ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#52525B]">Primary key</span>
            <span className="text-[#FAFAFA]">{column.is_primary_key ? "Yes" : "No"}</span>
          </div>
        </div>

        {/* Default value */}
        <div>
          <Label className="mb-1.5 block">Default Value</Label>
          <DefaultValueInput
            type={column.type}
            value={defaultVal}
            onChange={setDefaultVal}
            allowRegenerate
          />
        </div>

        {/* Nullable */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Switch
              checked={nullable}
              onCheckedChange={setNullable}
              disabled={column.is_primary_key}
            />
            <p className="text-sm text-[#FAFAFA]">Allow Nullable</p>
          </div>
          <p className="pl-14 text-xs text-[#52525B]">
            {column.is_primary_key
              ? "Primary key columns cannot be nullable"
              : "Allow this column to store NULL values"}
          </p>
        </div>

        {previewSQL.length > 0 && (
          <SqlPreview sql={previewSQL.join("\n")} />
        )}
      </div>
    </SlideOverPanel>
  )
}
