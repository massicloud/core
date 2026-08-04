import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "gold";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-sm shadow-blue-500/20",
  secondary:
    "bg-[#1A1A1A] text-[#FAFAFA] border border-[#27272A] hover:bg-[#232323]",
  outline:
    "border border-[#27272A] bg-transparent text-[#A1A1AA] hover:border-[#52525B] hover:bg-[#1A1A1A] hover:text-[#FAFAFA]",
  ghost: "bg-transparent text-[#FAFAFA] hover:bg-[#1A1A1A]",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-500/20",
  gold: "bg-[#D4A843] text-[#0A0A0A] hover:bg-[#c3962a] shadow-sm shadow-[#D4A843]/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-9 px-4 py-2 text-sm",
  sm: "h-9 px-3 rounded-md text-sm",
  lg: "h-11 px-6 rounded-lg text-base",
  icon: "h-10 w-10 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

