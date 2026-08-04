"use client"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConnectionRowProps {
    label: string
    value: string
    onCopy: () => void
    copied: boolean
    isLast?: boolean
}

export function ConnectionRow({
                                  label,
                                  value,
                                  onCopy,
                                  copied,
                                  isLast,
                              }: ConnectionRowProps) {
    return (
        <div
            className={cn(
                "flex items-center justify-between py-1.5",
                !isLast && "border-b border-[#1F1F23]"
            )}
        >
            <span className="text-[#52525B] text-xs w-20 shrink-0">{label}</span>
            <span className="text-[#A1A1AA] text-xs font-mono flex-1 mx-3 truncate">{value}</span>
            <button
                onClick={onCopy}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-[#1A1A1A] transition-colors text-[#52525B] hover:text-[#A1A1AA]"
            >
                {copied ? <Check size={11} className="text-[#22C55E]" /> : <Copy size={11} />}
            </button>
        </div>
    )
}
