import Link from "next/link"
import { Home, AlertCircle } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-[#1A1A1A] border border-[#27272A] flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={22} className="text-[#3F3F46]" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-[#71717A] text-sm mb-6">
          This page doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4A843] hover:bg-[#D4A843]/90 text-[#0A0A0A] text-sm font-semibold rounded-lg transition-colors"
        >
          <Home size={14} />
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
