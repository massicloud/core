"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { TextInput } from "@/components/ui/text-input"
import { createMongoIndex, getMongoDocuments } from "@/lib/mongo-api"

interface FieldRow {
  field: string
  order: 1 | -1
}

export function CreateIndexDialog({
  instanceId,
  collection,
  open,
  onClose,
  onCreated,
}: {
  instanceId: string
  collection: string
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [fields, setFields] = useState<FieldRow[]>([{ field: "", order: 1 }])
  const [unique, setUnique] = useState(false)
  const [sparse, setSparse] = useState(false)
  const [ttlEnabled, setTtlEnabled] = useState(false)
  const [ttlSeconds, setTtlSeconds] = useState("3600")

  const { data: sample } = useQuery({
    queryKey: ["mongo-sample-doc", instanceId, collection],
    queryFn: () => getMongoDocuments(instanceId, collection, { limit: 1 }),
    enabled: open,
  })
  const sampleFields = sample?.documents[0] ? Object.keys(sample.documents[0]).filter((k) => k !== "_id") : []

  const mutation = useMutation({
    mutationFn: () =>
      createMongoIndex(instanceId, collection, {
        name: name || undefined,
        keys: Object.fromEntries(fields.filter((f) => f.field).map((f) => [f.field, f.order])),
        unique,
        sparse,
        ttl_seconds: ttlEnabled ? parseInt(ttlSeconds, 10) || undefined : undefined,
      }),
    onSuccess: () => {
      toast.success("Index created")
      onCreated()
      handleClose()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create index"),
  })

  function handleClose() {
    setName("")
    setFields([{ field: "", order: 1 }])
    setUnique(false)
    setSparse(false)
    setTtlEnabled(false)
    setTtlSeconds("3600")
    onClose()
  }

  const canSubmit = fields.some((f) => f.field.trim())

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create index"
      description={`On collection "${collection}"`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="gold" onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create index"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Name" hint="Auto-generated if left blank">
          <TextInput value={name} onChange={setName} placeholder="e.g. email_1" />
        </FormField>

        <FormField label="Fields" required>
          <datalist id="mongo-index-field-options">
            {sampleFields.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <div className="space-y-2">
            {fields.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  list="mongo-index-field-options"
                  value={row.field}
                  onChange={(e) =>
                    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, field: e.target.value } : f)))
                  }
                  placeholder="e.g. profile.city"
                  className="flex-1 h-9 px-3 rounded-md bg-[#1A1A1A] border border-[#27272A] text-sm text-[#E4E4E7] placeholder:text-[#3F3F46] focus:outline-none focus:border-[#3B82F6]"
                />
                <select
                  value={row.order}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((f, idx) => (idx === i ? { ...f, order: Number(e.target.value) as 1 | -1 } : f))
                    )
                  }
                  className="h-9 px-2 rounded-md bg-[#1A1A1A] border border-[#27272A] text-sm text-[#E4E4E7]"
                >
                  <option value={1}>Ascending</option>
                  <option value={-1}>Descending</option>
                </select>
                {fields.length > 1 && (
                  <button
                    onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
                    className="h-9 w-9 flex items-center justify-center rounded-md border border-[#27272A] text-[#52525B] hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setFields((prev) => [...prev, { field: "", order: 1 }])}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#D4A843] hover:underline"
          >
            <Plus size={11} />
            Add another field
          </button>
        </FormField>

        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
            <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
            Unique
          </label>
          <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
            <input type="checkbox" checked={sparse} onChange={(e) => setSparse(e.target.checked)} />
            Sparse
          </label>
          <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
            <input type="checkbox" checked={ttlEnabled} onChange={(e) => setTtlEnabled(e.target.checked)} />
            TTL
          </label>
        </div>

        {ttlEnabled && (
          <FormField label="Expire after (seconds)">
            <TextInput value={ttlSeconds} onChange={setTtlSeconds} placeholder="3600" />
          </FormField>
        )}
      </div>
    </Modal>
  )
}
