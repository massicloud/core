"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { AppShellNew } from "./app-shell-new"

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset"]

interface ConditionalShellProps {
  children: ReactNode
}

export function ConditionalShell({ children }: ConditionalShellProps) {
  const pathname = usePathname()
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  if (isPublicRoute) {
    return <>{children}</>
  }

  return <AppShellNew>{children}</AppShellNew>
}
