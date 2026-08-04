"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Play,
  Trash2,
  Clock,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  X,
} from "lucide-react"
import { runQuery, getTables } from "@/lib/db-api"
import { useExplorer } from "@/lib/explorer-context"
import { QueryResult } from "@/types/db"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { SQLEditorHelp } from "@/components/explorer/sql-editor-help"

const SqlMonaco = dynamic(() => import("./sql-monaco"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-[#09090B] flex items-center justify-center text-xs text-[#52525B]">
      Loading editor…
    </div>
  ),
})

// ── Persistence helpers ───────────────────────────────────────────────────────

const HISTORY_KEY = "sql_query_history"
const MAX_HISTORY  = 30

function loadHistory(): string[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") } catch { return [] }
}
function saveHistory(h: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)))
}

// ── Component ────────────────────────────────────────────────────────────────

interface SqlEditorTabProps {
  instanceId: string
  initialTable?: string
}

function defaultSQL(table?: string) {
  if (table) return `SELECT *\nFROM "${table}"\nLIMIT 100;`
  return ""
}

export function SqlEditorTab({ instanceId, initialTable }: SqlEditorTabProps) {
  const { currentSchema } = useExplorer()
  const [sql, setSql]           = useState(() => defaultSQL(initialTable))
  const [result, setResult]     = useState<QueryResult | null>(null)
  const [loading, setLoading]   = useState(false)
  const [history, setHistory]   = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [splitPct, setSplitPct] = useState(55)
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setHistory(loadHistory()) }, [])

  // Fetch table names for autocomplete (free from cache)
  const { data: tables = [] } = useQuery({
    queryKey: ["db", instanceId, "tables", currentSchema],
    queryFn: () => getTables(instanceId, currentSchema),
    staleTime: 60_000,
  })
  const _tableNames = tables.map((t) => t.name) // available for future autocomplete

  const handleRun = useCallback(async () => {
    const query = sql.trim()
    if (!query) { toast.error("Write a query first"); return }
    setLoading(true)
    setShowHistory(false)
    try {
      const res = await runQuery(instanceId, query)
      setResult(res)
      const next = [query, ...history.filter(h => h !== query)]
      setHistory(next)
      saveHistory(next)
      if (res.error) {
        toast.error("Query error", { description: res.error.slice(0, 120) })
      } else {
        toast.success(`${res.row_count} row${res.row_count !== 1 ? "s" : ""} · ${res.execution_time_ms}ms`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Query failed")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [sql, history, instanceId])

  const handleClear = () => { setSql(""); setResult(null) }

  // Drag-to-resize
  const onDividerMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    e.preventDefault()
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((ev.clientY - rect.top) / rect.height) * 100
      setSplitPct(Math.min(80, Math.max(20, pct)))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  const isEmpty = !sql.trim()

  return (
    <div className="h-full flex flex-col bg-[#09090B] overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 h-11 flex items-center gap-2 px-3 border-b border-[#1E1E24] bg-[#0D0D10]">
        <button
          onClick={handleRun}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Run
          <span className="opacity-50 text-[10px] ml-0.5">⌘↵</span>
        </button>

        <div className="w-px h-5 bg-[#27272A]" />

        <button
          onClick={handleClear}
          title="Clear editor"
          className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[#71717A] hover:text-white hover:bg-[#18181B] text-xs transition-colors"
        >
          <Trash2 size={12} />
          Clear
        </button>

        <div className="w-px h-5 bg-[#27272A]" />

        {/* History */}
        <div className="relative">
          <button
            onClick={() => setShowHistory(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs transition-colors",
              showHistory
                ? "bg-[#18181B] text-white"
                : "text-[#71717A] hover:text-white hover:bg-[#18181B]"
            )}
          >
            <History size={12} />
            History
            <ChevronDown size={10} className={cn("transition-transform", showHistory && "rotate-180")} />
          </button>
          {showHistory && history.length > 0 && (
            <div className="absolute top-full left-0 mt-1 z-50 w-[400px] max-h-[280px] overflow-y-auto rounded-lg border border-[#27272A] bg-[#111113] shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1E1E24]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#52525B]">Recent queries</span>
                <button onClick={() => setShowHistory(false)} className="text-[#52525B] hover:text-white">
                  <X size={11} />
                </button>
              </div>
              {history.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setSql(q); setShowHistory(false) }}
                  className="w-full text-left px-3 py-2 text-xs font-mono text-[#A1A1AA] hover:bg-[#18181B] hover:text-white border-b border-[#1E1E24] last:border-0 truncate transition-colors"
                >
                  {q.replace(/\s+/g, " ").trim()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        {result && !loading && (
          <div className={cn(
            "ml-auto flex items-center gap-1.5 text-xs",
            result.error ? "text-red-400" : "text-emerald-400"
          )}>
            {result.error
              ? <><XCircle size={12} /> Error</>
              : <><CheckCircle2 size={12} /> {result.row_count} rows · {result.execution_time_ms}ms</>
            }
          </div>
        )}
      </div>

      {/* Help panel — visible only when editor is empty */}
      {isEmpty && <SQLEditorHelp onPickQuery={setSql} />}

      {/* Split pane */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        onClick={() => setShowHistory(false)}
      >
        {/* Monaco editor */}
        <div className="overflow-hidden" style={{ height: `${splitPct}%` }}>
          <SqlMonaco value={sql} onChange={setSql} onRun={handleRun} />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={onDividerMouseDown}
          className="shrink-0 h-[5px] bg-[#1E1E24] hover:bg-[#3B82F6]/30 cursor-row-resize transition-colors flex items-center justify-center group"
        >
          <div className="w-8 h-0.5 rounded-full bg-[#27272A] group-hover:bg-[#3B82F6]/50 transition-colors" />
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col" style={{ height: `${100 - splitPct}%` }}>
          <ResultsPanel result={result} loading={loading} />
        </div>
      </div>
    </div>
  )
}

// ── Results panel ─────────────────────────────────────────────────────────────

function ResultsPanel({ result, loading }: { result: QueryResult | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#09090B]">
        <div className="flex items-center gap-2 text-[#52525B] text-sm">
          <Loader2 size={16} className="animate-spin" />
          Executing…
        </div>
      </div>
    )
  }

  if (result === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#09090B]">
        <div className="text-center">
          <Clock size={20} className="text-[#27272A] mx-auto mb-2" />
          <p className="text-[#52525B] text-xs">Run a query to see results</p>
        </div>
      </div>
    )
  }

  if (result.error) {
    return (
      <div className="flex-1 overflow-auto bg-[#09090B] p-4">
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2 text-red-400 text-xs font-semibold uppercase tracking-wider">
            <XCircle size={13} /> Error
          </div>
          <pre className="text-sm text-red-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
            {result.error}
          </pre>
        </div>
      </div>
    )
  }

  if (result.columns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#09090B]">
        <div className="text-center">
          <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-emerald-400 text-sm font-medium">Query executed successfully</p>
          <p className="text-[#52525B] text-xs mt-1">
            {result.row_count} row{result.row_count !== 1 ? "s" : ""} affected · {result.execution_time_ms}ms
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#09090B]">
      <div className="flex-1 min-h-0 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-[#0D0D10] border-b border-[#1E1E24]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-center text-[11px] text-[#3F3F46] font-mono border-r border-[#1E1E24] select-none">
                #
              </TableHead>
              {result.columns.map((col) => (
                <TableHead
                  key={col}
                  className="font-mono text-[11px] text-[#71717A] font-semibold uppercase tracking-wide whitespace-nowrap"
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row, idx) => (
              <TableRow key={idx} className="border-[#1E1E24] hover:bg-[#111113]">
                <TableCell className="text-center text-[10px] text-[#3F3F46] font-mono border-r border-[#1E1E24] select-none">
                  {idx + 1}
                </TableCell>
                {row.map((cell, ci) => (
                  <TableCell key={ci} className="font-mono text-xs whitespace-nowrap max-w-[320px] truncate">
                    {cell === null || cell === undefined
                      ? <span className="text-[#3F3F46] italic">NULL</span>
                      : <span className="text-[#E4E4E7]">{String(cell)}</span>
                    }
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="shrink-0 border-t border-[#1E1E24] bg-[#0D0D10] px-4 h-7 flex items-center">
        <span className="text-[11px] text-[#52525B]">
          {result.row_count} row{result.row_count !== 1 ? "s" : ""} · {result.execution_time_ms}ms
        </span>
      </div>
    </div>
  )
}
