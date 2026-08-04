"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { FileCode, Database, ExternalLink, Search, Table2, Plus, Layers } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getProject, listAPIKeys, listStages } from "@/lib/api"
import { getTables } from "@/lib/db-api"
import { PageHeader } from "@/components/ui/page-header"
import { AuthEndpointsBlock } from "@/components/api-spec/auth-endpoints-block"
import { TableEndpointsBlock } from "@/components/api-spec/table-endpoints-block"

export default function APISpecPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  })

  const { data: stages = [] } = useQuery({
    queryKey: ["stages", id],
    queryFn: () => listStages(id),
    enabled: !!id,
  })

  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys", id],
    queryFn: () => listAPIKeys(id),
  })

  const stageFromURL  = searchParams.get("stage") ?? ""
  const dbFromURL     = searchParams.get("db")    ?? ""

  const [selectedStage, setSelectedStage] = useState<string>(stageFromURL)
  const [selectedDB,    setSelectedDB]    = useState<string>(dbFromURL)

  useEffect(() => {
    if (!stages.length) return
    const first = stages[0].name
    if (selectedStage && stages.find((s) => s.name === selectedStage)) return
    const initial = stageFromURL && stages.find((s) => s.name === stageFromURL)
      ? stageFromURL
      : first
    setSelectedStage(initial)
  }, [stages, stageFromURL, selectedStage])

  const currentStage = stages.find((s) => s.name === selectedStage)
  const pgInstances  = useMemo(
    () => (currentStage?.instances ?? []).filter((i) => i.type === "postgres"),
    [currentStage]
  )

  useEffect(() => {
    if (!pgInstances.length) return
    if (selectedDB && pgInstances.find((i) => i.name === selectedDB)) return
    const initial = dbFromURL && pgInstances.find((i) => i.name === dbFromURL)
      ? dbFromURL
      : pgInstances[0].name
    setSelectedDB(initial)
  }, [pgInstances, dbFromURL, selectedDB])

  function onStageChange(name: string) {
    setSelectedStage(name)
    setSelectedDB("")
    const params = new URLSearchParams(searchParams.toString())
    params.set("stage", name)
    params.delete("db")
    router.replace(`/projects/${id}/api?${params.toString()}`, { scroll: false })
  }

  function onDBChange(name: string) {
    setSelectedDB(name)
    const params = new URLSearchParams(searchParams.toString())
    params.set("db", name)
    router.replace(`/projects/${id}/api?${params.toString()}`, { scroll: false })
  }

  const selectedInstance = pgInstances.find((i) => i.name === selectedDB)

  const { data: tables = [] } = useQuery({
    queryKey: ["db-tables", selectedInstance?.id, "public"],
    queryFn: () => getTables(selectedInstance!.id, "public"),
    enabled: !!selectedInstance,
  })

  const [search, setSearch] = useState("")

  const filteredTables = useMemo(() => {
    if (!search.trim()) return tables
    const q = search.toLowerCase()
    return tables.filter((t) => t.name.toLowerCase().includes(q))
  }, [tables, search])

  const anonKeyPrefix = keys.find((k) => k.type === "anon")?.key_prefix ?? "mc_anon_"

  if (!project) return <APISpecSkeleton />

  if (stages.length === 0) {
    return <EmptyState projectId={id} />
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="API Spec"
        eyebrowIcon={FileCode}
        title={project.name}
        description="Auto-generated REST endpoints for this project's databases."
        actions={
          <a
            href={`${process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.massicloud.dz"}/get-started/welcome/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-9 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] rounded-md text-xs text-[#A1A1AA] hover:text-white transition-all"
          >
            <ExternalLink size={11} />
            Platform docs
          </a>
        }
      />

      {/* Sticky control bar */}
      <div className="sticky top-0 z-10 bg-[#0A0A0A] -mx-6 lg:-mx-8 px-6 lg:px-8 pb-4 mb-6 border-b border-[#1F1F23]">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

          {/* Stage switcher */}
          <div className="flex items-center gap-2">
            <Layers size={13} className="text-[#D4A843] shrink-0" />
            <Select value={selectedStage} onValueChange={onStageChange}>
              <SelectTrigger className="h-9 w-[180px] bg-[#111111] border-[#27272A] text-sm font-mono">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent className="bg-[#111111] border-[#27272A]">
                {stages.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    <span className="font-mono">{s.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Database switcher */}
          {pgInstances.length > 0 && (
            <div className="flex items-center gap-2">
              <Database size={13} className="text-[#3B82F6] shrink-0" />
              <Select value={selectedDB} onValueChange={onDBChange}>
                <SelectTrigger className="h-9 w-[200px] bg-[#111111] border-[#27272A] text-sm font-mono">
                  <SelectValue placeholder="Select database" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#27272A]">
                  {pgInstances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.name}>
                      <span className="font-mono">{inst.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Table search — only shown when meaningful */}
          {tables.length > 5 && (
            <div className="flex-1 relative max-w-md">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter tables…"
                className="w-full h-9 pl-9 pr-3 bg-[#111111] border border-[#27272A] rounded-md text-sm text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#3B82F6]/40"
              />
            </div>
          )}

          {/* Table count */}
          {selectedInstance && (
            <p className="text-xs text-[#52525B] sm:ml-auto shrink-0">
              {filteredTables.length} of {tables.length}{" "}
              {tables.length === 1 ? "table" : "tables"}
            </p>
          )}
        </div>
      </div>

      {/* No postgres DB in this stage */}
      {currentStage && pgInstances.length === 0 && (
        <div className="bg-[#111111] border border-dashed border-[#27272A] rounded-xl p-12 text-center">
          <Database size={20} className="text-[#52525B] mx-auto mb-3" />
          <p className="text-sm text-white mb-1">No databases in stage &ldquo;{currentStage.name}&rdquo;</p>
          <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto mb-5">
            Add a PostgreSQL instance to this stage to see auto-generated API endpoints.
          </p>
          <button
            onClick={() => router.push(`/projects/${id}/stages`)}
            className="inline-flex items-center gap-2 h-9 px-4 bg-[#D4A843] hover:bg-[#D4A843]/90 text-[#0A0A0A] text-sm font-medium rounded-md transition-colors"
          >
            <Plus size={13} />
            Add database
          </button>
        </div>
      )}

      {selectedInstance && (
        <div className="space-y-4">
          {/* Auth endpoints */}
          <AuthEndpointsBlock
            projectSlug={project.slug}
            stage={selectedStage}
            dbName={selectedInstance.name}
            anonKeyPrefix={anonKeyPrefix}
            defaultOpen
          />

          {/* Per-table blocks */}
          {filteredTables.length === 0 ? (
            search ? (
              <div className="bg-[#111111] border border-dashed border-[#27272A] rounded-xl p-8 text-center">
                <p className="text-sm text-[#A1A1AA]">No tables match &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              <div className="bg-[#111111] border border-dashed border-[#27272A] rounded-xl p-12 text-center">
                <Table2 size={20} className="text-[#52525B] mx-auto mb-3" />
                <p className="text-sm text-white mb-1">No tables in {selectedInstance.name}</p>
                <p className="text-xs text-[#52525B]">
                  Create one from the explorer to see auto-generated API endpoints here.
                </p>
              </div>
            )
          ) : (
            filteredTables.map((table, idx) => (
              <TableEndpointsBlock
                key={table.name}
                instance={selectedInstance}
                tableName={table.name}
                projectSlug={project.slug}
                stage={selectedStage}
                anonKeyPrefix={anonKeyPrefix}
                defaultOpen={idx === 0}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function APISpecSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 bg-[#1A1A1A] rounded" />
        <div className="h-8 w-64 bg-[#1A1A1A] rounded" />
        <div className="h-4 w-96 bg-[#1A1A1A] rounded" />
      </div>
      <div className="h-14 bg-[#111111] rounded-xl" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 bg-[#111111] rounded-xl" />
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ projectId }: { projectId: string }) {
  const router = useRouter()
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="API Spec"
        eyebrowIcon={FileCode}
        title="No API endpoints yet"
        description="Create a stage with a database to start building your API."
      />
      <div className="bg-[#111111] border border-dashed border-[#27272A] rounded-xl p-12 text-center">
        <Layers size={24} className="text-[#52525B] mx-auto mb-3" />
        <p className="text-sm text-white mb-1">No stages in this project</p>
        <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto mb-5">
          Each stage holds the databases for a deployment environment. Create a stage to
          see endpoints appear here automatically.
        </p>
        <button
          onClick={() => router.push(`/projects/${projectId}/stages`)}
          className="inline-flex items-center gap-2 h-9 px-4 bg-[#D4A843] hover:bg-[#D4A843]/90 text-[#0A0A0A] text-sm font-medium rounded-md transition-colors"
        >
          <Plus size={13} />
          Create stage
        </button>
      </div>
    </div>
  )
}
