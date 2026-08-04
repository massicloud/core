"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { TextInput } from "@/components/ui/text-input"
import { createRedisInstance, getErrorMessage } from "@/lib/api"
import { useProject } from "@/lib/project-context"
import { cn } from "@/lib/utils"

interface CreateRedisModalProps {
  open: boolean
  onClose: () => void
}

const MEMORY_OPTIONS = [256, 512, 1024, 2048]

export function CreateRedisModal({ open, onClose }: CreateRedisModalProps) {
  const queryClient = useQueryClient()
  const { currentProject } = useProject()
  const [name, setName] = useState("")
  const [memory, setMemory] = useState(256)
  const [errors, setErrors] = useState<{ name?: string }>({})

  const mutation = useMutation({
    mutationFn: () =>
      createRedisInstance({
        name,
        memory_mb: memory,
        project_id: currentProject?.id ?? "",
      }),
    onSuccess: (instance) => {
      queryClient.invalidateQueries({ queryKey: ["redis", currentProject?.id] })
      toast.success(`Redis instance "${instance.name}" created`)
      handleClose()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  function handleClose() {
    setName("")
    setMemory(256)
    setErrors({})
    onClose()
  }

  function handleSubmit() {
    const newErrors: { name?: string } = {}
    if (!name.trim()) {
      newErrors.name = "Instance name is required"
    } else if (!/^[a-z0-9-]+$/.test(name)) {
      newErrors.name = "Only lowercase letters, numbers and hyphens"
    }

    if (!currentProject) {
      toast.error("Please select a project first")
      return
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    mutation.mutate()
  }

  function formatMemory(mb: number): string {
    return mb >= 1024 ? `${mb / 1024}GB` : `${mb}MB`
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create Redis instance"
      description="A managed Redis cache for your project"
      size="md"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create instance"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <TextInput
          label="Instance name"
          required
          placeholder="my-redis-cache"
          value={name}
          onChange={setName}
          error={errors.name}
          hint="Lowercase letters, numbers and hyphens only"
        />

        <FormField label="Memory allocation" required>
          <div className="grid grid-cols-4 gap-2">
            {MEMORY_OPTIONS.map((mb) => (
              <button
                key={mb}
                type="button"
                onClick={() => setMemory(mb)}
                className={cn(
                  "flex flex-col items-center justify-center",
                  "h-16 rounded-lg border text-sm font-medium",
                  "transition-all duration-150",
                  memory === mb
                    ? "border-[#3B82F6] bg-[#1D3461] text-[#3B82F6]"
                    : "border-[#27272A] bg-[#1A1A1A] text-[#A1A1AA] hover:border-[#3B82F6] hover:text-[#3B82F6]"
                )}
              >
                <span className="font-mono font-bold">{formatMemory(mb)}</span>
                <span className="text-xs opacity-60 mt-0.5">RAM</span>
              </button>
            ))}
          </div>
        </FormField>
      </div>
    </Modal>
  )
}
