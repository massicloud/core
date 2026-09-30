"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { confirmPasswordReset, getErrorMessage } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Cloud, AlertCircle, CheckCircle2 } from "lucide-react"

const MIN_PASSWORD_LENGTH = 8

function ResetForm() {
  const router = useRouter()
  const token = useSearchParams().get("token")?.trim() ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => router.push("/login"), 2000)
    return () => clearTimeout(t)
  }, [done, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setLoading(true)
    try {
      await confirmPasswordReset(token, password)
      setDone(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    "bg-[#18181B] border-[#27272A] text-white placeholder:text-[#3F3F46] h-10"

  return (
    <div className="bg-[#111113] border border-[#27272A] rounded-xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      {!token ? (
        <div className="space-y-4 text-center">
          <div className="flex items-start gap-2.5 bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-lg px-3 py-2.5 text-left">
            <AlertCircle size={14} className="text-[#EF4444] shrink-0 mt-0.5" />
            <span className="text-[#EF4444] text-xs leading-relaxed">
              Invalid reset link. Request a new one to continue.
            </span>
          </div>
          <Link
            href="/forgot-password"
            className="inline-block text-[#A1A1AA] hover:text-white transition-colors underline underline-offset-2 text-xs"
          >
            Request a new reset link
          </Link>
        </div>
      ) : done ? (
        <div className="flex items-start gap-2.5 bg-[#D4A843]/8 border border-[#D4A843]/20 rounded-lg px-3 py-2.5">
          <CheckCircle2 size={14} className="text-[#D4A843] shrink-0 mt-0.5" />
          <span className="text-[#D4A843] text-xs leading-relaxed">
            Password reset successful. Redirecting to login...
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[#A1A1AA] text-xs font-medium">
              New password
            </Label>
            <Input
              id="password"
              type="password"
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-[#A1A1AA] text-xs font-medium">
              Confirm password
            </Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              className={inputClass}
            />
          </div>

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
              "Reset password"
            )}
          </button>
        </form>
      )}

      <div className="mt-5 pt-5 border-t border-[#1F1F23] text-center">
        <Link
          href="/login"
          className="text-[#A1A1AA] hover:text-white transition-colors underline underline-offset-2 text-xs"
        >
          Back to login
        </Link>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
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
          <h1 className="text-[22px] font-bold text-white tracking-tight">Set a new password</h1>
          <p className="text-[#71717A] text-sm mt-1">Choose a new password for your account</p>
        </div>

        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
