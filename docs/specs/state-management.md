# 状态管理规范

> 适用范围：`apps/web` 前端应用
> 最后更新：2026-05-22

---

## 1. 状态管理策略概述

| 状态类型 | 方案 | 适用场景 |
|----------|------|----------|
| 全局客户端状态 | **Zustand** | 认证信息、全局 UI 状态（侧边栏、当前招标 ID） |
| 服务端远程状态 | **SWR** | 数据获取、缓存、自动重验证 |
| 表单状态 | **React Hook Form** | 所有表单输入与验证 |
| 本地 UI 状态 | **useState / useReducer** | 单组件内的临时状态（弹窗开关、tab 切换） |

### 为什么不用 TanStack Query（React Query）

项目已封装 `src/lib/api-client.ts`（axios）作为统一请求层。SWR 与 axios 搭配更轻量，
无需引入额外的 QueryClient Provider，且满足本项目的缓存需求，故选用 SWR。

---

## 2. Zustand Store 设计

### 2.1 authStore — 认证状态

**文件**：`apps/web/src/stores/auth.store.ts`

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRole } from '@decoration-bidding/shared-types'

interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  companyId: string
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthActions {
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
  updateToken: (token: string) => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      // 初始状态
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,

      // Actions
      setAuth: (token, user) =>
        set({ accessToken: token, user, isAuthenticated: true, isLoading: false }),

      clearAuth: () =>
        set({ accessToken: null, user: null, isAuthenticated: false }),

      updateToken: (token) =>
        set({ accessToken: token }),
    }),
    {
      name: 'auth-storage',        // localStorage key
      partialize: (state) => ({    // 只持久化 token 和 user，不持久化 isLoading
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
```

**使用示例**

```ts
// 登录后写入
const { setAuth } = useAuthStore()
setAuth(response.accessToken, response.user)

// 路由守卫中读取
const { isAuthenticated, user } = useAuthStore()
```

---

### 2.2 uiStore — 全局 UI 状态

**文件**：`apps/web/src/stores/ui.store.ts`

```ts
import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  currentTenderId: string | null  // 用于面包屑导航与上下文传递
}

interface UIActions {
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setCurrentTender: (id: string | null) => void
}

export const useUIStore = create<UIState & UIActions>()((set) => ({
  // 初始状态
  sidebarCollapsed: false,
  currentTenderId: null,

  // Actions
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),

  setCurrentTender: (id) =>
    set({ currentTenderId: id }),
}))
```

**使用示例**

```ts
// 侧边栏组件
const { sidebarCollapsed, toggleSidebar } = useUIStore()

// 招标详情页进入时设置
const { setCurrentTender } = useUIStore()
useEffect(() => {
  setCurrentTender(params.id)
  return () => setCurrentTender(null)
}, [params.id])
```

---

## 3. SWR 数据获取规范

### 3.1 全局 SWR 配置

**文件**：`apps/web/src/lib/swr-config.ts`

```ts
import type { SWRConfiguration } from 'swr'
import apiClient from './api-client'
import { useAuthStore } from '@/stores/auth.store'

export const swrFetcher = (url: string) =>
  apiClient.get(url).then((res) => res.data.data)

export const swrConfig: SWRConfiguration = {
  fetcher: swrFetcher,
  revalidateOnFocus: false,   // 防止用户切换标签页时频繁重请求
  errorRetryCount: 2,
  onError: (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      // Next.js 路由跳转由 middleware.ts 处理
    }
  },
}
```

在根布局注册：

```tsx
// apps/web/src/app/layout.tsx
import { SWRConfig } from 'swr'
import { swrConfig } from '@/lib/swr-config'

export default function RootLayout({ children }) {
  return (
    <SWRConfig value={swrConfig}>
      {children}
    </SWRConfig>
  )
}
```

---

### 3.2 SWR Key 命名约定

| 数据 | SWR Key |
|------|---------|
| 招标列表 | `/api/tenders` |
| 单个招标 | `/api/tenders/${id}` |
| 投标详情 | `/api/bids/${id}` |
| 经济标清单 | `/api/bids/${id}/items` |
| 公司信息 | `/api/org/company` |
| 成员列表 | `/api/org/members` |
| 物料库（分页+搜索） | `/api/org/materials?search=${q}&page=${p}` |

> Key 必须与 core-service 实际路由路径对应，不得自造路径。

---

### 3.3 自定义 Hook 封装示例

```ts
// apps/web/src/hooks/use-tender.ts
import useSWR from 'swr'
import type { Tender } from '@decoration-bidding/shared-types'

export function useTender(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Tender>(
    id ? `/api/tenders/${id}` : null
  )
  return { tender: data, error, isLoading, mutate }
}
```

---

### 3.4 乐观更新示例（bid-item 数量修改）

```ts
import useSWR, { useSWRConfig } from 'swr'
import apiClient from '@/lib/api-client'

export function useBidItems(bidId: string) {
  const key = `/api/bids/${bidId}/items`
  const { data, mutate } = useSWR(key)
  const { mutate: globalMutate } = useSWRConfig()

  const updateItem = async (itemId: string, quantity: number) => {
    // 1. 乐观更新本地缓存
    const optimisticData = data?.map((item) =>
      item.id === itemId ? { ...item, quantity } : item
    )
    await mutate(
      async () => {
        // 2. 发送实际请求
        const res = await apiClient.put(`/api/bid-items/${itemId}`, { quantity })
        return res.data.data
      },
      {
        optimisticData,
        rollbackOnError: true,   // 失败时自动回滚
        revalidate: false,
      }
    )
  }

  return { items: data, updateItem }
}
```

---

## 4. React Hook Form 规范

- 所有表单必须使用 React Hook Form（RHF），禁止受控 `useState` 管理表单字段
- 配合 `@hookform/resolvers/zod` 做前端 Schema 验证
- 字段 `name` 与 API 请求体字段名称保持一致，降低转换成本
- 提交时直接将 `formData` 传入 `apiClient.post/put`

**示例**

```ts
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1, '标题不能为空'),
  budget: z.number().positive('预算须为正数'),
})

type FormValues = z.infer<typeof schema>

export function TenderForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormValues) => {
    await apiClient.post('/api/tenders', data)
    mutate('/api/tenders')   // 提交成功后刷新列表缓存
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('title')} />
      {errors.title && <span>{errors.title.message}</span>}
    </form>
  )
}
```

---

## 5. Store 文件结构

```
apps/web/src/stores/
├── auth.store.ts      # 认证状态（accessToken、user、isAuthenticated）
├── ui.store.ts        # 全局 UI 状态（sidebar、currentTenderId）
└── index.ts           # re-export，统一入口
```

`index.ts` 内容：

```ts
export { useAuthStore } from './auth.store'
export { useUIStore } from './ui.store'
```

---

## 6. 数据流说明

```
页面组件
  └─► useSWR(key)
        └─► swrFetcher(url)
              └─► api-client.get(url)        ← axios 实例，自动附加 Authorization header
                    └─► core-service API
                          └─► 返回 ApiResponse<T>

更新操作：
  RHF handleSubmit
    └─► api-client.post/put(url, data)
          └─► core-service API
                └─► 成功后调用 mutate(key) 刷新 SWR 缓存
```

> `api-client.ts` 需在请求拦截器中从 `useAuthStore.getState().accessToken` 读取 token，
> 并在响应拦截器中处理 401（触发 token 刷新或跳转登录页）。
