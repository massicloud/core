"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { FileIcon } from "./file-icon"
import { fileName } from "./helpers"
import { presignObject, getErrorMessage } from "@/lib/api"

interface PresignModalProps {
  open: boolean
  onClose: () => void
  bucketName: string
  objectKey: string
}

const EXPIRY_OPTIONS = [
  { label: "5 minutes", value: "300" },
  { label: "1 hour",    value: "3600" },
  { label: "24 hours",  value: "86400" },
  { label: "7 days",    value: "604800" },
]

export function PresignModal({
  open,
  onClose,
  bucketName,
  objectKey,
}: PresignModalProps) {
  const [expiry, setExpiry] = useState("3600")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleClose() {
    setUrl("")
    setCopied(false)
    onClose()
  }

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await presignObject(bucketName, objectKey, Number(expiry))
      setUrl(res.url)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const expiryLabel = EXPIRY_OPTIONS.find((o) => o.value === expiry)?.label ?? "1 hour"

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Generate Temporary URL"
      description="Create a presigned URL that expires after a set time"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Close
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating…" : url ? "Regenerate" : "Generate URL"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <FormField label="File">
          <div className="flex items-center gap-2 p-2 bg-[#1A1A1A] border border-[#27272A] rounded-md">
            <FileIcon name={fileName(objectKey)} size={14} />
            <span className="text-sm text-white font-mono truncate">
              {objectKey}
            </span>
          </div>
        </FormField>

        <FormField label="Expires in">
          <select
            value={expiry}
            onChange={(e) => { setExpiry(e.target.value); setUrl("") }}
            className="w-full h-9 bg-[#1A1A1A] border border-[#27272A] rounded-md px-3 text-sm text-[#FAFAFA] focus:border-[#3B82F6] focus:outline-none"
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>

        {url && (
          <FormField label="Temporary URL">
            <div className="flex items-center gap-2 p-2 bg-[#0A0A0A] border border-[#27272A] rounded-md">
              <code className="text-xs text-[#A1A1AA] font-mono flex-1 truncate">
                {url}
              </code>
              <button
                onClick={copyUrl}
                className="shrink-0 p-1.5 rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-white transition-colors"
              >
                {copied ? (
                  <Check size={12} className="text-[#22C55E]" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
            <p className="text-xs text-[#52525B] mt-1.5">
              Expires in {expiryLabel} — anyone with this link can download the
              file.
            </p>
          </FormField>
        )}
      </div>
    </Modal>
  )
}
