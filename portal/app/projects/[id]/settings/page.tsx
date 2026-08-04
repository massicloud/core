"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Settings, Key, Users, Trash2, Save } from "lucide-react"
import { toast } from "sonner"
import { getProject, listAPIKeys, updateProject, deleteProject, getErrorMessage } from "@/lib/api"
import { PageHeader } from "@/components/ui/page-header"
import { SectionCard } from "@/components/ui/section-card"
import { KeysCard, KeysCardSkeleton } from "@/components/api/keys-card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"

type Tab = "general" | "keys" | "members"

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General",  icon: Settings },
  { id: "keys",    label: "API Keys", icon: Key },
  { id: "members", label: "Members",  icon: Users },
]

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>("general")

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  })

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Settings"
        eyebrowIcon={Settings}
        title="Project settings"
        description={project?.name}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0F0F0F] border border-[#1F1F23] rounded-xl p-1">
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            onClick={() => setTab(tid)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 h-8 rounded-lg text-xs font-medium transition-all",
              tab === tid
                ? "bg-[#1A1A1A] text-white shadow-sm"
                : "text-[#52525B] hover:text-[#9CA3AF]"
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {tab === "general" && project && (
        <GeneralTab project={project} projectId={id} />
      )}
      {tab === "keys" && (
        <KeysTab projectId={id} />
      )}
      {tab === "members" && (
        <MembersTab />
      )}
    </div>
  )
}

// ─── General tab ─────────────────────────────────────────────────────────────

function GeneralTab({ project, projectId }: { project: { name: string; description: string; slug: string }; projectId: string }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? "")
  const [showDelete, setShowDelete] = useState(false)

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => updateProject(projectId, { name: name.trim(), description: description.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      toast.success("Project updated")
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const { mutate: destroy, isPending: deleting } = useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      router.push("/projects")
      toast.success("Project deleted")
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const dirty = name.trim() !== project.name || description.trim() !== (project.description ?? "")

  return (
    <div className="space-y-4">
      <SectionCard title="Project details" icon={Settings}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">Project name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 bg-[#0A0A0A] border border-[#27272A] rounded-lg text-sm text-white placeholder-[#3B3B3B] focus:outline-none focus:border-[#3B82F6] transition-colors"
              placeholder="My Project"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#27272A] rounded-lg text-sm text-white placeholder-[#3B3B3B] focus:outline-none focus:border-[#3B82F6] transition-colors resize-none"
              placeholder="What is this project for?"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">Project slug</label>
            <div className="h-9 px-3 flex items-center bg-[#0A0A0A] border border-[#1F1F23] rounded-lg font-mono text-xs text-[#52525B]">
              {project.slug}
            </div>
            <p className="text-[10px] text-[#3B3B3B] mt-1">Slug is immutable after creation.</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => save()}
              disabled={!dirty || saving || !name.trim()}
              className="h-9 px-4 bg-[#3B82F6] hover:bg-[#3B82F6]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-opacity"
            >
              <Save size={13} />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Danger zone"
        className="border-[#EF4444]/20"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Delete this project</p>
            <p className="text-xs text-[#52525B] mt-0.5">
              Permanently deletes all databases, buckets, and keys. This cannot be undone.
            </p>
          </div>
          <button
            onClick={() => setShowDelete(true)}
            className="shrink-0 h-9 px-4 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 text-[#EF4444] text-sm font-medium rounded-lg flex items-center gap-2 transition-all"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete project?"
        message="All databases, storage buckets, and API keys in this project will be permanently destroyed. This action cannot be reversed."
        confirmLabel="Delete project"
        loading={deleting}
        requiresTyping="delete"
        onConfirm={() => destroy()}
      />
    </div>
  )
}

// ─── Keys tab ─────────────────────────────────────────────────────────────────

function KeysTab({ projectId }: { projectId: string }) {
  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys", projectId],
    queryFn: () => listAPIKeys(projectId),
  })

  const anonKey = keys?.find((k) => k.type === "anon")
  const serviceKey = keys?.find((k) => k.type === "service")

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#52525B]">
        Use the anon key for client-side requests and the service key for trusted server-side code only.
      </p>
      {isLoading ? (
        <KeysCardSkeleton />
      ) : (
        <>
          <KeysCard keyRecord={anonKey} type="anon" projectId={projectId} />
          <KeysCard keyRecord={serviceKey} type="service" projectId={projectId} />
        </>
      )}
    </div>
  )
}

// ─── Members tab ─────────────────────────────────────────────────────────────

function MembersTab() {
  return (
    <SectionCard title="Team members" icon={Users}>
      <div className="py-8 text-center">
        <Users size={24} className="text-[#27272A] mx-auto mb-3" />
        <p className="text-sm font-medium text-[#52525B]">Team management coming soon</p>
        <p className="text-xs text-[#3B3B3B] mt-1">
          Multi-user project access will be available in a future release.
        </p>
      </div>
    </SectionCard>
  )
}
