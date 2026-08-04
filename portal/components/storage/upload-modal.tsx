"use client"

import { useRef, useState } from "react"
import { Upload, X, Check, AlertCircle } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FileIcon } from "./file-icon"
import { formatBytes } from "./helpers"
import { uploadObject, getErrorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

type FileStatus = "pending" | "uploading" | "success" | "error"

interface UploadEntry {
  file: File
  status: FileStatus
  progress: number
  error?: string
}

interface UploadModalProps {
  open: boolean
  onClose: () => void
  bucketName: string
  prefix: string
  initialFiles?: File[]
}

export function UploadModal({
  open,
  onClose,
  bucketName,
  prefix,
  initialFiles,
}: UploadModalProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<UploadEntry[]>(() =>
    (initialFiles ?? []).map((f) => ({ file: f, status: "pending", progress: 0 }))
  )
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Sync initial files when they change
  const prevInitialRef = useRef<File[]>([])
  if (
    open &&
    initialFiles &&
    initialFiles !== prevInitialRef.current &&
    files.length === 0
  ) {
    prevInitialRef.current = initialFiles
    setFiles(
      initialFiles.map((f) => ({ file: f, status: "pending", progress: 0 }))
    )
  }

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return
    const entries: UploadEntry[] = Array.from(newFiles).map((f) => ({
      file: f,
      status: "pending",
      progress: 0,
    }))
    setFiles((prev) => [...prev, ...entries])
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  function handleClose() {
    if (uploading) return
    setFiles([])
    setDragOver(false)
    prevInitialRef.current = []
    onClose()
  }

  async function handleUploadAll() {
    setUploading(true)
    let anyError = false

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "success") continue

      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: "uploading", progress: 0 } : f
        )
      )

      try {
        await uploadObject(
          bucketName,
          files[i].file,
          prefix || undefined,
          (percent) => {
            setFiles((prev) =>
              prev.map((f, idx) =>
                idx === i ? { ...f, progress: percent } : f
              )
            )
          }
        )

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "success", progress: 100 } : f
          )
        )
      } catch (err) {
        anyError = true
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: "error",
                  error: getErrorMessage(err),
                }
              : f
          )
        )
      }
    }

    setUploading(false)
    queryClient.invalidateQueries({ queryKey: ["objects", bucketName] })
    queryClient.invalidateQueries({ queryKey: ["buckets"] })

    if (!anyError) {
      toast.success("Upload complete")
      handleClose()
    } else {
      toast.error("Some files failed to upload")
    }
  }

  const pendingCount = files.filter((f) => f.status !== "success").length

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Upload Files"
      description={`Upload to ${bucketName}${prefix ? ` / ${prefix}` : ""}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUploadAll}
            disabled={files.length === 0 || uploading}
          >
            {uploading
              ? "Uploading…"
              : `Upload ${pendingCount} ${pendingCount === 1 ? "file" : "files"}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
            dragOver
              ? "border-[#3B82F6] bg-[#1D3461]/20"
              : "border-[#27272A] hover:border-[#3B82F6]/40 hover:bg-[#1D3461]/10"
          )}
        >
          <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] mx-auto flex items-center justify-center mb-3">
            <Upload size={20} className="text-[#3B82F6]" />
          </div>
          <p className="text-white text-sm font-medium mb-1">
            Drop files here or click to browse
          </p>
          <p className="text-[#52525B] text-xs">Maximum 100 MB per file</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {files.map((entry, idx) => (
              <UploadFileRow
                key={idx}
                file={entry.file}
                progress={entry.progress}
                status={entry.status}
                error={entry.error}
                onRemove={() => removeFile(idx)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

interface UploadFileRowProps {
  file: File
  progress: number
  status: FileStatus
  error?: string
  onRemove: () => void
}

function UploadFileRow({
  file,
  progress,
  status,
  error,
  onRemove,
}: UploadFileRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[#0A0A0A] border border-[#1F1F23] rounded-lg">
      <FileIcon name={file.name} size={16} className="shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-white font-mono truncate">{file.name}</span>
          <span className="text-xs text-[#52525B] ml-2 shrink-0">
            {formatBytes(file.size)}
          </span>
        </div>

        {status === "uploading" && (
          <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3B82F6] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {status === "success" && (
          <div className="flex items-center gap-1 text-xs text-[#22C55E]">
            <Check size={11} /> Uploaded
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-1 text-xs text-[#EF4444]">
            <AlertCircle size={11} /> {error ?? "Upload failed"}
          </div>
        )}
      </div>

      {status !== "uploading" && (
        <button
          onClick={onRemove}
          className="text-[#52525B] hover:text-[#EF4444] transition-colors shrink-0"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
