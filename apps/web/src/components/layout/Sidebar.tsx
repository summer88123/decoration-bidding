'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Settings,
  Mic,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: '商机仪表板',
    href: '/tenders',
    icon: LayoutDashboard,
  },
  {
    label: '投标管理',
    href: '/bids',
    icon: FileText,
  },
  {
    label: '语音助手',
    href: '/voice',
    icon: Mic,
  },
]

const bottomItems = [
  {
    label: '组织设置',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="flex flex-col h-screen w-sidebar bg-surface border-r border-border sticky top-0"
      aria-label="主导航"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <Building2 className="w-5 h-5 text-accent" />
        <span className="font-semibold text-base text-fg">投标辅助系统</span>
      </div>

      {/* 主导航 */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <p className="px-4 mb-1 text-2xs font-semibold text-muted uppercase tracking-wider">
          主功能
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-1.5 text-sm rounded-[var(--radius)] mx-2 transition-colors',
                    isActive
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-fg hover:bg-inset',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 底部导航（设置等） */}
      <div className="border-t border-border py-3">
        <ul className="space-y-0.5">
          {bottomItems.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-1.5 text-sm rounded-[var(--radius)] mx-2 transition-colors',
                    isActive
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-fg hover:bg-inset',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
