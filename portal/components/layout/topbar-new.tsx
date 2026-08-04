"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Cloud, ChevronDown, Settings, LogOut, Menu } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { me } from "@/lib/api"
import { removeToken, getToken } from "@/lib/auth"
import { ProjectSwitcher } from "./project-switcher"
import { StageSwitcher } from "./stage-switcher"

interface TopBarProps {
  onCreateProject: () => void
  onMenuClick?: () => void
}

export function TopBar({ onCreateProject, onMenuClick }: TopBarProps) {
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  // Start false to match SSR (window undefined). After hydration, update from localStorage.
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setIsLoggedIn(getToken() !== null)
  }, [])

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: me,
    enabled: isLoggedIn,
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [userMenuOpen])

  function handleLogout() {
    removeToken()
    const landingURL = process.env.NEXT_PUBLIC_LANDING_URL
    if (landingURL && typeof window !== "undefined" && !landingURL.includes(window.location.hostname)) {
      window.location.href = landingURL
    } else {
      router.push("/login")
    }
  }

  function getInitials(name?: string): string {
    if (!name) return "?"
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-[52px] bg-[#0D0D10] border-b border-[#1E1E24] z-40 flex items-center px-4">
      {/* Mobile menu button */}
      {isLoggedIn && onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden mr-3 p-1.5 rounded-md hover:bg-[#1A1A1A] transition-colors"
        >
          <Menu size={20} className="text-[#A1A1AA]" />
        </button>
      )}

      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <Link href="/projects" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-md bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center">
            <Cloud size={15} className="text-[#D4A843]" />
          </div>
          <span className="text-[#FAFAFA] text-sm font-semibold hidden sm:block">
            Massi<span className="text-[#D4A843]">Cloud</span>
          </span>
        </Link>

        {/* Separator */}
        <div className="h-5 w-px bg-[#1E1E24] mx-1 hidden sm:block" />

        {/* Project Switcher */}
        {isLoggedIn && <ProjectSwitcher onCreateClick={onCreateProject} />}

        {/* Stage Switcher */}
        {isLoggedIn && (
          <>
            <div className="h-4 w-px bg-[#27272A] hidden sm:block" />
            <StageSwitcher />
          </>
        )}
      </div>

      {/* Center - empty */}
      <div className="flex-1" />

      {/* Right section - User menu */}
      {isLoggedIn && user && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[#18181B] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#D4A843]/15 border border-[#D4A843]/25 flex items-center justify-center">
              <span className="text-[#D4A843] text-[10px] font-bold">
                {getInitials(user.full_name)}
              </span>
            </div>
            <span className="text-[#E4E4E7] text-[13px] hidden md:block">
              {user.full_name}
            </span>
            <ChevronDown size={13} className="text-[#3F3F46]" />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-[#111113] border border-[#27272A] rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.7)] z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="p-1">
                <button
                  onClick={() => {
                    setUserMenuOpen(false)
                    router.push("/settings")
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[#A1A1AA] hover:text-white hover:bg-[#18181B] rounded-md transition-colors text-sm"
                >
                  <Settings size={14} />
                  My Account
                </button>
              </div>
              <div className="border-t border-[#1E1E24]" />
              <div className="p-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[#A1A1AA] hover:text-[#EF4444] hover:bg-[#EF4444]/8 rounded-md transition-colors text-sm"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
