"use client"

import { useState } from "react"
import { useRouter, useSearchParams, usePathname, useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Leaf, Trash2, ArrowLeft } from "lucide-react"
import { getMongoInstances, deleteMongoInstance, getErrorMessage } from "@/lib/api"
import { useProject } from "@/lib/project-context"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CollectionList } from "./components/collection-list"
import { ConnectionField } from "./components/connection-field"

export default function MongoInstanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { id: instanceId } = useParams<{ id: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { currentProject } = useProject()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["mongo", currentProject?.id],
    queryFn: () => getMongoInstances(currentProject?.id),
    enabled: !!currentProject?.id,
  })
  const instance = instances.find((i) => i.id === instanceId)

  const selectedCollection = searchParams.get("collection") ?? undefined

  function selectCollection(name: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("collection", name)
    if (!params.get("tab")) params.set("tab", "documents")
    router.push(`${pathname}?${params.toString()}`)
  }

  const deleteMutation = useMutation({
    mutationFn: () => deleteMongoInstance(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mongo", currentProject?.id] })
      toast.success("MongoDB instance deleted")
      router.push("/mongo")
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-52px)] w-full bg-[#09090B]">
        <div className="w-72 border-r border-[#1E1E24] p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-[#111111] border border-[#1E1E24] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!instance) {
    return (
      <div className="flex h-[calc(100dvh-52px)] w-full items-center justify-center bg-[#09090B] text-center">
        <div>
          <Leaf size={28} className="text-[#3F3F46] mx-auto mb-3" />
          <p className="text-[#52525B] text-sm">Instance not found</p>
          <a href="/mongo" className="mt-4 inline-block text-xs text-[#D4A843] hover:underline">
            ← Back to MongoDB
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-52px)] w-full bg-[#09090B] overflow-hidden">
      <aside className="w-72 shrink-0 border-r border-[#1E1E24] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#1E1E24]">
          <a
            href="/mongo"
            className="inline-flex items-center gap-1.5 text-[11px] text-[#52525B] hover:text-white transition-colors mb-3"
          >
            <ArrowLeft size={11} />
            All MongoDB instances
          </a>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#0F2417] flex items-center justify-center shrink-0">
                <Leaf size={14} className="text-[#22C55E]" />
              </div>
              <h1 className="text-sm font-semibold text-white truncate">{instance.name}</h1>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg border border-[#27272A] hover:border-[#EF4444]/40 hover:bg-[#2D1414] text-[#52525B] hover:text-[#EF4444] transition-all"
              aria-label="Delete instance"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <p className="text-[10px] text-[#52525B] mt-1 font-mono">{instance.database_name}</p>
        </div>

        <div className="p-3 border-b border-[#1E1E24] space-y-1">
          <ConnectionField label="Service" dsn={instance.service_dsn} />
          <ConnectionField label="Readonly" dsn={instance.readonly_dsn} />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <CollectionList
            instanceId={instanceId}
            selected={selectedCollection}
            onSelect={selectCollection}
          />
        </div>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">{children}</div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete MongoDB instance"
        message={`Are you sure you want to delete "${instance.name}"? All data will be permanently lost.`}
        confirmLabel="Delete instance"
        loading={deleteMutation.isPending}
        requiresTyping={instance.name}
      />
    </div>
  )
}
