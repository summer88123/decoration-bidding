'use client'
// apps/web/src/components/auth-provider.tsx
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/lib/api-client'
import type { User } from '@decoration-bidding/shared-types'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  useEffect(() => {
    apiClient
      .post<{ data: { accessToken: string; user: User } }>('/api/auth/refresh')
      .then(({ data }) => setAuth(data.data.accessToken, data.data.user))
      .catch(() => clearAuth())
  }, [])

  return <>{children}</>
}
