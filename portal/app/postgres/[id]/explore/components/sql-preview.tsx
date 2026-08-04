"use client"

import { SQL_TYPES } from "./column-types"

const KEYWORDS = new Set([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "CREATE",
  "DROP",
  "ALTER",
  "ADD",
  "TABLE",
  "INDEX",
  "ON",
  "USING",
  "NOT",
  "NULL",
  "DEFAULT",
  "UNIQUE",
  "PRIMARY",
  "KEY",
  "CONCURRENTLY",
  "VALUES",
])

function highlightToken(token: string): JSX.Element {
  const trimmed = token.trim()
  if (trimmed.length === 0) {
    return <span>{token}</span>
  }

  if (["(", ")", ",", ";"].includes(trimmed)) {
    return <span className="text-[#52525B]">{token}</span>
  }

  if (/^'.*'$/.test(trimmed)) {
    return <span className="text-[#22C55E]">{token}</span>
  }

  const upper = trimmed.toUpperCase()
  if (["NOT", "NULL"].includes(upper)) {
    return <span className="text-[#EF4444]">{token}</span>
  }
  if (["PRIMARY", "KEY"].includes(upper)) {
    return <span className="text-[#A855F7]">{token}</span>
  }
  if (KEYWORDS.has(upper)) {
    return <span className="text-[#3B82F6]">{token}</span>
  }

  if (SQL_TYPES.has(trimmed.toLowerCase())) {
    return <span className="text-[#D4A843]">{token}</span>
  }

  return <span>{token}</span>
}

function highlightLine(line: string, lineIdx: number): JSX.Element {
  const trimmed = line.trimStart()
  if (trimmed.startsWith("--")) {
    return <span key={lineIdx} className="text-[#52525B]">{line}</span>
  }

  const parts = line.split(/('(?:''|[^'])*')/g)

  return (
    <span key={lineIdx}>
      {parts.map((part, partIdx) => {
        if (part.length === 0) return null
        if (/^'.*'$/.test(part)) {
          return (
            <span key={`${lineIdx}-${partIdx}`} className="text-[#22C55E]">
              {part}
            </span>
          )
        }

        return (
          <span key={`${lineIdx}-${partIdx}`}>
            {part.split(/(\b)/g).map((token, tokenIdx) => (
              <span key={`${lineIdx}-${partIdx}-${tokenIdx}`}>{highlightToken(token)}</span>
            ))}
          </span>
        )
      })}
    </span>
  )
}

export function SqlPreview({ sql }: { sql: string }) {
  const lines = sql.split("\n")

  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[0.05em] text-[#52525B]">SQL Preview</p>
      <div className="rounded-md border border-[#27272A] bg-[#0A0A0A] px-4 py-4">
        <pre className="min-h-[80px] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.7] text-[#FAFAFA]">
          {lines.map((line, idx) => (
            <span key={idx}>
              {highlightLine(line, idx)}
              {idx < lines.length - 1 ? "\n" : null}
            </span>
          ))}
        </pre>
      </div>
    </div>
  )
}

