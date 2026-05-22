import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TopbarProps {
  title: string
  actions?: ReactNode
  className?: string
}

export function Topbar({ title, actions, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between px-6 py-3 border-b border-border bg-bg sticky top-0 z-10',
        className,
      )}
    >
      <h1 className="text-xl font-semibold text-fg">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
