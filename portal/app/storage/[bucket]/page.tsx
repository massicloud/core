"use client"

import { Fragment, Suspense, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import {
  ArrowLeft,
  FolderArchive,
  Upload,
  Home,
  ChevronRight,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { FileList } from "@/components/storage/file-list"
import { FileDropZone } from "@/components/storage/file-drop-zone"
import { UploadModal } from "@/components/storage/upload-modal"
import { FilePreviewModal } from "@/components/storage/file-preview-modal"
import { formatBytes } from "@/components/storage/helpers"
import { listObjects, getBuckets, deleteObject, getErrorMessage } from "@/lib/api"
import { useProject } from "@/lib/project-context"
import type { StorageObject } from "@/types"

// ─── Outer page ──────────────────────────────────────────────────────────────
// useParams doesn't need Suspense; useSearchParams does.

export default function BucketPage() {
  const params = useParams()
  const bucketName = params.bucket as string

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full p-12">
          <div className="h-8 w-48 bg-[#1A1A1A] rounded animate-pulse" />
        </div>
      }
    >
      <BucketBrowser bucketName={bucketName} />
    </Suspense>
  )
}

// ─── Inner browser ────────────────────────────────────────────────────────────

function BucketBrowser({ bucketName }: { bucketName: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { currentProject } = useProject()

  const prefix = searchParams.get("prefix") ?? ""

  const [uploadOpen, setUploadOpen] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [previewObject, setPreviewObject] = useState<StorageObject | null>(null)

  // Get bucket metadata from the project list
  const { data: bucketsRaw } = useQuery({
    queryKey: ["buckets", currentProject?.id],
    queryFn: () => getBuckets(currentProject!.id),
    enabled: !!currentProject?.id,
  })
  const buckets = Array.isArray(bucketsRaw) ? bucketsRaw : []
  const bucket = buckets.find((b) => b.name === bucketName)

  const { data: contents, isLoading } = useQuery({
    queryKey: ["objects", bucketName, prefix],
    queryFn: () => listObjects(bucketName, prefix),
  })

  const pathSegments = prefix.split("/").filter(Boolean)

  function handleFileDrop(files: File[]) {
    setDroppedFiles(files)
    setUploadOpen(true)
  }

  function handleUploadClose() {
    setUploadOpen(false)
    setDroppedFiles([])
  }

  // Bulk delete
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const keys = Array.from(selectedKeys)
      for (const key of keys) {
        await deleteObject(bucketName, key)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["objects", bucketName] })
      queryClient.invalidateQueries({ queryKey: ["buckets"] })
      toast.success(`Deleted ${selectedKeys.size} file(s)`)
      setSelectedKeys(new Set())
      setBulkDeleteOpen(false)
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err))
    },
  })

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      {/* Header */}
      <header className="border-b border-[#1F1F23] bg-[#0D0D0D] px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/storage")}
              className="text-[#52525B] hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="w-9 h-9 rounded-lg bg-[#2D1A4A] flex items-center justify-center shrink-0">
              <FolderArchive size={18} className="text-[#A855F7]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-base truncate">
                {bucketName}
              </h1>
              <p className="text-[#52525B] text-xs">
                {bucket?.file_count ?? 0} files ·{" "}
                {formatBytes(bucket?.size_bytes ?? 0)}
              </p>
            </div>
          </div>

          <Button onClick={() => setUploadOpen(true)}>
            <Upload size={14} className="mr-2" />
            Upload Files
          </Button>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="border-b border-[#1F1F23] bg-[#0A0A0A] px-6 py-2.5 flex items-center gap-1.5 text-sm shrink-0 flex-wrap">
        <button
          onClick={() => router.push(`/storage/${bucketName}`)}
          className="text-[#A1A1AA] hover:text-white transition-colors flex items-center gap-1"
        >
          <Home size={12} />
          <span>{bucketName}</span>
        </button>
        {pathSegments.map((seg, idx) => {
          const segPrefix = pathSegments.slice(0, idx + 1).join("/") + "/"
          const isLast = idx === pathSegments.length - 1
          return (
            <Fragment key={idx}>
              <ChevronRight size={12} className="text-[#3B3B3B]" />
              {isLast ? (
                <span className="text-white font-medium">{seg}</span>
              ) : (
                <button
                  onClick={() =>
                    router.push(
                      `/storage/${bucketName}?prefix=${encodeURIComponent(segPrefix)}`
                    )
                  }
                  className="text-[#A1A1AA] hover:text-white transition-colors"
                >
                  {seg}
                </button>
              )}
            </Fragment>
          )
        })}
      </div>

      {/* File area with page-level drop zone */}
      <FileDropZone onFileDrop={handleFileDrop}>
        {isLoading ? (
          <FileListSkeleton />
        ) : !contents ||
          (contents.objects.length === 0 && contents.folders.length === 0) ? (
          <EmptyBucketState onUpload={() => setUploadOpen(true)} />
        ) : (
          <FileList
            contents={contents}
            prefix={prefix}
            bucketName={bucketName}
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            onPreview={setPreviewObject}
          />
        )}
      </FileDropZone>

      {/* Bulk selection bar */}
      {selectedKeys.size > 0 && (
        <SelectionBar
          count={selectedKeys.size}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={() => setSelectedKeys(new Set())}
        />
      )}

      {/* Upload modal */}
      <UploadModal
        open={uploadOpen}
        onClose={handleUploadClose}
        bucketName={bucketName}
        prefix={prefix}
        initialFiles={droppedFiles.length > 0 ? droppedFiles : undefined}
      />

      {/* File preview */}
      {previewObject && (
        <FilePreviewModal
          open={!!previewObject}
          onClose={() => setPreviewObject(null)}
          object={previewObject}
          bucketName={bucketName}
        />
      )}

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate()}
        title="Delete files"
        message={`Permanently delete ${selectedKeys.size} selected file(s)? This cannot be undone.`}
        confirmLabel={`Delete ${selectedKeys.size} file(s)`}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FileListSkeleton() {
  return (
    <div className="p-6 space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-10 bg-[#111111] rounded animate-pulse" />
      ))}
    </div>
  )
}

function EmptyBucketState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-[#27272A] flex items-center justify-center mb-4">
        <Upload size={28} className="text-[#52525B]" />
      </div>
      <h3 className="text-white font-semibold mb-2">This bucket is empty</h3>
      <p className="text-[#52525B] text-sm max-w-xs mb-6">
        Drag files here or click upload to add your first files
      </p>
      <Button onClick={onUpload}>
        <Upload size={14} className="mr-2" />
        Upload Files
      </Button>
    </div>
  )
}

interface SelectionBarProps {
  count: number
  onDelete: () => void
  onClear: () => void
}

function SelectionBar({ count, onDelete, onClear }: SelectionBarProps) {
  return (
    <div className="border-t border-[#27272A] bg-[#111111] px-6 py-3 flex items-center justify-between shrink-0">
      <span className="text-[#A1A1AA] text-sm">
        {count} file{count !== 1 ? "s" : ""} selected
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 size={13} className="mr-1.5" />
          Delete {count}
        </Button>
      </div>
    </div>
  )
}
