"use client"

import { LayoutGrid, LayoutPanelLeft } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useExplorer } from "@/lib/explorer-context"

import { getTables } from "@/lib/db-api"
import { MainPanel } from "./main-panel"
import { OverviewView } from "./overview-view"

function EmptyExplorer() {
  const { openOverview } = useExplorer()
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#27272A] flex items-center justify-center mx-auto mb-4">
          <LayoutPanelLeft size={28} className="text-[#27272A]" />
        </div>
        <h3 className="text-white font-semibold mb-2">No tables open</h3>
        <p className="text-[#52525B] text-sm mb-6">
          Click a table from the sidebar to start exploring, or open the schema overview.
        </p>
        <button
          onClick={openOverview}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium rounded-md transition-colors"
        >
          <LayoutGrid size={14} />
          Open Overview
        </button>
      </div>
    </div>
  )
}

/** Thin wrapper that fetches the table list once and passes it to OverviewView */
function OverviewTab({ instanceId }: { instanceId: string }) {
  const { currentSchema } = useExplorer()
  const { data: tables = [] } = useQuery({
    queryKey: ["db", instanceId, "tables", currentSchema],
    queryFn: () => getTables(instanceId, currentSchema),
    staleTime: 30_000,
  })
  return <OverviewView instanceId={instanceId} tables={tables} />
}

export function TabContent({ instanceId, instanceName }: { instanceId: string; instanceName: string }) {
  const { tabs, activeTabId } = useExplorer()

  if (tabs.length === 0) return <EmptyExplorer />

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "absolute inset-0 flex flex-col",
            tab.id === activeTabId ? "flex" : "hidden"
          )}
        >
          {tab.type === "overview" ? (
            <OverviewTab instanceId={instanceId} />
          ) : (
            <MainPanel instanceId={instanceId} instanceName={instanceName} tab={tab} />
          )}
        </div>
      ))}
    </div>
  )
}
