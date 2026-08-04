"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Table2, X, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import { useExplorer, type ExplorerTab } from "@/lib/explorer-context"
import { ExportButton } from "@/components/explorer/export-button"

// ── Simple custom context menu (no extra package needed) ──────────────────────

interface CtxMenu {
  x: number
  y: number
  tabId: string
}

function ContextMenu({
  menu,
  onClose,
}: {
  menu: CtxMenu
  onClose: () => void
}) {
  const { closeTab, closeOtherTabs, closeAllTabs } = useExplorer()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  const item = (label: string, action: () => void) => (
    <button
      key={label}
      onClick={() => { action(); onClose() }}
      className="flex w-full items-center px-3 py-1.5 text-xs text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1A] transition-colors text-left"
    >
      {label}
    </button>
  )

  return (
    <div
      ref={ref}
      style={{ top: menu.y, left: menu.x }}
      className="fixed z-50 min-w-[160px] rounded-md border border-[#27272A] bg-[#111111] shadow-[0_8px_24px_rgba(0,0,0,0.6)] py-1"
    >
      {item("Close", () => closeTab(menu.tabId))}
      {item("Close Others", () => closeOtherTabs(menu.tabId))}
      {item("Close All", () => closeAllTabs())}
    </div>
  )
}

// ── Single tab item ───────────────────────────────────────────────────────────

function TabItem({
  tab,
  isActive,
  currentSchema,
  onContextMenu,
}: {
  tab: ExplorerTab
  isActive: boolean
  currentSchema: string
  onContextMenu: (e: React.MouseEvent, tabId: string) => void
}) {
  const { setActiveTab, closeTab } = useExplorer()

  const label =
    tab.type === "overview"
      ? "Overview"
      : tab.state.schema !== currentSchema
      ? `${tab.state.schema}.${tab.state.tableName}`
      : tab.state.tableName

  const Icon = tab.type === "overview" ? LayoutGrid : Table2

  return (
    <div
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(tab.id)}
      onMouseDown={(e) => {
        // Middle-click closes
        if (e.button === 1) { e.preventDefault(); closeTab(tab.id) }
      }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, tab.id) }}
      className={cn(
        "group flex items-center gap-1.5 h-full px-3 cursor-pointer",
        "border-r border-[#1F1F23] shrink-0 select-none relative",
        "transition-colors min-w-[110px] max-w-[180px]",
        isActive
          ? "bg-[#111111] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#3B82F6]"
          : "hover:bg-[#0F0F0F]"
      )}
    >
      <Icon
        size={12}
        className={cn("shrink-0 transition-colors", isActive ? "text-[#3B82F6]" : "text-[#52525B]")}
      />
      <span
        className={cn(
          "text-xs truncate flex-1 transition-colors",
          tab.type === "table" && "font-mono",
          isActive ? "text-white" : "text-[#A1A1AA]"
        )}
      >
        {label}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
        className={cn(
          "shrink-0 w-4 h-4 flex items-center justify-center rounded transition-all",
          isActive
            ? "text-[#52525B] hover:text-white hover:bg-[#27272A]"
            : "text-transparent group-hover:text-[#52525B] hover:!text-white hover:!bg-[#27272A]"
        )}
        aria-label="Close tab"
      >
        <X size={10} />
      </button>
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

export function TabBar({ instanceId }: { instanceId: string }) {
  const { tabs, activeTabId, setActiveTab, closeTab, openOverview, currentSchema } = useExplorer()
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleCtxMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, tabId })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return

      // Cmd+W → close active tab
      if (e.key === "w") {
        e.preventDefault()
        if (activeTabId) closeTab(activeTabId)
        return
      }

      // Cmd+1…9 → jump to nth tab
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= 9 && tabs[num - 1]) {
        e.preventDefault()
        setActiveTab(tabs[num - 1].id)
        return
      }

      // Cmd+Shift+] → next tab
      if (e.shiftKey && e.key === "]") {
        e.preventDefault()
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        const next = tabs[(idx + 1) % tabs.length]
        if (next) setActiveTab(next.id)
        return
      }

      // Cmd+Shift+[ → previous tab
      if (e.shiftKey && e.key === "[") {
        e.preventDefault()
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length]
        if (prev) setActiveTab(prev.id)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [activeTabId, tabs, closeTab, setActiveTab])

  // Scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tabid="${activeTabId}"]`)
    el?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeTabId])

  return (
    <>
      <div className="flex items-stretch h-9 bg-[#0A0A0A] border-b border-[#1F1F23] shrink-0">
        {/* Scrollable tab list */}
        <div
          ref={scrollRef}
          className="flex items-stretch overflow-x-auto flex-1 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {tabs.length === 0 ? (
            <div className="flex items-center gap-2 px-4 text-xs text-[#52525B]">
              Click a table in the sidebar to open it here
            </div>
          ) : (
            tabs.map((tab) => (
              <div key={tab.id} data-tabid={tab.id} className="flex h-full">
                <TabItem
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  currentSchema={currentSchema}
                  onContextMenu={handleCtxMenu}
                />
              </div>
            ))
          )}
        </div>

        {/* Overview button */}
        <button
          onClick={openOverview}
          title="Open schema overview"
          className="flex items-center gap-1.5 px-3 h-full shrink-0 text-[#52525B] hover:text-white hover:bg-[#111111] border-l border-[#1F1F23] transition-colors"
        >
          <LayoutGrid size={12} />
          <span className="text-xs">Overview</span>
        </button>

        {/* Export / Import */}
        <div className="flex items-center px-2 border-l border-[#1F1F23]">
          <ExportButton instanceId={instanceId} />
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />
      )}
    </>
  )
}
