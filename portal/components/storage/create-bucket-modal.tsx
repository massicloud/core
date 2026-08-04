"use client"

import { useState } from "react"
import { Globe, Lock, AlertTriangle } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { TextInput } from "@/components/ui/text-input"
import { createBucket, getErrorMessage } from "@/lib/api"
import { useProject } from "@/lib/project-context"
import { cn } from "@/lib/utils"

interface CreateBucketModalProps {
  open: boolean
  onClose: () => void
}

export function CreateBucketModal({ open, onClose }: CreateBucketModalProps) {
  const queryClient = useQueryClient()
  const { currentProject } = useProject()
  const [name, setName] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [nameError, setNameError] = useState("")

  function handleClose() {
    setName("")
    setIsPublic(false)
    setNameError("")
    onClose()
  }

  const mutation = useMutation({
    mutationFn: () =>
      createBucket({ name, project_id: currentProject!.id, public: isPublic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buckets"] })
      toast.success("Bucket created")
      handleClose()
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err))
    },
  })

  function handleNameChange(raw: string) {
    const cleaned = raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 63)
    setName(cleaned)
    setNameError("")
  }

  function handleSubmit() {
    if (name.length < 3) {
      setNameError("Bucket name must be at least 3 characters")
      return
    }
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name)) {
      setNameError("Must start and end with a letter or number, 3–63 chars")
      return
    }
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create Bucket"
      description="A new S3-compatible storage bucket for your project"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create Bucket"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <FormField
          label="Bucket name"
          required
          hint="Lowercase letters, numbers and hyphens. 3–63 characters."
          error={nameError}
        >
          <TextInput
            placeholder="my-photos"
            value={name}
            onChange={handleNameChange}
            error={nameError}
          />
        </FormField>

        <FormField label="Access policy">
          <div className="grid grid-cols-2 gap-3">
            <AccessOption
              icon={Lock}
              title="Private"
              description="Only authenticated requests can read"
              recommended
              selected={!isPublic}
              warning={false}
              onClick={() => setIsPublic(false)}
            />
            <AccessOption
              icon={Globe}
              title="Public"
              description="Anyone with the URL can read"
              recommended={false}
              selected={isPublic}
              warning
              onClick={() => setIsPublic(true)}
            />
          </div>
        </FormField>

        {isPublic && (
          <div className="flex items-start gap-2 p-3 bg-[#2D2510]/40 border border-[#EAB308]/20 rounded-md">
            <AlertTriangle size={14} className="text-[#EAB308] shrink-0 mt-0.5" />
            <p className="text-xs text-[#EAB308]">
              Public buckets allow anyone to download files via direct URLs.
              Only use for files meant to be publicly accessible.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

interface AccessOptionProps {
  icon: typeof Lock
  title: string
  description: string
  selected: boolean
  onClick: () => void
  recommended: boolean
  warning: boolean
}

function AccessOption({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
  recommended,
  warning,
}: AccessOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 p-4 rounded-lg border text-left transition-all",
        selected
          ? warning
            ? "border-[#EAB308] bg-[#2D2510]/30"
            : "border-[#3B82F6] bg-[#1D3461]/20"
          : "border-[#27272A] bg-[#1A1A1A] hover:border-[#3B82F6]/40"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          size={14}
          className={cn(
            selected
              ? warning
                ? "text-[#EAB308]"
                : "text-[#3B82F6]"
              : "text-[#A1A1AA]"
          )}
        />
        <span className="text-sm font-medium text-white">{title}</span>
        {recommended && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#22C55E]/20 text-[#22C55E]">
            Recommended
          </span>
        )}
      </div>
      <p className="text-xs text-[#52525B]">{description}</p>
    </button>
  )
}
