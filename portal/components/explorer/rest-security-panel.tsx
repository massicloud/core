"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Network,
  AlertTriangle,
  Copy,
  Check,
  Code2,
  Loader2,
} from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { CodeSnippetTabs } from "@/components/ui/code-snippet-tabs"
import { enableRLS } from "@/lib/db-api"
import { getApiBaseUrl, listStages } from "@/lib/api"
import { buildRESTSnippets } from "@/lib/code-snippets"
import { useProject } from "@/lib/project-context"
import type { TableSecurity, Column } from "@/types/db"

interface Props {
  instanceId: string
  instanceName: string
  projectSlug: string
  tableName: string
  security?: TableSecurity
  columns?: Column[]
}

export function RESTSecurityPanel({
  instanceId,
  instanceName,
  projectSlug,
  tableName,
  security,
  columns,
}: Props) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [showExamples, setShowExamples] = useState(false)

  const { currentProject } = useProject()
  const { data: stages = [] } = useQuery({
    queryKey: ["stages", currentProject?.id],
    queryFn: () => listStages(currentProject!.id),
    enabled: !!currentProject?.id,
  })
  const stage = stages.find(
    (s) => s.instances?.some((inst) => inst.id === instanceId)
  )?.name ?? "production"

  const restURL = `${getApiBaseUrl()}/v1/${projectSlug}/${stage}/db/${instanceName}/rest/${tableName}`

  function copy() {
    navigator.clipboard.writeText(restURL)
    setCopied(true)
    toast.success("Copied")
    setTimeout(() => setCopied(false), 2000)
  }

  const { mutate: doEnableRLS, isPending: enabling } = useMutation({
    mutationFn: () => enableRLS(instanceId, tableName),
    onSuccess: () => {
      toast.success("RLS enabled")
      queryClient.invalidateQueries({
        queryKey: ["db-security", instanceId],
      })
    },
    onError: () => toast.error("Failed to enable RLS"),
  })

  return (
    <>
      <div className="bg-[#111111] border border-[#27272A] rounded-xl p-5 mb-6">
        {/* Section heading */}
        <div className="flex items-center gap-2 mb-4">
          <Network size={13} className="text-[#3B82F6]" />
          <h3 className="text-sm font-semibold text-white">REST & Security</h3>
        </div>

        {/* Endpoint row */}
        <div className="mb-4">
          <p className="text-[10px] font-medium text-[#52525B] uppercase tracking-wider mb-1.5">
            Endpoint
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#0A0A0A] border border-[#1F1F23] rounded px-3 py-2 font-mono text-xs text-white overflow-x-auto whitespace-nowrap">
              {restURL}
            </div>
            <button
              onClick={copy}
              className="shrink-0 h-9 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] rounded text-xs font-medium text-[#A1A1AA] hover:text-white transition-all flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-[#22C55E]" /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy
                </>
              )}
            </button>
            <button
              onClick={() => setShowExamples(true)}
              className="shrink-0 h-9 px-3 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] rounded text-xs font-medium text-[#A1A1AA] hover:text-white transition-all flex items-center gap-1.5"
            >
              <Code2 size={12} />
              Examples
            </button>
          </div>
        </div>

        {/* RLS status */}
        <div>
          <p className="text-[10px] font-medium text-[#52525B] uppercase tracking-wider mb-1.5">
            Row Level Security
          </p>

          {security?.rls_enabled ? (
            <div className="flex items-center justify-between gap-3 bg-[#14291E]/30 border border-[#22C55E]/20 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-2 h-2 rounded-full bg-[#22C55E] shrink-0" />
                <span className="text-sm text-white">Enabled</span>
                <span className="text-xs text-[#52525B]">·</span>
                <span className="text-xs text-[#A1A1AA]">
                  {security.policy_count}{" "}
                  {security.policy_count === 1 ? "policy" : "policies"}
                </span>
                {security.policy_count === 0 && (
                  <span className="text-xs text-[#EAB308]">
                    ⚠ No rows visible to anyone except service_role
                  </span>
                )}
              </div>
              <span className="text-xs text-[#3B3B3B]" title="Policy editor coming soon">
                Manage →
              </span>
            </div>
          ) : (
            <div className="bg-[#2D1414]/30 border border-[#EF4444]/20 rounded-lg px-3 py-3">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle
                  size={14}
                  className="text-[#EF4444] mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm text-white">
                    Disabled — this table is public
                  </p>
                  <p className="text-xs text-[#A1A1AA] mt-0.5 leading-relaxed">
                    Anyone with your anon key can read and write all rows.
                    Enable RLS, then add policies to control access per user.
                  </p>
                </div>
              </div>
              <button
                onClick={() => doEnableRLS()}
                disabled={enabling}
                className="h-8 px-3 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-medium rounded transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {enabling && <Loader2 size={11} className="animate-spin" />}
                Enable RLS
              </button>
            </div>
          )}
        </div>
      </div>

      {/* REST examples modal */}
      <Modal
        open={showExamples}
        onClose={() => setShowExamples(false)}
        title={`REST examples — ${tableName}`}
        description={restURL}
        size="lg"
      >
        <TableRESTSnippets
          projectSlug={projectSlug}
          stage={stage}
          instanceName={instanceName}
          tableName={tableName}
          columns={columns}
        />
      </Modal>
    </>
  )
}

function TableRESTSnippets({
  projectSlug,
  stage,
  instanceName,
  tableName,
  columns,
}: {
  projectSlug: string
  stage: string
  instanceName: string
  tableName: string
  columns?: Column[]
}) {
  const primaryKey = columns?.find((c) => c.is_primary_key)?.name

  const snippets = buildRESTSnippets({
    projectSlug,
    stage,
    dbName: instanceName,
    anonKeyDisplay: 'mc_anon_',
    tableName,
    primaryKey,
    columns,
    apiBaseURL: typeof window !== "undefined" ? getApiBaseUrl() : undefined,
  })

  return (
    <div className="bg-[#0D0D0D] border border-[#27272A] rounded-xl overflow-hidden">
      <CodeSnippetTabs
        snippets={snippets}
        defaultLang="sdk"
        installHint="npm install @massicloud/client"
        className="border-0 rounded-none"
      />
    </div>
  )
}
