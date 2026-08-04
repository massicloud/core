"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Home, RefreshCw, TriangleAlert } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-red-500/[0.08] border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <TriangleAlert size={20} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-[#71717A] text-sm mb-6">
          {error.message ?? "An unexpected error occurred."}
        </p>
        <div className="flex items-center gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] text-[#A1A1AA] hover:text-white text-sm rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </button>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4A843] hover:bg-[#D4A843]/90 text-[#0A0A0A] text-sm font-semibold rounded-lg transition-colors"
          >
            <Home size={14} />
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
