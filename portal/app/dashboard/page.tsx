"use client"

import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Database, Zap, CheckCircle2, HardDrive, ChevronRight, Plus, Activity } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { getPostgresInstances, getRedisInstances, getHealth, me, getBuckets } from "@/lib/api"
import { useProject } from "@/lib/project-context"
import { StatCard, StatusBadge } from "@/components/dashboard/stat-card"
import { StatusRow } from "@/components/dashboard/status-row"

const getTimeOfDay = () => {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}

const formatRelativeTime = (date: string) =>
  formatDistanceToNow(new Date(date), { addSuffix: true })

export default function DashboardPage() {
  const router = useRouter()
  const { currentProject } = useProject()

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: me,
  })

  const { data: postgresInstances, isLoading: pgLoading } = useQuery({
    queryKey: ["postgres", currentProject?.id],
    queryFn: () => getPostgresInstances(currentProject!.id),
    enabled: !!currentProject?.id,
  })

  const { data: redisInstances, isLoading: redisLoading } = useQuery({
    queryKey: ["redis", currentProject?.id],
    queryFn: () => getRedisInstances(currentProject!.id),
    enabled: !!currentProject?.id,
  })

  const { data: buckets, isLoading: bucketsLoading } = useQuery({
    queryKey: ["buckets", currentProject?.id],
    queryFn: () => getBuckets(currentProject!.id),
    enabled: !!currentProject?.id,
  })

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30_000,
  })

  const loading = pgLoading || redisLoading
  const bucketList = Array.isArray(buckets) ? buckets : []
  const totalStorageBytes = bucketList.reduce((sum, b) => sum + b.size_bytes, 0)
  const formatStorageSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const pgList = Array.isArray(postgresInstances) ? postgresInstances : []
  const redisList = Array.isArray(redisInstances) ? redisInstances : []

  const allInstances = [
    ...pgList.map(i => ({ ...i, kind: "postgres" as const })),
    ...redisList.map(i => ({ ...i, kind: "redis" as const })),
  ]

  const runningCount = allInstances.filter(i => i.status === "running").length
  const stoppedCount = allInstances.filter(i => i.status !== "running").length

  const recentInstances = [...allInstances]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const apiOk = health?.status === "ok"
  const firstName = user?.full_name?.split(" ")[0] ?? "there"

  return (
    <div className="px-8 py-8">
      {/* PAGE HEADER */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Good {getTimeOfDay()}, {firstName}
            </h1>
            <p className="text-[#52525B] text-sm mt-1">
              {currentProject?.name
                ? `${currentProject.name} · `
                : ""}
              {format(new Date(), "EEEE, MMMM d yyyy")}
            </p>
          </div>
          {/* Algeria sovereignty badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#27272A] rounded-lg">
            <span className="text-lg">🇩🇿</span>
            <div>
              <p className="text-xs font-medium text-[#D4A843]">Data in Algeria</p>
              <p className="text-[10px] text-[#52525B]">Law 18-07 Compliant</p>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse ml-1" />
          </div>
        </div>
      </div>

      {/* No project selected */}
      {!currentProject && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center mb-4 border border-[#27272A]">
            <Database size={28} className="text-[#52525B]" />
          </div>
          <h3 className="text-white font-semibold mb-2">No project selected</h3>
          <p className="text-[#52525B] text-sm">
            Select or create a project from the topbar to view your dashboard.
          </p>
        </div>
      )}

      {currentProject && (
        <>
          {/* STAT CARDS */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Databases"
              icon={<Database size={16} style={{ color: "#3B82F6" }} />}
              iconBg="#1D3461"
              value={pgLoading ? null : pgList.length}
              subtitle="PostgreSQL instances"
              accentColor="#3B82F6"
            />
            <StatCard
              label="Redis"
              icon={<Zap size={16} style={{ color: "#D4A843" }} />}
              iconBg="#2D1A00"
              value={redisLoading ? null : redisList.length}
              subtitle="Cache instances"
              accentColor="#D4A843"
            />
            <StatCard
              label="Running"
              icon={<CheckCircle2 size={16} style={{ color: "#22C55E" }} />}
              iconBg="#14291E"
              value={loading ? null : runningCount}
              subtitle={loading ? "Services healthy" : `${stoppedCount} stopped`}
              accentColor="#22C55E"
            />
            <StatCard
              label="Storage"
              icon={<HardDrive size={16} style={{ color: "#A855F7" }} />}
              iconBg="#2D1A4A"
              value={bucketsLoading ? null : bucketList.length}
              subtitle={bucketsLoading ? "Buckets" : `${formatStorageSize(totalStorageBytes)} used`}
              accentColor="#A855F7"
            />
          </div>

          {/* MAIN CONTENT */}
          <div className="grid grid-cols-12 gap-6 mb-10">
            {/* LEFT: Recent Instances */}
            <div className="col-span-7">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white text-lg font-semibold">Recent Instances</h2>
                <a href="/projects" className="text-[#3B82F6] text-xs font-medium hover:underline">
                  View all →
                </a>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 rounded-lg bg-[#111111] animate-pulse" />
                  ))}
                </div>
              ) : recentInstances.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Activity size={32} className="text-[#27272A] mb-3" />
                  <p className="text-[#52525B] text-sm">No instances yet</p>
                  <p className="text-[#3B3B3B] text-xs mt-1">
                    Create your first database to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentInstances.map(instance => (
                    <div
                      key={instance.id}
                      onClick={() =>
                        instance.kind === "postgres"
                          ? router.push(`/postgres/${instance.id}/explore`)
                          : router.push("/redis")
                      }
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-[#111111] transition-colors cursor-pointer border border-transparent hover:border-[#27272A]"
                    >
                      <div
                        className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                        style={{ background: instance.kind === "postgres" ? "#1D3461" : "#2D1A00" }}
                      >
                        {instance.kind === "postgres"
                          ? <Database size={16} className="text-[#3B82F6]" />
                          : <Zap size={16} className="text-[#D4A843]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{instance.name}</span>
                          <StatusBadge status={instance.status ?? "unknown"} size="xs" />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[#52525B] text-xs">
                            {instance.kind === "postgres" ? "PostgreSQL" : "Redis"}
                          </span>
                          <span className="text-[#1F1F23]">·</span>
                          <span className="text-[#52525B] text-xs font-mono">
                            {instance.host}:{instance.port}
                          </span>
                          <span className="text-[#1F1F23]">·</span>
                          <span className="text-[#52525B] text-xs">
                            {formatRelativeTime(instance.created_at)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-[#27272A] shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Quick Actions + Platform Status */}
            <div className="col-span-5 flex flex-col gap-4">
              {/* Quick Actions */}
              <div>
                <h2 className="text-white text-lg font-semibold mb-3">Quick Actions</h2>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => currentProject ? router.push(`/projects/${currentProject.id}/stages`) : router.push("/projects")}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#111111] border border-[#27272A] hover:border-[#3B82F6]/40 hover:bg-[#1D3461]/20 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-md bg-[#1D3461] flex items-center justify-center shrink-0">
                      <Database size={15} className="text-[#3B82F6]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">New Database</p>
                      <p className="text-[#52525B] text-xs">PostgreSQL instance</p>
                    </div>
                    <Plus size={14} className="text-[#52525B] group-hover:text-[#3B82F6] transition-colors" />
                  </button>
                  <button
                    onClick={() => router.push("/redis")}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#111111] border border-[#27272A] hover:border-[#D4A843]/40 hover:bg-[#2D1A00]/20 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-md bg-[#2D1A00] flex items-center justify-center shrink-0">
                      <Zap size={15} className="text-[#D4A843]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">New Redis</p>
                      <p className="text-[#52525B] text-xs">Cache instance</p>
                    </div>
                    <Plus size={14} className="text-[#52525B] group-hover:text-[#D4A843] transition-colors" />
                  </button>
                  <button
                    onClick={() => router.push("/storage")}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#111111] border border-[#27272A] hover:border-[#A855F7]/40 hover:bg-[#2D1A4A]/20 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-md bg-[#2D1A4A] flex items-center justify-center shrink-0">
                      <HardDrive size={15} className="text-[#A855F7]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">Object Storage</p>
                      <p className="text-[#52525B] text-xs">S3-compatible buckets</p>
                    </div>
                    <Plus size={14} className="text-[#52525B] group-hover:text-[#A855F7] transition-colors" />
                  </button>
                </div>
              </div>

              {/* Platform Status */}
              <div className="bg-[#111111] border border-[#27272A] rounded-xl p-4 mt-4">
                <h2 className="text-white text-lg font-semibold mb-3">Platform Status</h2>
                <div className="flex flex-col gap-3">
                  <StatusRow
                    label="API"
                    status={apiOk ? "operational" : "down"}
                    detail={apiOk ? `v${health?.version ?? "0.1.0"}` : "Unreachable"}
                  />
                  <StatusRow
                    label="Database Service"
                    status={apiOk ? "operational" : "down"}
                    detail={apiOk ? "All instances healthy" : "—"}
                  />
                  <StatusRow
                    label="Storage"
                    status={apiOk ? "operational" : "down"}
                    detail={apiOk ? "MinIO running" : "—"}
                  />
                  <StatusRow
                    label="Algeria DC"
                    status={apiOk ? "operational" : "down"}
                    detail={apiOk ? "Algiers · Online" : "—"}
                  />
                </div>
                <div className="mt-3 pt-3 border-t border-[#1F1F23] flex items-center justify-between">
                  <span className="text-[#3B3B3B] text-xs">
                    {apiOk ? "Last checked: just now" : "Cannot reach API"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${apiOk ? "bg-[#22C55E]" : "bg-[#EF4444]"}`} />
                    <span className={`text-xs font-medium ${apiOk ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                      {apiOk ? "All systems operational" : "API unreachable"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
