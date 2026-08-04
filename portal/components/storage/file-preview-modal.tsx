"use client"

import { useEffect, useRef, useState } from "react"
import { Download, AlertCircle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FileIcon } from "./file-icon"
import { fileName, formatBytes } from "./helpers"
import { api, presignObject, getErrorMessage } from "@/lib/api"
import type { StorageObject } from "@/types"

// ─── Preview type resolution ──────────────────────────────────────────────────

type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "office" | "none"

const TEXT_EXTS = new Set([
  "txt", "log", "md", "json", "yaml", "yml", "toml", "xml", "html", "htm",
  "css", "js", "ts", "tsx", "jsx", "py", "go", "rs", "java", "sh", "bash",
  "zsh", "env", "gitignore", "dockerfile", "csv", "ini", "cfg", "conf", "sql",
  "graphql", "proto",
])

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif"])
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "avi", "mkv"])
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac"])
const OFFICE_EXTS = new Set(["docx", "doc", "pptx", "ppt", "xlsx", "xls"])

function resolveKind(contentType: string, key: string): PreviewKind {
  const ext = key.split(".").pop()?.toLowerCase() ?? ""
  const ct = contentType.toLowerCase()

  if (ct.startsWith("image/") || IMAGE_EXTS.has(ext)) return "image"
  if (ct.startsWith("video/") || VIDEO_EXTS.has(ext)) return "video"
  if (ct.startsWith("audio/") || AUDIO_EXTS.has(ext)) return "audio"
  if (ct === "application/pdf" || ext === "pdf") return "pdf"
  if (ct.startsWith("text/") || TEXT_EXTS.has(ext)) return "text"
  if (OFFICE_EXTS.has(ext)) return "office"
  return "none"
}

export function canPreview(contentType: string, key: string): boolean {
  return resolveKind(contentType, key) !== "none"
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FilePreviewModalProps {
  open: boolean
  onClose: () => void
  object: StorageObject
  bucketName: string
}

const MAX_TEXT_BYTES = 512 * 1024 // 512 KB

export function FilePreviewModal({
  open,
  onClose,
  object,
  bucketName,
}: FilePreviewModalProps) {
  // blobUrl is a blob: URL created from the authenticated API download.
  // It never contains MinIO credentials — it is local to the browser tab.
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep a ref to the current blob URL so we can revoke it on cleanup.
  const blobRef = useRef<string | null>(null)

  const kind = resolveKind(object.content_type, object.key)
  const name = fileName(object.key)

  // Revoke the blob URL when the component unmounts to free browser memory.
  useEffect(() => {
    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      // Revoke any existing blob and reset state.
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
      setBlobUrl(null)
      setTextContent(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      // Revoke the previous blob before starting a new load.
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
        setBlobUrl(null)
      }

      setLoading(true)
      setError(null)
      setTextContent(null)

      // Build the authenticated download URL for the object.
      // The key may contain slashes, so encode each segment separately.
      const encodedKey = object.key
        .split("/")
        .map(encodeURIComponent)
        .join("/")
      const apiPath = `/storage/buckets/${bucketName}/objects/${encodedKey}`

      try {
        if (kind === "text") {
          if (object.size > MAX_TEXT_BYTES) {
            setError(
              `File too large to preview (${formatBytes(object.size)}). Download to view.`
            )
            return
          }
          // Fetch text through the authenticated API — no credentials in URL.
          const res = await api.get<string>(apiPath, { responseType: "text" })
          if (cancelled) return
          let text = res.data
          if (object.key.endsWith(".json")) {
            try {
              text = JSON.stringify(JSON.parse(text), null, 2)
            } catch {
              // keep raw text
            }
          }
          setTextContent(text)
        } else if (kind !== "none") {
          // Fetch binary content as a Blob, then create a local blob: URL.
          // blob: URLs are same-origin and never expose server credentials.
          const res = await api.get<Blob>(apiPath, { responseType: "blob" })
          if (cancelled) return
          const url = URL.createObjectURL(res.data)
          blobRef.current = url
          setBlobUrl(url)
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open, bucketName, object.key, object.size, kind])

  // Download uses a clean token URL (no MinIO credentials) via window.open.
  async function handleDownload() {
    try {
      const res = await presignObject(bucketName, object.key, 300)
      window.open(res.url, "_blank", "noopener,noreferrer")
    } catch (err) {
      // Error is already surfaced via the presignObject rejection.
      console.error(err)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={name}
      description={`${object.content_type || "Unknown type"} · ${formatBytes(object.size)}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={handleDownload}>
            <Download size={14} className="mr-2" />
            Download
          </Button>
        </>
      }
    >
      <div className="min-h-[300px] flex flex-col">
        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
            <Loader2 size={24} className="text-[#3B82F6] animate-spin" />
            <p className="text-sm text-[#52525B]">Loading preview…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle size={24} className="text-[#EF4444]" />
            <p className="text-sm text-[#A1A1AA] max-w-sm">{error}</p>
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              <Download size={13} className="mr-1.5" />
              Download instead
            </Button>
          </div>
        )}

        {!loading && !error && (blobUrl !== null || textContent !== null) && (
          <PreviewContent
            kind={kind}
            blobUrl={blobUrl}
            textContent={textContent}
            name={name}
            object={object}
            onDownload={handleDownload}
          />
        )}
      </div>
    </Modal>
  )
}

// ─── Preview renderers ────────────────────────────────────────────────────────

interface PreviewContentProps {
  kind: PreviewKind
  blobUrl: string | null
  textContent: string | null
  name: string
  object: StorageObject
  onDownload: () => void
}

function PreviewContent({
  kind,
  blobUrl,
  textContent,
  name,
  object,
  onDownload,
}: PreviewContentProps) {
  const url = blobUrl ?? ""

  switch (kind) {
    case "image":
      return (
        <div className="flex items-center justify-center w-full bg-[#0A0A0A] rounded-lg overflow-hidden p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={name}
            className="max-w-full object-contain rounded"
            style={{ maxHeight: "62vh" }}
          />
        </div>
      )

    case "video":
      return (
        <div className="w-full bg-black rounded-lg overflow-hidden">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={url} controls className="w-full" style={{ maxHeight: "62vh" }} />
        </div>
      )

    case "audio":
      return (
        <div className="flex flex-col items-center gap-5 py-10">
          <div className="w-20 h-20 rounded-2xl bg-[#2D0A2A] border border-[#EC4899]/20 flex items-center justify-center">
            <FileIcon name={name} size={32} />
          </div>
          <p className="text-white font-medium text-sm font-mono">{name}</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={url} controls className="w-full max-w-md" />
        </div>
      )

    case "pdf":
      return (
        <iframe
          src={url}
          title={name}
          className="w-full border border-[#27272A] rounded-lg bg-white"
          style={{ height: "62vh" }}
        />
      )

    case "text":
      return (
        <pre
          className="w-full overflow-auto bg-[#0A0A0A] border border-[#1F1F23] rounded-lg p-4 text-xs text-[#A1A1AA] font-mono whitespace-pre-wrap break-words leading-relaxed"
          style={{ maxHeight: "62vh" }}
        >
          {textContent ?? ""}
        </pre>
      )

    case "office":
      return (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-[#27272A] flex items-center justify-center">
            <FileIcon name={name} size={28} />
          </div>
          <div>
            <p className="text-white font-medium mb-1">Office preview not available</p>
            <p className="text-[#52525B] text-sm">Download to open in your local application</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onDownload}>
            <Download size={13} className="mr-1.5" />
            Download
          </Button>
        </div>
      )

    default:
      return (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-[#27272A] flex items-center justify-center">
            <FileIcon name={name} size={28} />
          </div>
          <div>
            <p className="text-white font-medium mb-1">No preview available</p>
            <p className="text-[#52525B] text-sm">Download the file to view its contents</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onDownload}>
            <Download size={13} className="mr-1.5" />
            Download
          </Button>
        </div>
      )
  }
}
