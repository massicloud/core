"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Lock } from "lucide-react"
import * as api from "@/lib/api"
import { validateStageName } from "@/lib/stage-validation"
import { validateInstanceName } from "@/lib/instance-validation"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { TextInput } from "@/components/ui/text-input"
import { InstanceFormFields } from "./instance-form-fields"
import { INSTANCE_PROVISION_KEY, type InstanceProvisionVars } from "@/lib/instance-provisioning"
import type { InstanceType, CreateInstanceForStageRequest } from "@/types"

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
}

export function NewStageModal({ open, onClose, projectId }: Props) {
  const queryClient = useQueryClient()

  const [stageName,    setStageName]    = useState('')
  const [isProtected,  setIsProtected]  = useState(false)
  const [addDB,        setAddDB]        = useState(true)
  const [dbType,       setDbType]       = useState<InstanceType>('postgres')
  const [dbName,       setDbName]       = useState('main')
  const [memoryMB,     setMemoryMB]     = useState(512)
  const [schemaPreset, setSchemaPreset] = useState('auth_basic')

  const { data: presets = [] } = useQuery({
    queryKey: ['schema-presets'],
    queryFn:  () => api.listSchemaPresets(),
    enabled:  open && addDB && hasSchemaPresets(dbType),
  })

  const stageNameError = stageName ? validateStageName(stageName) : null
  const dbNameError    = addDB && dbName ? validateInstanceName(dbName) : null
  const canSubmit =
    !!stageName && !stageNameError &&
    (!addDB || (!!dbName && !dbNameError))

  interface Vars extends InstanceProvisionVars {
    is_protected: boolean
    initial_instance?: CreateInstanceForStageRequest
  }

  // Tagged with the shared provisioning key so the global banner/lock (see
  // components/layout/provisioning-banner.tsx) picks this up regardless of
  // whether this modal is still open — we close it immediately on submit
  // rather than blocking the user behind it for however long creation takes.
  const { mutate } = useMutation({
    mutationKey: INSTANCE_PROVISION_KEY,
    mutationFn: (vars: Vars) =>
      api.createStage(projectId, {
        name:              vars.stageName,
        is_protected:      vars.is_protected,
        initial_instance:  vars.initial_instance,
      }),
    onSuccess: (stage) => {
      toast.success(`Stage "${stage.name}" created`)
      queryClient.invalidateQueries({ queryKey: ['stages', projectId] })
    },
    onError: (e: any, vars) => {
      toast.error(e.response?.data?.error ?? `Failed to create stage "${vars.stageName}"`)
    },
  })

  function reset() {
    setStageName('')
    setIsProtected(false)
    setAddDB(true)
    setDbType('postgres')
    setDbName('main')
    setMemoryMB(512)
    setSchemaPreset('auth_basic')
  }

  function handleSubmit() {
    mutate({
      name: dbName, type: dbType, stageName, hasInstance: addDB, isNewStage: true,
      is_protected: isProtected,
      initial_instance: addDB
        ? {
            name:          dbName,
            type:          dbType,
            memory_mb:     memoryMB,
            schema_preset: hasSchemaPresets(dbType) ? schemaPreset : undefined,
          }
        : undefined,
    })
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="New stage"
      description="A stage is an isolated environment for your databases and services."
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
            Create stage
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Stage name */}
        <FormField
          label="Stage name"
          required
          hint='Lowercase. Used in API URLs. Examples: production, staging, dev.'
          error={stageNameError ?? undefined}
        >
          <TextInput
            value={stageName}
            onChange={(v) => setStageName(v.toLowerCase().replace(/\s+/g, '-'))}
            placeholder="staging"
          />
        </FormField>

        {/* Protected toggle */}
        <label className="flex items-center gap-2 cursor-pointer bg-[#0A0A0A] border border-[#27272A] hover:border-[#3B3B3B] rounded-lg p-3 transition-colors">
          <input
            type="checkbox"
            checked={isProtected}
            onChange={(e) => setIsProtected(e.target.checked)}
            className="rounded border-[#27272A] bg-[#1A1A1A] accent-[#D4A843]"
          />
          <Lock size={11} className="text-[#D4A843]" />
          <span className="text-sm text-white">Mark as protected</span>
          <span className="text-xs text-[#52525B]">(prevents accidental deletion)</span>
        </label>

        <div className="h-px bg-[#1F1F23]" />

        {/* Add DB toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={addDB}
            onChange={(e) => setAddDB(e.target.checked)}
            className="rounded border-[#27272A] bg-[#1A1A1A] accent-[#D4A843]"
          />
          <span className="text-sm font-semibold text-white">
            Add a database to this stage
          </span>
        </label>

        {addDB && (
          <div className="pl-6 border-l border-[#1F1F23]">
            <InstanceFormFields
              type={dbType}           onTypeChange={(t) => { setDbType(t); setSchemaPreset(defaultPresetFor(t)) }}
              name={dbName}           onNameChange={setDbName}    nameError={dbNameError}
              memoryMB={memoryMB}     onMemoryChange={setMemoryMB}
              schemaPreset={schemaPreset} onPresetChange={setSchemaPreset}
              presets={presets}
            />
          </div>
        )}

        {!addDB && (
          <p className="text-xs text-[#52525B] leading-relaxed">
            The stage will be created empty. You can add databases to it later.
          </p>
        )}
      </div>
    </Modal>
  )
}
