// apps/web/src/lib/api-client.ts
import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth-store'

// 使用相对路径，通过 Next.js rewrites 代理到 core-service
// 这样 cookie 统一设置在 localhost:3000 域，proxy.ts 可以正确读取
const BASE_URL = typeof window === 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080')
  : ''

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  withCredentials: true,
})

let isRefreshing = false
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)))
  pendingQueue = []
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error)
    if (original.url?.includes('/api/auth/refresh')) {
      // refresh 端点 401：清除认证状态并跳转登录页
      useAuthStore.getState().clearAuth()
      if (typeof window !== 'undefined') {
        // 清除 logged_in 标记 cookie，防止 proxy.ts 将 /login 重定向回 /dashboard 造成循环
        document.cookie = 'logged_in=; path=/; max-age=0'
        // 仅在非登录页时跳转，避免在登录页因 refresh 失败造成无限重载
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }
    // 其他 auth 端点（login/logout 等）401 直接拒绝，不触发 token 刷新重试
    // 否则登录密码错误等 401 会被错误地触发 refresh，导致 "RefreshToken 已被吊销" 误报
    if (original.url?.includes('/api/auth/')) {
      return Promise.reject(error)
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((token) => {
        original._retry = true
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` }
        return apiClient(original)
      })
    }
    original._retry = true
    isRefreshing = true
    try {
      const { data } = await apiClient.post<{ data: { accessToken: string } }>('/api/auth/refresh')
      const newToken = data.data.accessToken
      useAuthStore.getState().setAccessToken(newToken)
      processQueue(null, newToken)
      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` }
      return apiClient(original)
    } catch (refreshError) {
      processQueue(refreshError, null)
      useAuthStore.getState().clearAuth()
      if (typeof window !== 'undefined') {
        // 清除 logged_in 标记 cookie，防止 proxy.ts 将 /login 重定向回 /dashboard 造成循环
        document.cookie = 'logged_in=; path=/; max-age=0'
        // 仅在非登录页时跳转，避免在登录页因 refresh 失败造成无限重载
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default apiClient
