"use client"

import { type ReactNode, useState } from "react"
import { Upload } from "lucide-react"

interface FileDropZoneProps {
  children: ReactNode
  onFileDrop: (files: File[]) => void
}

export function FileDropZone({ children, onFileDrop }: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false)

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length > 0) {
      onFileDrop(dropped)
    }
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 relative flex flex-col overflow-hidden"
    >
      {children}

      {dragOver && (
        <div className="absolute inset-0 bg-[#1D3461]/30 backdrop-blur-sm border-2 border-dashed border-[#3B82F6] flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center">
            <Upload size={48} className="text-[#3B82F6] mx-auto mb-3" />
            <p className="text-white font-medium text-lg">Drop files to upload</p>
          </div>
        </div>
      )}
    </div>
  )
}
