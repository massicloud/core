"use client"

import { useMutationState } from "@tanstack/react-query"

// Shared across every mutation that provisions a database instance (either
// directly via "add instance to stage", or bundled into "create stage with
// an initial instance"). TanStack Query's mutation cache is a single global
// instance (see app/providers.tsx), so tracking by this key works from any
// component, and survives the triggering modal being closed/unmounted —
// which is the point: we close the modal immediately on submit instead of
// blocking the user behind it for however long provisioning takes.
export const INSTANCE_PROVISION_KEY = ["instance-provisioning"] as const

export interface InstanceProvisionVars {
  name: string
  type: string
  stageName: string
  // False for a "new stage" submission with no initial database — that's
  // fast and isn't what this tracker is for, so it's filtered out below.
  hasInstance: boolean
  isNewStage?: boolean
}

function isTrackable(v: unknown): v is InstanceProvisionVars {
  return !!v && typeof v === "object" && (v as InstanceProvisionVars).hasInstance === true
}

/** Metadata for whatever instance creation(s) are currently in flight, anywhere in the app. */
export function usePendingInstanceProvisions(): InstanceProvisionVars[] {
  return useMutationState({
    filters: { mutationKey: INSTANCE_PROVISION_KEY, status: "pending" },
    select: (mutation) => mutation.state.variables,
  }).filter(isTrackable)
}

/** True while any instance is being created, anywhere — used to lock out new creation attempts. */
export function useIsProvisioningInstance(): boolean {
  return usePendingInstanceProvisions().length > 0
}

export function instanceTypeLabel(type: string): string {
  switch (type) {
    case "postgres": return "Postgres"
    case "redis": return "Redis"
    case "mongo": return "MongoDB"
    default: return type
  }
}
