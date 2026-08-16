"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as api from "@/lib/api"
import { validateInstanceName } from "@/lib/instance-validation"
import { INSTANCE_PROVISION_KEY, type InstanceProvisionVars } from "@/lib/instance-provisioning"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { InstanceFormFields } from "./instance-form-fields"
import type { InstanceType } from "@/types"

function defaultPresetFor(_type: InstanceType) {
  return 'auth_basic'
}

function hasSchemaPresets(type: InstanceType) {
  return type === 'postgres'
}

interface Props {
  open:      boolean
  onClose:   () => void
  projectId: string
  stageName: string
}

export function AddInstanceModal({ open, onClose, projectId, stageName }: Props) {
  const queryClient = useQueryClient()

  const [type,         setType]         = useState<InstanceType>('postgres')
  const [name,         setName]         = useState('main')
  const [memoryMB,     setMemoryMB]     = useState(512)
  const [schemaPreset, setSchemaPreset] = useState('auth_basic')

  const { data: presets = [] } = useQuery({
    queryKey: ['schema-presets'],
    queryFn:  () => api.listSchemaPresets(),
    enabled:  open && hasSchemaPresets(type),
  })

  const nameError = name ? validateInstanceName(name) : null
  const canSubmit = !!name && !nameError

  interface Vars extends InstanceProvisionVars {
    memoryMB: number
    schemaPreset?: string
  }

  // Tagged with the shared provisioning key so the global banner/lock (see
  // components/layout/provisioning-banner.tsx) picks this up regardless of
  // whether this modal is still open — we close it immediately on submit
  // rather than blocking the user behind it for however long creation takes.
  // Everything the request needs travels through `vars` (not component
  // closure) since the mutation keeps running after this component unmounts.
  const { mutate } = useMutation({
    mutationKey: INSTANCE_PROVISION_KEY,
    mutationFn: (vars: Vars) =>
      api.addInstanceToStage(projectId, stageName, {
        name:          vars.name,
        type:          vars.type as InstanceType,
        memory_mb:     vars.memoryMB,
        schema_preset: vars.schemaPreset,
      }),
    onSuccess: (_instance, vars) => {
      toast.success(`Database "${vars.name}" created`)
      queryClient.invalidateQueries({ queryKey: ['stages', projectId] })
    },
    onError: (e: any, vars) => {
      toast.error(e.response?.data?.error ?? `Failed to create database "${vars.name}"`)
    },
  })

  function reset() {
    setType('postgres')
    setName('main')
    setMemoryMB(512)
    setSchemaPreset('auth_basic')
  }

  function handleSubmit() {
    mutate({
      name, type, stageName, hasInstance: true,
      memoryMB,
      schemaPreset: hasSchemaPresets(type) ? schemaPreset : undefined,
    })
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title={`Add database to ${stageName}`}
      description="Add a database instance to this stage."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose() }}>
            Cancel
          </Button>
          <Button
            variant="gold"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Add database
          </Button>
        </>
      }
    >
      <InstanceFormFields
        type={type}           onTypeChange={(t) => { setType(t); setSchemaPreset(defaultPresetFor(t)) }}
        name={name}           onNameChange={setName}    nameError={nameError}
        memoryMB={memoryMB}   onMemoryChange={setMemoryMB}
        schemaPreset={schemaPreset} onPresetChange={setSchemaPreset}
        presets={presets}
      />
    </Modal>
  )
}
