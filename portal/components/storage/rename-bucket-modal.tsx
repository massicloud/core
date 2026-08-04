"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { TextInput } from "@/components/ui/text-input"
import { renameBucket, getErrorMessage } from "@/lib/api"

interface RenameBucketModalProps {
  open: boolean
  onClose: () => void
  currentName: string
}

const BUCKET_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/

export function RenameBucketModal({
  open,
  onClose,
  currentName,
}: RenameBucketModalProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(currentName)
  const [nameError, setNameError] = useState("")

  useEffect(() => {
    if (open) setName(currentName)
  }, [open, currentName])

  function handleClose() {
    setNameError("")
    onClose()
  }

  const mutation = useMutation({
    mutationFn: () => renameBucket(currentName, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buckets"] })
      toast.success(`Bucket renamed to "${name}"`)
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
    if (name === currentName) {
      setNameError("New name must differ from current name")
      return
    }
    if (name.length < 3 || !BUCKET_RE.test(name)) {
      setNameError("Must be 3–63 chars, start/end with letter or number")
      return
    }
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Rename Bucket"
      description={`All files will be moved to the new bucket. This may take a moment.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending || name === currentName}
          >
            {mutation.isPending ? "Renaming…" : "Rename"}
          </Button>
        </>
      }
    >
      <FormField
        label="New bucket name"
        required
        hint="Lowercase letters, numbers and hyphens. 3–63 characters."
        error={nameError}
      >
        <TextInput
          value={name}
          onChange={handleNameChange}
          placeholder="new-name"
          error={nameError}
        />
      </FormField>
    </Modal>
  )
}
