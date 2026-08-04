"use client"

import { cn } from "@/lib/utils"
import { Table2, Code2, Columns, Sparkles } from "lucide-react"
import { DataEditorTab } from "./tabs/data-editor-tab"
import { SqlEditorTab } from "./tabs/sql-editor-tab"
import { SchemaTab } from "./tabs/schema-tab"
import { IndexesTab } from "./tabs/indexes-tab"
import { useExplorer, type ExplorerTab, type InnerTab } from "@/lib/explorer-context"

interface MainPanelProps {
  instanceId: string
  instanceName: string
  tab: Extract<ExplorerTab, { type: "table" }>
}

const INNER_TABS: { id: InnerTab; label: string; Icon: React.ElementType }[] = [
  { id: "data",    label: "Data",    Icon: Table2 },
  { id: "sql",     label: "SQL",     Icon: Code2 },
  { id: "schema",  label: "Schema",  Icon: Columns },
  { id: "indexes", label: "Indexes", Icon: Sparkles },
]

export function MainPanel({ instanceId, instanceName, tab }: MainPanelProps) {
  const { updateTableState } = useExplorer()
  const { state, id: tabId } = tab
  const { tableName, schema, innerTab } = state

  const setInnerTab = (t: InnerTab) => updateTableState(tabId, { innerTab: t })

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#09090B]">
      {/* Inner tab bar */}
      <div className="h-[44px] border-b border-[#1F1F23] px-4 flex items-end shrink-0 bg-[#0D0D0D]">
        <div className="flex gap-0">
          {INNER_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setInnerTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 h-full text-xs font-medium",
                "border-b-2 -mb-px transition-colors pb-2",
                innerTab === id
                  ? "text-white border-[#3B82F6]"
                  : "text-[#52525B] border-transparent hover:text-[#A1A1AA]"
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {innerTab === "data"    && <DataEditorTab instanceId={instanceId} tableName={tableName} schema={schema} />}
        {innerTab === "sql"     && <SqlEditorTab  instanceId={instanceId} initialTable={tableName} />}
        {innerTab === "schema"  && <SchemaTab     instanceId={instanceId} instanceName={instanceName} tableName={tableName} schema={schema} />}
        {innerTab === "indexes" && <IndexesTab    instanceId={instanceId} tableName={tableName} schema={schema} />}
      </div>
    </div>
  )
}
