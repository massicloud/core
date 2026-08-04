"use client"

import { useRef, useCallback } from "react"
import Editor, { type OnMount } from "@monaco-editor/react"

interface Props {
  value: string
  onChange: (value: string) => void
  onRun: () => void
}

export default function SqlMonaco({ value, onChange, onRun }: Props) {
  const onRunRef = useRef(onRun)
  onRunRef.current = onRun

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monaco.editor.defineTheme("massicloud-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment",  foreground: "52525B", fontStyle: "italic" },
        { token: "keyword",  foreground: "3B82F6", fontStyle: "bold" },
        { token: "string",   foreground: "22C55E" },
        { token: "number",   foreground: "D4A843" },
        { token: "operator", foreground: "A1A1AA" },
        { token: "type",     foreground: "A855F7" },
      ],
      colors: {
        "editor.background":                   "#09090B",
        "editor.foreground":                   "#E4E4E7",
        "editorLineNumber.foreground":         "#3F3F46",
        "editorLineNumber.activeForeground":   "#71717A",
        "editor.selectionBackground":          "#1D346150",
        "editor.lineHighlightBackground":      "#111113",
        "editorCursor.foreground":             "#D4A843",
        "editorGutter.background":             "#09090B",
        "editorIndentGuide.background":        "#1E1E24",
        "editorIndentGuide.activeBackground":  "#27272A",
        "scrollbarSlider.background":          "#27272A60",
        "scrollbarSlider.hoverBackground":     "#3F3F4680",
        "scrollbarSlider.activeBackground":    "#52525B80",
        "editorWidget.background":             "#111113",
        "editorWidget.border":                 "#27272A",
        "editorSuggestWidget.background":      "#111113",
        "editorSuggestWidget.border":          "#27272A",
        "editorSuggestWidget.selectedBackground": "#1D3461",
        "editorSuggestWidget.highlightForeground": "#3B82F6",
        "input.background":                    "#18181B",
        "input.border":                        "#27272A",
        "focusBorder":                         "#3B82F6",
      },
    })
    monaco.editor.setTheme("massicloud-dark")

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => onRunRef.current()
    )

    editor.updateOptions({ tabSize: 2, insertSpaces: true })
  }, [])

  return (
    <Editor
      height="100%"
      defaultLanguage="sql"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      loading={
        <div className="h-full w-full flex items-center justify-center text-xs text-[#52525B] bg-[#09090B]">
          Loading editor…
        </div>
      }
      options={{
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
        fontSize: 13,
        lineHeight: 21,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "off",
        renderLineHighlight: "line",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorStyle: "line",
        padding: { top: 14, bottom: 14 },
        fixedOverflowWidgets: true,
        automaticLayout: true,
        suggest: { showKeywords: true, showSnippets: true },
        quickSuggestionsDelay: 100,
      }}
    />
  )
}
