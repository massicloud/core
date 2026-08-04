"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Edit2, Trash2, Key } from "lucide-react"
import { getColumns, getForeignKeys, dropColumn, getTableSecurity } from "@/lib/db-api"
import { toast } from "sonner"
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
import { getTypeBadgeClass } from "../components/column-types"
import { AddColumnDialog } from "../dialogs/add-column-dialog"
import { EditColumnDialog } from "../dialogs/edit-column-dialog"
import { AddForeignKeyDialog } from "../dialogs/add-foreign-key-dialog"
import { Column } from "@/types/db"
import { RESTSecurityPanel } from "@/components/explorer/rest-security-panel"
import { useProject } from "@/lib/project-context"

interface SchemaTabProps {
  instanceId: string
  instanceName: string
  tableName: string
  schema: string
}

export function SchemaTab({ instanceId, instanceName, tableName, schema }: SchemaTabProps) {
  const queryClient = useQueryClient()
  const { currentProject } = useProject()
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [showAddForeignKey, setShowAddForeignKey] = useState(false)
  const [editingColumn, setEditingColumn] = useState<Column | null>(null)

  const { data: securityData } = useQuery({
    queryKey: ["db-security", instanceId],
    queryFn: () => getTableSecurity(instanceId),
    staleTime: 60_000,
    enabled: schema === "public",
  })

  const tableSecurity = useMemo(
    () => securityData?.find((s) => s.table_name === tableName),
    [securityData, tableName]
  )

  const handleDropColumn = async (col: Column) => {
    if (!confirm(`Drop column "${col.name}"? This cannot be undone.`)) return
    try {
      await dropColumn(instanceId, tableName, col.name, schema)
      toast.success(`Column "${col.name}" dropped`)
      queryClient.invalidateQueries({
        queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "columns"],
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to drop column")
    }
  }

  const { data: columns, isLoading: columnsLoading } = useQuery({
    queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "columns"],
    queryFn: () => getColumns(instanceId, tableName, schema),
  })

  const { data: foreignKeys, isLoading: fksLoading } = useQuery({
    queryKey: ["db", instanceId, "table", `${schema}.${tableName}`, "foreign-keys"],
    queryFn: () => getForeignKeys(instanceId, tableName, schema),
  })

  return (
    <div className="h-full overflow-auto bg-[#0A0A0A]">
      <div className="px-6 py-6 space-y-6 max-w-4xl">
        {/* REST & Security — only shown for public schema tables */}
        {schema === "public" && currentProject && (
          <RESTSecurityPanel
            instanceId={instanceId}
            instanceName={instanceName}
            projectSlug={currentProject.slug}
            tableName={tableName}
            security={tableSecurity}
            columns={columns}
          />
        )}

        {/* Columns Section */}
        <div className="rounded-lg border border-[#27272A] bg-[#1A1A1A] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[#27272A]">
            <h3 className="font-semibold text-sm">Columns</h3>
            <Button
              size="sm"
              onClick={() => setShowAddColumn(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Column
            </Button>
          </div>

          {columnsLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-[#111111]">
                <TableRow className="hover:bg-transparent border-[#27272A]">
                  <TableHead className="text-[12px] text-[#A1A1AA]">Name</TableHead>
                  <TableHead className="text-[12px] text-[#A1A1AA]">Type</TableHead>
                  <TableHead className="text-[12px] text-[#A1A1AA]">Nullable</TableHead>
                  <TableHead className="text-[12px] text-[#A1A1AA]">Default</TableHead>
                  <TableHead className="text-[12px] text-[#A1A1AA]">PK</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns?.map((col) => (
                  <TableRow
                    key={col.name}
                    className="border-[#27272A] hover:bg-[#111111]"
                  >
                    <TableCell className="font-mono text-xs text-[#FAFAFA]">
                      {col.name}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium font-mono ${getTypeBadgeClass(col.type)}`}
                      >
                        {col.type}
                        {col.length && `(${col.length})`}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-[#A1A1AA]">
                      {col.nullable ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#A1A1AA]">
                      {col.default || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {col.is_primary_key && <Key className="w-4 h-4 text-yellow-400 inline" />}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingColumn(col)}
                          title="Edit column"
                          className="p-1.5 rounded text-[#52525B] hover:text-[#FAFAFA] hover:bg-[#27272A] transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDropColumn(col)}
                          disabled={col.is_primary_key}
                          title={col.is_primary_key ? "Cannot drop primary key" : "Drop column"}
                          className="p-1.5 rounded text-[#52525B] hover:text-[#EF4444] hover:bg-[#2D1414] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Foreign Keys Section */}
        {foreignKeys && foreignKeys.length > 0 && (
          <div className="rounded-lg border border-[#27272A] bg-[#1A1A1A] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#27272A]">
              <h3 className="font-semibold text-sm">Foreign Keys</h3>
              <Button
                size="sm"
                onClick={() => setShowAddForeignKey(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Foreign Key
              </Button>
            </div>

            {fksLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[#111111]">
                  <TableRow className="hover:bg-transparent border-[#27272A]">
                    <TableHead className="text-[12px] text-[#A1A1AA]">Column</TableHead>
                    <TableHead className="text-[12px] text-[#A1A1AA]">References</TableHead>
                    <TableHead className="text-[12px] text-[#A1A1AA]">On Delete</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {foreignKeys.map((fk) => (
                    <TableRow key={fk.name} className="border-[#27272A]">
                      <TableCell className="font-mono text-xs text-[#FAFAFA]">
                        {fk.column}
                      </TableCell>
                      <TableCell className="text-xs text-[#A1A1AA]">
                        {fk.referenced_table}.{fk.referenced_column}
                      </TableCell>
                      <TableCell className="text-xs text-[#A1A1AA]">
                        {fk.on_delete}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* Danger Zone */}
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
          <h3 className="font-semibold text-red-400 mb-4">Danger Zone</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[#A1A1AA] mb-2">Remove all rows from this table</p>
              <Button variant="destructive" size="sm">
                Truncate Table
              </Button>
            </div>
            <div>
              <p className="text-xs text-[#A1A1AA] mb-2">Permanently delete this table and all its data</p>
              <Button variant="destructive" size="sm">
                Drop Table
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AddColumnDialog
        open={showAddColumn}
        onOpenChange={setShowAddColumn}
        instanceId={instanceId}
        tableName={tableName}
        schema={schema}
        hasPrimaryKey={Boolean(columns?.some((col) => col.is_primary_key))}
      />

      <EditColumnDialog
        open={editingColumn !== null}
        onOpenChange={(open) => { if (!open) setEditingColumn(null) }}
        instanceId={instanceId}
        tableName={tableName}
        schema={schema}
        column={editingColumn}
      />

      <AddForeignKeyDialog
        open={showAddForeignKey}
        onOpenChange={setShowAddForeignKey}
        instanceId={instanceId}
        tableName={tableName}
        schema={schema}
      />
    </div>
  )
}


