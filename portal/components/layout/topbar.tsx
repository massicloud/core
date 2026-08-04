"use client";

import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useShell } from "@/components/layout/shell-context";

interface TopbarProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function Topbar({ title, description, actions, className }: TopbarProps) {
  const { setMobileNavOpen } = useShell();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-[#27272A] bg-[#0A0A0A]/90 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-[#FAFAFA]">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 truncate text-sm text-[#A1A1AA]">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">{actions}</div>
      </div>
    </header>
  );
}

