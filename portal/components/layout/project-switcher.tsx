"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronsUpDown, Check, Plus, Search } from "lucide-react"
import { useProject } from "@/lib/project-context"
import { cn } from "@/lib/utils"
import type { Project } from "@/types"

const PROJECT_COLORS = [
  "#3B82F6", // blue
  "#D4A843", // gold
  "#22C55E", // green
  "#A855F7", // purple
  "#F97316", // orange
  "#EC4899", // pink
  "#14B8A6", // teal
  "#EF4444", // red
]

function getProjectColor(id: string): string {
  const lastChar = id.slice(-1)
  const index = parseInt(lastChar, 16) % PROJECT_COLORS.length
  return PROJECT_COLORS[isNaN(index) ? 0 : index]
}

interface ProjectSwitcherProps {
  onCreateClick: () => void
}

export function ProjectSwitcher({ onCreateClick }: ProjectSwitcherProps) {
  const { currentProject, setCurrentProject, projects, isLoading } = useProject()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      inputRef.current?.focus()
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleSelect(project: Project) {
    setCurrentProject(project)
    setOpen(false)
    setSearch("")
  }

  function handleCreate() {
    setOpen(false)
    setSearch("")
    onCreateClick()
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="w-2 h-2 rounded-full bg-[#27272A] animate-pulse" />
        <span className="text-[#52525B] text-sm">Loading...</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-[#18181B] transition-colors group"
      >
        {currentProject ? (
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold"
            style={{
              background: getProjectColor(currentProject.id) + "22",
              color: getProjectColor(currentProject.id),
              border: `1px solid ${getProjectColor(currentProject.id)}30`,
            }}
          >
            {currentProject.name[0]?.toUpperCase()}
          </div>
        ) : (
          <div className="w-5 h-5 rounded-md bg-[#27272A] shrink-0" />
        )}
        <span className="text-[#FAFAFA] text-sm font-medium max-w-[140px] truncate">
          {currentProject?.name ?? "Select project"}
        </span>
        <ChevronsUpDown
          size={13}
          className="text-[#3F3F46] group-hover:text-[#A1A1AA] transition-colors"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-[280px] bg-[#111113] border border-[#27272A] rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.7)] z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]"
            />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-9 pr-3 py-2.5 bg-transparent border-b border-[#27272A] text-sm text-white placeholder-[#52525B] outline-none"
            />
          </div>

          {/* Projects list */}
          <div className="max-h-[240px] overflow-y-auto p-1">
            {filteredProjects.length === 0 ? (
              <div className="px-3 py-6 text-center text-[#52525B] text-sm">
                {projects.length === 0
                  ? "No projects yet"
                  : "No projects found"}
              </div>
            ) : (
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 hover:bg-[#18181B] rounded-md transition-colors text-left",
                    currentProject?.id === project.id && "bg-[#18181B]"
                  )}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold"
                    style={{
                      background: getProjectColor(project.id) + "22",
                      color: getProjectColor(project.id),
                      border: `1px solid ${getProjectColor(project.id)}30`,
                    }}
                  >
                    {project.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#FAFAFA] font-medium truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-[#52525B] truncate">
                      {project.description || "No description"}
                    </div>
                  </div>
                  {currentProject?.id === project.id && (
                    <Check size={14} className="text-[#3B82F6] shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-[#27272A]" />

          {/* Create button */}
          <div className="p-1">
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-[#3B82F6] hover:bg-[#1D3461] rounded-md transition-colors text-sm"
            >
              <Plus size={14} />
              Create new project
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export { getProjectColor }
