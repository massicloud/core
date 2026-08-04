"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getPostgresInstances, getApiBaseUrl } from "@/lib/api"
import { getTables, getColumns } from "@/lib/db-api"
import { buildRESTSnippets } from "@/lib/code-snippets"
import { CodeSnippetTabs } from "@/components/ui/code-snippet-tabs"

interface Props {
  slug: string
  dbName: string
  anonKeyPrefix: string
  projectId: string
}

export function RESTExamples({ slug, dbName, anonKeyPrefix, projectId }: Props) {
  const [selectedTable, setSelectedTable] = useState("")

  const { data: instances } = useQuery({
    queryKey: ["postgres", projectId],
    queryFn: () => getPostgresInstances(projectId),
    enabled: !!projectId,
  })

  const pgInstances = useMemo(
    () => (instances ?? []).filter((i) => i.type === "postgres"),
    [instances]
  )

  const instanceId = useMemo(
    () => pgInstances.find((i) => i.name === dbName)?.id ?? "",
    [pgInstances, dbName]
  )

  // Reset table selection when the selected database changes
  useEffect(() => {
    setSelectedTable("")
  }, [instanceId])

  const { data: tables } = useQuery({
    queryKey: ["db", instanceId, "tables", "public"],
    queryFn: () => getTables(instanceId),
    enabled: !!instanceId,
  })

  useEffect(() => {
    if (tables && tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].name)
    }
  }, [tables, selectedTable])

  const { data: columns } = useQuery({
    queryKey: ["db", instanceId, "table", `public.${selectedTable}`, "columns"],
    queryFn: () => getColumns(instanceId, selectedTable, "public"),
    enabled: !!instanceId && !!selectedTable,
  })

  const primaryKey = useMemo(
    () => columns?.find((c) => c.is_primary_key)?.name,
    [columns]
  )

  const effectiveTable = selectedTable || "<table>"
  const snippets = buildRESTSnippets({
    projectSlug: slug,
    stage: 'production',
    dbName,
    anonKeyDisplay: anonKeyPrefix,
    tableName: effectiveTable,
    primaryKey,
    columns: selectedTable ? columns : undefined,
    apiBaseURL: typeof window !== "undefined" ? getApiBaseUrl() : undefined,
  })

  const restURL = `${typeof window !== "undefined" ? getApiBaseUrl() : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080")}/v1/${slug}/db/${dbName}/rest/${effectiveTable}`

  return (
    <div className="space-y-3">
      {/* Heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">REST API</h2>
          <p className="text-xs text-[#52525B] mt-0.5">
            Every public table in your database is exposed automatically.
            Your anon and service keys work with all databases in this project.
          </p>
        </div>
      </div>

      {/* Table selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
          className="h-8 px-2 bg-[#1A1A1A] border border-[#27272A] rounded text-xs text-white focus:outline-none focus:border-[#3B82F6]"
        >
          {!tables?.length ? (
            <option value="">No tables yet</option>
          ) : (
            tables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))
          )}
        </select>

        {selectedTable && (
          <span className="text-[10px] text-[#52525B] font-mono truncate">
            {restURL}
          </span>
        )}
      </div>

      {/* Code block */}
      <div className="bg-[#111111] border border-[#27272A] rounded-xl overflow-hidden">
        <CodeSnippetTabs
          snippets={snippets}
          defaultLang="sdk"
          installHint="npm install @massicloud/client"
          className="border-0 rounded-none"
        />
      </div>
    </div>
  )
}
