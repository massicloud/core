"use client"

import { useCallback, useEffect, useState } from "react"
import Editor, { type OnMount } from "@monaco-editor/react"
import { Play, Clock } from "lucide-react"
import { runMongoQuery } from "@/lib/mongo-api"
import { applyMassicloudTheme, MONACO_EDITOR_OPTIONS } from "./monaco-theme"

const EXAMPLES = [
  { label: "Find all", value: (c: string) => `db.${c}.find({})` },
  { label: "Filter", value: (c: string) => `db.${c}.find({status: "active"}).limit(10)` },
  {
    label: "Aggregate",
    value: (c: string) => `db.${c}.aggregate([{$group: {_id: "$userId", total: {$sum: "$amount"}}}])`,
  },
]

const HISTORY_LIMIT = 20

// Parses `db.<collection>.<op>(<args>).limit(<n>)?` — args are evaluated as a
// JS expression (not strict JSON) so unquoted keys / $-prefixed operators
// from real mongo-shell syntax work, same way mongosh itself accepts them.
// This only ever runs in the user's own browser against their own query
// text, so a Function-based eval here carries no more risk than the
// browser devtools console already does.
const CALL_RE = /^db\.([a-zA-Z0-9_]+)\.(find|findOne|count|aggregate|distinct)\(([\s\S]*?)\)(?:\.limit\((\d+)\))?\s*;?\s*$/

function parseShellQuery(input: string): { command: Record<string, unknown> } | { error: string } {
  const match = input.trim().match(CALL_RE)
  if (!match) {
    return { error: "Only db.<collection>.find/findOne/count/aggregate/distinct(...) is supported here" }
  }
  const [, collection, op, argsText, limitSuffix] = match

  let args: unknown[]
  try {
    // eslint-disable-next-line no-new-func
    args = argsText.trim() ? new Function(`return [${argsText}]`)() : []
  } catch {
    return { error: "Could not parse arguments" }
  }

  switch (op) {
    case "find":
      return { command: { find: collection, filter: args[0] ?? {}, limit: limitSuffix ? Number(limitSuffix) : 10 } }
    case "findOne":
      return { command: { find: collection, filter: args[0] ?? {}, limit: 1 } }
    case "count":
      return { command: { count: collection, query: args[0] ?? {} } }
    case "aggregate":
      return { command: { aggregate: collection, pipeline: args[0] ?? [], cursor: {} } }
    case "distinct":
      return { command: { distinct: collection, key: args[0], query: args[1] ?? {} } }
    default:
      return { error: "Unsupported operation" }
  }
}

export function QueryConsole({ instanceId, collection }: { instanceId: string; collection: string }) {
  const historyKey = `massicloud:mongo-query-history:${instanceId}`
  const [query, setQuery] = useState(() => EXAMPLES[0].value(collection))
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [tookMs, setTookMs] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(historyKey)
      if (raw) setHistory(JSON.parse(raw))
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyKey])

  const run = useCallback(async () => {
    const parsed = parseShellQuery(query)
    if ("error" in parsed) {
      setError(parsed.error)
      setResult(null)
      return
    }
    setRunning(true)
    setError(null)
    try {
      const res = await runMongoQuery(instanceId, parsed.command)
      setResult(res.result)
      setTookMs(res.took_ms)
      setHistory((prev) => {
        const next = [query, ...prev.filter((q) => q !== query)].slice(0, HISTORY_LIMIT)
        try {
          sessionStorage.setItem(historyKey, JSON.stringify(next))
        } catch {
          // ignore quota errors
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed")
      setResult(null)
    } finally {
      setRunning(false)
    }
  }, [query, instanceId, historyKey])

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      applyMassicloudTheme(monaco)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run())
    },
    [run]
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1E1E24] shrink-0 overflow-x-auto">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => setQuery(ex.value(collection))}
            className="shrink-0 h-6 px-2.5 rounded-full border border-[#27272A] text-[11px] text-[#A1A1AA] hover:text-white hover:border-[#3B3B3B] transition-colors"
          >
            {ex.label}
          </button>
        ))}
        {history.length > 0 && (
          <select
            onChange={(e) => e.target.value && setQuery(e.target.value)}
            defaultValue=""
            className="shrink-0 h-6 px-2 rounded-full border border-[#27272A] bg-transparent text-[11px] text-[#71717A]"
          >
            <option value="" disabled>
              History
            </option>
            {history.map((q, i) => (
              <option key={i} value={q}>
                {q.length > 60 ? q.slice(0, 60) + "…" : q}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="h-[160px] border-b border-[#1E1E24] shrink-0">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={query}
          onChange={(v) => setQuery(v ?? "")}
          onMount={handleMount}
          loading={
            <div className="h-full w-full flex items-center justify-center text-xs text-[#52525B] bg-[#09090B]">
              Loading editor…
            </div>
          }
          options={{ ...MONACO_EDITOR_OPTIONS, lineNumbers: "off" as const }}
        />
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1E1E24] shrink-0">
        <button
          onClick={run}
          disabled={running}
          className="h-7 px-3 flex items-center gap-1.5 rounded-md bg-[#D4A843] hover:bg-[#C39936] text-black text-xs font-medium disabled:opacity-50"
        >
          <Play size={11} />
          {running ? "Running…" : "Run"}
          <span className="text-[10px] opacity-60 ml-1">⌘⏎</span>
        </button>
        {tookMs !== null && (
          <span className="text-[11px] text-[#52525B] flex items-center gap-1">
            <Clock size={10} />
            {tookMs}ms
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {error ? (
          <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">{error}</p>
        ) : result !== null ? (
          <pre className="text-xs font-mono text-[#E4E4E7] whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : (
          <p className="text-xs text-[#52525B]">Run a query to see results here.</p>
        )}
      </div>
    </div>
  )
}
