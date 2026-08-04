import * as React from "react";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="range"
        className={cn("h-2 w-full cursor-pointer appearance-none rounded-full bg-[#27272A] accent-blue-500", className)}
        {...props}
      />
    );
  },
);
Slider.displayName = "Slider";

