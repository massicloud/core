import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "danger"
  | "gold";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  secondary: "bg-[#1A1A1A] text-[#FAFAFA] border-[#27272A]",
  outline: "bg-transparent text-[#A1A1AA] border-[#27272A]",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  danger: "bg-red-500/15 text-red-300 border-red-500/30",
  gold: "bg-[#D4A843]/15 text-[#D4A843] border-[#D4A843]/30",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

