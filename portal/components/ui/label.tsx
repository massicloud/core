import * as React from "react";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-[#A1A1AA]", className)} {...props} />;
}

