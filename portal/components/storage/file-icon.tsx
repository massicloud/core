"use client"

import {
  File,
  FileText,
  FileArchive,
  FileCode2,
  Image,
  Video,
  Music,
} from "lucide-react"

const EXT_MAP: Record<string, { color: string; Icon: typeof File }> = {
  jpg:  { Icon: Image,       color: "#22C55E" },
  jpeg: { Icon: Image,       color: "#22C55E" },
  png:  { Icon: Image,       color: "#22C55E" },
  gif:  { Icon: Image,       color: "#22C55E" },
  webp: { Icon: Image,       color: "#22C55E" },
  svg:  { Icon: Image,       color: "#22C55E" },
  mp4:  { Icon: Video,       color: "#A855F7" },
  webm: { Icon: Video,       color: "#A855F7" },
  mov:  { Icon: Video,       color: "#A855F7" },
  avi:  { Icon: Video,       color: "#A855F7" },
  mp3:  { Icon: Music,       color: "#EC4899" },
  wav:  { Icon: Music,       color: "#EC4899" },
  ogg:  { Icon: Music,       color: "#EC4899" },
  pdf:  { Icon: FileText,    color: "#EF4444" },
  zip:  { Icon: FileArchive, color: "#D4A843" },
  tar:  { Icon: FileArchive, color: "#D4A843" },
  gz:   { Icon: FileArchive, color: "#D4A843" },
  rar:  { Icon: FileArchive, color: "#D4A843" },
  js:   { Icon: FileCode2,   color: "#3B82F6" },
  ts:   { Icon: FileCode2,   color: "#3B82F6" },
  tsx:  { Icon: FileCode2,   color: "#3B82F6" },
  jsx:  { Icon: FileCode2,   color: "#3B82F6" },
  py:   { Icon: FileCode2,   color: "#3B82F6" },
  go:   { Icon: FileCode2,   color: "#3B82F6" },
  rs:   { Icon: FileCode2,   color: "#3B82F6" },
  java: { Icon: FileCode2,   color: "#3B82F6" },
}

interface FileIconProps {
  name: string
  size?: number
  className?: string
}

export function FileIcon({ name, size = 14, className }: FileIconProps) {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const { Icon, color } = EXT_MAP[ext] ?? { Icon: File, color: "#A1A1AA" }
  return <Icon size={size} style={{ color }} className={className} />
}
