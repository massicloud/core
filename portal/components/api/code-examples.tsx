"use client"

import { getApiBaseUrl } from "@/lib/api"
import { buildAuthSnippets } from "@/lib/code-snippets"
import { CodeSnippetTabs } from "@/components/ui/code-snippet-tabs"

interface Props {
  slug: string
  dbName: string
  anonKeyPrefix: string
}

export function CodeExamples({ slug, dbName, anonKeyPrefix }: Props) {
  const snippets = buildAuthSnippets({
    projectSlug: slug,
    stage: 'production',
    dbName,
    anonKeyDisplay: anonKeyPrefix,
    apiBaseURL: typeof window !== "undefined" ? getApiBaseUrl() : undefined,
  })

  return (
    <div className="bg-[#111111] border border-[#27272A] rounded-xl overflow-hidden">
      <CodeSnippetTabs
        snippets={snippets}
        defaultLang="sdk"
        installHint="npm install @massicloud/client"
        className="border-0 rounded-none"
      />
    </div>
  )
}
