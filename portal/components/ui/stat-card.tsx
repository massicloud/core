import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  accent?: 'blue' | 'gold' | 'green' | 'purple' | 'red'
  trend?: { value: string; positive?: boolean }
}

const ACCENT_COLORS = {
  blue:   { ring: '#3B82F6', bg: '#1D3461' },
  gold:   { ring: '#D4A843', bg: '#2D2410' },
  green:  { ring: '#22C55E', bg: '#14291E' },
  purple: { ring: '#A855F7', bg: '#2D1A4A' },
  red:    { ring: '#EF4444', bg: '#2D1414' },
}

export function StatCard({ label, value, icon: Icon, accent = 'blue', trend }: StatCardProps) {
  const colors = ACCENT_COLORS[accent]

  return (
    <div className="bg-[#111113] border border-[#1E1E24] hover:border-[#27272A] rounded-xl p-5 transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: colors.bg }}
          >
            <Icon size={14} style={{ color: colors.ring }} />
          </div>
        )}
      </div>
      <div className="text-[26px] font-bold text-white leading-none mb-1.5">{value}</div>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#52525B]">
        {label}
      </span>
      {trend && (
        <div className={`mt-2 text-[11px] ${trend.positive ? 'text-[#22C55E]' : 'text-[#A1A1AA]'}`}>
          {trend.value}
        </div>
      )}
    </div>
  )
}
