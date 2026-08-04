import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  eyebrowIcon?: LucideIcon
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, eyebrowIcon: Icon, title, description, actions }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#52525B] font-mono uppercase tracking-wider mb-2.5">
            {Icon && <Icon size={10} className="text-[#3F3F46]" />}
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] font-bold text-white tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-[#71717A] mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
