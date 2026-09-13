import type { Monaco } from "@monaco-editor/react"

// Shared with the Postgres SQL editor (postgres/[id]/explore/tabs/sql-monaco.tsx) —
// same palette, kept as a small standalone helper here rather than importing
// across the postgres/mongo route boundary.
export function applyMassicloudTheme(monaco: Monaco) {
  monaco.editor.defineTheme("massicloud-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "52525B", fontStyle: "italic" },
      { token: "keyword", foreground: "3B82F6", fontStyle: "bold" },
      { token: "string", foreground: "22C55E" },
      { token: "number", foreground: "D4A843" },
      { token: "operator", foreground: "A1A1AA" },
      { token: "type", foreground: "A855F7" },
    ],
    colors: {
      "editor.background": "#09090B",
      "editor.foreground": "#E4E4E7",
      "editorLineNumber.foreground": "#3F3F46",
      "editorLineNumber.activeForeground": "#71717A",
      "editor.selectionBackground": "#1D346150",
      "editor.lineHighlightBackground": "#111113",
      "editorCursor.foreground": "#D4A843",
      "editorGutter.background": "#09090B",
      "editorIndentGuide.background": "#1E1E24",
      "editorIndentGuide.activeBackground": "#27272A",
      "scrollbarSlider.background": "#27272A60",
      "scrollbarSlider.hoverBackground": "#3F3F4680",
      "scrollbarSlider.activeBackground": "#52525B80",
      "editorWidget.background": "#111113",
      "editorWidget.border": "#27272A",
      "input.background": "#18181B",
      "input.border": "#27272A",
      focusBorder: "#3B82F6",
    },
  })
  monaco.editor.setTheme("massicloud-dark")
}

export const MONACO_EDITOR_OPTIONS = {
  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
  fontSize: 13,
  lineHeight: 21,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: "off" as const,
  renderLineHighlight: "line" as const,
  smoothScrolling: true,
  cursorBlinking: "smooth" as const,
  cursorStyle: "line" as const,
  padding: { top: 14, bottom: 14 },
  fixedOverflowWidgets: true,
  automaticLayout: true,
}
