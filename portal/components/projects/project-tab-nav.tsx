"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Server, Key } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  projectId: string
}

export function ProjectTabNav({ projectId }: Props) {
  const pathname = usePathname()

  const tabs = [
    {
      href: `/projects/${projectId}`,
      label: "Instances",
      icon: Server,
      exact: true,
    },
    {
      href: `/projects/${projectId}/api`,
      label: "API & Keys",
      icon: Key,
      exact: false,
    },
  ]

  return (
    <div className="border-b border-[#1F1F23] px-6 lg:px-8 flex items-center gap-0">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors",
              "border-b-2 -mb-px",
              active
                ? "text-white border-[#3B82F6]"
                : "text-[#52525B] border-transparent hover:text-[#A1A1AA]"
            )}
          >
            <Icon size={14} />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
