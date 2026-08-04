"use client";

import type { ReactNode } from "react";
import { ShellProvider } from "@/components/layout/shell-context";
import { Sidebar } from "@/components/layout/sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <ShellProvider>
      <div className="min-h-dvh bg-[#0A0A0A] text-[#FAFAFA] md:h-dvh md:overflow-hidden">
        <Sidebar />
        <main className="min-h-dvh md:h-dvh md:overflow-hidden md:pl-[240px]">{children}</main>
      </div>
    </ShellProvider>
  );
}

