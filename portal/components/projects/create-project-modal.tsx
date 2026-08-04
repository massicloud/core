"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { TextInput } from "@/components/ui/text-input"
import { ProjectKeysReveal } from "@/components/projects/project-keys-reveal"
import { createProject, getErrorMessage } from "@/lib/api"
import { useProject } from "@/lib/project-context"
import type { ProjectWithKeys } from "@/types"

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
}

export function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { setCurrentProject } = useProject()

  const [step, setStep] = useState<"form" | "keys">("form")
  const [createdData, setCreatedData] = useState<ProjectWithKeys | null>(null)
  const [name, setName] = useState("")

  function handleNameChange(raw: string) {
    // Spaces become dashes; strip leading dashes; trim trailing spaces while typing
    const slugified = raw.replace(/ /g, "-").replace(/^-+/, "")
    setName(slugified)
  }
  const [description, setDescription] = useState("")
  const [errors, setErrors] = useState<{ name?: string }>({})

  const mutation = useMutation({
    mutationFn: () => createProject({ name, description }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      setCurrentProject(data.project)
      setCreatedData(data)
      setStep("keys")
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  function handleClose() {
    setName("")
    setDescription("")
    setErrors({})
    setStep("form")
    setCreatedData(null)
    onClose()
  }

  function handleSubmit() {
    const trimmed = name.trim().replace(/-+$/, "") // strip trailing dashes too
    const newErrors: { name?: string } = {}
    if (!trimmed) {
      newErrors.name = "Project name is required"
    } else if (trimmed.length < 2) {
      newErrors.name = "Name must be at least 2 characters"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setName(trimmed) // commit the cleaned value before mutating
    mutation.mutate()
  }

  function handleAcknowledge() {
    const projectId = createdData!.project.id
    handleClose()
    router.push(`/projects/${projectId}/api`)
  }

  const isKeysStep = step === "keys"

  return (
    <Modal
      open={open}
      onClose={isKeysStep ? undefined : handleClose}
      title={isKeysStep ? "Save your API keys" : "Create new project"}
      description={
        isKeysStep
          ? `Project "${createdData?.project.name}" created`
          : "Projects help you organize your databases and services"
      }
      size="lg"
      footer={
        !isKeysStep ? (
          <>
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create project"}
            </Button>
          </>
        ) : undefined
      }
    >
      {!isKeysStep ? (
        <div className="flex flex-col gap-5">
          <TextInput
            label="Project name"
            required
            placeholder="my-awesome-app"
            value={name}
            onChange={handleNameChange}
            error={errors.name}
            hint="Spaces are converted to dashes"
          />

          <FormField
            label="Description"
            hint="Optional — describe what this project is for"
          >
            <textarea
              placeholder="E-commerce platform for Algeria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-[#1A1A1A] border border-[#27272A] rounded-md px-3 py-2 text-sm text-[#FAFAFA] placeholder-[#52525B] focus:border-[#3B82F6] focus:outline-none resize-none"
            />
          </FormField>
        </div>
      ) : (
        <ProjectKeysReveal
          projectName={createdData!.project.name}
          anonKey={createdData!.anon_key}
          serviceKey={createdData!.service_key}
          onAcknowledge={handleAcknowledge}
        />
      )}
    </Modal>
  )
}
