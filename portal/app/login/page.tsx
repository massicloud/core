"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { login, getErrorMessage } from "@/lib/api"
import { setToken, getSavedEmail, saveRememberEmail, clearRememberEmail } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Cloud, AlertCircle, Eye, EyeOff } from "lucide-react"

// Only ever redirect back to a same-site path — an unvalidated `redirect`
// query param would otherwise be an open-redirect vector.
function safeRedirect(target: string | null): string {
  if (!target) return "/dashboard"
  if (!target.startsWith("/") || target.startsWith("//")) return "/dashboard"
  return target
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [expired, setExpired] = useState(false)
  // Query params are browser-only state here on purpose: reading them via
  // useSearchParams() would force this otherwise-static page through a
  // Suspense boundary, and Next ships those as an empty shell on first
  // load (BAILOUT_TO_CLIENT_SIDE_RENDERING) until JS hydrates — i.e. a
  // blank page. Plain window.location keeps the page fully server-rendered.
  const redirectTarget = useRef<string | null>(null)

  // Pre-fill saved email on mount
  useEffect(() => {
    const saved = getSavedEmail()
    if (saved) {
      setEmail(saved)
      setRememberMe(true)
    }
    const params = new URLSearchParams(window.location.search)
    setExpired(params.get("reason") === "expired")
    redirectTarget.current = params.get("redirect")
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const response = await login(email, password)
      if (rememberMe) {
        saveRememberEmail(email)
      } else {
        clearRememberEmail()
      }
      setToken(response.token, rememberMe)
      router.push(safeRedirect(redirectTarget.current))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#D4A843]/[0.04] rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/20 mb-5">
            <Cloud size={20} className="text-[#D4A843]" />
          </div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-[#71717A] text-sm mt-1">Sign in to your MassiCloud account</p>
        </div>

        <div className="bg-[#111113] border border-[#27272A] rounded-xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {expired && !error && (
            <div className="flex items-start gap-2.5 bg-[#D4A843]/8 border border-[#D4A843]/20 rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle size={14} className="text-[#D4A843] shrink-0 mt-0.5" />
              <span className="text-[#D4A843] text-xs leading-relaxed">
                Your session expired. Please sign in again.
              </span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[#A1A1AA] text-xs font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-[#18181B] border-[#27272A] text-white placeholder:text-[#3F3F46] h-10"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[#A1A1AA] text-xs font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-[#18181B] border-[#27272A] text-white placeholder:text-[#3F3F46] h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3F3F46] hover:text-[#A1A1AA] transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer group select-none">
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                  rememberMe
                    ? "bg-[#D4A843] border-[#D4A843]"
                    : "bg-[#18181B] border-[#3F3F46] group-hover:border-[#52525B]"
                }`}
                onClick={() => setRememberMe((v) => !v)}
              >
                {rememberMe && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="#09090B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="text-xs text-[#71717A] group-hover:text-[#A1A1AA] transition-colors">
                Remember me for 30 days
              </span>
            </label>

            {error && (
              <div className="flex items-start gap-2.5 bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-lg px-3 py-2.5">
                <AlertCircle size={14} className="text-[#EF4444] shrink-0 mt-0.5" />
                <span className="text-[#EF4444] text-xs leading-relaxed">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#D4A843] hover:bg-[#D4A843]/90 disabled:opacity-50 text-[#09090B] text-sm font-semibold rounded-lg transition-all flex items-center justify-center"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#09090B]/25 border-t-[#09090B] rounded-full animate-spin" />
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-[#1F1F23] text-center">
            <p className="text-[#52525B] text-xs">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-[#A1A1AA] hover:text-white transition-colors underline underline-offset-2"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-[#3F3F46] text-[11px] mt-6 tracking-wide">
          Algerian Sovereign Cloud · Law 18-07 Compliant
        </p>
      </div>
    </div>
  )
}
