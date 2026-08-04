"use client"

import { GripVertical } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useQueryClient, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { createIndex, getColumns } from "@/lib/db-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { IndexDefinition } from "@/types/db"
import { getTypeBadgeClass } from "../components/column-types"
import { SlideOverPanel } from "../components/slide-over-panel"
import { SqlPreview } from "../components/sql-preview"

interface CreateIndexDialogProps {
  instanceId: string
  tableName: string
  schema: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateIndexDialog({
  instanceId,
  tableName,
  schema,
  open,
  onOpenChange,
}: CreateIndexDialogProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [manualName, setManualName] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [type, setType] = useState<"btree" | "hash" | "gin" | "gist" | "brin">("btree")
  const [isUnique, setIsUnique] = useState(false)
  const [concurrent, setConcurrent] = useState(true)
  const [loading, setLoading] = useState(false)

  const { data: columns } = useQuery({
    queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "columns"],
    queryFn: () => getColumns(instanceId, tableName, schema),
  })

  useEffect(() => {
    if (manualName) return

    if (selectedColumns.length === 0) {
      setName("")
      return
    }

    const suffix = selectedColumns.join("_")
    setName(`${tableName}_${suffix}_idx`)
  }, [manualName, selectedColumns, tableName])

  const sqlPreview = useMemo(() => {
    const finalName = name || `${tableName}_idx`
    const cols = selectedColumns.length > 0 ? selectedColumns.join(", ") : "column_name"
    return `CREATE ${isUnique ? "UNIQUE " : ""}INDEX ${concurrent ? "CONCURRENTLY " : ""}${finalName}\nON ${tableName} USING ${type} (${cols});`
  }, [concurrent, isUnique, name, selectedColumns, tableName, type])

  const handleCreate = async () => {
    if (!name.trim() || selectedColumns.length === 0) {
      toast.error("Index name and columns are required")
      return
    }

    setLoading(true)
    try {
      const idx: IndexDefinition = {
        name,
        columns: selectedColumns,
        type,
        unique: isUnique,
        concurrent,
      }
      await createIndex(instanceId, tableName, idx, schema)
      toast.success(`Index "${name}" created`)
      queryClient.invalidateQueries({
        queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "indexes"],
      })
      setName("")
      setSelectedColumns([])
      setType("btree")
      setIsUnique(false)
      setConcurrent(true)
      setManualName(false)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create index")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={onOpenChange}
      title="Create Index"
      subtitle={`Improve query performance on ${tableName}`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || selectedColumns.length === 0 || !name.trim()}>
            {loading ? "Creating..." : "Create Index ->"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label>
            Index Name <span className="text-[#3B82F6]">*</span>
          </Label>
          <Input
            placeholder={`${tableName}_columns_idx`}
            value={name}
            onChange={(event) => {
              setManualName(true)
              setName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
            }}
            className="font-mono"
          />
        </div>

        <div>
          <Label>
            Select Columns <span className="text-[#3B82F6]">*</span>
          </Label>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-[#27272A] bg-[#1A1A1A] p-2">
            {columns?.map((column) => {
              const isSelected = selectedColumns.includes(column.name)
              return (
                <button
                  type="button"
                  key={column.name}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[#1F1F23]"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedColumns((prev) => prev.filter((name) => name !== column.name))
                    } else {
                      setSelectedColumns((prev) => [...prev, column.name])
                    }
                  }}
                >
                  <input readOnly checked={isSelected} type="checkbox" className="h-4 w-4" />
                  <span className="flex-1 font-mono text-sm text-[#FAFAFA]">{column.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium font-mono ${getTypeBadgeClass(column.type)}`}>
                    {column.type}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-xs text-[#52525B]">Select one or more columns to index</p>
        </div>

        {selectedColumns.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-[#A1A1AA]">Selected columns</p>
            <div className="flex flex-wrap gap-2">
              {selectedColumns.map((column, idx) => (
                <div key={column} className="inline-flex items-center gap-1 rounded-full border border-[#27272A] bg-[#1A1A1A] px-2 py-1">
                  <GripVertical className="h-3.5 w-3.5 text-[#71717A]" />
                  <span className="font-mono text-xs text-[#FAFAFA]">{column}</span>
                  <button
                    type="button"
                    className="ml-1 text-xs text-[#A1A1AA] hover:text-[#FAFAFA]"
                    onClick={() => setSelectedColumns((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <Label>
            Index Type <span className="text-[#3B82F6]">*</span>
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "btree", title: "btree", desc: "General purpose" },
              { value: "hash", title: "hash", desc: "Equality only" },
              { value: "gin", title: "gin", desc: "JSON & Arrays" },
              { value: "gist", title: "gist", desc: "Geo & Range" },
            ].map((option) => (
              <button
                type="button"
                key={option.value}
                className={`rounded-md border p-3 text-left transition-colors ${
                  type === option.value
                    ? "border-[#3B82F6] bg-blue-500/10"
                    : "border-[#27272A] bg-[#1A1A1A] hover:bg-[#1F1F23]"
                }`}
                onClick={() => setType(option.value as typeof type)}
              >
                <p className="font-mono text-sm text-[#FAFAFA]">{option.title}</p>
                <p className="mt-1 text-xs text-[#A1A1AA]">{option.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Switch checked={isUnique} onCheckedChange={setIsUnique} />
              <p className="text-sm text-[#FAFAFA]">Unique Index</p>
            </div>
            <p className="pl-14 text-xs text-[#52525B]">Reject duplicate values in indexed columns</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Switch checked={concurrent} onCheckedChange={setConcurrent} />
              <p className="text-sm text-[#FAFAFA]">Create Concurrently</p>
            </div>
            <p className="pl-14 text-xs text-[#52525B]">Build index without locking table reads/writes</p>
          </div>
        </div>

        <SqlPreview sql={sqlPreview} />
      </div>
    </SlideOverPanel>
  )
}

