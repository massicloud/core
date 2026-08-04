"use client"

import { Folder } from "lucide-react"
import { useRouter } from "next/navigation"
import { FileIcon } from "./file-icon"
import { FileActionsDropdown } from "./file-actions-dropdown"
import { formatBytes, formatRelativeTime, fileName, folderName } from "./helpers"
import { canPreview } from "./file-preview-modal"
import type { ListObjectsResult, StorageObject } from "@/types"
import { cn } from "@/lib/utils"

interface FileListProps {
  contents: ListObjectsResult
  prefix: string
  bucketName: string
  selectedKeys: Set<string>
  onSelectionChange: (keys: Set<string>) => void
  onPreview: (object: StorageObject) => void
}

export function FileList({
  contents,
  prefix,
  bucketName,
  selectedKeys,
  onSelectionChange,
  onPreview,
}: FileListProps) {
  const allKeys = contents.objects.map((o) => o.key)
  const allSelected =
    allKeys.length > 0 && allKeys.every((k) => selectedKeys.has(k))

  function toggleSelectAll() {
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(allKeys))
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-[#0D0D0D] border-b border-[#1F1F23]">
          <tr>
            <th className="w-10 px-4 py-2.5">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="rounded border-[#27272A] bg-[#1A1A1A] accent-[#3B82F6]"
              />
            </th>
            <th className="text-left text-[11px] font-semibold text-[#52525B] uppercase tracking-wider px-4 py-2.5">
              Name
            </th>
            <th className="text-left text-[11px] font-semibold text-[#52525B] uppercase tracking-wider px-4 py-2.5 w-24">
              Size
            </th>
            <th className="text-left text-[11px] font-semibold text-[#52525B] uppercase tracking-wider px-4 py-2.5 w-36">
              Type
            </th>
            <th className="text-left text-[11px] font-semibold text-[#52525B] uppercase tracking-wider px-4 py-2.5 w-40">
              Modified
            </th>
            <th className="w-12 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {contents.folders.map((folder) => (
            <FolderRow key={folder} folder={folder} bucketName={bucketName} />
          ))}
          {contents.objects.map((obj) => (
            <FileRow
              key={obj.key}
              object={obj}
              bucketName={bucketName}
              currentPrefix={prefix}
              selected={selectedKeys.has(obj.key)}
              onSelect={(checked) => {
                const next = new Set(selectedKeys)
                if (checked) next.add(obj.key)
                else next.delete(obj.key)
                onSelectionChange(next)
              }}
              onPreview={() => onPreview(obj)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FolderRow({
  folder,
  bucketName,
}: {
  folder: string
  bucketName: string
}) {
  const router = useRouter()
  return (
    <tr
      onClick={() =>
        router.push(
          `/storage/${bucketName}?prefix=${encodeURIComponent(folder)}`
        )
      }
      className="border-b border-[#111111] hover:bg-[#111111] cursor-pointer transition-colors"
    >
      <td className="px-4 py-2.5" />
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Folder size={14} className="text-[#3B82F6]" />
          <span className="text-sm text-white font-medium">
            {folderName(folder)}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-[#52525B]">—</td>
      <td className="px-4 py-2.5 text-xs text-[#52525B]">Folder</td>
      <td className="px-4 py-2.5 text-xs text-[#52525B]">—</td>
      <td className="px-4 py-2.5" />
    </tr>
  )
}

interface FileRowProps {
  object: StorageObject
  bucketName: string
  currentPrefix: string
  selected: boolean
  onSelect: (checked: boolean) => void
  onPreview: () => void
}

function FileRow({
  object,
  bucketName,
  currentPrefix,
  selected,
  onSelect,
  onPreview,
}: FileRowProps) {
  const previewable = canPreview(object.content_type, object.key)
  const name = fileName(object.key)

  return (
    <tr
      className={cn(
        "border-b border-[#111111] transition-colors group",
        selected ? "bg-[#1D3461]/30" : "hover:bg-[#111111]"
      )}
    >
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="rounded border-[#27272A] bg-[#1A1A1A] accent-[#3B82F6]"
        />
      </td>
      <td className="px-4 py-2.5">
        <button
          onClick={onPreview}
          disabled={!previewable}
          className={cn(
            "flex items-center gap-2.5 min-w-0 max-w-full text-left",
            previewable
              ? "hover:text-[#3B82F6] cursor-pointer"
              : "cursor-default"
          )}
          title={previewable ? "Click to preview" : undefined}
        >
          <FileIcon name={name} size={14} className="shrink-0" />
          <span
            className={cn(
              "text-sm font-mono truncate transition-colors",
              previewable
                ? "text-white group-hover:text-[#A1A1AA]"
                : "text-white"
            )}
          >
            {name}
          </span>
        </button>
      </td>
      <td className="px-4 py-2.5 text-xs text-[#A1A1AA] font-mono">
        {formatBytes(object.size)}
      </td>
      <td className="px-4 py-2.5">
        <span className="text-xs text-[#52525B] truncate block max-w-[120px]">
          {object.content_type || "unknown"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-[#52525B]">
        {formatRelativeTime(object.last_modified)}
      </td>
      <td className="px-4 py-2.5">
        <FileActionsDropdown
          object={object}
          bucketName={bucketName}
          currentPrefix={currentPrefix}
          onPreview={onPreview}
        />
      </td>
    </tr>
  )
}
