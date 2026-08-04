"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { FolderArchive, Plus, HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BucketCard } from "@/components/storage/bucket-card"
import { CreateBucketModal } from "@/components/storage/create-bucket-modal"
import { useProject } from "@/lib/project-context"
import { getBuckets, listAPIKeys } from "@/lib/api"

function BucketGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-52 bg-[#111111] border border-[#27272A] rounded-xl animate-pulse"
        />
      ))}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-[#27272A] flex items-center justify-center mb-4">
        <FolderArchive size={28} className="text-[#52525B]" />
      </div>
      <h3 className="text-white font-semibold mb-2">No buckets yet</h3>
      <p className="text-[#52525B] text-sm max-w-xs mb-6">
        Create your first storage bucket to upload and manage files
      </p>
      <Button onClick={onCreate}>
        <Plus size={14} className="mr-2" />
        Create Bucket
      </Button>
    </div>
  )
}

function NoProjectState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center mb-4 border border-[#27272A]">
        <HardDrive size={28} className="text-[#52525B]" />
      </div>
      <h3 className="text-white font-semibold mb-2">No project selected</h3>
      <p className="text-[#52525B] text-sm max-w-xs">
        Select or create a project to manage object storage
      </p>
    </div>
  )
}

export default function StoragePage() {
  const router = useRouter()
  const { currentProject } = useProject()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: bucketsRaw, isLoading } = useQuery({
    queryKey: ["buckets", currentProject?.id],
    queryFn: () => getBuckets(currentProject!.id),
    enabled: !!currentProject?.id,
  })

  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys", currentProject?.id],
    queryFn: () => listAPIKeys(currentProject!.id),
    enabled: !!currentProject?.id,
  })

  const anonKeyPrefix = keys.find((k) => k.type === "anon")?.key_prefix ?? "mc_anon_"

  const buckets = Array.isArray(bucketsRaw) ? bucketsRaw : []

  if (!currentProject) {
    return <NoProjectState />
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Object Storage</h1>
          <p className="text-[#52525B] text-sm mt-0.5">
            S3-compatible buckets in {currentProject.name}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-2" />
          Create Bucket
        </Button>
      </div>

      {isLoading ? (
        <BucketGridSkeleton />
      ) : buckets.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buckets.map((bucket) => (
            <BucketCard
              key={bucket.id}
              bucket={bucket}
              projectSlug={currentProject.slug}
              anonKeyPrefix={anonKeyPrefix}
              onClick={() => router.push(`/storage/${bucket.name}`)}
            />
          ))}
        </div>
      )}

      <CreateBucketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}
