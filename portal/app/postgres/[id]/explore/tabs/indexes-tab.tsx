"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { getIndexes } from "@/lib/db-api"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CreateIndexDialog } from "../dialogs/create-index-dialog"
import { getTypeBadgeClass } from "../components/column-types"

interface IndexesTabProps {
  instanceId: string
  tableName: string
  schema: string
}

const formatBytes = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIdx = 0
  while (size >= 1024 && unitIdx < units.length - 1) {
    size /= 1024
    unitIdx++
  }
  return `${size.toFixed(1)} ${units[unitIdx]}`
}

export function IndexesTab({ instanceId, tableName, schema }: IndexesTabProps) {
  const [showCreateIndex, setShowCreateIndex] = useState(false)

  const { data: indexes, isLoading } = useQuery({
    queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "indexes"],
    queryFn: () => getIndexes(instanceId, tableName, schema),
  })

  return (
    <div className="h-full overflow-auto bg-[#0A0A0A]">
      <div className="px-6 py-6 space-y-6 max-w-4xl">
        {/* Indexes Section */}
        <div className="rounded-lg border border-[#27272A] bg-[#1A1A1A] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[#27272A]">
            <h3 className="font-semibold text-sm">Indexes</h3>
            <Button
              size="sm"
              onClick={() => setShowCreateIndex(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Index
            </Button>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : indexes && indexes.length > 0 ? (
            <Table>
              <TableHeader className="bg-[#111111]">
                <TableRow className="hover:bg-transparent border-[#27272A]">
                  <TableHead className="text-[12px] text-[#A1A1AA]">Name</TableHead>
                  <TableHead className="text-[12px] text-[#A1A1AA]">Type</TableHead>
                  <TableHead className="text-[12px] text-[#A1A1AA]">Columns</TableHead>
                  <TableHead className="text-[12px] text-[#A1A1AA]">Size</TableHead>
                  <TableHead className="text-[12px] text-[#A1A1AA]">Unique</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {indexes.map((idx) => (
                  <TableRow
                    key={idx.name}
                    className="border-[#27272A] hover:bg-[#111111]"
                  >
                    <TableCell className="font-mono text-xs text-[#FAFAFA]">
                      {idx.name}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium font-mono ${getTypeBadgeClass(idx.type)}`}
                      >
                        {idx.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-[#A1A1AA]">
                      {idx.columns.join(", ")}
                    </TableCell>
                    <TableCell className="text-xs text-[#A1A1AA]">
                      {formatBytes(idx.size_bytes)}
                    </TableCell>
                    <TableCell className="text-xs text-[#A1A1AA]">
                      {idx.unique ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!idx.primary && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-[#A1A1AA]">No indexes yet</p>
              <Button
                onClick={() => setShowCreateIndex(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Index
              </Button>
            </div>
          )}
        </div>
      </div>

      <CreateIndexDialog
        open={showCreateIndex}
        onOpenChange={setShowCreateIndex}
        instanceId={instanceId}
        tableName={tableName}
        schema={schema}
      />
    </div>
  )
}

