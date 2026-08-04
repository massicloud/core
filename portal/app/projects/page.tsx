"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getProjects, deleteProject } from "@/lib/api"
import { CreateProjectModal } from "@/components/projects/create-project-modal"
import { getProjectColor } from "@/components/layout/project-switcher"
import { Plus, Trash2, ArrowRight, FolderOpen } from "lucide-react"
import { format } from "date-fns"
import type { Project } from "@/types"

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })

  function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault()
    e.stopPropagation()
    if (confirm(`Delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto">
        <div className="h-7 w-28 bg-[#18181B] rounded-lg mb-1.5 animate-pulse" />
        <div className="h-4 w-52 bg-[#18181B] rounded mb-8 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[148px] bg-[#111113] border border-[#1E1E24] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Projects</h1>
          <p className="text-[#71717A] text-sm mt-1">
            {projects.length === 0
              ? "Get started by creating your first project"
              : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 h-9 px-4 bg-[#D4A843] hover:bg-[#D4A843]/90 text-[#09090B] text-sm font-semibold rounded-lg transition-all shrink-0"
        >
          <Plus size={14} />
          New project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center mb-4">
            <FolderOpen size={22} className="text-[#3F3F46]" />
          </div>
          <h2 className="text-white font-semibold mb-1.5">No projects yet</h2>
          <p className="text-[#71717A] text-sm mb-6 max-w-[280px] leading-relaxed">
            Projects are workspaces that contain your databases, stages, and storage.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 h-9 px-4 bg-[#D4A843] hover:bg-[#D4A843]/90 text-[#09090B] text-sm font-semibold rounded-lg transition-all"
          >
            <Plus size={14} />
            Create first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: Project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={(e) => handleDelete(e, project.id, project.name)}
            />
          ))}
        </div>
      )}

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

function ProjectCard({
  project,
  onDelete,
}: {
  project: Project
  onDelete: (e: React.MouseEvent) => void
}) {
  const color = getProjectColor(project.id)

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative flex flex-col bg-[#111113] border border-[#1E1E24] hover:border-[#3F3F46] rounded-xl p-5 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-bold"
          style={{
            background: color + "1A",
            border: `1px solid ${color}30`,
            color,
          }}
        >
          {project.name[0]?.toUpperCase()}
        </div>

        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-[#EF4444]/10 hover:text-[#EF4444] text-[#3F3F46]"
          title="Delete project"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex-1">
        <h3 className="font-semibold text-white text-[15px] mb-0.5 truncate">
          {project.name}
        </h3>
        {project.description ? (
          <p className="text-[#71717A] text-xs line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        ) : (
          <p className="text-[#3F3F46] text-xs italic">No description</p>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1E1E24]">
        <span className="text-[11px] text-[#3F3F46]">
          {format(new Date(project.created_at), "MMM d, yyyy")}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-[#52525B] group-hover:text-[#A1A1AA] transition-colors">
          Open
          <ArrowRight size={11} />
        </div>
      </div>
    </Link>
  )
}
