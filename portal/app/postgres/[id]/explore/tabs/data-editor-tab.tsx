"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy, Eye, GripVertical, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { getColumns, getRows, deleteRows } from "@/lib/db-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RowDetailPanel } from "../components/row-detail-panel"
import { getTypeBadgeClass } from "../components/column-types"
import type { Filter, QueryParams } from "@/types/db"

type FilterRule = {
  id: string
  column: string
  operator: Filter["operator"]
  value: string
  logic: "and" | "or"
}

type SortRule = {
  id: string
  column: string
  direction: "asc" | "desc"
}

interface DataEditorTabProps {
  instanceId: string
  tableName: string
  schema: string
}

interface OperatorOption {
  label: string
  value: Filter["operator"]
  fixedValue?: string
  hideValue?: boolean
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function inferTypeGroup(type: string): "text" | "number" | "boolean" | "date" | "uuid" | "other" {
  const normalized = type.toLowerCase()
  if (["text", "varchar", "char"].includes(normalized)) return "text"
  if (["integer", "bigint", "smallint", "serial", "bigserial", "numeric", "decimal", "real", "double precision"].includes(normalized)) return "number"
  if (normalized === "boolean") return "boolean"
  if (["timestamp", "timestamptz", "date", "time", "interval"].includes(normalized)) return "date"
  if (normalized === "uuid") return "uuid"
  return "other"
}

function getOperatorOptions(type: string): OperatorOption[] {
  const group = inferTypeGroup(type)

  if (group === "text") {
    return [
      { label: "equals", value: "eq" },
      { label: "not equals", value: "neq" },
      { label: "contains", value: "contains" },
      { label: "starts with", value: "starts_with" },
      { label: "ends with", value: "ends_with" },
      { label: "is empty", value: "is_null", hideValue: true },
      { label: "is not empty", value: "is_not_null", hideValue: true },
    ]
  }

  if (group === "number") {
    return [
      { label: "equals", value: "eq" },
      { label: "not equals", value: "neq" },
      { label: "greater than", value: "gt" },
      { label: "greater than or equal", value: "gte" },
      { label: "less than", value: "lt" },
      { label: "less than or equal", value: "lte" },
      { label: "is empty", value: "is_null", hideValue: true },
      { label: "is not empty", value: "is_not_null", hideValue: true },
    ]
  }

  if (group === "boolean") {
    return [
      { label: "is true", value: "eq", fixedValue: "true", hideValue: true },
      { label: "is false", value: "eq", fixedValue: "false", hideValue: true },
      { label: "is empty", value: "is_null", hideValue: true },
      { label: "is not empty", value: "is_not_null", hideValue: true },
    ]
  }

  if (group === "date") {
    return [
      { label: "equals", value: "eq" },
      { label: "not equals", value: "neq" },
      { label: "is after", value: "gt" },
      { label: "is before", value: "lt" },
      { label: "is on or after", value: "gte" },
      { label: "is on or before", value: "lte" },
      { label: "is empty", value: "is_null", hideValue: true },
      { label: "is not empty", value: "is_not_null", hideValue: true },
    ]
  }

  if (group === "uuid") {
    return [
      { label: "equals", value: "eq" },
      { label: "not equals", value: "neq" },
      { label: "is empty", value: "is_null", hideValue: true },
      { label: "is not empty", value: "is_not_null", hideValue: true },
    ]
  }

  return [
    { label: "equals", value: "eq" },
    { label: "not equals", value: "neq" },
    { label: "is empty", value: "is_null", hideValue: true },
    { label: "is not empty", value: "is_not_null", hideValue: true },
  ]
}

function compareValues(operator: Filter["operator"], rowValue: unknown, filterValue: string): boolean {
  if (operator === "is_null") return rowValue === null || rowValue === undefined || rowValue === ""
  if (operator === "is_not_null") return rowValue !== null && rowValue !== undefined && rowValue !== ""

  const value = String(rowValue ?? "")
  const normalizedFilter = filterValue.toLowerCase()
  const normalizedValue = value.toLowerCase()

  switch (operator) {
    case "eq":
      return normalizedValue === normalizedFilter
    case "neq":
      return normalizedValue !== normalizedFilter
    case "contains":
      return normalizedValue.includes(normalizedFilter)
    case "starts_with":
      return normalizedValue.startsWith(normalizedFilter)
    case "ends_with":
      return normalizedValue.endsWith(normalizedFilter)
    case "gt":
      return Number(value) > Number(filterValue)
    case "gte":
      return Number(value) >= Number(filterValue)
    case "lt":
      return Number(value) < Number(filterValue)
    case "lte":
      return Number(value) <= Number(filterValue)
    default:
      return true
  }
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

// Click-to-copy cell. The copy icon is always visible on the right edge (subtle
// but never hidden) so users know the value is copyable.
function CopyCell({
  value,
  display,
  label = "Copied",
  mono = false,
}: {
  value: string
  display: string
  label?: string
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      toast.success(label, { duration: 1500 })
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Click to copy: ${value}`}
      className={`group flex items-center justify-between w-full gap-2 px-1.5 py-1 -mx-1.5 -my-1 rounded hover:bg-[#1A1A1A] transition-colors cursor-pointer text-xs ${mono ? "font-mono text-[#A1A1AA]" : "text-[#FAFAFA]"} hover:text-white`}
    >
      {/* Value — left side */}
      <span className="truncate group-hover:text-white transition-colors">{display}</span>

      {/* Copy icon — always visible at right edge, subtle until hover */}
      <span className="shrink-0 ml-2">
        {copied
          ? <Check size={11} className="text-[#22C55E]" />
          : <Copy size={11} className="text-[#3B3B3B] group-hover:text-[#52525B] transition-colors" />}
      </span>
    </button>
  )
}

function UuidCell({ value }: { value: string }) {
  const display = `${value.slice(0, 8)}…${value.slice(-4)}`
  return <CopyCell value={value} display={display} label="UUID copied" mono />
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="inline-flex h-4 w-4 cursor-pointer items-center justify-center">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <span className="flex h-4 w-4 items-center justify-center rounded-[4px] border-[1.5px] border-[#27272A] bg-transparent text-[10px] text-transparent peer-checked:border-[#3B82F6] peer-checked:bg-[#3B82F6] peer-checked:text-white">✓</span>
    </label>
  )
}

export function DataEditorTab({ instanceId, tableName, schema }: DataEditorTabProps) {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)

  const [appliedFilters, setAppliedFilters] = useState<FilterRule[]>([])
  const [draftFilters, setDraftFilters] = useState<FilterRule[]>([])
  const [filterOpen, setFilterOpen] = useState(false)

  const [appliedSorts, setAppliedSorts] = useState<SortRule[]>([])
  const [draftSorts, setDraftSorts] = useState<SortRule[]>([])
  const [sortOpen, setSortOpen] = useState(false)

  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)

  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set())
  const [rowDetailOpen, setRowDetailOpen] = useState(false)
  const [rowDetailMode, setRowDetailMode] = useState<"insert" | "edit">("insert")
  const [selectedRowData, setSelectedRowData] = useState<Record<string, unknown> | null>(null)

  const { data: columns } = useQuery({
    queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "columns"],
    queryFn: () => getColumns(instanceId, tableName, schema),
  })

  useEffect(() => {
    if (!columns) return
    setVisibleColumns((prev) => (prev.length > 0 ? prev : columns.map((column) => column.name)))
  }, [columns])

  const queryParams: QueryParams = {
    limit,
    offset,
    sort: appliedSorts[0]?.column,
    order: appliedSorts[0]?.direction,
    filters: appliedFilters.map((filter) => ({
      column: filter.column,
      operator: filter.operator,
      value: filter.value,
    })),
  }

  const { data: rowsData, isLoading } = useQuery({
    queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "rows", queryParams],
    queryFn: () => getRows(instanceId, tableName, queryParams, schema),
  })


  const activeColumns = useMemo(() => {
    if (!columns) return []
    return columns.filter((column) => visibleColumns.includes(column.name))
  }, [columns, visibleColumns])

  const filteredRows = useMemo(() => {
    const source = rowsData?.rows ?? []
    const searched = search
      ? source.filter((row) =>
          Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(search.toLowerCase()))
        )
      : source

    const byFilters = appliedFilters.length
      ? searched.filter((row) => {
          return appliedFilters.reduce((result, filter, index) => {
            const pass = compareValues(filter.operator, row[filter.column], filter.value)
            if (index === 0) return pass
            return filter.logic === "or" ? result || pass : result && pass
          }, true)
        })
      : searched

    if (appliedSorts.length === 0) return byFilters

    return [...byFilters].sort((left, right) => {
      for (const sort of appliedSorts) {
        const leftVal = left[sort.column]
        const rightVal = right[sort.column]
        if (leftVal === rightVal) continue

        const leftStr = String(leftVal ?? "")
        const rightStr = String(rightVal ?? "")
        const order = leftStr.localeCompare(rightStr, undefined, { numeric: true, sensitivity: "base" })
        if (order !== 0) {
          return sort.direction === "asc" ? order : -order
        }
      }
      return 0
    })
  }, [rowsData?.rows, search, appliedFilters, appliedSorts])

  const handleSelectRow = useCallback((pk: string | number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(pk)) next.delete(pk)
      else next.add(pk)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (!filteredRows.length) {
      setSelectedRows(new Set())
      return
    }

    if (selectedRows.size === filteredRows.length) {
      setSelectedRows(new Set())
      return
    }

    const primary = columns?.find((column) => column.is_primary_key)
    if (!primary) return
    setSelectedRows(new Set(filteredRows.map((row) => row[primary.name] as string | number)))
  }, [columns, filteredRows, selectedRows.size])

  const handleDeleteRows = useCallback(async () => {
    if (selectedRows.size === 0) return
    if (!confirm(`Delete ${selectedRows.size} row(s)? This cannot be undone.`)) return

    try {
      await deleteRows(instanceId, tableName, Array.from(selectedRows), schema)
      toast.success(`${selectedRows.size} row(s) deleted`)
      setSelectedRows(new Set())
      await queryClient.invalidateQueries({ queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "rows"] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete rows")
    }
  }, [instanceId, queryClient, selectedRows, tableName])

  const handleHeaderSortCycle = (columnName: string) => {
    setAppliedSorts((prev) => {
      const existing = prev.find((sort) => sort.column === columnName)
      if (!existing) {
        return [{ id: makeId("sort"), column: columnName, direction: "asc" }]
      }
      if (existing.direction === "asc") {
        return [{ ...existing, direction: "desc" }]
      }
      return prev.filter((sort) => sort.column !== columnName)
    })
  }

  const formatValue = (value: unknown, type: string): React.ReactNode => {
    // Distinguish actual NULL from empty string
    if (value === null || value === undefined) {
      return <span className="italic text-[#52525B]">NULL</span>
    }

    const typeLower = type.toLowerCase()

    if (typeLower === "boolean") {
      const boolValue = value === true || String(value).toLowerCase() === "true"
      return (
        <span className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${boolValue ? "bg-[#22C55E]" : "bg-[#EF4444]"}`} />
          <span className="capitalize text-xs">{boolValue ? "true" : "false"}</span>
        </span>
      )
    }

    if (["timestamp", "timestamptz", "date"].includes(typeLower) && typeof value === "string") {
      return formatTimestamp(value)
    }

    if (["integer", "bigint", "smallint", "serial", "bigserial", "numeric", "decimal"].includes(typeLower)) {
      return <span className="block text-right font-mono">{Number(value).toLocaleString()}</span>
    }

    if (typeLower === "uuid") {
      return <UuidCell value={String(value)} />
    }

    if (["json", "jsonb"].includes(typeLower)) {
      return <span className="font-mono text-[#A1A1AA]">{"{...}"}</span>
    }

    const text = String(value)
    if (text === "") return <span className="italic text-[#3B3B3B]">empty</span>

    // UUID by content (type might not be tagged "uuid" in every schema)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
      return <UuidCell value={text} />
    }

    // URL — show domain, copy full URL
    if (text.startsWith("http://") || text.startsWith("https://")) {
      let domain = text
      try { domain = new URL(text).hostname } catch { /* keep original */ }
      return <CopyCell value={text} display={domain} label="URL copied" />
    }

    // Email — show full, copy full
    if (text.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      return <CopyCell value={text} display={text} label="Email copied" />
    }

    // Long text — truncate display, copy full
    if (text.length > 30) {
      return <CopyCell value={text} display={`${text.slice(0, 28)}…`} label="Copied" />
    }

    return text
  }

  const beginFilterEdit = () => {
    setDraftFilters(appliedFilters.length > 0 ? appliedFilters : [{ id: makeId("filter"), column: columns?.[0]?.name ?? "", operator: "eq", value: "", logic: "and" }])
    setFilterOpen(true)
  }

  const beginSortEdit = () => {
    setDraftSorts(appliedSorts.length > 0 ? appliedSorts : [{ id: makeId("sort"), column: columns?.[0]?.name ?? "", direction: "asc" }])
    setSortOpen(true)
  }

  const primaryKey = columns?.find((column) => column.is_primary_key)

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#09090B]">
      {selectedRows.size > 0 ? (
        <div className="border-b border-[#3B82F640] bg-[#1D3461] px-4 py-3 md:px-6">
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-3 text-white">
              <span className="text-white">{selectedRows.size} rows selected</span>
              <button type="button" className="text-[#A1A1AA] hover:text-white transition-colors" onClick={() => setSelectedRows(new Set())}>
                Deselect all
              </button>
            </div>
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md bg-[#EF4444] px-3 text-xs font-medium text-white transition-colors hover:bg-[#DC2626]"
              onClick={handleDeleteRows}
            >
              <Trash2 className="h-4 w-4" />
              Delete selected
            </button>
          </div>
        </div>
      ) : (
        <div className="border-b border-[#1F1F23] px-6 py-3 shrink-0 h-[52px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-white font-semibold text-sm shrink-0">
              {filteredRows.length.toLocaleString()} rows
            </span>

            <div className="relative flex-1 max-w-md">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
              <input
                placeholder="Search rows..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearch("")
                }}
                className="w-full h-8 bg-[#141414] border border-[#1F1F23] rounded-md pl-8 pr-8 text-xs text-white placeholder-[#52525B] focus:border-[#27272A] focus:outline-none transition-colors"
              />
              {search ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#52525B] hover:text-white transition-colors"
                  onClick={() => setSearch("")}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Popover
                open={filterOpen}
                onOpenChange={(open) => {
                  setFilterOpen(open)
                  if (open) beginFilterEdit()
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 items-center gap-1.5 rounded-md border border-[#27272A] bg-transparent px-3 text-xs font-medium text-[#52525B] transition-colors hover:border-[#3B82F6] hover:text-white"
                  >
                    <SlidersHorizontal size={13} />
                    <span>Filter</span>
                    {appliedFilters.length > 0 ? (
                      <span className="rounded-full bg-[#3B82F6] px-1.5 py-0 text-[10px] font-semibold text-white">{appliedFilters.length}</span>
                    ) : null}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="z-[100] w-[560px] border-[#27272A] bg-[#111111] p-4 rounded-lg shadow-2xl"
                  style={{ pointerEvents: 'auto' }}
                  onInteractOutside={(event) => {
                    const target = event.target as Element
                    if (target.closest('[data-radix-select-content]') || target.closest('[data-radix-popper-content-wrapper]')) {
                      event.preventDefault()
                    }
                  }}
                >
                  <div onClick={(event) => event.stopPropagation()}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#FAFAFA]">Filter</p>
                      {draftFilters.length > 0 ? (
                        <button type="button" className="text-xs text-[#A1A1AA] hover:text-[#FAFAFA]" onClick={() => setDraftFilters([])}>
                          Clear all
                        </button>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      {draftFilters.map((filter, index) => {
                        const column = columns?.find((col) => col.name === filter.column)
                        const columnType = column?.type ?? "text"
                        const operators = getOperatorOptions(columnType)
                        const selectedOption = operators.find((option) => option.value === filter.operator && (option.fixedValue ?? filter.value) === filter.value) ?? operators[0]
                        const hideValue = selectedOption?.hideValue ?? false

                        return (
                          <div key={filter.id} className="space-y-2">
                            <div className="flex items-center gap-2 w-full">
                              {/* Column selector — fixed width */}
                              <div className="w-[180px] shrink-0">
                                <Select
                                  value={filter.column}
                                  onValueChange={(value) => {
                                    const nextColumn = columns?.find((col) => col.name === value)
                                    const nextOperators = getOperatorOptions(nextColumn?.type ?? "text")
                                    const firstOperator = nextOperators[0]
                                    setDraftFilters((prev) => prev.map((item) => item.id === filter.id ? {
                                      ...item,
                                      column: value,
                                      operator: firstOperator.value,
                                      value: firstOperator.fixedValue ?? "",
                                    } : item))
                                  }}
                                >
                                  <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="Column" />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="z-[200] border-[#27272A] bg-[#1A1A1A]">
                                    {columns?.map((columnOption) => (
                                      <SelectItem key={columnOption.name} value={columnOption.name}>
                                        <span className="flex items-center gap-2">
                                          <span className="font-mono">{columnOption.name}</span>
                                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono ${getTypeBadgeClass(columnOption.type)}`}>{columnOption.type}</span>
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Operator selector — fixed width */}
                              <div className="w-[150px] shrink-0">
                                <Select
                                  value={(() => {
                                    // Find matching option to get correct select value
                                    const match = operators.find((op) =>
                                      op.value === filter.operator &&
                                      (op.fixedValue === undefined || op.fixedValue === filter.value)
                                    )
                                    return match ? `${match.value}|${match.fixedValue ?? ""}` : `${filter.operator}|`
                                  })()}
                                  onValueChange={(encoded) => {
                                    const [newOperator, fixedValue] = encoded.split("|")
                                    const newOption = operators.find((op) =>
                                      op.value === newOperator &&
                                      (op.fixedValue ?? "") === fixedValue
                                    )
                                    setDraftFilters((prev) => prev.map((item) => item.id === filter.id ? {
                                      ...item,
                                      operator: newOperator as Filter["operator"],
                                      value: newOption?.fixedValue ?? (newOption?.hideValue ? "" : item.value),
                                    } : item))
                                  }}
                                >
                                  <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="Select..." />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="z-[200] border-[#27272A] bg-[#1A1A1A]">
                                    {operators.map((option) => (
                                      <SelectItem
                                        key={`${option.value}-${option.label}`}
                                        value={`${option.value}|${option.fixedValue ?? ""}`}
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Value input — takes ALL remaining space */}
                              <div className="flex-1 min-w-0">
                                {hideValue ? (
                                  <div className="w-full h-9 bg-[#0A0A0A] border border-dashed border-[#27272A] rounded-md px-3 flex items-center">
                                    <span className="text-xs text-[#52525B] italic">no value needed</span>
                                  </div>
                                ) : (
                                  <input
                                    type={inferTypeGroup(columnType) === "number" ? "number" : inferTypeGroup(columnType) === "date" ? "date" : "text"}
                                    value={filter.value}
                                    onChange={(event) => setDraftFilters((prev) => prev.map((item) => item.id === filter.id ? { ...item, value: event.target.value } : item))}
                                    placeholder="Enter value..."
                                    className="w-full h-9 bg-[#1A1A1A] border border-[#27272A] rounded-md px-3 text-sm text-[#FAFAFA] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6] pointer-events-auto cursor-text"
                                    style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
                                  />
                                )}
                              </div>

                              {/* Remove button — fixed width */}
                              <button
                                type="button"
                                className="shrink-0 w-8 h-8 flex items-center justify-center text-[#52525B] hover:text-[#EF4444] hover:bg-[#2D1414] rounded transition-colors"
                                onClick={() => setDraftFilters((prev) => prev.filter((item) => item.id !== filter.id))}
                              >
                                <X size={14} />
                              </button>
                            </div>

                            {index < draftFilters.length - 1 ? (
                              <div className="flex justify-center">
                                <button
                                  type="button"
                                  className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.05em] ${filter.logic === "and" ? "border-[#3B82F6] bg-[#1D3461] text-[#3B82F6]" : "border-[#27272A] bg-[#1A1A1A] text-[#A1A1AA]"}`}
                                  onClick={() => setDraftFilters((prev) => prev.map((item) => item.id === filter.id ? { ...item, logic: item.logic === "and" ? "or" : "and" } : item))}
                                >
                                  {filter.logic}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}

                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full border-dashed"
                        onClick={() => setDraftFilters((prev) => [...prev, {
                          id: makeId("filter"),
                          column: columns?.[0]?.name ?? "",
                          operator: "eq",
                          value: "",
                          logic: "and",
                        }])}
                      >
                        <Plus className="h-4 w-4" />
                        Add filter
                      </Button>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[#27272A] pt-3">
                      <p className="text-xs text-[#A1A1AA]">{draftFilters.length} filters applied</p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setDraftFilters([])}>Reset</Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setAppliedFilters(draftFilters.filter((filter) => filter.column && (filter.value || ["is_null", "is_not_null"].includes(filter.operator))))
                            setFilterOpen(false)
                          }}
                        >
                          Apply filters
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover
                open={sortOpen}
                onOpenChange={(open) => {
                  setSortOpen(open)
                  if (open) beginSortEdit()
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-1.5 rounded-md border border-[#27272A] bg-[#1A1A1A] px-3 text-[13px] font-medium text-[#A1A1AA] transition-colors hover:border-[#3B82F6] hover:bg-[#1D346120] hover:text-[#FAFAFA]"
                  >
                    <ArrowUpDown className="h-[14px] w-[14px]" />
                    <span>Sort</span>
                    {appliedSorts.length > 0 ? (
                      <span className="ml-0.5 rounded-[10px] bg-[#3B82F6] px-1.5 py-[1px] text-[11px] font-semibold text-white">{appliedSorts.length}</span>
                    ) : null}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="z-[100] w-[min(360px,calc(100vw-2rem))] border-[#27272A] bg-[#111111] p-4"
                  onInteractOutside={(event) => {
                    const target = event.target as Element
                    if (target.closest('[data-radix-select-content]') || target.closest('[data-radix-popper-content-wrapper]')) {
                      event.preventDefault()
                    }
                  }}
                >
                  <div onClick={(event) => event.stopPropagation()}>
                    <p className="mb-3 text-sm font-semibold text-[#FAFAFA]">Sort</p>
                    <div className="space-y-2">
                      {draftSorts.map((sort, idx) => (
                        <div key={sort.id} className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-[#52525B]" />
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#27272A] text-[10px] text-[#A1A1AA]">{idx + 1}</span>
                          <Select value={sort.column} onValueChange={(value) => setDraftSorts((prev) => prev.map((item) => item.id === sort.id ? { ...item, column: value } : item))}>
                            <SelectTrigger className="h-8 flex-1">
                              <SelectValue placeholder="Column" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[200] border-[#27272A] bg-[#1A1A1A]">
                              {columns?.map((column) => (
                                <SelectItem key={column.name} value={column.name}>{column.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="inline-flex rounded-md border border-[#27272A]">
                            <button
                              type="button"
                              className={`px-2 py-1 text-xs ${sort.direction === "asc" ? "bg-[#1D3461] text-[#3B82F6]" : "text-[#A1A1AA]"}`}
                              onClick={() => setDraftSorts((prev) => prev.map((item) => item.id === sort.id ? { ...item, direction: "asc" } : item))}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className={`px-2 py-1 text-xs ${sort.direction === "desc" ? "bg-[#1D3461] text-[#3B82F6]" : "text-[#A1A1AA]"}`}
                              onClick={() => setDraftSorts((prev) => prev.map((item) => item.id === sort.id ? { ...item, direction: "desc" } : item))}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button type="button" className="rounded p-1 text-[#52525B] hover:text-[#EF4444]" onClick={() => setDraftSorts((prev) => prev.filter((item) => item.id !== sort.id))}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full border-dashed"
                        onClick={() => setDraftSorts((prev) => [...prev, { id: makeId("sort"), column: columns?.[0]?.name ?? "", direction: "asc" }])}
                      >
                        <Plus className="h-4 w-4" />
                        Add sort
                      </Button>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#27272A] pt-3">
                      <Button size="sm" variant="ghost" onClick={() => setDraftSorts([])}>Reset</Button>
                      <Button size="sm" onClick={() => { setAppliedSorts(draftSorts.filter((sort) => sort.column)); setSortOpen(false) }}>
                        Apply sort
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={columnMenuOpen} onOpenChange={setColumnMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-1.5 rounded-md border border-[#27272A] bg-[#1A1A1A] px-3 text-[13px] font-medium text-[#A1A1AA] transition-colors hover:border-[#3B82F6] hover:bg-[#1D346120] hover:text-[#FAFAFA]"
                  >
                    <Eye className="h-[14px] w-[14px]" />
                    <span>Columns</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-56 border-[#27272A] bg-[#111111] p-0">
                  <div className="flex items-center justify-between border-b border-[#27272A] px-3 py-2">
                    <span className="text-xs font-medium uppercase tracking-[0.05em] text-[#A1A1AA]">Toggle Columns</span>
                    <button type="button" className="text-xs text-[#3B82F6] hover:text-white" onClick={() => setVisibleColumns(columns?.map((col) => col.name) ?? [])}>
                      Show all
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1">
                    {columns?.map((column) => (
                      <label key={column.name} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[#1A1A1A]">
                        <Checkbox
                          checked={visibleColumns.includes(column.name)}
                          onChange={() => {
                            setVisibleColumns((prev) =>
                              prev.includes(column.name)
                                ? prev.filter((name) => name !== column.name)
                                : [...prev, column.name]
                            )
                          }}
                        />
                        <span className="font-mono text-sm text-[#FAFAFA]">{column.name}</span>
                        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-mono ${getTypeBadgeClass(column.type)}`}>{column.type}</span>
                      </label>
                    ))}
                  </div>

                  <div className="border-t border-[#27272A] px-3 py-2">
                    <button type="button" className="text-xs text-[#52525B] hover:text-[#EF4444]" onClick={() => setVisibleColumns([])}>
                      Hide all
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              <div className="h-5 w-px bg-[#27272A]" />

              <Button size="sm" onClick={() => { setSelectedRowData(null); setRowDetailMode("insert"); setRowDetailOpen(true) }}>
                <Plus className="h-4 w-4" />
                Insert Row
              </Button>
            </div>
          </div>

          {appliedFilters.length > 0 || appliedSorts.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {appliedFilters.map((filter) => (
                <span key={filter.id} className="inline-flex items-center gap-1 rounded-full border border-[#3B82F620] bg-[#1D3461] px-2 py-1 text-xs text-[#3B82F6]">
                  {filter.column} {filter.operator} {filter.value || ""}
                  <button type="button" onClick={() => setAppliedFilters((prev) => prev.filter((item) => item.id !== filter.id))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {appliedSorts.map((sort) => (
                <span key={sort.id} className="inline-flex items-center gap-1 rounded-full border border-[#A855F720] bg-[#2D1A4A] px-2 py-1 text-xs text-[#A855F7]">
                  {sort.column} {sort.direction.toUpperCase()}
                  <button type="button" onClick={() => setAppliedSorts((prev) => prev.filter((item) => item.id !== sort.id))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="text-xs text-[#A1A1AA] hover:text-[#FAFAFA]"
                onClick={() => {
                  setAppliedFilters([])
                  setAppliedSorts([])
                }}
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : filteredRows.length > 0 ? (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[#111111]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredRows.length > 0 && selectedRows.size === filteredRows.length}
                    onChange={handleSelectAll}
                  />
                </TableHead>
                {activeColumns.map((column) => {
                  const sort = appliedSorts.find((item) => item.column === column.name)
                  return (
                    <TableHead key={column.name} className="min-w-[120px] px-4 py-2">
                      <button
                        type="button"
                        className={`group flex w-full items-start justify-between gap-2 text-left ${sort ? "text-[#3B82F6]" : "text-[#FAFAFA]"}`}
                        onClick={() => handleHeaderSortCycle(column.name)}
                      >
                        <span className="font-mono text-[13px] font-semibold">{column.name}</span>
                        {sort ? (
                          sort.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-[#52525B] opacity-0 transition-opacity group-hover:opacity-100" />
                        )}
                      </button>
                      <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 font-mono text-xs font-medium ${getTypeBadgeClass(column.type)}`}>
                        {column.type}
                      </span>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row, rowIndex) => {
                const pk = primaryKey ? (row[primaryKey.name] as string | number) : rowIndex
                const isSelected = selectedRows.has(pk)

                return (
                  <TableRow
                    key={String(pk)}
                    className={`h-11 border-b border-[#1F1F23] ${isSelected ? "bg-[#1D3461]" : "hover:bg-[#141414]"}`}
                  >
                    <TableCell className="px-4 py-0 align-middle">
                      <Checkbox checked={isSelected} onChange={() => handleSelectRow(pk)} />
                    </TableCell>
                    {activeColumns.map((column) => (
                      <TableCell
                        key={`${String(pk)}-${column.name}`}
                        className="cursor-pointer px-4 py-0 align-middle font-mono text-xs text-[#FAFAFA]"
                        onClick={() => {
                          setSelectedRowData(row)
                          setRowDetailMode("edit")
                          setRowDetailOpen(true)
                        }}
                      >
                        {formatValue(row[column.name], column.type)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-[#A1A1AA]">No rows match your filters</p>
              <Button className="mt-3" onClick={() => { setAppliedFilters([]); setAppliedSorts([]); setSearch("") }}>
                Clear filters
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between border-t border-[#27272A] bg-[#0A0A0A] px-4 py-3 text-xs text-[#A1A1AA] md:px-6">
        <p>
          Showing {filteredRows.length === 0 ? 0 : offset + 1}–{Math.min(offset + limit, offset + filteredRows.length)} of {filteredRows.length.toLocaleString()} rows
        </p>

        <div className="flex items-center gap-4">
          {rowsData && rowsData.total > limit ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</Button>
              <Button size="sm" variant="ghost" disabled={offset + limit >= rowsData.total} onClick={() => setOffset(offset + limit)}>Next</Button>
            </div>
          ) : null}

          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value))
              setOffset(0)
            }}
            className="rounded bg-transparent px-1 text-xs text-[#A1A1AA] focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <RowDetailPanel
        open={rowDetailOpen}
        onOpenChange={setRowDetailOpen}
        mode={rowDetailMode}
        data={selectedRowData}
        columns={columns}
        instanceId={instanceId}
        tableName={tableName}
        schema={schema}
        onSuccess={() => {
          setRowDetailOpen(false)
          queryClient.invalidateQueries({ queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "rows"] })
        }}
      />
    </div>
  )
}


