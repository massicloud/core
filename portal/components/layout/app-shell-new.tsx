"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  X,
  Layers,
  HardDrive,
  Settings,
  Boxes,
  KeyRound,
} from "lucide-react"
import { TopBar } from "./topbar-new"
import { LeftSidebar } from "./left-sidebar"
import { ProvisioningBanner } from "./provisioning-banner"
import { CreateProjectModal } from "@/components/projects/create-project-modal"
import { ProjectProvider } from "@/lib/project-context"
import { StageProvider } from "@/lib/stage-context"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface AppShellProps {
  children: ReactNode
}

const mobileNavItems = [
  { href: "/projects",  label: "Projects",            icon: Layers },
  { href: "#",          label: "Kubernetes Engine",   icon: Boxes,    soon: true },
  { href: "/storage",   label: "Object Storage",      icon: HardDrive },
  { href: "#",          label: "Vaults",              icon: KeyRound, soon: true },
  { href: "/settings",  label: "Settings",            icon: Settings },
]

function AppShellContent({ children }: AppShellProps) {
  const pathname = usePathname()
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-[#09090B] text-[#FAFAFA]">
      <TopBar
        onCreateProject={() => setCreateProjectOpen(true)}
        onMenuClick={() => setMobileNavOpen(true)}
      />

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <LeftSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-[#0D0D0D] border-r border-[#1F1F23] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between h-[52px] px-4 border-b border-[#1F1F23] shrink-0">
              <span className="text-[#D4A843] text-sm font-semibold">
                MassiCloud
              </span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 rounded-md hover:bg-[#1A1A1A] transition-colors"
              >
                <X size={18} className="text-[#A1A1AA]" />
              </button>
            </div>
            <nav className="flex-1 py-4 overflow-y-auto">
              {mobileNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.soon ? "#" : item.href}
                    onClick={(e) => {
                      if (item.soon) {
                        e.preventDefault()
                      } else {
                        setMobileNavOpen(false)
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2.5 w-full h-11 px-4 text-[14px] font-medium transition-all duration-150",
                      "border-l-[3px]",
                      isActive
                        ? "border-l-[#3B82F6] bg-transparent text-[#3B82F6]"
                        : "border-l-transparent text-[#6B7280] hover:bg-[#1A1A1A] hover:text-[#FAFAFA]",
                      item.soon && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.soon && (
                      <Badge variant="gold" className="text-[10px] px-1.5 py-0">
                        Soon
                      </Badge>
                    )}
                  </Link>
                )
              })}
            </nav>
            <div className="px-4 py-3 border-t border-[#1F1F23] space-y-1.5 shrink-0">
              <div className="text-[11px] text-[#D4A843] flex items-center gap-1.5">
                <span>🇩🇿</span>
                <span>Data stored in Algeria</span>
              </div>
              <div className="text-[11px] text-[#22C55E]">
                Law 18-07 Compliant
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="md:ml-[248px] pt-[52px] min-h-dvh overflow-x-hidden">
        <ProvisioningBanner />
        {children}
      </main>

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
      />
    </div>
  )
}

export function AppShellNew({ children }: AppShellProps) {
  return (
    <ProjectProvider>
      <StageProvider>
        <AppShellContent>{children}</AppShellContent>
      </StageProvider>
    </ProjectProvider>
  )
}
