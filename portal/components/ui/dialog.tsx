import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, children }: DialogProps) {
  if (!open) {
    return null;
  }

  return <>{children}</>;
}

export function DialogContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-[#27272A] bg-[#111111]", className)}>{children}</div>;
}

export function DialogHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("space-y-2 text-left", className)}>{children}</div>;
}

export function DialogFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex items-center justify-end gap-3", className)}>{children}</div>;
}

export function DialogTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn("text-xl font-semibold text-[#FAFAFA]", className)}>{children}</h2>;
}

export function DialogDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-sm text-[#A1A1AA]", className)}>{children}</p>;
}

export function DialogTrigger({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function DialogClose({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

