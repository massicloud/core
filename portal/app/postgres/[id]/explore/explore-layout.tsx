"use client"

import React from "react"

export function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-[#0A0A0A] md:flex-row md:overflow-hidden">
      {children}
    </div>
  )
}

