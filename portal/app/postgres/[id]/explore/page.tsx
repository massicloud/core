"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getTables } from "@/lib/db-api"
import { getPostgresInstances, listStages } from "@/lib/api"
import { useProject } from "@/lib/project-context"
import { ExplorerProvider, useExplorer } from "@/lib/explorer-context"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { LeftPanel } from "./left-panel"
import { TabBar } from "./tab-bar"
import { TabContent } from "./tab-content"
import { NewTableDialog } from "./dialogs/new-table-dialog"

interface ExplorePage {
  params: { id: string }
}

export default function ExplorePage({ params }: ExplorePage) {
  const { id: instanceId } = params

  return (
    <ExplorerProvider instanceId={instanceId}>
      <ExplorerShell instanceId={instanceId} />
    </ExplorerProvider>
  )
}

function ExplorerShell({ instanceId }: { instanceId: string }) {
  const { currentProject } = useProject()
  const [showNewTableDialog, setShowNewTableDialog] = useState(false)
  const { currentSchema } = useExplorer()

  const { data: instances } = useQuery({
    queryKey: ["postgres", currentProject?.id],
    queryFn: () => getPostgresInstances(currentProject?.id),
    enabled: !!currentProject?.id,
  })

  const { data: stages = [] } = useQuery({
    queryKey: ["stages", currentProject?.id],
    queryFn: () => listStages(currentProject!.id),
    enabled: !!currentProject?.id,
  })

  const databaseName = instances?.find((i) => i.id === instanceId)?.name ?? instanceId

  const instanceStage = stages.find((s) =>
    s.instances?.some((inst) => inst.id === instanceId)
  )

  const { data: tables, isLoading, error } = useQuery({
    queryKey: ["db", instanceId, "tables", currentSchema],
    queryFn: () => getTables(instanceId, currentSchema),
    staleTime: 30_000,
  })

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0A0A]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">
            Failed to load database
          </h2>
          <p className="text-[#52525B] text-sm">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    )
  }

  const breadcrumbItems = [
    ...(currentProject
      ? [{ label: currentProject.name, href: `/projects/${currentProject.id}` }]
      : []),
    ...(currentProject
      ? [{ label: "Stages", href: `/projects/${currentProject.id}/stages` }]
      : []),
    ...(instanceStage
      ? [{ label: instanceStage.name, href: `/projects/${currentProject!.id}/stages` }]
      : []),
    { label: databaseName },
  ]

  return (
    <div className="flex h-[calc(100dvh-52px)] w-full bg-[#09090B] overflow-hidden">
      <LeftPanel
        instanceId={instanceId}
        tables={tables}
        loading={isLoading}
        onNewTable={() => setShowNewTableDialog(true)}
        databaseName={databaseName}
        breadcrumbs={breadcrumbItems}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <TabBar instanceId={instanceId} />
        <TabContent instanceId={instanceId} instanceName={databaseName} />
      </div>

      <NewTableDialog
        instanceId={instanceId}
        open={showNewTableDialog}
        onOpenChange={setShowNewTableDialog}
      />
    </div>
  )
}
