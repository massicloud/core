"use client"

import { Layers, Plus } from "lucide-react"

interface Props {
  onCreate: () => void
  disabled?: boolean
}

export function EmptyStages({ onCreate, disabled }: Props) {
  return (
    <div className="bg-[#111111] border border-dashed border-[#27272A] rounded-xl p-12 text-center">
      <Layers size={24} className="text-[#52525B] mx-auto mb-3" />
      <p className="text-sm text-white mb-1">No stages in this project</p>
      <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto mb-5">
        A stage is an environment like production or staging. Each stage gets
        its own databases and services.
      </p>
      <button
        onClick={onCreate}
        disabled={disabled}
        title={disabled ? 'A database is already being created' : undefined}
        className="inline-flex items-center gap-2 h-9 px-4 bg-[#D4A843] hover:bg-[#D4A843]/90 text-[#0A0A0A] text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#D4A843]"
      >
        <Plus size={13} />
        {disabled ? 'Creating…' : 'Create your first stage'}
      </button>
    </div>
  )
}
