'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const navItems = [
  {
    label: '商机仪表板',
    href: '/dashboard',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0">
        <path d="M0 1.75A.75.75 0 01.75 1h14.5a.75.75 0 010 1.5H.75A.75.75 0 010 1.75zM0 8a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H.75A.75.75 0 010 8zm0 6.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H.75a.75.75 0 01-.75-.75z" />
      </svg>
    ),
  },
  {
    label: '招标项目',
    href: '/tenders',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0">
        <path d="M2 1.75C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v14.5A.75.75 0 0113.25 17H2.75a.75.75 0 01-.75-.75V1.75zM3.75 1.5a.25.25 0 00-.25.25V15h9V1.75a.25.25 0 00-.25-.25h-8.5z" />
        <path d="M5 5h6v1.5H5V5zm0 3h6v1.5H5V8zm0 3h4v1.5H5V11z" />
      </svg>
    ),
  },
  {
    label: '投标工作台',
    href: '/bids',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0">
        <path d="M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zM8 0a8 8 0 100 16A8 8 0 008 0zm.5 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 00.471.696l2.5 1a.75.75 0 00.558-1.392L8.5 7.742V4.75z" />
      </svg>
    ),
  },
]

const managementItems = [
  {
    label: '组织设置',
    href: '/settings',
    icon: <Settings className="w-4 h-4 shrink-0" />,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <>
    <aside
      className="flex flex-col h-screen w-[240px] bg-surface border-r border-border sticky top-0"
      aria-label="主导航"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 pb-4 pt-4 border-b border-border">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect width="20" height="20" rx="4" fill="#0969da" />
          <path d="M5 10h10M10 5v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="font-semibold text-[15px] text-fg">投标管理系统</span>
      </div>

      {/* 主导航 */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <p className="px-4 pt-2 pb-1 text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">
          核心功能
        </p>
        <ul>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-[6px] text-[13px] transition-colors',
                  isActive(item.href)
                    ? 'bg-[#ddf4ff] text-[#0969da] font-semibold'
                    : 'text-fg hover:bg-black/[0.04]',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">
          管理
        </p>
        <ul>
          {managementItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-[6px] text-[13px] transition-colors',
                  isActive(item.href)
                    ? 'bg-[#ddf4ff] text-[#0969da] font-semibold'
                    : 'text-fg hover:bg-black/[0.04]',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* 用户信息 */}
      {user && (
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#0969da] text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-fg truncate">{user.email}</div>
              <div className="text-[11px] text-muted truncate">
                {/* companyName 如果有的话，否则显示 email */}
                {user.email}
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              title="退出登录"
              className="ml-auto p-1 text-muted hover:text-fg hover:bg-inset rounded-[4px] transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>

    {/* Logout confirm modal */}
    {showLogoutConfirm && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-bg border border-border rounded-[6px] w-[360px] max-w-[90vw]">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm text-fg">
            确认退出登录
          </div>
          <div className="px-4 py-4 text-sm text-muted">
            退出后需要重新输入账号密码才能登录，确认继续？
          </div>
          <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="px-3 py-[3px] text-xs border border-border rounded-[6px] bg-surface hover:bg-inset text-fg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-[3px] text-xs bg-[#cf222e] hover:bg-[#a40e26] text-white rounded-[6px] font-medium transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
