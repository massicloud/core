"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, Lock, ClipboardList, ShieldCheck } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { TextInput } from "@/components/ui/text-input"
import { SchemaToggle } from "@/components/instances/schema-toggle"
import { createPostgresInstance } from "@/lib/api"
import { validateInstanceName } from "@/lib/instance-validation"
import { useProject } from "@/lib/project-context"
import { cn } from "@/lib/utils"
import axios from "axios"

interface CreatePostgresModalProps {
  open: boolean
  onClose: () => void
}

const MEMORY_OPTIONS = [512, 1024, 2048, 4096]

export function CreatePostgresModal({ open, onClose }: CreatePostgresModalProps) {
  const queryClient = useQueryClient()
  const { currentProject } = useProject()
  const [name, setName] = useState("")
  const [memory, setMemory] = useState(512)
  const [schemas, setSchemas] = useState<string[]>([])

  const nameError = name ? validateInstanceName(name) : null

  const toggleSchema = (id: string) => {
    setSchemas((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const mutation = useMutation({
    mutationFn: () =>
      createPostgresInstance({
        name,
        memory_mb: memory,
        project_id: currentProject?.id ?? "",
        schemas,
      }),
    onSuccess: (instance) => {
      queryClient.invalidateQueries({ queryKey: ["postgres", currentProject?.id] })
      toast.success(
        schemas.length > 0
          ? `"${instance.name}" created with ${schemas.join(", ")} schemas`
          : `Database "${instance.name}" created`
      )
      handleClose()
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error
        if (err.response?.status === 409) {
          toast.error(msg ?? 'A database with this name already exists in this project')
          return
        }
        if (err.response?.status === 400) {
          toast.error(msg ?? 'Invalid database name')
          return
        }
      }
      toast.error('Failed to create database')
    },
  })

  function handleClose() {
    setName("")
    setMemory(512)
    setSchemas([])
    onClose()
  }

  function handleSubmit() {
    const err = validateInstanceName(name)
    if (err) {
      toast.error(err)
      return
    }

    if (!currentProject) {
      toast.error("Please select a project first")
      return
    }

    mutation.mutate()
  }

  function formatMemory(mb: number): string {
    return mb >= 1024 ? `${mb / 1024}GB` : `${mb}MB`
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create Postgres database"
      description="A managed PostgreSQL instance for your project"
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
            {mutation.isPending ? "Creating..." : "Create database"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <TextInput
          label="Database name"
          required
          placeholder="production"
          value={name}
          onChange={(v) => setName(v.toLowerCase().replace(/\s+/g, '-'))}
          error={nameError ?? undefined}
          hint="Lowercase letters, digits, hyphens, underscores. Must be unique within this project. Used in API URLs."
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

        <FormField
          label="Initial setup"
          hint="Pre-configured schemas added on creation"
        >
          <div className="space-y-2">
            {/* Always included */}
            <div className="bg-[#0A0A0A] border border-[#1F1F23] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Check size={12} className="text-[#22C55E]" />
                <span className="text-xs font-medium text-[#22C55E]">
                  Always included
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA]">
                <span className="font-mono">uuid-ossp</span>,{" "}
                <span className="font-mono">pgcrypto</span>,{" "}
                <span className="font-mono">pg_stat_statements</span>
              </p>
            </div>

            <SchemaToggle
              id="auth"
              checked={schemas.includes("auth")}
              onChange={toggleSchema}
              icon={Lock}
              iconBg="#1D3461"
              iconColor="#3B82F6"
              title="Auth Schema"
              description="Ready-to-use user authentication with sessions and password hashing"
              tables={["auth.users", "auth.sessions", "auth.password_reset_tokens"]}
            />

            <SchemaToggle
              id="audit"
              checked={schemas.includes("audit")}
              onChange={toggleSchema}
              icon={ClipboardList}
              iconBg="#14291E"
              iconColor="#22C55E"
              title="Audit Schema"
              description="Track all data changes automatically. Recommended for Law 18-07 compliance."
              tables={["audit.logs"]}
              badge="Law 18-07"
            />

            <SchemaToggle
              id="compliance"
              checked={schemas.includes("compliance")}
              onChange={toggleSchema}
              icon={ShieldCheck}
              iconBg="#2D2410"
              iconColor="#D4A843"
              title="Compliance Schema"
              description="Consent tracking, data registry, subject requests, breach log. Algeria-ready."
              tables={[
                "compliance.data_registry",
                "compliance.consents",
                "compliance.data_requests",
                "compliance.breaches",
              ]}
              badge="🇩🇿 Algeria"
              recommended
            />
          </div>
        </FormField>
      </div>
    </Modal>
  )
}
