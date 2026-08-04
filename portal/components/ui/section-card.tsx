import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  title?: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({ title, description, icon: Icon, action, children, className }: SectionCardProps) {
  return (
    <div className={cn('bg-[#111113] border border-[#1E1E24] rounded-xl overflow-hidden', className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#1E1E24]">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={13} className="text-[#52525B]" />}
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {description && (
              <span className="text-xs text-[#3F3F46]">· {description}</span>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
