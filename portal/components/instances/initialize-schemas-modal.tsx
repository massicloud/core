"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Lock, ClipboardList, ShieldCheck } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { SchemaToggle } from "@/components/instances/schema-toggle"
import { Skeleton } from "@/components/ui/skeleton"
import { getSchemas, initializeInstance } from "@/lib/db-api"

const MASSICLOUD_SCHEMAS = ["auth", "audit", "compliance"] as const

const SCHEMA_CONFIG = {
  auth: {
    icon: Lock,
    iconBg: "#1D3461",
    iconColor: "#3B82F6",
    title: "Auth Schema",
    description:
      "Ready-to-use user authentication with sessions and password hashing",
    tables: ["auth.users", "auth.sessions", "auth.password_reset_tokens"],
  },
  audit: {
    icon: ClipboardList,
    iconBg: "#14291E",
    iconColor: "#22C55E",
    title: "Audit Schema",
    description:
      "Track all data changes automatically. Recommended for Law 18-07 compliance.",
    tables: ["audit.logs"],
    badge: "Law 18-07",
  },
  compliance: {
    icon: ShieldCheck,
    iconBg: "#2D2410",
    iconColor: "#D4A843",
    title: "Compliance Schema",
    description:
      "Consent tracking, data registry, subject requests, breach log. Algeria-ready.",
    tables: [
      "compliance.data_registry",
      "compliance.consents",
      "compliance.data_requests",
      "compliance.breaches",
    ],
    badge: "🇩🇿 Algeria",
    recommended: true,
  },
} as const

interface InitializeSchemasModalProps {
  instanceId: string
  open: boolean
  onClose: () => void
}

export function InitializeSchemasModal({
  instanceId,
  open,
  onClose,
}: InitializeSchemasModalProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string[]>([])

  const { data: existingSchemas, isLoading } = useQuery({
    queryKey: ["db", instanceId, "schemas"],
    queryFn: () => getSchemas(instanceId),
    enabled: open,
  })

  const available = MASSICLOUD_SCHEMAS.filter(
    (s) => !(existingSchemas ?? []).includes(s)
  )

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () => initializeInstance(instanceId, selected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["db", instanceId, "schemas"] })
      queryClient.invalidateQueries({ queryKey: ["db", instanceId, "tables"] })
      toast.success("Schemas added successfully")
      setSelected([])
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to add schemas")
    },
  })

  function handleClose() {
    setSelected([])
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add MassiCloud schemas"
      description="Add pre-configured schemas to this database"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            disabled={isPending || selected.length === 0}
          >
            {isPending ? "Applying..." : "Apply schemas"}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : available.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#52525B]">
          All MassiCloud schemas are already installed.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {available.map((s) => {
            const cfg = SCHEMA_CONFIG[s]
            return (
              <SchemaToggle
                key={s}
                id={s}
                checked={selected.includes(s)}
                onChange={toggle}
                icon={cfg.icon}
                iconBg={cfg.iconBg}
                iconColor={cfg.iconColor}
                title={cfg.title}
                description={cfg.description}
                tables={[...cfg.tables]}
                badge={"badge" in cfg ? cfg.badge : undefined}
                recommended={"recommended" in cfg ? cfg.recommended : undefined}
              />
            )
          })}
        </div>
      )}
    </Modal>
  )
}
