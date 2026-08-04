"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Instance, InstanceKind } from "@/types";
import { deletePostgresInstance, deleteRedisInstance, getErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface DeleteInstanceDialogProps {
  kind: InstanceKind;
  instance: Instance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteInstanceDialog({ kind, instance, open, onOpenChange }: DeleteInstanceDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!instance) {
        return;
      }

      if (kind === "postgres") {
        await deletePostgresInstance(instance.id);
        return;
      }

      await deleteRedisInstance(instance.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kind === "postgres" ? queryKeys.postgres : queryKeys.redis });
      toast.success(kind === "postgres" ? "Database deleted" : "Redis instance deleted");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  if (!open || !instance) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-lg rounded-lg border border-[#27272A] bg-[#111111] shadow-2xl shadow-black/50">
        <div className="border-b border-[#27272A] px-6 py-5">
          <h2 className="text-xl font-semibold text-[#FAFAFA]">
            {kind === "postgres" ? "Delete Database" : "Delete Redis Instance"}
          </h2>
        </div>

        <div className="space-y-6 p-6">
          <p className="text-sm leading-6 text-[#A1A1AA]">
            Are you sure you want to delete <span className="font-medium text-[#FAFAFA]">{instance.name}</span>?
            This action cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

