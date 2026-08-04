"use client"

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { Key, Link, ZoomIn, ZoomOut, Maximize2, Search, RotateCcw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { getColumns, getForeignKeys, getSchemas } from "@/lib/db-api"
import { getTypeBadgeClass } from "./components/column-types"
import { useExplorer } from "@/lib/explorer-context"
import { InitializeSchemasModal } from "@/components/instances/initialize-schemas-modal"
import type { Table, Column, ForeignKey, TableSecurity } from "@/types/db"
import { getTableSecurity } from "@/lib/db-api"
import { RLSDot } from "@/components/explorer/rls-badge"

const MASSICLOUD_SCHEMAS = ["auth", "audit", "compliance"]

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_W    = 248   // card width
const HDR_H     = 42   // header height
const COL_H     = 27   // per-column row height
const FTR_H     = 28   // footer height
const PAD_X     = 80   // horizontal gap between layers
const PAD_Y     = 60   // vertical gap within a layer

// ─── Types ───────────────────────────────────────────────────────────────────

interface NodePos { x: number; y: number }

interface ErdEdge {
  id: string
  srcTable: string
  tgtTable: string
  srcCol:   string
  tgtCol:   string
  onDelete: string
  /** coord of FK column's row midpoint (right or left edge of FK table) */
  sx: number; sy: number
  /** coord of PK column's row midpoint (right or left edge of PK table) */
  tx: number; ty: number
  /** true → FK table is to the right, edge flows ← */
  fkOnRight: boolean
}

interface ErdNode {
  tableName:   string
  columns:     Column[]
  foreignKeys: ForeignKey[]
  edgeCount:   number
  pos:         NodePos
  security?:   TableSecurity
}

// ─── Auto-layout (topological + layered) ─────────────────────────────────────

function autoLayout(
  tables: Table[],
  fkMap:  Map<string, ForeignKey[]>,
  colCounts: Map<string, number>,
): Map<string, NodePos> {
  // Build adjacency: table → set of referenced tables
  const deps = new Map<string, Set<string>>()
  for (const t of tables) {
    deps.set(t.name, new Set())
    for (const fk of fkMap.get(t.name) ?? []) {
      if (fk.referenced_table !== t.name) deps.get(t.name)!.add(fk.referenced_table)
    }
  }

  // Kahn's BFS topological layering
  const inDeg = new Map<string, number>()
  for (const t of tables) inDeg.set(t.name, 0)
  for (const [, targets] of deps)
    for (const tgt of targets) inDeg.set(tgt, (inDeg.get(tgt) ?? 0) + 1)

  const layer = new Map<string, number>()
  const queue: string[] = []
  for (const [n, d] of inDeg) if (d === 0) { queue.push(n); layer.set(n, 0) }

  while (queue.length) {
    const cur = queue.shift()!
    for (const tgt of deps.get(cur) ?? []) {
      const nl = (layer.get(cur) ?? 0) + 1
      if (!layer.has(tgt) || layer.get(tgt)! < nl) layer.set(tgt, nl)
      inDeg.set(tgt, (inDeg.get(tgt) ?? 1) - 1)
      if (inDeg.get(tgt) === 0) queue.push(tgt)
    }
  }
  for (const t of tables) if (!layer.has(t.name)) layer.set(t.name, 0)

  // Group by layer
  const byLayer = new Map<number, string[]>()
  for (const [n, l] of layer) {
    if (!byLayer.has(l)) byLayer.set(l, [])
    byLayer.get(l)!.push(n)
  }
  for (const [, names] of byLayer) names.sort()

  const nodeH = (name: string) =>
    HDR_H + (colCounts.get(name) ?? 4) * COL_H + FTR_H + 8

  const positions = new Map<string, NodePos>()
  const sortedLayers = [...byLayer.entries()].sort(([a], [b]) => a - b)

  let x = 40
  for (const [, names] of sortedLayers) {
    let y = 40
    for (const name of names) {
      positions.set(name, { x, y })
      y += nodeH(name) + PAD_Y
    }
    x += NODE_W + PAD_X
  }
  return positions
}

// ─── Crow's foot notation markers ────────────────────────────────────────────
// `dir` is the direction the edge travels FROM the marker's table.
// 'right' = edge exits to the right; 'left' = edge exits to the left.

function CrowFoot({ x, y, dir, hovered }: {
  x: number; y: number; dir: "left" | "right"; hovered: boolean
}) {
  const s  = dir === "right" ? 1 : -1  // sign: +1 toward edge, -1 into table
  const L  = 13  // line length
  const Sp = 8   // spread (y offset for outer feet)
  const stroke = hovered ? "#3B82F6" : "#52525B"
  const sw     = hovered ? 2 : 1.5

  // Three "feet" spreading from the connection point into the edge
  return (
    <g stroke={stroke} strokeWidth={sw} strokeLinecap="round">
      <line x1={x} y1={y}     x2={x + s * L} y2={y - Sp} />
      <line x1={x} y1={y}     x2={x + s * L} y2={y}      />
      <line x1={x} y1={y}     x2={x + s * L} y2={y + Sp} />
      {/* Mandatory bar */}
      <line x1={x + s * (L + 4)} y1={y - 7} x2={x + s * (L + 4)} y2={y + 7} />
    </g>
  )
}

function OneBar({ x, y, dir, hovered }: {
  x: number; y: number; dir: "left" | "right"; hovered: boolean
}) {
  const s      = dir === "right" ? 1 : -1
  const stroke = hovered ? "#A855F7" : "#52525B"
  const sw     = hovered ? 2 : 1.5

  return (
    <g stroke={stroke} strokeWidth={sw} strokeLinecap="round">
      <line x1={x + s * 4} y1={y - 7} x2={x + s * 4} y2={y + 7} />
      <line x1={x + s * 9} y1={y - 7} x2={x + s * 9} y2={y + 7} />
    </g>
  )
}

// ─── Relationship edge ────────────────────────────────────────────────────────

function RelEdge({
  edge, hovered,
}: {
  edge: ErdEdge
  hovered: boolean
}) {
  const [labelVisible, setLabelVisible] = useState(false)

  // Bezier control points
  const dx  = Math.abs(edge.tx - edge.sx)
  const cp  = Math.max(60, dx * 0.55)
  const d   = `M ${edge.sx} ${edge.sy} C ${edge.sx + (edge.fkOnRight ? -cp : cp)} ${edge.sy}, ${edge.tx + (edge.fkOnRight ? cp : -cp)} ${edge.ty}, ${edge.tx} ${edge.ty}`

  // Label midpoint
  const mx = (edge.sx + edge.tx) / 2
  const my = (edge.sy + edge.ty) / 2

  // Directions: crow's foot = FK direction (away from FK table); one-bar = toward PK
  const crowDir: "left" | "right" = edge.fkOnRight ? "left"  : "right"
  const barDir:  "left" | "right" = edge.fkOnRight ? "right" : "left"

  const edgeColor   = hovered ? "#3B82F6" : "#27272A"
  const edgeOpacity = hovered ? 1 : 0.6

  return (
    <g
      onMouseEnter={() => setLabelVisible(true)}
      onMouseLeave={() => setLabelVisible(false)}
      style={{ cursor: "default" }}
    >
      {/* Invisible thick hit-area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={16} />

      {/* Shadow/glow when hovered */}
      {hovered && (
        <path d={d} fill="none"
          stroke="#3B82F6" strokeWidth={4} strokeOpacity={0.12}
          strokeLinecap="round" />
      )}

      {/* Main path */}
      <path d={d} fill="none"
        stroke={edgeColor} strokeWidth={hovered ? 1.75 : 1.25}
        strokeOpacity={edgeOpacity}
        strokeDasharray={hovered ? undefined : "4 3"}
        strokeLinecap="round" />

      {/* Crow's foot at FK (many) end */}
      <CrowFoot x={edge.sx} y={edge.sy} dir={crowDir} hovered={hovered} />

      {/* One-bar at PK (one) end */}
      <OneBar x={edge.tx} y={edge.ty} dir={barDir} hovered={hovered} />

      {/* Relationship label on hover */}
      {(hovered || labelVisible) && (
        <g>
          <rect
            x={mx - 58} y={my - 12}
            width={116} height={24}
            rx={4}
            fill="#111111" stroke="#27272A" strokeWidth={1}
          />
          <text
            x={mx} y={my + 4}
            textAnchor="middle"
            fontSize={9}
            fontFamily="monospace"
            fill="#A1A1AA"
          >
            {edge.srcCol} → {edge.tgtCol}
            {edge.onDelete && edge.onDelete !== "NO ACTION"
              ? `  ·  ON DELETE ${edge.onDelete}` : ""}
          </text>
        </g>
      )}
    </g>
  )
}

// ─── Table node card ──────────────────────────────────────────────────────────

function TableNode({
  node, zoom, isHovered, isDimmed,
  onMouseEnter, onMouseLeave,
  onDragEnd, onOpen,
  hoveredEdgeIds, edgesByTable,
}: {
  node:          ErdNode
  zoom:          number
  isHovered:     boolean
  isDimmed:      boolean
  onMouseEnter:  () => void
  onMouseLeave:  () => void
  onDragEnd:     (name: string, pos: NodePos) => void
  onOpen:        (name: string) => void
  hoveredEdgeIds: Set<string>
  edgesByTable:  Map<string, ErdEdge[]>
}) {
  const ref      = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const start    = useRef({ mx: 0, my: 0, nx: 0, ny: 0 })
  const posRef   = useRef(node.pos)
  posRef.current = node.pos

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    e.preventDefault()
    dragging.current = true
    start.current = { mx: e.clientX, my: e.clientY, nx: posRef.current.x, ny: posRef.current.y }

    const move = (me: MouseEvent) => {
      if (!dragging.current || !ref.current) return
      const dx = (me.clientX - start.current.mx) / zoom
      const dy = (me.clientY - start.current.my) / zoom
      ref.current.style.transform = `translate(${start.current.nx + dx}px, ${start.current.ny + dy}px)`
    }
    const up = (me: MouseEvent) => {
      dragging.current = false
      const dx = (me.clientX - start.current.mx) / zoom
      const dy = (me.clientY - start.current.my) / zoom
      onDragEnd(node.tableName, { x: start.current.nx + dx, y: start.current.ny + dy })
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", up)
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
  }, [node.tableName, zoom, onDragEnd])

  const connectedTables = useMemo(() => {
    const edges = edgesByTable.get(node.tableName) ?? []
    return new Set(edges.map(e => e.srcTable === node.tableName ? e.tgtTable : e.srcTable))
  }, [node.tableName, edgesByTable])

  // Which column names are FK columns
  const fkColNames = useMemo(() => new Set(node.foreignKeys.map(fk => fk.column)), [node.foreignKeys])

  // Which FK columns have their edge currently hovered
  const fkColRefMap = useMemo(() => {
    const m = new Map<string, ForeignKey>()
    for (const fk of node.foreignKeys) m.set(fk.column, fk)
    return m
  }, [node.foreignKeys])

  const fkEdgesHovered = useMemo(() => {
    const s = new Set<string>()
    for (const edge of edgesByTable.get(node.tableName) ?? []) {
      if (hoveredEdgeIds.has(edge.id)) s.add(edge.srcCol)
    }
    return s
  }, [edgesByTable, node.tableName, hoveredEdgeIds])

  return (
    <div
      ref={ref}
      data-erd-node="true"
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        transform: `translate(${node.pos.x}px, ${node.pos.y}px)`,
        width: NODE_W,
        position: "absolute",
        top: 0, left: 0,
        userSelect: "none",
        transition: "opacity 150ms ease",
        opacity: isDimmed ? 0.2 : 1,
      }}
      className={cn(
        "rounded-lg border bg-[#111111] shadow-md cursor-grab active:cursor-grabbing",
        isHovered
          ? "border-[#3B82F6] shadow-[0_0_0_1px_#3B82F6,0_4px_24px_rgba(59,130,246,0.18)]"
          : "border-[#27272A] hover:border-[#3B3B3B]"
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 border-b border-[#1F1F23] rounded-t-lg hover:bg-[#1A1A1A] transition-colors"
        style={{ height: HDR_H }}
        onDoubleClick={() => onOpen(node.tableName)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-2 h-2 rounded-full shrink-0", isHovered ? "bg-[#3B82F6]" : "bg-[#27272A]")} />
          <span className="text-white text-[13px] font-semibold font-mono truncate">
            {node.tableName}
          </span>
          <RLSDot security={node.security} />
        </div>
        <button
          onClick={() => onOpen(node.tableName)}
          className="text-[#3B3B3B] hover:text-[#3B82F6] transition-colors text-[10px] font-medium ml-2 shrink-0"
        >
          Open →
        </button>
      </div>

      {/* Columns */}
      <div className="py-0.5">
        {node.columns.length === 0 ? (
          <div className="px-3 py-2 text-[10px] text-[#3B3B3B]">No columns</div>
        ) : (
          node.columns.map((col) => {
            const isFkCol = fkColNames.has(col.name)
            const fkEdgeHovered = fkEdgesHovered.has(col.name)
            const fkRef = fkColRefMap.get(col.name)
            return (
              <div
                key={col.name}
                style={{ height: COL_H }}
                className={cn(
                  "flex items-center gap-2 px-3 transition-colors",
                  fkEdgeHovered ? "bg-[#1D3461]/30" : "hover:bg-[#141414]"
                )}
              >
                {col.is_primary_key ? (
                  <Key size={10} className="text-[#F59E0B] shrink-0" />
                ) : isFkCol ? (
                  <Link size={10} className={cn("shrink-0", fkEdgeHovered ? "text-[#3B82F6]" : "text-[#A855F7]")} />
                ) : (
                  <div className="w-[10px] shrink-0" />
                )}

                <span className={cn(
                  "text-[11px] font-mono truncate flex-1",
                  col.is_primary_key ? "text-[#F59E0B]"
                    : isFkCol ? (fkEdgeHovered ? "text-[#3B82F6]" : "text-[#A855F7]")
                    : "text-[#A1A1AA]"
                )}>
                  {col.name}
                </span>

                {/* Referenced table hint on FK column */}
                {isFkCol && fkRef && (
                  <span className={cn(
                    "text-[9px] font-mono shrink-0 transition-colors",
                    fkEdgeHovered ? "text-[#3B82F6]" : "text-[#3B3B3B]"
                  )}>
                    → {fkRef.referenced_table}
                  </span>
                )}

                {!isFkCol && (
                  <span className={cn(
                    "text-[9px] px-1 py-0.5 rounded font-mono border shrink-0",
                    getTypeBadgeClass(col.type)
                  )}>
                    {col.type}
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div
        className="px-3 border-t border-[#1F1F23] flex items-center justify-between"
        style={{ height: FTR_H }}
      >
        <span className="text-[9px] text-[#3B3B3B]">
          {node.columns.length} col{node.columns.length !== 1 ? "s" : ""}
        </span>
        {node.edgeCount > 0 && (
          <span className={cn(
            "text-[9px] font-medium px-1.5 py-0.5 rounded-full",
            isHovered ? "bg-[#1D3461] text-[#3B82F6]" : "bg-[#1A1A1A] text-[#52525B]"
          )}>
            {node.edgeCount} rel{node.edgeCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const POS_KEY = (id: string) => `massicloud:erd-positions:${id}`

export function OverviewView({ instanceId, tables }: { instanceId: string; tables: Table[] }) {
  const { openTable, currentSchema } = useExplorer()

  const [pan,              setPan]              = useState<NodePos>({ x: 0, y: 0 })
  const [zoom,             setZoom]             = useState(1)
  const [search,           setSearch]           = useState("")
  const [hoveredTable,     setHoveredTable]     = useState<string | null>(null)
  const [initializeOpen,   setInitializeOpen]   = useState(false)

  const { data: existingSchemas } = useQuery({
    queryKey: ["db", instanceId, "schemas"],
    queryFn: () => getSchemas(instanceId),
    staleTime: 30_000,
  })

  const availableNewSchemas = MASSICLOUD_SCHEMAS.filter(
    (s) => !(existingSchemas ?? []).includes(s)
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning    = useRef(false)
  const panStart     = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  // Security data for RLS indicators
  const { data: securityData } = useQuery({
    queryKey: ["db-security", instanceId],
    queryFn: () => getTableSecurity(instanceId),
    staleTime: 60_000,
    enabled: currentSchema === "public",
  })

  const securityByTable = useMemo(
    () =>
      Object.fromEntries(
        (securityData ?? []).map((s) => [s.table_name, s])
      ),
    [securityData]
  )

  // Batch-fetch columns + FKs
  const colResults = useQueries({
    queries: tables.map((t) => ({
      queryKey: ["db", instanceId, "table", `${currentSchema}.${t.name}`, "columns"],
      queryFn:  () => getColumns(instanceId, t.name, currentSchema),
      staleTime: 60_000,
    })),
  })
  const fkResults = useQueries({
    queries: tables.map((t) => ({
      queryKey: ["db", instanceId, "table", `${currentSchema}.${t.name}`, "foreign-keys"],
      queryFn:  () => getForeignKeys(instanceId, t.name, currentSchema),
      staleTime: 60_000,
    })),
  })

  const loading = colResults.some((r) => r.isLoading)

  const colMap = useMemo(() => {
    const m = new Map<string, Column[]>()
    tables.forEach((t, i) => m.set(t.name, colResults[i].data ?? []))
    return m
  }, [tables, colResults])

  const fkMap = useMemo(() => {
    const m = new Map<string, ForeignKey[]>()
    tables.forEach((t, i) => m.set(t.name, fkResults[i].data ?? []))
    return m
  }, [tables, fkResults])

  const colCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const [name, cols] of colMap) m.set(name, cols.length)
    return m
  }, [colMap])

  // Positions
  const [positions, setPositions] = useState<Map<string, NodePos>>(() => {
    if (typeof window === "undefined") return new Map()
    try {
      const saved = localStorage.getItem(POS_KEY(instanceId))
      if (saved) return new Map(Object.entries(JSON.parse(saved)))
    } catch { /* ignore */ }
    return new Map()
  })

  const layoutDone = useRef(false)
  useEffect(() => {
    if (layoutDone.current || tables.length === 0) return
    if (fkResults.some((r) => r.isLoading) || colResults.some((r) => r.isLoading)) return
    if (tables.every((t) => positions.has(t.name))) { layoutDone.current = true; return }
    const layout = autoLayout(tables, fkMap, colCounts)
    setPositions((prev) => {
      const next = new Map(prev)
      for (const [n, p] of layout) if (!next.has(n)) next.set(n, p)
      return next
    })
    layoutDone.current = true
  }, [tables, fkMap, colCounts, colResults, fkResults, positions])

  useEffect(() => {
    if (positions.size === 0) return
    try {
      const obj: Record<string, NodePos> = {}
      for (const [k, v] of positions) obj[k] = v
      localStorage.setItem(POS_KEY(instanceId), JSON.stringify(obj))
    } catch { /* ignore */ }
  }, [positions, instanceId])

  const resetLayout = useCallback(() => {
    layoutDone.current = false
    setPositions(new Map())
    try { localStorage.removeItem(POS_KEY(instanceId)) } catch { /* ignore */ }
  }, [instanceId])

  const handleDragEnd = useCallback((name: string, pos: NodePos) => {
    setPositions((prev) => new Map(prev).set(name, pos))
  }, [])

  // Pan
  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-erd-node]")) return
    isPanning.current = true
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
    const move = (me: MouseEvent) => {
      if (!isPanning.current) return
      setPan({ x: panStart.current.px + me.clientX - panStart.current.mx, y: panStart.current.py + me.clientY - panStart.current.my })
    }
    const up = () => { isPanning.current = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up) }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
  }, [pan])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.min(2.5, Math.max(0.2, z * (e.deltaY > 0 ? 0.9 : 1.1))))
  }, [])

  const fitView = useCallback(() => {
    if (!containerRef.current || positions.size === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [name, pos] of positions) {
      const h = HDR_H + (colCounts.get(name) ?? 4) * COL_H + FTR_H + 8
      minX = Math.min(minX, pos.x); minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + NODE_W); maxY = Math.max(maxY, pos.y + h)
    }
    const W = maxX - minX + 80; const H = maxY - minY + 80
    const nz = Math.min(2, Math.max(0.2, Math.min(rect.width / W, rect.height / H) * 0.88))
    setZoom(nz)
    setPan({ x: rect.width / 2 - (minX + W / 2) * nz, y: rect.height / 2 - (minY + H / 2) * nz })
  }, [positions, colCounts])

  // Build edges
  const edges = useMemo<ErdEdge[]>(() => {
    const result: ErdEdge[] = []
    tables.forEach((t) => {
      const srcPos  = positions.get(t.name)
      const srcCols = colMap.get(t.name) ?? []
      const fks     = fkMap.get(t.name) ?? []
      if (!srcPos) return

      fks.forEach((fk) => {
        if (fk.referenced_table === t.name) return
        const tgtPos  = positions.get(fk.referenced_table)
        const tgtCols = colMap.get(fk.referenced_table) ?? []
        if (!tgtPos) return

        const srcColIdx = srcCols.findIndex((c) => c.name === fk.column)
        const tgtColIdx = tgtCols.findIndex((c) => c.name === fk.referenced_column)

        const srcColY = srcPos.y + HDR_H + (srcColIdx >= 0 ? srcColIdx : 0) * COL_H + COL_H / 2
        const tgtColY = tgtPos.y + HDR_H + (tgtColIdx >= 0 ? tgtColIdx : 0) * COL_H + COL_H / 2

        // Determine which side to connect from
        const fkOnRight = srcPos.x > tgtPos.x
        const sx = fkOnRight ? srcPos.x : srcPos.x + NODE_W
        const tx = fkOnRight ? tgtPos.x + NODE_W : tgtPos.x

        result.push({
          id:        `${t.name}.${fk.column}->${fk.referenced_table}.${fk.referenced_column}`,
          srcTable:  t.name,
          tgtTable:  fk.referenced_table,
          srcCol:    fk.column,
          tgtCol:    fk.referenced_column,
          onDelete:  fk.on_delete,
          sx, sy: srcColY, tx, ty: tgtColY,
          fkOnRight,
        })
      })
    })
    return result
  }, [tables, positions, colMap, fkMap])

  // Edge lookup by table
  const edgesByTable = useMemo(() => {
    const m = new Map<string, ErdEdge[]>()
    for (const edge of edges) {
      if (!m.has(edge.srcTable)) m.set(edge.srcTable, [])
      if (!m.has(edge.tgtTable)) m.set(edge.tgtTable, [])
      m.get(edge.srcTable)!.push(edge)
      m.get(edge.tgtTable)!.push(edge)
    }
    return m
  }, [edges])

  // Hovered edges (those connected to the hovered table)
  const hoveredEdgeIds = useMemo(() => {
    if (!hoveredTable) return new Set<string>()
    return new Set((edgesByTable.get(hoveredTable) ?? []).map((e) => e.id))
  }, [hoveredTable, edgesByTable])

  // Tables connected to the hovered one
  const connectedTables = useMemo(() => {
    if (!hoveredTable) return new Set<string>()
    const s = new Set<string>([hoveredTable])
    for (const edge of edgesByTable.get(hoveredTable) ?? []) {
      s.add(edge.srcTable); s.add(edge.tgtTable)
    }
    return s
  }, [hoveredTable, edgesByTable])

  // Filtered nodes
  const nodes = useMemo<ErdNode[]>(() => {
    return tables
      .filter((t) => {
        if (!search) return true
        const cols = colMap.get(t.name) ?? []
        return t.name.toLowerCase().includes(search.toLowerCase()) ||
          cols.some((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      })
      .map((t) => ({
        tableName:   t.name,
        columns:     colMap.get(t.name) ?? [],
        foreignKeys: fkMap.get(t.name) ?? [],
        edgeCount:   (edgesByTable.get(t.name) ?? []).length,
        pos:         positions.get(t.name) ?? { x: 40, y: 40 },
        security:    securityByTable[t.name],
      }))
  }, [tables, colMap, fkMap, edgesByTable, positions, search])

  const canvasW = useMemo(() => {
    let max = 800; for (const pos of positions.values()) max = Math.max(max, pos.x + NODE_W + 80); return max
  }, [positions])
  const canvasH = useMemo(() => {
    let max = 600
    for (const [name, pos] of positions)
      max = Math.max(max, pos.y + HDR_H + (colCounts.get(name) ?? 4) * COL_H + FTR_H + 60)
    return max
  }, [positions, colCounts])

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 h-11 border-b border-[#1F1F23] bg-[#0D0D0D] shrink-0">
        <div className="relative flex-1 max-w-[240px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#52525B]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tables or columns…"
            className="w-full h-7 bg-[#141414] border border-[#1F1F23] rounded-md pl-7 pr-3 text-xs text-white placeholder-[#3B3B3B] focus:border-[#3B82F6] focus:outline-none"
          />
        </div>

        {/* Edge count summary */}
        {edges.length > 0 && (
          <span className="text-[10px] text-[#3B3B3B]">
            {edges.length} relationship{edges.length !== 1 ? "s" : ""}
          </span>
        )}

        <div className="flex-1" />

        {/* Legend */}
        <div className="hidden md:flex items-center gap-3 mr-1">
          <div className="flex items-center gap-1.5">
            <svg width="28" height="10" viewBox="0 0 28 10">
              <line x1="0" y1="5" x2="14" y2="2" stroke="#52525B" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="0" y1="5" x2="14" y2="5" stroke="#52525B" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="0" y1="5" x2="14" y2="8" stroke="#52525B" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="17" y1="2" x2="17" y2="8" stroke="#52525B" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="21" y1="2" x2="21" y2="8" stroke="#52525B" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] text-[#52525B]">Many : One</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Key size={9} className="text-[#F59E0B]" />
            <span className="text-[10px] text-[#52525B]">PK</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link size={9} className="text-[#A855F7]" />
            <span className="text-[10px] text-[#52525B]">FK</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} className="p-1.5 rounded text-[#52525B] hover:text-white hover:bg-[#1A1A1A]" title="Zoom in"><ZoomIn size={13} /></button>
          <span className="text-[10px] text-[#52525B] w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))} className="p-1.5 rounded text-[#52525B] hover:text-white hover:bg-[#1A1A1A]" title="Zoom out"><ZoomOut size={13} /></button>
          <div className="w-px h-4 bg-[#27272A] mx-1" />
          <button onClick={fitView}     className="p-1.5 rounded text-[#52525B] hover:text-white hover:bg-[#1A1A1A]" title="Fit to view"><Maximize2 size={13} /></button>
          <button onClick={resetLayout} className="p-1.5 rounded text-[#52525B] hover:text-white hover:bg-[#1A1A1A]" title="Reset layout"><RotateCcw size={13} /></button>
        </div>

        {/* Add MassiCloud schemas */}
        {availableNewSchemas.length > 0 && (
          <button
            onClick={() => setInitializeOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#27272A] border border-[#27272A] hover:border-[#3B82F6]/40 rounded-md text-xs text-[#A1A1AA] hover:text-white transition-all"
          >
            <Sparkles size={12} />
            Add MassiCloud schemas
          </button>
        )}
      </div>

      <InitializeSchemasModal
        instanceId={instanceId}
        open={initializeOpen}
        onClose={() => setInitializeOpen(false)}
      />

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative select-none"
        style={{ cursor: "grab" }}
        onMouseDown={onCanvasMouseDown}
        onWheel={onWheel}
      >
        {/* Dot grid */}
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
          <pattern id="erd-grid" x={pan.x % 28} y={pan.y % 28} width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="0.8" cy="0.8" r="0.8" fill="#1F1F23" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#erd-grid)" />
        </svg>

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="grid grid-cols-3 gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-24 h-16 rounded-lg bg-[#111111] border border-[#27272A] animate-pulse" />
                ))}
              </div>
              <p className="text-[#52525B] text-xs mt-1">Loading schema…</p>
            </div>
          </div>
        ) : tables.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[#52525B] text-sm">No tables in this schema</p>
          </div>
        ) : (
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute", width: canvasW, height: canvasH }}>

            {/* SVG edges layer (below nodes) */}
            <svg style={{ position: "absolute", inset: 0, width: canvasW, height: canvasH, overflow: "visible", pointerEvents: "all" }}>
              {edges.map((edge) => {
                const isHovered = hoveredEdgeIds.has(edge.id) ||
                  (hoveredTable !== null && (edge.srcTable === hoveredTable || edge.tgtTable === hoveredTable))
                return (
                  <RelEdge key={edge.id} edge={edge} hovered={isHovered} />
                )
              })}
            </svg>

            {/* Table nodes */}
            {nodes.map((node) => {
              const isHovered = hoveredTable === node.tableName
              const isDimmed  = hoveredTable !== null && !connectedTables.has(node.tableName)
              return (
                <TableNode
                  key={node.tableName}
                  node={node}
                  zoom={zoom}
                  isHovered={isHovered}
                  isDimmed={isDimmed}
                  onMouseEnter={() => setHoveredTable(node.tableName)}
                  onMouseLeave={() => setHoveredTable(null)}
                  onDragEnd={handleDragEnd}
                  onOpen={(name) => openTable(name, currentSchema)}
                  hoveredEdgeIds={hoveredEdgeIds}
                  edgesByTable={edgesByTable}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
