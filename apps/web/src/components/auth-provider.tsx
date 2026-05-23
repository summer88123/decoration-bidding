'use client'
// apps/web/src/components/auth-provider.tsx
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/lib/api-client'
import type { User } from '@decoration-bidding/shared-types'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  // 防止 React 18 Strict Mode 在开发环境中双重触发 useEffect，
  // 避免同一个 refresh_token 被使用两次导致第二次请求返回 TOKEN_REVOKED。
  const initiated = useRef(false)
  // 初始化完成前阻止子组件渲染，防止页面组件在 auth 未就绪时并发发起 API 请求，
  // 与 AuthProvider 的 refresh 请求产生竞态条件（两次并发 refresh 导致 TOKEN_REVOKED）。
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (initiated.current) return
    initiated.current = true
    apiClient
      .post<{ data: { accessToken: string; user: User } }>('/api/auth/refresh')
      .then(({ data }) => {
        setAuth(data.data.accessToken, data.data.user)
      })
      .catch(() => {
        clearAuth()
      })
      .finally(() => {
        setReady(true)
      })
  }, [])

  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
