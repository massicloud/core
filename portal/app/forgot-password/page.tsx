"use client"

import { useState } from "react"
import Link from "next/link"
import { requestPasswordReset } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Cloud, AlertCircle, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch {
      // Deliberately generic — never surface server details on this flow.
      setError("Something went wrong. Please try again.")
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
          <h1 className="text-[22px] font-bold text-white tracking-tight">Reset your password</h1>
          <p className="text-[#71717A] text-sm mt-1">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <div className="bg-[#111113] border border-[#27272A] rounded-xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {sent ? (
            <div className="flex items-start gap-2.5 bg-[#D4A843]/8 border border-[#D4A843]/20 rounded-lg px-3 py-2.5">
              <CheckCircle2 size={14} className="text-[#D4A843] shrink-0 mt-0.5" />
              <span className="text-[#D4A843] text-xs leading-relaxed">
                If an account exists for this email, a password reset link has been sent. Check
                your inbox — the link expires in 1 hour.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  "Send reset link"
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
      </div>
    </div>
  )
}
