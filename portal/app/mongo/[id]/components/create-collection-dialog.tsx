"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { TextInput } from "@/components/ui/text-input"
import { createMongoCollection } from "@/lib/mongo-api"

export function CreateCollectionDialog({
  instanceId,
  open,
  onClose,
  onCreated,
}: {
  instanceId: string
  open: boolean
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => createMongoCollection(instanceId, name),
    onSuccess: () => {
      toast.success(`Collection "${name}" created`)
      onCreated(name)
      handleClose()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create collection"),
  })

  function handleClose() {
    setName("")
    setError(null)
    onClose()
  }

  function handleSubmit() {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
      setError("Only letters, numbers, hyphens, underscores, and dots")
      return
    }
    setError(null)
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create collection"
      description="Add a new empty collection to this database."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="gold" onClick={handleSubmit} disabled={!name || mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create collection"}
          </Button>
        </>
      }
    >
      <FormField label="Collection name" required error={error ?? undefined}>
        <TextInput value={name} onChange={setName} placeholder="users" />
      </FormField>
    </Modal>
  )
}
