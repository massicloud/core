"use client";

import type { Instance, InstanceKind, InstanceStatus } from "@/types";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy, Database, ExternalLink, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorMessage } from "@/lib/api";
import { toast } from "sonner";

interface InstanceTableProps {
  instances: Instance[];
  kind: InstanceKind;
  onCreateClick: () => void;
  onDeleteClick: (instance: Instance) => void;
}

const statusVariant: Record<InstanceStatus, "success" | "danger" | "gold"> = {
  running: "success",
  stopped: "danger",
  error: "gold",
};

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function maskDsn(instance: Instance, kind: InstanceKind) {
  if (kind === "postgres") {
    return `postgresql://****@${instance.host}:${instance.port}/${instance.name}`;
  }

  return `redis://****@${instance.host}:${instance.port}`;
}

function kindIcon(kind: InstanceKind) {
  return kind === "postgres" ? Database : Zap;
}

export function InstanceTable({ instances, kind, onCreateClick, onDeleteClick }: InstanceTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const Icon = useMemo(() => kindIcon(kind), [kind]);
  const router = useRouter();

  const copyDsn = async (instance: Instance) => {
    try {
      await navigator.clipboard.writeText(instance.dsn);
      setCopiedId(instance.id);
      toast.success("DSN copied to clipboard");
      window.setTimeout(() => setCopiedId((current) => (current === instance.id ? null : current)), 1500);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (instances.length === 0) {
    return (
      <Card className="border-[#27272A] bg-[#1A1A1A]">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#27272A] bg-[#111111] text-[#A1A1AA]">
            <Icon className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold text-[#FAFAFA]">
              {kind === "postgres" ? "No databases yet" : "No Redis instances yet"}
            </CardTitle>
            <CardDescription className="max-w-md text-base text-[#A1A1AA]">
              {kind === "postgres"
                ? "Create your first Postgres database to get started"
                : "Create your first Redis instance to get started"}
            </CardDescription>
          </div>
          <Button onClick={onCreateClick} className="mt-2">
            {kind === "postgres" ? "Create Database" : "Create Redis Instance"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-[#27272A] bg-[#1A1A1A]">
      <CardHeader className="border-b border-[#27272A]">
        <CardTitle className="text-[#FAFAFA]">
          {kind === "postgres" ? "Postgres instances" : "Redis instances"}
        </CardTitle>
        <CardDescription>
          Manage running services, connection details, and lifecycle actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Host:Port</TableHead>
                <TableHead>DSN</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((instance) => {
                const isExplorable = kind === "postgres";
                return (
                <TableRow
                  key={instance.id}
                  className={isExplorable ? "cursor-pointer hover:bg-[#1A1A1A]" : "hover:bg-[#1A1A1A]"}
                  onClick={() => {
                    if (isExplorable) {
                      router.push(`/postgres/${instance.id}/explore`);
                    }
                  }}
                >
                  <TableCell className="font-medium text-[#FAFAFA]">{instance.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[instance.status]} className="capitalize border">
                      {instance.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[#A1A1AA]">
                    {instance.host}:{instance.port}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="max-w-64 truncate font-mono text-xs text-[#A1A1AA]">
                        {maskDsn(instance, kind)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#A1A1AA]"
                        onClick={(event) => {
                          event.stopPropagation();
                          void copyDsn(instance);
                        }}
                        aria-label="Copy DSN"
                      >
                        {copiedId === instance.id ? (
                          <ExternalLink className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-[#A1A1AA]">{formatRelativeTime(instance.created_at)}</TableCell>
                   <TableCell className="text-right">
                     <div className="flex items-center justify-end gap-1">
                      {kind === "postgres" ? <ChevronRight className="h-4 w-4 text-[#71717A]" /> : null}
                     <Button
                       type="button"
                       variant="ghost"
                       size="icon"
                       className="text-[#A1A1AA] hover:text-red-300"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteClick(instance);
                        }}
                       aria-label={`Delete ${instance.name}`}
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
                     </div>
                   </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
