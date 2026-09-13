"use client"

import { useCallback, useState } from "react"
import Editor, { type OnMount } from "@monaco-editor/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  insertMongoDocument,
  updateMongoDocument,
  deleteMongoDocument,
} from "@/lib/mongo-api"
import { applyMassicloudTheme, MONACO_EDITOR_OPTIONS } from "./monaco-theme"

interface Props {
  instanceId: string
  collection: string
  document: Record<string, unknown> | null // null = creating a new document
  onClose: () => void
  onSaved: () => void
}

export function DocumentEditor({ instanceId, collection, document, onClose, onSaved }: Props) {
  const isNew = document === null
  const [text, setText] = useState(() => JSON.stringify(document ?? {}, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const queryClient = useQueryClient()

  const handleMount: OnMount = useCallback((_editor, monaco) => {
    applyMassicloudTheme(monaco)
  }, [])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["mongo-documents", instanceId, collection] })
    queryClient.invalidateQueries({ queryKey: ["mongo-collections", instanceId] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error("Invalid JSON")
      }
      if (isNew) {
        return insertMongoDocument(instanceId, collection, parsed)
      }
      const original = document as Record<string, unknown>
      const changed: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (key === "_id") continue
        if (JSON.stringify(value) !== JSON.stringify(original[key])) {
          changed[key] = value
        }
      }
      if (Object.keys(changed).length === 0) return null
      const docId = String(original._id)
      return updateMongoDocument(instanceId, collection, docId, changed)
    },
    onSuccess: () => {
      toast.success(isNew ? "Document created" : "Document saved")
      invalidate()
      onSaved()
      onClose()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteMongoDocument(instanceId, collection, String((document as Record<string, unknown>)._id)),
    onSuccess: () => {
      toast.success("Document deleted")
      invalidate()
      onSaved()
      onClose()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
  })

  function handleChange(value: string | undefined) {
    setText(value ?? "")
    try {
      JSON.parse(value ?? "")
      setParseError(null)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON")
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={isNew ? "New document" : "Edit document"}
        description={isNew ? undefined : `_id: ${String((document as Record<string, unknown>)._id)}`}
        size="lg"
        footer={
          <>
            {!isNew && (
              <Button
                variant="ghost"
                className="mr-auto text-red-400 hover:text-red-300"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={() => saveMutation.mutate()}
              disabled={!!parseError || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="h-[400px] rounded-lg overflow-hidden border border-[#27272A]">
          <Editor
            height="100%"
            defaultLanguage="json"
            value={text}
            onChange={handleChange}
            onMount={handleMount}
            loading={
              <div className="h-full w-full flex items-center justify-center text-xs text-[#52525B] bg-[#09090B]">
                Loading editor…
              </div>
            }
            options={MONACO_EDITOR_OPTIONS}
          />
        </div>
        {parseError && <p className="text-xs text-red-400 mt-2">{parseError}</p>}
      </Modal>

      {!isNew && (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={() => deleteMutation.mutate()}
          title="Delete document"
          message="Are you sure you want to delete this document? This action cannot be undone."
          confirmLabel="Delete document"
          loading={deleteMutation.isPending}
        />
      )}
    </>
  )
}
