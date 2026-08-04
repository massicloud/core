import type { ReactNode } from "react"

interface Props {
  children: ReactNode
  params: { id: string }
}

export default function ProjectLayout({ children }: Props) {
  return <>{children}</>
}
