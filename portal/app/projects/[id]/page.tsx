"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  LayoutDashboard, Database, HardDrive, Code2, Key,
  ArrowRight, Plus, Layers, Lock, Globe,
} from "lucide-react"
import { format } from "date-fns"
import { getProject, listStages, getBuckets } from "@/lib/api"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { SectionCard } from "@/components/ui/section-card"
import type { Stage } from "@/types"

export default function ProjectDashboard() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn:  () => getProject(id),
  })

  const { data: stages = [] } = useQuery({
    queryKey: ["stages", id],
    queryFn:  () => listStages(id),
    enabled:  !!id,
  })

  const { data: buckets = [] } = useQuery({
    queryKey: ["buckets", id],
    queryFn:  () => getBuckets(id),
    enabled:  !!id,
  })

  const bucketList = Array.isArray(buckets) ? buckets : []
  const totalDbs   = stages.reduce((sum, s) => sum + (s.instances?.length ?? 0), 0)

  if (!project) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[#1A1A1A] rounded" />
          <div className="h-4 w-96 bg-[#1A1A1A] rounded" />
        </div>
      </div>
    )
  }

  const apiBase = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/v1/${project.slug}`

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">

      <PageHeader
        eyebrow={`Created ${format(new Date(project.created_at), 'MMM d, yyyy')}`}
        eyebrowIcon={LayoutDashboard}
        title={project.name}
        description={project.description || undefined}
        actions={
          <button
            onClick={() => router.push(`/projects/${id}/api`)}
            className="h-9 px-4 bg-[#D4A843] hover:bg-[#D4A843]/90 text-[#0A0A0A] text-sm font-semibold rounded-md flex items-center gap-2 transition-opacity"
          >
            <Code2 size={13} />
            View API Docs
          </button>
        }
      />

      {/* Quick-start card */}
      <div className="bg-gradient-to-br from-[#1D3461]/20 to-[#111111] border border-[#3B82F6]/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Database size={13} className="text-[#3B82F6]" />
          <h3 className="text-sm font-semibold text-white">Project base URL</h3>
        </div>
        <code className="block bg-[#0A0A0A] border border-[#1F1F23] rounded px-3 py-2 font-mono text-xs text-white overflow-x-auto whitespace-nowrap mb-3">
          {apiBase}
        </code>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/projects/${id}/api`)}
            className="h-8 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] hover:border-[#3B82F6]/40 rounded text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1.5 transition-all"
          >
            <Code2 size={11} /> View API docs
          </button>
          <button
            onClick={() => router.push(`/projects/${id}/settings`)}
            className="h-8 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] hover:border-[#3B82F6]/40 rounded text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1.5 transition-all"
          >
            <Key size={11} /> Manage keys
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Stages"          value={stages.length}      icon={Layers}     accent="gold"   />
        <StatCard label="Databases"       value={totalDbs}           icon={Database}   accent="blue"   />
        <StatCard label="Storage buckets" value={bucketList.length}  icon={HardDrive}  accent="purple" />
        <StatCard label="Region"          value="Algeria"            icon={Globe}      accent="gold"   />
      </div>

      {/* Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Stages */}
        <SectionCard
          title="Stages"
          icon={Layers}
          action={
            <button
              onClick={() => router.push(`/projects/${id}/stages`)}
              className="text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1 transition-colors"
            >
              Manage all <ArrowRight size={11} />
            </button>
          }
        >
          {stages.length === 0 ? (
            <EmptyResource
              label="No stages yet"
              cta="Create stage"
              onClick={() => router.push(`/projects/${id}/stages`)}
            />
          ) : (
            <div className="space-y-2">
              {stages.slice(0, 4).map((stage) => (
                <DashboardStageRow key={stage.id} stage={stage} projectId={id} />
              ))}
              {stages.length > 4 && (
                <button
                  onClick={() => router.push(`/projects/${id}/stages`)}
                  className="w-full text-center text-xs text-[#52525B] hover:text-white py-2 transition-colors"
                >
                  +{stages.length - 4} more…
                </button>
              )}
            </div>
          )}
        </SectionCard>

        {/* Storage */}
        <SectionCard
          title="Storage"
          icon={HardDrive}
          action={
            <button
              onClick={() => router.push("/storage")}
              className="text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1 transition-colors"
            >
              All <ArrowRight size={11} />
            </button>
          }
        >
          {bucketList.length === 0 ? (
            <EmptyResource
              label="No buckets yet"
              cta="Create bucket"
              onClick={() => router.push("/storage")}
            />
          ) : (
            <div className="space-y-2">
              {bucketList.slice(0, 5).map((b) => (
                <button
                  key={b.id}
                  onClick={() => router.push(`/storage/${b.name}`)}
                  className="w-full flex items-center justify-between gap-3 bg-[#0A0A0A] border border-[#1F1F23] hover:border-[#27272A] rounded-lg px-3 py-2.5 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <HardDrive size={13} className="text-[#A855F7] shrink-0" />
                    <span className="font-mono text-xs text-white truncate">{b.name}</span>
                    {b.public && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#1D3461]/40 text-[#3B82F6] shrink-0">
                        public
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#52525B] shrink-0">
                    {b.file_count} {b.file_count === 1 ? "file" : "files"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

function DashboardStageRow({ stage, projectId }: { stage: Stage; projectId: string }) {
  const router = useRouter()
  const instanceCount = stage.instances?.length ?? 0

  return (
    <button
      onClick={() => router.push(`/projects/${projectId}/stages`)}
      className="w-full flex items-center justify-between gap-3 bg-[#0A0A0A] border border-[#1F1F23] hover:border-[#27272A] rounded-lg px-3 py-2.5 text-left transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Layers size={13} className="text-[#D4A843] shrink-0" />
        <span className="font-mono text-xs text-white truncate">{stage.name}</span>
        {stage.is_protected && (
          <Lock size={9} className="text-[#D4A843] shrink-0" />
        )}
      </div>
      <span className="text-[10px] text-[#52525B] shrink-0">
        {instanceCount} {instanceCount === 1 ? 'database' : 'databases'}
      </span>
    </button>
  )
}

function EmptyResource({ label, cta, onClick }: { label: string; cta: string; onClick: () => void }) {
  return (
    <div className="text-center py-6">
      <p className="text-xs text-[#52525B] mb-3">{label}</p>
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] rounded text-xs text-[#A1A1AA] hover:text-white transition-all"
      >
        <Plus size={11} /> {cta}
      </button>
    </div>
  )
}
