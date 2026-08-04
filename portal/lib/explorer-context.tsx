"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type InnerTab = "data" | "sql" | "schema" | "indexes"

export interface TableTabState {
  tableName: string
  schema: string
  innerTab: InnerTab
  sqlContent: string
}

export interface OverviewTabState {
  schema: string
}

export type ExplorerTab =
  | { type: "overview"; id: "overview"; state: OverviewTabState }
  | { type: "table"; id: string; state: TableTabState }

interface ExplorerState {
  tabs: ExplorerTab[]
  activeTabId: string | null
  currentSchema: string
}

interface ExplorerContextType {
  tabs: ExplorerTab[]
  activeTabId: string | null
  activeTab: ExplorerTab | null
  currentSchema: string

  openTable: (tableName: string, schema: string) => void
  openSqlForTable: (tableName: string, schema: string) => void
  openOverview: () => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setSchema: (schema: string) => void

  updateTableState: (id: string, partial: Partial<TableTabState>) => void
  reorderTabs: (fromIdx: number, toIdx: number) => void
  closeOtherTabs: (keepId: string) => void
  closeAllTabs: () => void
}

// ──────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────

function makeTableTab(tableName: string, schema: string): ExplorerTab {
  return {
    type: "table",
    id: `${schema}.${tableName}`,
    state: {
      tableName,
      schema,
      innerTab: "data",
      sqlContent: `SELECT *\nFROM ${schema}.${tableName}\nLIMIT 50;`,
    },
  }
}

function defaultState(): ExplorerState {
  return {
    tabs: [{ type: "overview", id: "overview", state: { schema: "public" } }],
    activeTabId: "overview",
    currentSchema: "public",
  }
}

// ──────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────

const ExplorerContext = createContext<ExplorerContextType | null>(null)

export function ExplorerProvider({
  instanceId,
  children,
}: {
  instanceId: string
  children: React.ReactNode
}) {
  const storageKey = `massicloud:explorer:${instanceId}`

  const [state, setState] = useState<ExplorerState>(() => {
    if (typeof window === "undefined") return defaultState()
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved) as ExplorerState
    } catch {
      // ignore parse errors
    }
    return defaultState()
  })

  // Persist whenever state changes (debounced via ref to avoid stale closure)
  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // ignore storage errors (private browsing, quota, etc.)
    }
  }, [state, storageKey])

  const openOverview = useCallback(() => {
    setState((prev) => {
      const exists = prev.tabs.some((t) => t.id === "overview")
      if (exists) return { ...prev, activeTabId: "overview" }
      const tab: ExplorerTab = {
        type: "overview",
        id: "overview",
        state: { schema: prev.currentSchema },
      }
      return { ...prev, tabs: [tab, ...prev.tabs], activeTabId: "overview" }
    })
  }, [])

  const openTable = useCallback((tableName: string, schema: string) => {
    const id = `${schema}.${tableName}`
    setState((prev) => {
      const exists = prev.tabs.some((t) => t.id === id)
      if (exists) return { ...prev, activeTabId: id }
      return {
        ...prev,
        tabs: [...prev.tabs, makeTableTab(tableName, schema)],
        activeTabId: id,
      }
    })
  }, [])

  // Opens the table tab and immediately switches to the SQL inner tab
  const openSqlForTable = useCallback((tableName: string, schema: string) => {
    const id = `${schema}.${tableName}`
    setState((prev) => {
      const exists = prev.tabs.some((t) => t.id === id)
      const tabs = exists
        ? prev.tabs.map((t) =>
            t.id === id && t.type === "table"
              ? { ...t, state: { ...t.state, innerTab: "sql" as InnerTab } }
              : t
          )
        : [...prev.tabs, { ...makeTableTab(tableName, schema), state: { tableName, schema, innerTab: "sql" as InnerTab, sqlContent: `SELECT *\nFROM "${tableName}"\nLIMIT 100;` } }]
      return { ...prev, tabs, activeTabId: id }
    })
  }, [])

  const closeTab = useCallback((id: string) => {
    setState((prev) => {
      const tabs = prev.tabs.filter((t) => t.id !== id)
      let activeTabId = prev.activeTabId
      if (prev.activeTabId === id) {
        const closedIdx = prev.tabs.findIndex((t) => t.id === id)
        if (tabs.length === 0) activeTabId = null
        else activeTabId = (tabs[Math.min(closedIdx, tabs.length - 1)] ?? tabs[0]).id
      }
      return { ...prev, tabs, activeTabId }
    })
  }, [])

  const setActiveTab = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeTabId: id }))
  }, [])

  const setSchema = useCallback((schema: string) => {
    setState((prev) => ({ ...prev, currentSchema: schema }))
  }, [])

  const updateTableState = useCallback(
    (id: string, partial: Partial<TableTabState>) => {
      setState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t) =>
          t.id === id && t.type === "table"
            ? { ...t, state: { ...t.state, ...partial } }
            : t
        ),
      }))
    },
    []
  )

  const reorderTabs = useCallback((fromIdx: number, toIdx: number) => {
    setState((prev) => {
      const tabs = [...prev.tabs]
      const [moved] = tabs.splice(fromIdx, 1)
      tabs.splice(toIdx, 0, moved)
      return { ...prev, tabs }
    })
  }, [])

  const closeOtherTabs = useCallback((keepId: string) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.filter((t) => t.id === keepId),
      activeTabId: keepId,
    }))
  }, [])

  const closeAllTabs = useCallback(() => {
    setState((prev) => ({ ...prev, tabs: [], activeTabId: null }))
  }, [])

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null

  return (
    <ExplorerContext.Provider
      value={{
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        activeTab,
        currentSchema: state.currentSchema,
        openTable,
        openSqlForTable,
        openOverview,
        closeTab,
        setActiveTab,
        setSchema,
        updateTableState,
        reorderTabs,
        closeOtherTabs,
        closeAllTabs,
      }}
    >
      {children}
    </ExplorerContext.Provider>
  )
}

export function useExplorer() {
  const ctx = useContext(ExplorerContext)
  if (!ctx) throw new Error("useExplorer must be used inside ExplorerProvider")
  return ctx
}
