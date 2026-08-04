"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { addForeignKey, getAllTablesWithColumns, getColumns } from "@/lib/db-api"
import { SlideOverPanel } from "../components/slide-over-panel"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ForeignKeyForm, type FKFormValue } from "../components/foreign-key-form"
import { useExplorer } from "@/lib/explorer-context"
import type { ForeignKeyDefinition } from "@/types/db"

interface AddForeignKeyDialogProps {
  instanceId: string
  tableName: string
  schema: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddForeignKeyDialog({
  instanceId,
  tableName,
  schema,
  open,
  onOpenChange,
}: AddForeignKeyDialogProps) {
  const queryClient  = useQueryClient()
  const { currentSchema } = useExplorer()

  const [sourceColumn, setSourceColumn] = useState("")
  const [fkValue,      setFkValue]      = useState<FKFormValue | null>(null)
  const [loading,      setLoading]      = useState(false)

  const { data: columns = [] } = useQuery({
    queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "columns"],
    queryFn: () => getColumns(instanceId, tableName, schema),
    enabled: open,
  })

  const { data: availableTables = [] } = useQuery({
    queryKey: ["db", instanceId, "tables-with-columns", currentSchema],
    queryFn: () => getAllTablesWithColumns(instanceId, currentSchema),
    enabled: open,
    staleTime: 30_000,
  })

  const selectedCol = columns.find((c) => c.name === sourceColumn)

  const reset = () => {
    setSourceColumn("")
    setFkValue(null)
  }

  const handleCreate = async () => {
    if (!sourceColumn || !fkValue?.referenced_table || !fkValue?.referenced_column) {
      toast.error("Fill in all required fields")
      return
    }

    setLoading(true)
    try {
      const payload: ForeignKeyDefinition = {
        column:            sourceColumn,
        referenced_table:  fkValue.referenced_table,
        referenced_column: fkValue.referenced_column,
        on_delete:         fkValue.on_delete as ForeignKeyDefinition["on_delete"],
        on_update:         fkValue.on_update as ForeignKeyDefinition["on_update"],
      }
      await addForeignKey(instanceId, tableName, payload, schema)
      toast.success("Foreign key added")
      queryClient.invalidateQueries({ queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "foreign-keys"] })
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add foreign key")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}
      title="Add Foreign Key"
      subtitle={`Define a relationship on ${tableName}`}
      footer={
        <>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !sourceColumn || !fkValue?.referenced_table || !fkValue?.referenced_column}
          >
            {loading ? "Adding…" : "Add Foreign Key"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Source column picker */}
        <div>
          <Label className="mb-1.5 block">
            Column <span className="text-[#3B82F6]">*</span>
          </Label>
          <Select
            value={sourceColumn}
            onValueChange={(v) => { setSourceColumn(v); setFkValue(null) }}
          >
            <SelectTrigger className="h-9 font-mono">
              <SelectValue placeholder="Select source column…" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-[#27272A]">
              {columns.map((c) => (
                <SelectItem key={c.name} value={c.name} className="font-mono text-xs">
                  <span>{c.name}</span>
                  <span className="ml-2 text-[#52525B]">{c.type}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* FK form shown once a source column is picked */}
        {selectedCol ? (
          <ForeignKeyForm
            sourceColumn={{ name: selectedCol.name, type: selectedCol.type }}
            availableTables={availableTables}
            value={fkValue}
            onChange={setFkValue}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-[#27272A] py-10 text-center">
            <p className="text-sm text-[#52525B]">Pick a source column above to configure the relationship</p>
          </div>
        )}
      </div>
    </SlideOverPanel>
  )
}
