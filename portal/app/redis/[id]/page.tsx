"use client"

import { useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Zap,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  ArrowLeft,
  Terminal,
  Code2,
  Server,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { getRedisInstances, deleteRedisInstance, getErrorMessage } from "@/lib/api"
import { useProject } from "@/lib/project-context"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CodeSnippetTabs } from "@/components/ui/code-snippet-tabs"
import { cn } from "@/lib/utils"

// ── helpers ──────────────────────────────────────────────────────────────────

function parseRedis(dsn: string) {
  try {
    const u = new URL(dsn)
    return { password: u.password, host: u.hostname, port: u.port }
  } catch {
    return { password: "", host: "", port: "" }
  }
}

function masked(s: string) {
  return "•".repeat(Math.min(s?.length ?? 0, 24))
}

function maskDSN(dsn: string, password: string) {
  if (!password) return dsn
  return dsn.replace(`:${password}@`, ":••••••••••••@")
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── copy hook ────────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = useCallback(async (key: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }, [])
  return { copied, copy }
}

// ── sub-components ────────────────────────────────────────────────────────────

function ConnField({
  label,
  value,
  secret,
  fieldKey,
  copied,
  onCopy,
}: {
  label: string
  value: string
  secret?: boolean
  fieldKey: string
  copied: string | null
  onCopy: (key: string, value: string) => void
}) {
  const [show, setShow] = useState(false)
  const display = secret && !show ? masked(value) : value

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#1E1E24] last:border-0">
      <span className="text-[11px] font-medium text-[#52525B] w-20 shrink-0 uppercase tracking-wide">
        {label}
      </span>
      <span className="flex-1 text-xs font-mono text-[#E4E4E7] truncate">{display}</span>
      <div className="flex items-center gap-1 shrink-0">
        {secret && (
          <button
            onClick={() => setShow((v) => !v)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
            title={show ? "Hide" : "Reveal"}
          >
            {show ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
        )}
        <button
          onClick={() => onCopy(fieldKey, value)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1A1A1A] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
          title="Copy"
        >
          {copied === fieldKey ? (
            <Check size={11} className="text-[#22C55E]" />
          ) : (
            <Copy size={11} />
          )}
        </button>
      </div>
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function RedisInstancePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentProject } = useProject()
  const { copied, copy } = useCopy()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["redis", currentProject?.id],
    queryFn: () => getRedisInstances(currentProject?.id),
    enabled: !!currentProject?.id,
  })

  const instance = instances.find((i) => i.id === id)

  const deleteMutation = useMutation({
    mutationFn: () => deleteRedisInstance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["redis", currentProject?.id] })
      toast.success(`Redis instance deleted`)
      router.push("/redis")
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-[#111111] border border-[#1E1E24] animate-pulse" />
        ))}
      </div>
    )
  }

  if (!instance) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto text-center py-24">
        <Zap size={28} className="text-[#3F3F46] mx-auto mb-3" />
        <p className="text-[#52525B] text-sm">Instance not found</p>
        <Link href="/redis" className="mt-4 inline-block text-xs text-[#D4A843] hover:underline">
          ← Back to Redis
        </Link>
      </div>
    )
  }

  const { host, password } = parseRedis(instance.dsn)

  // Code snippets
  const snippets = {
    cli: `redis-cli -h ${host} -p ${instance.port} -a <password>`,
    js: `import Redis from 'ioredis'

const redis = new Redis(${JSON.stringify(maskDSN(instance.dsn, password))})

await redis.set('key', 'value')
const val = await redis.get('key')`,
    py: `import redis

r = redis.Redis(
    host="${host}",
    port=${instance.port},
    password="<password>",
    decode_responses=True
)

r.set("key", "value")
val = r.get("key")`,
    go: `import (
	"context"
	"github.com/redis/go-redis/v9"
)

rdb := redis.NewClient(&redis.Options{
	Addr:     "${host}:${instance.port}",
	Password: "<password>",
})

ctx := context.Background()
rdb.Set(ctx, "key", "value", 0)
val, _ := rdb.Get(ctx, "key").Result()`,
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/redis"
        className="inline-flex items-center gap-1.5 text-[11px] text-[#52525B] hover:text-white transition-colors mb-5"
      >
        <ArrowLeft size={11} />
        All Redis instances
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center shrink-0">
            <Zap size={18} className="text-[#D4A843]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{instance.name}</h1>
            <p className="text-[12px] text-[#52525B] mt-0.5 font-mono">
              {host}:{instance.port}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-medium px-2 py-1 rounded-full border",
              instance.status === "running"
                ? "bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E]"
                : "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]"
            )}
          >
            {instance.status}
          </span>
          <button
            onClick={() => setDeleteOpen(true)}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#27272A] hover:border-[#EF4444]/40 hover:bg-[#2D1414] text-[#52525B] hover:text-[#EF4444] transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Memory", value: `${instance.memory_mb} MB` },
          { label: "Port", value: String(instance.port) },
          { label: "Created", value: formatRelative(instance.created_at) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-[#1E1E24] bg-[#111111] px-4 py-3 text-center"
          >
            <p className="text-[10px] text-[#52525B] uppercase tracking-wide mb-1">{label}</p>
            <p className="text-sm font-mono text-[#E4E4E7] font-medium">{value}</p>
          </div>
        ))}
      </div>

      {/* Connection String */}
      <section className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Server size={13} className="text-[#D4A843]" />
          <h2 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
            Connection
          </h2>
        </div>
        <div className="rounded-xl border border-[#1E1E24] bg-[#111111] px-4 py-1">
          <ConnField
            label="Host"
            value={host || instance.host}
            fieldKey="host"
            copied={copied}
            onCopy={(k, v) => { copy(k, v); toast.success("Host copied") }}
          />
          <ConnField
            label="Port"
            value={String(instance.port)}
            fieldKey="port"
            copied={copied}
            onCopy={(k, v) => { copy(k, v); toast.success("Port copied") }}
          />
          <ConnField
            label="Password"
            value={password}
            secret
            fieldKey="password"
            copied={copied}
            onCopy={(k, v) => { copy(k, v); toast.success("Password copied") }}
          />
          <ConnField
            label="URL"
            value={instance.dsn}
            secret
            fieldKey="url"
            copied={copied}
            onCopy={(k, v) => { copy(k, v); toast.success("Connection URL copied") }}
          />
        </div>
      </section>

      {/* Code snippets */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Code2 size={13} className="text-[#D4A843]" />
          <h2 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
            Connect from code
          </h2>
        </div>
        <CodeSnippetTabs
          snippets={snippets}
          labels={{ js: "Node.js (ioredis)", py: "Python (redis-py)", go: "Go (go-redis)" }}
          order={["cli", "js", "py", "go"]}
          defaultLang="cli"
        />
        <p className="mt-3 text-[11px] text-[#3F3F46] flex items-center gap-1.5">
          <Terminal size={10} />
          Replace <code className="font-mono text-[#52525B]">&lt;password&gt;</code> with the actual password shown above.
        </p>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Redis instance"
        message={`Are you sure you want to delete "${instance.name}"? All cached data will be permanently lost.`}
        confirmLabel="Delete instance"
        loading={deleteMutation.isPending}
        requiresTyping={instance.name}
      />
    </div>
  )
}
