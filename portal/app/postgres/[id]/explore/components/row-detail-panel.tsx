"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"
import { insertRow, updateRow, deleteRow } from "@/lib/db-api"
import { Column } from "@/types/db"
import { getTypeBadgeClass } from "./column-types"

interface RowDetailPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "insert" | "edit"
  data: Record<string, unknown> | null
  columns: Column[] | undefined
  instanceId: string
  tableName: string
  schema: string
  onSuccess: () => void
}

// Columns whose values are entirely managed by Postgres — never show in form.
// Only true sequences (SERIAL / nextval) qualify; UUID defaults are editable.
function isSequenceGenerated(column: Column): boolean {
  const typeLower = column.type.toLowerCase()
  if (typeLower === "serial" || typeLower === "bigserial") return true
  if (column.default) {
    const d = column.default.toLowerCase()
    if (d.includes("nextval(")) return true
  }
  return false
}

// Derive a sensible initial value for a column when opening the insert form.
function getInsertDefault(column: Column): string {
  if (!column.default) return ""
  const d = column.default.toLowerCase()

  // UUID columns: generate a fresh UUID the user can see and override.
  if (d.includes("gen_random_uuid()") || d.includes("uuid_generate_v4()")) {
    return crypto.randomUUID()
  }

  // DB-side timestamps — let the DB apply them; leave the field empty.
  if (d.includes("now()") || d.includes("current_timestamp")) return ""

  // Boolean literals
  if (d === "true" || d === "false") return column.default

  // Numeric literals
  if (!isNaN(Number(column.default))) return column.default

  // Quoted string literals like 'active' → strip the quotes
  const strMatch = column.default.match(/^'(.*)'$/)
  if (strMatch) return strMatch[1]

  return ""
}

// Build payload for insert.
// Iterates the schema columns (authoritative) instead of formData keys so the
// function is safe even when columns refetches mid-edit.
function buildInsertPayload(
  formData: Record<string, unknown>,
  columns: Column[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  for (const col of columns) {
    const value = formData[col.name]

    const isAutoGen =
      col.type === "serial" ||
      col.type === "bigserial" ||
      (col.default?.toLowerCase().includes("nextval(") ?? false) ||
      (col.default?.toLowerCase().includes("gen_random_uuid()") ?? false) ||
      (col.default?.toLowerCase().includes("uuid_generate_v4()") ?? false)

    // User typed a real value — always send it regardless of anything else.
    if (value !== undefined && value !== "" && value !== null) {
      payload[col.name] = value
      continue
    }

    // No user value below this point:
    if (isAutoGen) continue                                  // let DB generate
    if (col.default && (value === undefined || value === "")) continue  // let DB use default
    if (col.nullable && (value === undefined || value === "")) continue  // DB will store NULL

    // NOT NULL + no default + no user value → send null so the DB returns a
    // descriptive error instead of silently inserting wrong data.
    payload[col.name] = null
  }

  return payload
}

export function RowDetailPanel({
  open,
  onOpenChange,
  mode,
  data,
  columns,
  instanceId,
  tableName,
  schema,
  onSuccess,
}: RowDetailPanelProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set())
  // Track whether the panel was already open in the previous render so we only
  // initialise the form on the open→close→open transition, not on every
  // background re-fetch of `columns` (which would wipe user input mid-edit).
  const wasOpenRef = useRef(false)

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open

    if (!justOpened) return

    if (mode === "edit" && data) {
      setFormData(data)
      setChangedFields(new Set())
    } else if (mode === "insert") {
      const initial: Record<string, unknown> = {}
      columns?.forEach((col) => {
        if (!isSequenceGenerated(col)) {
          initial[col.name] = getInsertDefault(col)
        }
      })
      setFormData(initial)
      setChangedFields(new Set())
    }
  }, [open, mode, data, columns])

  const handleFieldChange = (column: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [column]: value }))
    if (mode === "edit") {
      setChangedFields((prev) => new Set([...prev, column]))
    }
  }

  const handleSubmit = async () => {
    // Guard: columns must be loaded before we can build a correct payload.
    if (!columns || columns.length === 0) {
      toast.error("Column metadata not yet loaded — please wait a moment and try again.")
      return
    }

    setLoading(true)
    try {
      if (mode === "insert") {
        const payload = buildInsertPayload(formData, columns)
        console.log("[insert] formData:", formData, "columns:", columns.map(c => c.name), "payload:", payload)

        // API now returns the full inserted row via RETURNING *.
        const insertedRow = await insertRow(instanceId, tableName, payload, schema)

        // Immediately inject the returned row into the cache so the grid
        // reflects the real DB state without waiting for a round-trip refetch.
        if (insertedRow && typeof insertedRow === "object" && !("status" in insertedRow)) {
          queryClient.setQueriesData(
            { queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "rows"] },
            (old: { rows: Record<string, unknown>[]; total: number } | undefined) => {
              if (!old) return old
              return { ...old, rows: [insertedRow as Record<string, unknown>, ...old.rows], total: old.total + 1 }
            }
          )
        }

        // Always invalidate to reconcile count and ordering with the DB.
        queryClient.invalidateQueries({ queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "rows"] })
        toast.success("Row inserted")
      } else {
        const primary = columns.find((c) => c.is_primary_key)
        if (!primary) throw new Error("No primary key found")
        const pk = data?.[primary.name]
        await updateRow(instanceId, tableName, pk as string | number, formData, schema)
        queryClient.invalidateQueries({ queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "rows"] })
        toast.success("Row updated")
      }
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save row")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Delete this row? This cannot be undone.")) return

    setLoading(true)
    try {
      const primary = columns?.find((c) => c.is_primary_key)
      if (!primary) throw new Error("No primary key found")
      const pk = data?.[primary.name]
      await deleteRow(instanceId, tableName, pk as string | number, schema)
      toast.success("Row deleted")
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete row")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => onOpenChange(false)

  // Get columns to display based on mode
  const displayColumns = columns?.filter((col) => {
    // In edit mode, hide primary key
    if (mode === "edit" && col.is_primary_key) return false
    return true
  })

  return (
    <div
      className={`fixed right-0 top-0 h-screen w-96 bg-[#111111] border-l border-[#27272A] shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col z-50 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header - fixed */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272A] shrink-0">
        <div>
          <h3 className="text-base font-semibold text-white">
            {mode === "insert" ? "Insert Row" : "Edit Row"}
          </h3>
          <p className="text-xs text-[#52525B] mt-0.5">
            {mode === "insert" ? `Add a new row to ${tableName}` : `Modify row in ${tableName}`}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="text-[#52525B] hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Form - scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {displayColumns?.map((col) => {
          const seqGenerated = isSequenceGenerated(col)
          const isUuidDefault = col.default
            ? col.default.toLowerCase().includes("gen_random_uuid()") ||
              col.default.toLowerCase().includes("uuid_generate_v4()")
            : false
          const isTimestampDefault = col.default
            ? col.default.toLowerCase().includes("now()") ||
              col.default.toLowerCase().includes("current_timestamp")
            : false

          // Sequence columns (SERIAL) can never be set — show as a pill.
          if (mode === "insert" && seqGenerated) {
            return (
              <div key={col.name} className="flex items-center gap-2 py-2 mb-4">
                <span className="text-sm font-mono text-[#52525B]">
                  {col.name}
                </span>
                <span className="text-xs bg-[#1F1F23] text-[#52525B] border border-[#27272A] rounded-full px-2 py-0.5">
                  auto-increment
                </span>
              </div>
            )
          }

          // Get placeholder text
          let placeholder = `Enter ${col.name}...`
          if (isUuidDefault && mode === "insert") {
            placeholder = "UUID — edit or regenerate"
          } else if (isTimestampDefault && mode === "insert") {
            placeholder = "Leave empty to use CURRENT_TIMESTAMP"
          } else if (col.default && !isTimestampDefault) {
            placeholder = `Default: ${col.default}`
          }

          return (
            <div key={col.name} className="flex flex-col gap-1.5 mb-4">
              {/* Label row */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-[#A1A1AA]">
                  {col.name}
                </label>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-mono border ${getTypeBadgeClass(col.type)}`}
                >
                  {col.type}
                </span>
                {!col.nullable && !col.default && !seqGenerated && (
                  <span className="text-xs text-[#EF4444]">*</span>
                )}
              </div>

              {/* Input */}
              {col.type.toLowerCase() === "boolean" ? (
                <select
                  value={String(formData[col.name] ?? "")}
                  onChange={(e) => handleFieldChange(col.name, e.target.value)}
                  className="w-full h-9 bg-[#1A1A1A] border border-[#27272A] rounded-md px-3 text-sm text-[#FAFAFA] focus:border-[#3B82F6] focus:outline-none"
                >
                  <option value="">Select...</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={String(formData[col.name] ?? "")}
                  onChange={(e) => handleFieldChange(col.name, e.target.value)}
                  placeholder={placeholder}
                  className="w-full h-9 bg-[#1A1A1A] border border-[#27272A] rounded-md px-3 text-sm text-[#FAFAFA] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none"
                />
              )}

              {mode === "edit" && changedFields.has(col.name) && (
                <div className="text-[10px] text-[#3B82F6]">Modified</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer - fixed */}
      <div className="border-t border-[#27272A] px-5 py-4 shrink-0">
        {mode === "edit" && changedFields.size > 0 && (
          <p className="text-xs text-[#A1A1AA] mb-3">{changedFields.size} change(s)</p>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          {mode === "edit" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB]"
          >
            {mode === "insert" ? "Insert" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}