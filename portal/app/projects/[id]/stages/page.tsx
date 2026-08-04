"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Layers, Plus } from "lucide-react"
import { getProject, listStages } from "@/lib/api"
import { PageHeader } from "@/components/ui/page-header"
import { StageCard } from "@/components/stages/stage-card"
import { NewStageModal } from "@/components/stages/new-stage-modal"
import { EmptyStages } from "@/components/stages/empty-stages"
import { useIsProvisioningInstance } from "@/lib/instance-provisioning"

export default function StagesPage() {
  const { id } = useParams<{ id: string }>()
  const [creating, setCreating] = useState(false)
  const isProvisioning = useIsProvisioningInstance()

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn:  () => getProject(id),
  })

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['stages', id],
    queryFn:  () => listStages(id),
    enabled:  !!id,
  })

  if (!project) return <StagesSkeleton />

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Stages"
        eyebrowIcon={Layers}
        title="Environments"
        description="Each stage is an isolated environment for your project's databases and services."
        actions={
          <button
            onClick={() => setCreating(true)}
            disabled={isProvisioning}
            title={isProvisioning ? 'A database is already being created' : undefined}
            className="h-9 px-4 bg-[#D4A843] hover:bg-[#D4A843]/90 text-[#0A0A0A] text-sm font-medium rounded-md flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#D4A843]"
          >
            <Plus size={13} />
            {isProvisioning ? 'Creating…' : 'New stage'}
          </button>
        }
      />

      {isLoading ? (
        <StagesSkeleton />
      ) : stages.length === 0 ? (
        <EmptyStages onCreate={() => setCreating(true)} disabled={isProvisioning} />
      ) : (
        <div className="space-y-4">
          {stages.map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              projectId={id}
            />
          ))}
        </div>
      )}

      <NewStageModal
        open={creating}
        onClose={() => setCreating(false)}
        projectId={id}
      />
    </div>
  )
}

function StagesSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="bg-[#111111] border border-[#27272A] rounded-xl h-48"
        />
      ))}
    </div>
  )
}
