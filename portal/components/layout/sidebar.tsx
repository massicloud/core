"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  Cloud,
  Folder,
  HardDrive,
  Settings,
  LogOut,
  X,
  Database,
  Zap,
  KeyRound,
  Boxes,
  BookOpen,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useShell } from "@/components/layout/shell-context"
import { removeToken } from "@/lib/auth"

type NavItem = {
  href?: string
  label: string
  icon: LucideIcon
  soon?: boolean
  /** Extra path prefixes that should make this item active */
  matchPaths?: string[]
}

type NavSection = {
  label: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    label: "Compute",
    items: [{ label: "Kubernetes Engine", icon: Boxes, soon: true }],
  },
  {
    label: "Databases",
    items: [
      {
        href: "/databases",
        label: "PostgreSQL",
        icon: Database,
        matchPaths: ["/databases", "/postgres"],
      },
      { label: "MongoDB", icon: Database, soon: true },
    ],
  },
  {
    label: "Cache",
    items: [{ href: "/redis", label: "Redis", icon: Zap }],
  },
  {
    label: "Storage",
    items: [
      { href: "/storage", label: "Object Storage", icon: HardDrive },
      { label: "Vaults", icon: KeyRound, soon: true },
    ],
  },
]

function isItemActive(item: NavItem, pathname: string): boolean {
  if (!item.href) return false
  if (item.matchPaths) {
    return item.matchPaths.some((p) => pathname.startsWith(p))
  }
  return pathname.startsWith(item.href)
}

function SidebarContent() {
  const pathname = usePathname()
  const router = useRouter()
  const { setMobileNavOpen } = useShell()

  function handleLogout() {
    removeToken()
    router.push("/login")
  }

  return (
    <div className="relative flex h-full flex-col border-r border-[#27272A] bg-[#111111] text-[#FAFAFA]">
      {/* Background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(59,130,246,0.95) 0 2px, transparent 2px 18px), repeating-linear-gradient(-45deg, rgba(212,168,67,0.95) 0 2px, transparent 2px 18px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 md:px-6">
          <Link
            href="/projects"
            className="flex items-center gap-3"
            onClick={() => setMobileNavOpen(false)}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20">
              <Cloud className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-[#D4A843]">
              MassiCloud
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-3">
          <Separator />
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {sections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#3B3B3B]">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isItemActive(item, pathname)
                  const Icon = item.icon

                  if (item.soon || !item.href) {
                    return (
                      <li key={item.label}>
                        <div
                          className={cn(
                            "flex w-full items-center gap-3 border-l-[3px] border-l-transparent",
                            "px-3 py-2.5 text-sm text-[#3B3B3B] cursor-not-allowed select-none"
                          )}
                        >
                          <Icon className="h-[16px] w-[16px]" />
                          <span className="flex-1">{item.label}</span>
                          <Badge variant="gold" className="border text-[9px] px-1.5 py-0.5">
                            Soon
                          </Badge>
                        </div>
                      </li>
                    )
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          "flex w-full items-center gap-3 border-l-[3px] px-3 py-2.5 text-sm transition-colors",
                          active
                            ? "border-l-[#3B82F6] bg-[rgba(29,52,97,0.4)] text-[#3B82F6]"
                            : "border-l-transparent text-[#A1A1AA] hover:bg-[#1A1A1A] hover:text-[#FAFAFA]"
                        )}
                      >
                        <Icon className="h-[16px] w-[16px]" />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {/* Docs + Settings at bottom of nav */}
          <div className="mt-2 border-t border-[#1F1F23] pt-3 space-y-0.5">
            <a
              href={`${process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.massicloud.dz"}/get-started/welcome/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 border-l-[3px] border-l-transparent px-3 py-2.5 text-sm transition-colors text-[#A1A1AA] hover:bg-[#1A1A1A] hover:text-[#FAFAFA]"
            >
              <BookOpen className="h-[16px] w-[16px]" />
              <span className="flex-1">Documentation</span>
            </a>
            <Link
              href="/settings"
              onClick={() => setMobileNavOpen(false)}
              className={cn(
                "flex w-full items-center gap-3 border-l-[3px] px-3 py-2.5 text-sm transition-colors",
                pathname.startsWith("/settings")
                  ? "border-l-[#3B82F6] bg-[rgba(29,52,97,0.4)] text-[#3B82F6]"
                  : "border-l-transparent text-[#A1A1AA] hover:bg-[#1A1A1A] hover:text-[#FAFAFA]"
              )}
            >
              <Settings className="h-[16px] w-[16px]" />
              <span className="flex-1">Settings</span>
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="space-y-3 px-5 py-5 md:px-6">
          <Badge variant="gold" className="justify-center border px-3 py-2 text-xs">
            🇩🇿 Data stored in Algeria
          </Badge>
          <Badge variant="success" className="justify-center border px-3 py-2 text-xs">
            Law 18-07 Compliant
          </Badge>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { mobileNavOpen, setMobileNavOpen } = useShell()

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 md:block">
        <SidebarContent />
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-60 max-w-[85vw] shadow-2xl shadow-black/60">
            <SidebarContent />
          </aside>
        </div>
      ) : null}
    </>
  )
}
