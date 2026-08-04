"use client"

import { useState } from "react"
import { Lock, ChevronDown, ChevronRight } from "lucide-react"
import { buildAuthOperationSnippets } from "@/lib/code-snippets"
import { OperationCard } from "./operation-card"

interface Props {
  projectSlug: string
  stage: string
  dbName: string
  anonKeyPrefix: string
  defaultOpen?: boolean
}

const AUTH_OPERATIONS = [
  { method: "POST", path: "/auth/signup",  label: "Sign up a new end-user",            op: "signup"  },
  { method: "POST", path: "/auth/login",   label: "Sign in an existing end-user",      op: "login"   },
  { method: "POST", path: "/auth/refresh", label: "Refresh an access token",           op: "refresh" },
  { method: "GET",  path: "/auth/user",    label: "Get the current authenticated user", op: "user"   },
] as const

export function AuthEndpointsBlock({ projectSlug, stage, dbName, anonKeyPrefix, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [activeOp, setActiveOp] = useState<string | null>(null)

  const ctx = { projectSlug, stage, dbName, anonKeyDisplay: anonKeyPrefix }

  return (
    <div className="bg-[#111111] border border-[#27272A] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#0D0D0D] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1D3461]/40 flex items-center justify-center shrink-0">
            <Lock size={13} className="text-[#3B82F6]" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">Authentication</h3>
            <p className="text-xs text-[#52525B] mt-0.5">
              {AUTH_OPERATIONS.length} endpoints · sign up, sign in, refresh
            </p>
          </div>
        </div>
        {open
          ? <ChevronDown size={14} className="text-[#52525B]" />
          : <ChevronRight size={14} className="text-[#52525B]" />}
      </button>

      {open && (
        <div className="border-t border-[#1F1F23] p-5 space-y-2">
          {AUTH_OPERATIONS.map((op) => (
            <OperationCard
              key={op.op}
              method={op.method}
              path={op.path}
              label={op.label}
              isActive={activeOp === op.op}
              onToggle={() => setActiveOp(activeOp === op.op ? null : op.op)}
              snippets={buildAuthOperationSnippets(ctx, op.op)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
