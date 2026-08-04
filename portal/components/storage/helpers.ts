import { formatDistanceToNow } from "date-fns"

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function formatRelativeTime(date: string): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return date
  }
}

export function fileName(key: string): string {
  return key.split("/").filter(Boolean).pop() ?? key
}

export function folderName(folder: string): string {
  return folder.replace(/\/$/, "").split("/").filter(Boolean).pop() ?? folder
}
