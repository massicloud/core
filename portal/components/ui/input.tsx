import * as React from "react";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[#27272A] bg-[#1A1A1A] px-3 py-2 text-sm text-[#FAFAFA] placeholder:text-[#52525B] focus-visible:border-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30 aria-[invalid=true]:border-[#EF4444] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

