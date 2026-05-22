# 前端设计规范（Frontend Design System）

> 本文档是香港建筑投标辅助系统前端视觉与组件的权威规范，所有 UI 实现须遵循此标准。

---

## 1. 设计令牌（Design Tokens）

以下 CSS 变量定义在 `apps/web/src/app/globals.css` 的 `:root` 中，是所有颜色的唯一来源。

```css
:root {
  /* 背景层级 */
  --bg: #ffffff;           /* 页面底层背景 */
  --surface: #f6f8fa;      /* 卡片、面板背景 */
  --inset: #eaeef2;        /* 内嵌区域、代码块背景 */

  /* 文字 */
  --fg: #1f2328;           /* 主要正文 */
  --muted: #656d76;        /* 次要文字、占位符 */

  /* 边框 */
  --border: #d0d7de;       /* 通用边框 */

  /* 品牌色 */
  --accent: #0969da;       /* 主要交互色（链接、主按钮） */
  --accent-hover: #0550ae; /* 主要交互色悬停态 */

  /* 语义色 */
  --success: #1a7f37;      /* 成功状态 */
  --danger: #cf222e;       /* 危险/错误状态 */
  --warning: #9a6700;      /* 警告状态 */
  --done: #8250df;         /* 已完成/紫色标记 */
  --green-subtle: #dafbe1; /* 成功状态浅背景 */
}
```

---

## 2. Tailwind 配置扩展

文件路径：`apps/web/tailwind.config.ts`

将 CSS 变量映射到 Tailwind 颜色令牌，实现 `bg-surface`、`text-muted` 等原子类。

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* 背景 */
        bg:      'var(--bg)',
        surface: 'var(--surface)',
        inset:   'var(--inset)',

        /* 文字 */
        fg:    'var(--fg)',
        muted: 'var(--muted)',

        /* 边框 */
        border: 'var(--border)',

        /* 品牌色 */
        accent: {
          DEFAULT: 'var(--accent)',
          hover:   'var(--accent-hover)',
        },

        /* 语义色 */
        success: 'var(--success)',
        danger:  'var(--danger)',
        warning: 'var(--warning)',
        done:    'var(--done)',
        'green-subtle': 'var(--green-subtle)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          '"SF Mono"',
          'Menlo',
          'Consolas',
          '"Liberation Mono"',
          'monospace',
        ],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

> **注意**：`tailwindcss-animate` 是 shadcn/ui 动画的依赖，需运行 `pnpm add -D tailwindcss-animate` 安装。

---

## 3. 字体大小规范

| 用途 | 尺寸 | Tailwind 类 |
|------|------|-------------|
| 正文（body） | 14px / 0.875rem | `text-sm` |
| 页面标题（Page Title） | 20px / 1.25rem | `text-xl` |
| 版块标题（Section Title） | 16px / 1rem | `text-base` |
| 次级版块标题 | 18px / 1.125rem | `text-lg` |
| 表格内容 / 导航项 | 13px / 0.8125rem | `text-[13px]` |
| 标签文字（label） | 12px / 0.75rem | `text-xs` |
| 辅助说明（caption） | 11px / 0.6875rem | `text-[11px]` |

**全局基准**：在 `globals.css` 中设置 `html { font-size: 14px; }`，配合 `body { font-family: var(--font-sans); color: var(--fg); }`。

---

## 4. 间距规范

| 场景 | 间距值 | 说明 |
|------|--------|------|
| 页面内容 padding | `24px`（`p-6`） | 主内容区四边 padding |
| 卡片 padding | `16px`（`p-4`） | Card 组件内边距 |
| 表格单元格 | `10px 16px`（`py-2.5 px-4`） | `<td>` / `<th>` |
| 主按钮 | `5px 16px`（`py-[5px] px-4`） | Button default size |
| 小按钮 | `3px 12px`（`py-[3px] px-3`） | Button sm size |
| 徽章（Badge） | `2px 8px`（`py-0.5 px-2`） | 状态标签 |
| 通用圆角 | `6px`（`rounded-md`） | 按钮、输入框、卡片 |

---

## 5. 布局规范

### 整体结构

```
+------------------------------------------+
|  Topbar (~52px height, border-bottom)    |
+----------+-------------------------------+
| Sidebar  |  Main Content Area            |
| (240px)  |  (flex-1, overflow-y-auto)    |
|          |                               |
+----------+-------------------------------+
```

### Tailwind 实现示例

```tsx
// apps/web/src/components/layout/app-layout.tsx
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Topbar */}
      <header className="h-[52px] border-b border-border bg-bg flex items-center px-4 fixed top-0 left-0 right-0 z-10">
        {/* ...topbar content */}
      </header>

      {/* Body */}
      <div className="pt-[52px] grid lg:grid-cols-[240px_1fr]">
        {/* Sidebar（仅 lg 以上显示） */}
        <aside className="hidden lg:block w-[240px] border-r border-border min-h-[calc(100vh-52px)] bg-surface fixed top-[52px] left-0 bottom-0 overflow-y-auto">
          {/* ...nav items */}
        </aside>

        {/* Main */}
        <main className="lg:ml-[240px] p-6 min-h-[calc(100vh-52px)]">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**响应式**：`lg:1024px` 断点以下隐藏侧边栏，通过 Sheet/Drawer 组件提供移动端导航。

---

## 6. 状态 Badge 颜色规范

所有招标/投标状态标签使用内联样式或扩展 Tailwind 的语义类实现，禁止使用随机颜色。

| 状态值 | 背景色 | 文字色 | 语义 |
|--------|--------|--------|------|
| `PENDING` | `#fff8c5` | `#9a6700` | 待决策（黄色警告） |
| `DECIDED` / `BIDDING` | `#ddf4ff` | `#0969da` | 进行中（蓝色信息） |
| `SUBMITTED` | `#dafbe1` | `#1a7f37` | 已提交（绿色成功） |
| `WON` | `#1a7f37` | `#ffffff` | 中标（深绿实底） |
| `LOST` | `#ffebe9` | `#cf222e` | 落标（红色危险） |
| `DECLINED` | `#f6f8fa` | `#656d76` | 已拒绝（灰色静默） |

### Badge 组件使用示例

```tsx
// apps/web/src/components/ui/tender-status-badge.tsx
import { Badge } from '@/components/ui/badge'

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  PENDING:   { backgroundColor: '#fff8c5', color: '#9a6700' },
  DECIDED:   { backgroundColor: '#ddf4ff', color: '#0969da' },
  BIDDING:   { backgroundColor: '#ddf4ff', color: '#0969da' },
  SUBMITTED: { backgroundColor: '#dafbe1', color: '#1a7f37' },
  WON:       { backgroundColor: '#1a7f37', color: '#ffffff' },
  LOST:      { backgroundColor: '#ffebe9', color: '#cf222e' },
  DECLINED:  { backgroundColor: '#f6f8fa', color: '#656d76' },
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:   '待决策',
  DECIDED:   '已决定',
  BIDDING:   '投标中',
  SUBMITTED: '已提交',
  WON:       '中标',
  LOST:      '落标',
  DECLINED:  '已拒绝',
}

export function TenderStatusBadge({ status }: { status: string }) {
  return (
    <Badge style={STATUS_STYLES[status] ?? {}} className="text-xs font-medium">
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
```

---

## 7. 组件规范（shadcn/ui 选型）

所有 UI 组件优先使用 shadcn/ui，通过 `pnpm dlx shadcn@latest add <component>` 安装到 `apps/web/src/components/ui/`。

| 组件 | 用途 | 安装命令 |
|------|------|----------|
| `Button` | 主按钮（variant=default）、次级按钮（outline）、危险操作（destructive） | `shadcn add button` |
| `Input` | 表单文本输入 | `shadcn add input` |
| `Textarea` | 多行文本（项目描述、备注） | `shadcn add textarea` |
| `Select` | 下拉选择（状态筛选、材料单位） | `shadcn add select` |
| `Checkbox` | 多选项（权限配置） | `shadcn add checkbox` |
| `Switch` | 开关切换（通知设置） | `shadcn add switch` |
| `Table` | 招标列表、经济标清单明细 | `shadcn add table` |
| `Dialog` | 确认弹窗（删除确认、提交确认） | `shadcn add dialog` |
| `Tabs` | 投标工作台多标签页 | `shadcn add tabs` |
| `Badge` | 招标/投标状态标签 | `shadcn add badge` |
| `Toast` / `Sonner` | 操作成功/失败反馈 | `shadcn add sonner` |
| `Breadcrumb` | 面包屑导航 | `shadcn add breadcrumb` |
| `Skeleton` | 数据加载骨架屏 | `shadcn add skeleton` |
| `Separator` | 分割线（侧边栏分组、表单分区） | `shadcn add separator` |
| `Sheet` | 移动端侧边栏抽屉 | `shadcn add sheet` |
| `DropdownMenu` | 操作菜单（行操作、用户头像菜单） | `shadcn add dropdown-menu` |
| `Avatar` | 用户头像 | `shadcn add avatar` |
| `Card` | 统计卡片、内容容器 | `shadcn add card` |

### 按钮规范

```tsx
// 主要操作
<Button>提交审查</Button>

// 次级操作
<Button variant="outline">取消</Button>

// 危险操作（删除、拒绝）
<Button variant="destructive">删除招标</Button>

// 小尺寸（表格行内操作）
<Button size="sm" variant="outline">编辑</Button>

// 加载状态
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  处理中...
</Button>
```

### 表单规范

- 所有表单使用 **React Hook Form** + **Zod** 校验
- 字段标签使用 `<Label>` 组件，位于输入框上方
- 错误信息显示在输入框下方，使用 `text-danger text-xs`
- 必填字段标签后加 `<span className="text-danger ml-0.5">*</span>`

---

## 8. 页面路由结构

基于 Next.js 14 App Router，路由文件位于 `apps/web/src/app/`。

```
src/app/
├── (auth)/                          # 未登录布局组（无侧边栏）
│   ├── login/
│   │   └── page.tsx                 # /login
│   ├── register/
│   │   └── page.tsx                 # /register
│   ├── forgot-password/
│   │   └── page.tsx                 # /forgot-password
│   └── reset-password/
│       └── page.tsx                 # /reset-password?token=...
│
├── (dashboard)/                     # 已登录布局组（含 Topbar + Sidebar）
│   ├── layout.tsx                   # AppLayout，包含认证守卫
│   ├── page.tsx                     # / → redirect to /tenders
│   ├── tenders/
│   │   ├── page.tsx                 # /tenders（商机仪表板列表）
│   │   ├── new/
│   │   │   └── page.tsx             # /tenders/new（新建招标表单）
│   │   └── [id]/
│   │       └── page.tsx             # /tenders/[id]（招标详情）
│   ├── bids/
│   │   └── [id]/
│   │       ├── page.tsx             # /bids/[id]（投标工作台）
│   │       └── economic/
│   │           └── page.tsx         # /bids/[id]/economic（经济标工作台）
│   └── settings/
│       ├── layout.tsx               # 设置页面子布局（二级导航）
│       ├── page.tsx                 # /settings → redirect to /settings/company
│       ├── company/
│       │   └── page.tsx             # /settings/company（公司信息）
│       ├── members/
│       │   └── page.tsx             # /settings/members（成员管理）
│       └── materials/
│           └── page.tsx             # /settings/materials（材料库管理）
│
└── layout.tsx                       # 根布局（字体、全局样式、Provider）
```

### 路由守卫

```tsx
// apps/web/src/app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth-server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()
  if (!session) redirect('/login')

  return <AppLayout>{children}</AppLayout>
}
```

---

*文档版本：v1.0 | 最后更新：2026-05*

