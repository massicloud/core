"use client"

import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation"
import { Layers } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DocumentGrid } from "./components/document-grid"
import { QueryConsole } from "./components/query-console"
import { IndexManager } from "./components/index-manager"
import { CollectionStats } from "./components/collection-stats"

const TABS = ["documents", "query", "indexes", "stats"] as const
type Tab = (typeof TABS)[number]

export default function MongoExplorerPage() {
  const { id: instanceId } = useParams<{ id: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const collection = searchParams.get("collection") ?? undefined
  const tabParam = searchParams.get("tab")
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "documents"

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", next)
    router.push(`${pathname}?${params.toString()}`)
  }

  if (!collection) {
    return (
      <div className="flex h-full items-center justify-center text-center px-6">
        <div>
          <Layers size={28} className="text-[#3F3F46] mx-auto mb-3" />
          <p className="text-[#52525B] text-sm">Select a collection from the sidebar</p>
          <p className="text-[#3F3F46] text-xs mt-1">or create one to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-[#1E1E24] px-4 shrink-0">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="query">Query</TabsTrigger>
            <TabsTrigger value="indexes">Indexes</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "documents" && <DocumentGrid instanceId={instanceId} collection={collection} />}
        {tab === "query" && <QueryConsole instanceId={instanceId} collection={collection} />}
        {tab === "indexes" && <IndexManager instanceId={instanceId} collection={collection} />}
        {tab === "stats" && <CollectionStats instanceId={instanceId} collection={collection} />}
      </div>
    </div>
  )
}
