"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { listStages } from "@/lib/api"
import { useProject } from "./project-context"
import type { Stage } from "@/types"

interface StageContextType {
  currentStage:    Stage | null
  setCurrentStage: (stage: Stage) => void
  stages:          Stage[]
  isLoading:       boolean
}

const StageContext = createContext<StageContextType | null>(null)

function stageKey(projectId: string) {
  return `massicloud_stage_${projectId}`
}

export function StageProvider({ children }: { children: ReactNode }) {
  const { currentProject } = useProject()
  const [currentStage, setCurrentStageState] = useState<Stage | null>(null)

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['stages', currentProject?.id],
    queryFn:  () => listStages(currentProject!.id),
    enabled:  !!currentProject?.id,
  })

  useEffect(() => {
    if (!currentProject || !stages.length) {
      setCurrentStageState(null)
      return
    }
    setCurrentStageState((prev) => {
      // Keep the same stage selected after a query refetch (instances updated etc.)
      if (prev) {
        const refreshed = stages.find((s) => s.name === prev.name)
        if (refreshed) return refreshed
      }
      const saved = typeof window !== 'undefined'
        ? localStorage.getItem(stageKey(currentProject.id))
        : null
      const persisted = saved ? stages.find((s) => s.name === saved) : null
      return persisted ?? stages[0] ?? null
    })
  }, [currentProject?.id, stages])

  function setCurrentStage(stage: Stage) {
    setCurrentStageState(stage)
    if (currentProject) {
      localStorage.setItem(stageKey(currentProject.id), stage.name)
    }
  }

  return (
    <StageContext.Provider value={{ currentStage, setCurrentStage, stages, isLoading }}>
      {children}
    </StageContext.Provider>
  )
}

export function useStage() {
  const ctx = useContext(StageContext)
  if (!ctx) throw new Error('useStage must be used within a StageProvider')
  return ctx
}
