"use client"

import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode,
  Info,
  Loader2,
  Minus,
  Plus,
  Table2,
} from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { analyzeImport, applyImport } from "@/lib/db-api"
import type {
  AnalyzeResponse,
  ApplyResult,
  ImportAnalysis,
  ImportDecision,
  ImportTable,
  TableDiff,
} from "@/types/db"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultActionFor = (table: ImportTable): ImportDecision["action"] => {
  if (table.status === "new") return "create"
  if (table.status === "same") return "skip"
  return "replace"
}

const titleForStep = (step: Step) =>
  ({
    upload: "Import SQL file",
    review: "Review import",
    applying: "Importing…",
    done: "Import complete",
  }[step])

const descForStep = (step: Step) =>
  ({
    upload: "Upload a .sql file to import into this database",
    review: "Choose what to do for each table",
    applying: "Please wait while we apply your changes",
    done: "Review the import results",
  }[step])

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className="bg-[#0A0A0A] border border-[#1F1F23] rounded-lg p-3 text-center">
      <p className="text-2xl font-bold font-mono" style={{ color }}>
        {count}
      </p>
      <p className="text-[10px] text-[#52525B] uppercase tracking-wider mt-0.5">
        {label}
      </p>
    </div>
  )
}

function DiffView({ diff }: { diff: TableDiff }) {
  return (
    <div className="space-y-3">
      {diff.added_columns.length > 0 && (
        <div>
          <p className="text-[10px] text-[#22C55E] uppercase tracking-wider font-medium mb-1.5">
            + {diff.added_columns.length} new column
            {diff.added_columns.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {diff.added_columns.map((col) => (
              <div
                key={col.name}
                className="flex items-center gap-2 px-2 py-1 bg-[#14291E]/30 rounded text-[11px] font-mono"
              >
                <Plus size={10} className="text-[#22C55E] shrink-0" />
                <span className="text-[#A1A1AA]">{col.name}</span>
                <span className="text-[#52525B]">{col.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.removed_columns.length > 0 && (
        <div>
          <p className="text-[10px] text-[#EF4444] uppercase tracking-wider font-medium mb-1.5">
            − {diff.removed_columns.length} removed column
            {diff.removed_columns.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {diff.removed_columns.map((col) => (
              <div
                key={col.name}
                className="flex items-center gap-2 px-2 py-1 bg-[#2D1414]/30 rounded text-[11px] font-mono"
              >
                <Minus size={10} className="text-[#EF4444] shrink-0" />
                <span className="text-[#A1A1AA]">{col.name}</span>
                <span className="text-[#52525B]">{col.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.changed_columns.length > 0 && (
        <div>
          <p className="text-[10px] text-[#EAB308] uppercase tracking-wider font-medium mb-1.5">
            ≠ {diff.changed_columns.length} changed column
            {diff.changed_columns.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {diff.changed_columns.map((change) => (
              <div
                key={change.name}
                className="px-2 py-1.5 bg-[#2D2510]/30 rounded text-[11px]"
              >
                <p className="font-mono text-[#A1A1AA] mb-0.5">
                  {change.name}
                </p>
                <div className="flex items-center gap-2 text-[10px] font-mono ml-3">
                  <span className="text-[#EF4444] line-through">
                    {change.current.type}
                    {!change.current.nullable ? " NOT NULL" : ""}
                  </span>
                  <ArrowRight size={9} className="text-[#52525B] shrink-0" />
                  <span className="text-[#22C55E]">
                    {change.incoming.type}
                    {!change.incoming.nullable ? " NOT NULL" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TableRow({
  table,
  decision,
  onDecisionChange,
}: {
  table: ImportTable
  decision: ImportDecision
  onDecisionChange: (partial: Partial<ImportDecision>) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const statusBadge = {
    new: { label: "NEW", color: "#22C55E", bg: "#14291E" },
    same: { label: "NO CHANGE", color: "#52525B", bg: "#1F1F23" },
    conflict: { label: "CONFLICT", color: "#EAB308", bg: "#2D2510" },
  }[table.status]

  const availableActions = (() => {
    switch (table.status) {
      case "new":
        return [
          { value: "create", label: "Create table" },
          { value: "skip", label: "Skip" },
        ]
      case "same":
        return [
          { value: "skip", label: "Skip" },
          { value: "replace", label: "Replace (re-import)" },
        ]
      case "conflict":
        return [
          { value: "replace", label: "Replace (DROP + CREATE)" },
          { value: "skip", label: "Keep current" },
        ]
    }
  })()

  const canExpand = table.status === "conflict" || table.has_data

  return (
    <div
      className={cn(
        "bg-[#0A0A0A] border rounded-lg overflow-hidden",
        decision.action === "skip"
          ? "border-[#1F1F23] opacity-60"
          : "border-[#27272A]"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        {/* Status badge */}
        <div
          className="px-2 py-0.5 rounded-full text-[10px] font-medium font-mono shrink-0"
          style={{ background: statusBadge.bg, color: statusBadge.color }}
        >
          {statusBadge.label}
        </div>

        {/* Table info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Table2 size={12} className="text-[#52525B] shrink-0" />
            <span className="text-sm font-mono font-semibold text-white truncate">
              {table.name}
            </span>
          </div>
          {table.has_data && (
            <p className="text-[10px] text-[#52525B] mt-0.5 ml-5">
              {table.row_count.toLocaleString()} rows in import file
            </p>
          )}
        </div>

        {/* Action selector */}
        <Select
          value={decision.action}
          onValueChange={(action) =>
            onDecisionChange({ action: action as ImportDecision["action"] })
          }
        >
          <SelectTrigger className="w-[190px] h-8 bg-[#1A1A1A] border-[#27272A] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#111111] border-[#27272A]">
            {availableActions.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Expand toggle */}
        {canExpand && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[#52525B] hover:text-white p-1 transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-[#1F1F23] p-3 bg-[#0F0F0F]">
          {/* Include data checkbox */}
          {table.has_data && decision.action !== "skip" && (
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={decision.include_data}
                onChange={(e) =>
                  onDecisionChange({ include_data: e.target.checked })
                }
                className="rounded border-[#27272A] bg-[#1A1A1A] accent-[#3B82F6]"
              />
              <span className="text-xs text-[#A1A1AA]">
                Also import {table.row_count.toLocaleString()} data rows
              </span>
            </label>
          )}

          {/* Diff */}
          {table.diff && <DiffView diff={table.diff} />}

          {/* DDL preview */}
          <details className="mt-3">
            <summary className="text-[10px] text-[#52525B] cursor-pointer hover:text-[#A1A1AA] transition-colors">
              Show CREATE TABLE statement
            </summary>
            <pre className="mt-2 p-2 bg-[#0A0A0A] border border-[#1F1F23] rounded text-[10px] text-[#A1A1AA] font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {table.ddl}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}

function UploadStep({
  file,
  onFileSelect,
}: {
  file: File | null
  onFileSelect: (f: File) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith(".sql")) {
      onFileSelect(f)
    } else {
      toast.error("Please select a .sql file")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
          dragOver
            ? "border-[#3B82F6] bg-[#1D3461]/20"
            : "border-[#27272A] hover:border-[#3B82F6]/40 hover:bg-[#1D3461]/10"
        )}
      >
        <div className="w-14 h-14 rounded-xl bg-[#1A1A1A] mx-auto flex items-center justify-center mb-4">
          <FileCode size={24} className="text-[#3B82F6]" />
        </div>

        {file ? (
          <>
            <p className="text-white font-medium mb-1">{file.name}</p>
            <p className="text-[#52525B] text-xs">
              {(file.size / 1024).toFixed(1)} KB · Click to change
            </p>
          </>
        ) : (
          <>
            <p className="text-white text-sm font-medium mb-1">
              Drop SQL file or click to browse
            </p>
            <p className="text-[#52525B] text-xs">
              Only .sql files. Maximum 50 MB.
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".sql"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFileSelect(f)
          }}
          className="hidden"
        />
      </div>

      <div className="bg-[#0A0A0A] border border-[#1F1F23] rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info size={13} className="text-[#3B82F6] shrink-0 mt-0.5" />
          <div className="text-xs text-[#A1A1AA] leading-relaxed">
            <p className="font-medium text-white mb-1">How import works</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>We parse your SQL file and identify tables</li>
              <li>For each table we show you what will happen</li>
              <li>You decide per-table: create, replace, skip</li>
              <li>Nothing is changed until you click Apply</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviewStep({
  analysis,
  decisions,
  onDecisionsChange,
}: {
  analysis: ImportAnalysis
  decisions: Record<string, ImportDecision>
  onDecisionsChange: (d: Record<string, ImportDecision>) => void
}) {
  const setDecision = (
    tableName: string,
    partial: Partial<ImportDecision>
  ) => {
    const table = analysis.tables.find((t) => t.name === tableName)!
    const existing = decisions[tableName] ?? {
      table_name: tableName,
      action: defaultActionFor(table),
      include_data: table.has_data,
    }
    onDecisionsChange({
      ...decisions,
      [tableName]: { ...existing, ...partial },
    })
  }

  const stats = {
    new: analysis.tables.filter((t) => t.status === "new").length,
    same: analysis.tables.filter((t) => t.status === "same").length,
    conflict: analysis.tables.filter((t) => t.status === "conflict").length,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill label="New" count={stats.new} color="#22C55E" />
        <StatPill label="Same" count={stats.same} color="#52525B" />
        <StatPill label="Conflict" count={stats.conflict} color="#EAB308" />
      </div>

      {/* Parse errors */}
      {analysis.errors.length > 0 && (
        <div className="bg-[#2D1010] border border-[#EF4444]/30 rounded-lg p-3">
          <p className="text-xs font-medium text-[#EF4444] mb-2">
            Parsing warnings:
          </p>
          {analysis.errors.map((err, i) => (
            <p key={i} className="text-xs text-[#EF4444]/80 font-mono">
              • {err}
            </p>
          ))}
        </div>
      )}

      {/* Table list */}
      <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
        {analysis.tables.map((table) => {
          const decision = decisions[table.name] ?? {
            table_name: table.name,
            action: defaultActionFor(table),
            include_data: table.has_data,
          }
          return (
            <TableRow
              key={table.name}
              table={table}
              decision={decision}
              onDecisionChange={(partial) =>
                setDecision(table.name, partial)
              }
            />
          )
        })}
      </div>
    </div>
  )
}

function ApplyingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 size={32} className="text-[#3B82F6] animate-spin mb-4" />
      <p className="text-white font-medium mb-1">Applying import…</p>
      <p className="text-[#52525B] text-sm">
        This may take a moment for large imports
      </p>
    </div>
  )
}

function DoneStep({
  result,
  onClose,
}: {
  result: ApplyResult
  onClose: () => void
}) {
  const hasFailures = result.failed.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center py-6">
        <div
          className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center",
            hasFailures ? "bg-[#2D2510]" : "bg-[#14291E]"
          )}
        >
          {hasFailures ? (
            <AlertTriangle size={28} className="text-[#EAB308]" />
          ) : (
            <Check size={28} className="text-[#22C55E]" />
          )}
        </div>
      </div>

      <div className="text-center">
        <h3 className="text-white font-semibold mb-1">
          {hasFailures ? "Import completed with errors" : "Import successful"}
        </h3>
        <p className="text-[#52525B] text-sm">
          {result.successful.length} table
          {result.successful.length !== 1 ? "s" : ""} imported
          {result.total_rows_imported > 0 &&
            `, ${result.total_rows_imported.toLocaleString()} rows`}
          {hasFailures && `, ${result.failed.length} failed`}
        </p>
      </div>

      {result.successful.length > 0 && (
        <div className="bg-[#14291E]/30 border border-[#22C55E]/20 rounded-lg p-3">
          <p className="text-[10px] text-[#22C55E] uppercase tracking-wider font-medium mb-2">
            Successful
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.successful.map((name) => (
              <span key={name} className="font-mono text-xs text-[#A1A1AA]">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasFailures && (
        <div className="bg-[#2D1414]/30 border border-[#EF4444]/20 rounded-lg p-3">
          <p className="text-[10px] text-[#EF4444] uppercase tracking-wider font-medium mb-2">
            Failed
          </p>
          <div className="space-y-2">
            {result.failed.map((f) => (
              <div key={f.table_name}>
                <p className="font-mono text-xs text-[#A1A1AA]">
                  {f.table_name}
                </p>
                <p className="text-[10px] text-[#EF4444] ml-3">{f.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

type Step = "upload" | "review" | "applying" | "done"

interface ImportWizardProps {
  instanceId: string
  open: boolean
  onClose: () => void
}

export function ImportWizard({
  instanceId,
  open,
  onClose,
}: ImportWizardProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null)
  const [decisions, setDecisions] = useState<Record<string, ImportDecision>>(
    {}
  )
  const [result, setResult] = useState<ApplyResult | null>(null)

  const reset = () => {
    setStep("upload")
    setFile(null)
    setAnalysis(null)
    setDecisions({})
    setResult(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const { mutate: analyzeFile, isPending: analyzing } = useMutation({
    mutationFn: () => analyzeImport(instanceId, file!),
    onSuccess: (data) => {
      setAnalysis(data)
      setStep("review")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to analyze file")
    },
  })

  const { mutate: applyDecisions, isPending: applying } = useMutation({
    mutationFn: () =>
      applyImport(
        instanceId,
        analysis!.session_id,
        Object.values(decisions).length > 0
          ? Object.values(decisions)
          : // if user never changed any decision, build defaults from analysis
            analysis!.analysis.tables.map((t) => ({
              table_name: t.name,
              action: defaultActionFor(t),
              include_data: t.has_data,
            }))
      ),
    onSuccess: (data) => {
      setResult(data)
      setStep("done")
      queryClient.invalidateQueries({ queryKey: ["db", instanceId] })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Import failed")
      setStep("review")
    },
  })

  function renderFooter(): React.ReactNode {
    if (step === "upload") {
      return (
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => analyzeFile()}
            disabled={!file || analyzing}
          >
            {analyzing ? "Analyzing…" : "Analyze file"}
          </Button>
        </>
      )
    }

    if (step === "review") {
      const effectiveDecisions =
        Object.values(decisions).length > 0
          ? Object.values(decisions)
          : (analysis?.analysis.tables ?? []).map((t) => ({
              table_name: t.name,
              action: defaultActionFor(t),
              include_data: t.has_data,
            }))
      const toApply = effectiveDecisions.filter(
        (d) => d.action !== "skip"
      ).length

      return (
        <>
          <Button variant="ghost" onClick={() => setStep("upload")}>
            Back
          </Button>
          <Button
            onClick={() => {
              setStep("applying")
              applyDecisions()
            }}
            disabled={toApply === 0 || applying}
          >
            Apply {toApply} {toApply === 1 ? "change" : "changes"}
          </Button>
        </>
      )
    }

    if (step === "applying") return null

    if (step === "done") return null // DoneStep renders its own close button

    return null
  }

  return (
    <Modal
      open={open}
      onClose={step === "applying" ? () => {} : handleClose}
      title={titleForStep(step)}
      description={descForStep(step)}
      size="xl"
      footer={renderFooter()}
    >
      {step === "upload" && (
        <UploadStep file={file} onFileSelect={setFile} />
      )}
      {step === "review" && analysis && (
        <ReviewStep
          analysis={analysis.analysis}
          decisions={decisions}
          onDecisionsChange={setDecisions}
        />
      )}
      {step === "applying" && <ApplyingStep />}
      {step === "done" && result && (
        <DoneStep result={result} onClose={handleClose} />
      )}
    </Modal>
  )
}
