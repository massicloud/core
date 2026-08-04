"use client"

import { useEffect, useRef, useState } from "react"
import {
  MoreVertical,
  Download,
  Link2,
  Clock,
  Trash2,
  Eye,
} from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PresignModal } from "./presign-modal"
import { canPreview } from "./file-preview-modal"
import { deleteObject, presignObject, getErrorMessage } from "@/lib/api"
import type { StorageObject } from "@/types"
import { fileName } from "./helpers"
import { cn } from "@/lib/utils"

interface FileActionsDropdownProps {
  object: StorageObject
  bucketName: string
  currentPrefix: string
  onPreview: () => void
}

export function FileActionsDropdown({
  object,
  bucketName,
  currentPrefix,
  onPreview,
}: FileActionsDropdownProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [presignOpen, setPresignOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [open])

  const deleteMutation = useMutation({
    mutationFn: () => deleteObject(bucketName, object.key),
    onSuccess: () => {
      // Invalidate the full bucket's object list (all prefixes) + bucket stats
      queryClient.invalidateQueries({ queryKey: ["objects", bucketName] })
      queryClient.invalidateQueries({ queryKey: ["buckets"] })
      toast.success(`"${fileName(object.key)}" deleted`)
      setDeleteOpen(false)
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err))
    },
  })

  async function handleDownload() {
    setOpen(false)
    try {
      const res = await presignObject(bucketName, object.key, 300)
      window.open(res.url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function handleCopyUrl() {
    setOpen(false)
    try {
      const res = await presignObject(bucketName, object.key, 3600)
      await navigator.clipboard.writeText(res.url)
      toast.success("URL copied to clipboard")
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const previewable = canPreview(object.content_type, object.key)

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          className="p-1.5 rounded text-[#52525B] hover:text-white hover:bg-[#1A1A1A] transition-colors"
        >
          <MoreVertical size={14} />
        </button>

        {open && (
          <div
            className={cn(
              "absolute right-0 z-50 mt-1 w-52",
              "bg-[#111111] border border-[#27272A] rounded-lg shadow-xl",
              "py-1 text-sm"
            )}
            style={{ top: "100%" }}
          >
            {previewable && (
              <>
                <MenuItem
                  icon={Eye}
                  label="Preview"
                  onClick={() => { setOpen(false); onPreview() }}
                />
                <div className="my-1 border-t border-[#1F1F23]" />
              </>
            )}
            <MenuItem icon={Download} label="Download" onClick={handleDownload} />
            <MenuItem icon={Link2} label="Copy URL" onClick={handleCopyUrl} />
            <MenuItem
              icon={Clock}
              label="Temporary URL"
              onClick={() => { setOpen(false); setPresignOpen(true) }}
            />
            <div className="my-1 border-t border-[#27272A]" />
            <MenuItem
              icon={Trash2}
              label="Delete"
              destructive
              onClick={() => { setOpen(false); setDeleteOpen(true) }}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete file"
        message={`Delete "${fileName(object.key)}"? This cannot be undone.`}
        confirmLabel="Delete file"
        loading={deleteMutation.isPending}
      />

      <PresignModal
        open={presignOpen}
        onClose={() => setPresignOpen(false)}
        bucketName={bucketName}
        objectKey={object.key}
      />
    </>
  )
}

interface MenuItemProps {
  icon: typeof Download
  label: string
  onClick: () => void
  destructive?: boolean
}

function MenuItem({ icon: Icon, label, onClick, destructive }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
        destructive
          ? "text-[#EF4444] hover:bg-[#2D1414]"
          : "text-[#A1A1AA] hover:bg-[#1A1A1A] hover:text-white"
      )}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}
