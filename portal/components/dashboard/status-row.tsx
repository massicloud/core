import { cn } from "@/lib/utils"

interface StatusRowProps {
  label: string
  status: "operational" | "degraded" | "down"
  detail: string
}

export function StatusRow({ label, status, detail }: StatusRowProps) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    status === 'operational' ? "bg-[#22C55E] animate-pulse" :
                        status === 'degraded' ? "bg-[#EAB308]" : "bg-[#EF4444]"
                )} />
                <span className="text-[#A1A1AA] text-xs">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[#52525B] text-xs">{detail}</span>
                <span className={cn(
                    "text-xs font-medium",
                    status === 'operational' ? "text-[#22C55E]" :
                        status === 'degraded' ? "text-[#EAB308]" : "text-[#EF4444]"
                )}>
          {status === 'operational' ? 'Operational' :
              status === 'degraded' ? 'Degraded' : 'Down'}
        </span>
            </div>
        </div>
    )
}
