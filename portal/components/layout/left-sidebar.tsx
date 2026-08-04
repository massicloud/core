"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Database,
  HardDrive,
  Layers,
  Settings,
  FileCode,
  Zap,
  LayoutGrid,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useProject } from "@/lib/project-context"
import { useStage } from "@/lib/stage-context"
import { getProjectColor } from "./project-switcher"

// ─── Nav item ────────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon: Icon,
  label,
  matchPaths,
  end,
  iconColor,
}: {
  href: string
  icon: React.ElementType
  label: string
  matchPaths?: string[]
  end?: boolean
  iconColor?: string
}) {
  const pathname = usePathname()
  const active = end
    ? pathname === href
    : matchPaths
    ? matchPaths.some((p) => pathname.startsWith(p))
    : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 h-9 px-3 rounded-lg text-[13px] font-medium transition-all duration-150 mx-2",
        active
          ? "bg-[#D4A843]/[0.08] ring-1 ring-inset ring-[#D4A843]/15 text-[#D4A843]"
          : "text-[#71717A] hover:bg-[#18181B] hover:text-[#E4E4E7]"
      )}
    >
      <Icon
        size={15}
        className={cn(
          "shrink-0 transition-colors",
          active
            ? "text-[#D4A843]"
            : iconColor
            ? ""
            : "text-[#4B5563] group-hover:text-[#9CA3AF]"
        )}
        style={!active && iconColor ? { color: iconColor } : undefined}
      />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <div className={cn(
      "px-5 pb-1 pt-3 flex items-center gap-1.5",
      gold ? "text-[#D4A843]/60" : "text-[#374151]"
    )}>
      {gold && <Layers size={9} className="shrink-0" />}
      <p className="text-[10px] font-semibold tracking-widest uppercase">
        {children}
      </p>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function LeftSidebar() {
  const { currentProject } = useProject()
  const { currentStage } = useStage()

  const pgInstances = (currentStage?.instances ?? []).filter((i) => i.type === "postgres")
  const redisInstances = (currentStage?.instances ?? []).filter((i) => i.type === "redis")

  return (
    <aside className="fixed top-[52px] left-0 bottom-0 w-[248px] bg-[#0D0D10] border-r border-[#1E1E24] z-30 flex flex-col">

      <div className="flex-1 overflow-y-auto pt-3 pb-2 flex flex-col gap-0.5">

        {currentProject ? (
          <>
            {/* Project overview link — replaces the old dropdown */}
            <div className="mb-1 px-2">
              <Link
                href={`/projects/${currentProject.id}`}
                className="flex items-center gap-2.5 h-9 px-3 rounded-lg hover:bg-[#161616] transition-colors group"
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold text-white"
                  style={{ background: getProjectColor(currentProject.id) }}
                >
                  {currentProject.name[0]?.toUpperCase()}
                </div>
                <span className="flex-1 text-[13px] font-medium text-white truncate">
                  {currentProject.name}
                </span>
                <LayoutGrid size={12} className="text-[#374151] group-hover:text-[#52525B] shrink-0" />
              </Link>
            </div>

            {/* Stage section */}
            {currentStage ? (
              <>
                <SectionLabel gold>{currentStage.name}</SectionLabel>

                {/* Postgres instances → Explorer */}
                {pgInstances.map((inst) => (
                  <NavItem
                    key={inst.id}
                    href={`/postgres/${inst.id}/explore`}
                    icon={Database}
                    label={inst.name}
                    matchPaths={[`/postgres/${inst.id}`]}
                    iconColor="#3B82F6"
                  />
                ))}

                {/* Redis instances */}
                {redisInstances.map((inst) => (
                  <NavItem
                    key={inst.id}
                    href={`/redis/${inst.id}`}
                    icon={Zap}
                    label={inst.name}
                    matchPaths={[`/redis/${inst.id}`]}
                    iconColor="#D4A843"
                  />
                ))}

                {/* Empty stage */}
                {pgInstances.length === 0 && redisInstances.length === 0 && (
                  <Link
                    href={`/projects/${currentProject.id}/stages`}
                    className="mx-2 flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] text-[#374151] hover:text-[#52525B] hover:bg-[#161616] transition-all border border-dashed border-[#1F1F23] hover:border-[#27272A]"
                  >
                    <Plus size={11} />
                    Add database
                  </Link>
                )}

                {/* API Spec — stage-scoped */}
                <NavItem
                  href={`/projects/${currentProject.id}/api`}
                  icon={FileCode}
                  label="API Spec"
                />
              </>
            ) : (
              <div className="px-5 py-3 text-[12px] text-[#374151]">
                No stages yet —{" "}
                <Link
                  href={`/projects/${currentProject.id}/stages`}
                  className="text-[#D4A843] hover:underline"
                >
                  create one
                </Link>
              </div>
            )}

            {/* Project-level section */}
            <div className="mx-3 mt-2 mb-1 border-t border-[#1E1E24]" />
            <SectionLabel>Project</SectionLabel>

            <NavItem
              href={`/projects/${currentProject.id}/stages`}
              icon={Layers}
              label="All Stages"
              matchPaths={[`/projects/${currentProject.id}/stages`]}
            />
            <NavItem
              href="/storage"
              icon={HardDrive}
              label="Storage"
              matchPaths={["/storage"]}
            />
            <NavItem
              href={`/projects/${currentProject.id}/settings`}
              icon={Settings}
              label="Settings"
            />
          </>
        ) : (
          <>
            <SectionLabel>Platform</SectionLabel>
            <NavItem href="/storage" icon={HardDrive} label="Storage" />
          </>
        )}
      </div>

      {/* Bottom compliance badges */}
      <div className="border-t border-[#1E1E24] py-3 px-5 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#D4A843]">🇩🇿</span>
          <span className="text-[10px] text-[#374151]">Data stored in Algeria</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
          <span className="text-[10px] text-[#374151]">Law 18-07 Compliant</span>
        </div>
      </div>
    </aside>
  )
}
