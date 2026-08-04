"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Filter } from "@/types/db"

interface FilterBuilderProps {
  filters: Filter[]
  onChange: (filters: Filter[]) => void
}

const OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
]

export function FilterBuilder({ filters, onChange }: FilterBuilderProps) {
  const addFilter = () => {
    onChange([
      ...filters,
      { column: "", operator: "eq", value: "" },
    ])
  }

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index))
  }

  const updateFilter = (index: number, field: keyof Filter, value: unknown) => {
    const updated = [...filters]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  return (
    <div className="bg-[#111111] rounded border border-[#27272A] p-3 space-y-2">
      {filters.map((filter, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            placeholder="Column"
            value={filter.column}
            onChange={(e) => updateFilter(idx, "column", e.target.value)}
            className="h-8 text-xs flex-shrink-0 w-32"
          />
          <Select value={filter.operator} onValueChange={(val) => updateFilter(idx, "operator", val)}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value} className="text-xs">
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!["is_null", "is_not_null"].includes(filter.operator) && (
            <Input
              placeholder="Value"
              value={filter.value}
              onChange={(e) => updateFilter(idx, "value", e.target.value)}
              className="h-8 text-xs flex-1"
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => removeFilter(idx)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={addFilter} className="text-xs">
          Add filter
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onChange([])} className="text-xs text-[#A1A1AA]">
          Clear all
        </Button>
      </div>
    </div>
  )
}


