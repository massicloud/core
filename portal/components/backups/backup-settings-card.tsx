"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Calendar, Loader2, Pause, Shield } from "lucide-react"
import { updateBackupSettings } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Instance } from "@/types"

interface BackupSettingsCardProps {
  instance: Instance
  onUpdate: () => void
}

function ScheduleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium transition-all",
        active
          ? "bg-[#1D3461] text-[#3B82F6] border-[#3B82F6]"
          : "bg-[#1A1A1A] text-[#A1A1AA] border-[#27272A] hover:border-[#3B82F6]/40 hover:text-white"
      )}
    >
      {children}
    </button>
  )
}

export function BackupSettingsCard({ instance, onUpdate }: BackupSettingsCardProps) {
  const [schedule, setSchedule] = useState(instance.backup_schedule ?? "daily")
  const [retention, setRetention] = useState(instance.retention_days ?? 7)

  const isDirty =
    schedule !== (instance.backup_schedule ?? "daily") ||
    retention !== (instance.retention_days ?? 7)

  const reset = () => {
    setSchedule(instance.backup_schedule ?? "daily")
    setRetention(instance.retention_days ?? 7)
  }

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: () =>
      updateBackupSettings(instance.id, {
        backup_schedule: schedule,
        retention_days: retention,
      }),
    onSuccess: () => {
      toast.success("Backup settings saved")
      onUpdate()
    },
    onError: () => {
      toast.error("Failed to save settings")
    },
  })

  return (
    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white mb-0.5">
            Backup Settings
          </h3>
          <p className="text-xs text-[#52525B]">
            Automatic backups are stored in Algeria 🇩🇿
          </p>
        </div>
        <Shield size={20} className="text-[#22C55E]" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Schedule */}
        <div>
          <label className="block text-xs font-medium text-[#A1A1AA] mb-2">
            Schedule
          </label>
          <div className="flex gap-2">
            <ScheduleButton
              active={schedule === "daily"}
              onClick={() => setSchedule("daily")}
            >
              <Calendar size={11} />
              Daily
            </ScheduleButton>
            <ScheduleButton
              active={schedule === "disabled"}
              onClick={() => setSchedule("disabled")}
            >
              <Pause size={11} />
              Disabled
            </ScheduleButton>
          </div>
        </div>

        {/* Retention */}
        <div>
          <label className="block text-xs font-medium text-[#A1A1AA] mb-2">
            Retention
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setRetention(days)}
                className={cn(
                  "h-9 rounded-md text-xs font-medium transition-all border",
                  retention === days
                    ? "bg-[#1D3461] text-[#3B82F6] border-[#3B82F6]"
                    : "bg-[#1A1A1A] text-[#A1A1AA] border-[#27272A] hover:border-[#3B82F6]/40"
                )}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-[#1F1F23]">
          <button
            onClick={reset}
            className="text-xs text-[#52525B] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => save()}
            disabled={isSaving}
            className="flex items-center gap-1.5 h-8 px-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-medium rounded-md disabled:opacity-50 transition-colors"
          >
            {isSaving && <Loader2 size={11} className="animate-spin" />}
            Save changes
          </button>
        </div>
      )}
    </div>
  )
}
