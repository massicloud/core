import Link from "next/link"
import { ChevronRight } from "lucide-react"

export interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-[#52525B]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={10} className="text-[#3B3B3B] shrink-0" />}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-white transition-colors truncate max-w-[140px]"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[#A1A1AA] truncate max-w-[140px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
