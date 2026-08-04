"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { getProjects } from "@/lib/api"
import type { Project } from "@/types"

const STORAGE_KEY = "massicloud_project"

interface ProjectContextType {
  currentProject: Project | null
  setCurrentProject: (project: Project) => void
  projects: Project[]
  isLoading: boolean
  refetch: () => void
}

const ProjectContext = createContext<ProjectContextType | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null)
  const [initialized, setInitialized] = useState(false)

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  })

  useEffect(() => {
    if (!projects || initialized) return

    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const project = projects.find((p) => p.id === saved)
      if (project) {
        setCurrentProjectState(project)
        setInitialized(true)
        return
      }
    }

    if (projects.length > 0) {
      setCurrentProjectState(projects[0])
      localStorage.setItem(STORAGE_KEY, projects[0].id)
    }
    setInitialized(true)
  }, [projects, initialized])

  // Update current project if it was updated in the projects list
  useEffect(() => {
    if (!currentProject || !projects) return
    const updated = projects.find((p) => p.id === currentProject.id)
    if (updated && updated.name !== currentProject.name) {
      setCurrentProjectState(updated)
    }
  }, [projects, currentProject])

  const setCurrentProject = (project: Project) => {
    setCurrentProjectState(project)
    localStorage.setItem(STORAGE_KEY, project.id)
  }

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        setCurrentProject,
        projects: projects ?? [],
        isLoading,
        refetch,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider")
  }
  return context
}
