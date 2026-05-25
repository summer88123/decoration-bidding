# UI 组件设计令牌对齐 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写现有 shadcn/ui 基础组件（button、input、badge、textarea、select），使其完全对齐项目 CSS 变量设计令牌，并补充原型中反复出现的 variant，然后批量替换各页面中的内联 className。

**Architecture:** 修改 `apps/web/src/components/ui/` 下已有组件文件，以项目 CSS 变量（`--accent`、`--success`、`--danger`、`--border` 等）替换 oklch 硬编码值；使用 `cva` + `class-variance-authority` 定义 variant；页面中重复出现的内联 className 替换为组件 + variant props。

**Tech Stack:** Next.js 14 App Router, TailwindCSS, class-variance-authority (cva), shadcn/ui, React 18

---

## Chunk 1: 重写核心组件

### Task 1: 重写 Button 组件

**Files:**
- Modify: `apps/web/src/components/ui/button.tsx`

需要的 variant（来自原型分析）：
- `primary` — 绿色主操作：`bg-success hover:bg-success-hover text-white border border-[rgba(31,35,40,0.15)]`
- `secondary` — 次要操作：`bg-surface hover:bg-inset text-fg border border-border`
- `danger` — 危险操作：`bg-bg border border-border text-danger hover:bg-danger hover:text-white`
- `ghost` — 无边框：`hover:bg-inset text-fg`
- `link` — 链接样式：`text-accent hover:underline`

需要的 size：
- `sm` — `px-3 py-[3px] text-xs h-auto`
- `md` — `px-4 py-[5px] text-sm h-auto`（默认）
- `icon` — `p-1.5 w-7 h-7`

- [ ] **Step 1: 重写 button.tsx**

将文件内容替换为以下代码，对齐项目设计令牌：

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
  {
    variants: {
      variant: {
        primary:
          "bg-success hover:bg-[#1a7f37] text-white border border-[rgba(31,35,40,0.15)] rounded-[6px]",
        secondary:
          "bg-surface hover:bg-inset text-fg border border-border rounded-[6px]",
        danger:
          "bg-bg border border-border text-danger hover:bg-danger hover:text-white rounded-[6px]",
        ghost:
          "hover:bg-inset text-fg rounded-[6px]",
        link:
          "text-accent hover:underline p-0 h-auto",
      },
      size: {
        sm: "px-3 py-[3px] text-xs",
        md: "px-4 py-[5px] text-sm",
        icon: "p-1.5 w-7 h-7",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

- [ ] **Step 2: 验证构建无错误**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/button.tsx
git commit -m "refactor(ui): 重写 Button 组件对齐项目设计令牌"
```

---

### Task 2: 重写 Input 组件

**Files:**
- Modify: `apps/web/src/components/ui/input.tsx`

- [ ] **Step 1: 重写 input.tsx**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full px-3 py-[5px] border border-border rounded-[6px] text-sm bg-bg text-fg",
          "placeholder:text-muted",
          "focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

- [ ] **Step 2: 重写 textarea.tsx**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full px-3 py-[5px] border border-border rounded-[6px] text-sm bg-bg text-fg",
          "placeholder:text-muted resize-y min-h-[80px]",
          "focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/input.tsx apps/web/src/components/ui/textarea.tsx
git commit -m "refactor(ui): 重写 Input/Textarea 组件对齐设计令牌"
```

---

### Task 3: 重写 Badge 组件

**Files:**
- Modify: `apps/web/src/components/ui/badge.tsx`

原型中出现的状态标签 variant：
- `default` — `bg-inset text-fg border-border`（灰色/中性）
- `success` — `bg-success-subtle text-success`（绿色/已完成）
- `info` — `bg-[#ddf4ff] text-accent`（蓝色/进行中）
- `warning` — `bg-warning-subtle text-warning`（黄色/待处理）
- `danger` — `bg-danger-subtle text-danger`（红色/已拒绝/逾期）
- `done` — `bg-[#fbefff] text-[#8250df]`（紫色/已完成投标）
- `outline` — 无背景，有边框

- [ ] **Step 1: 重写 badge.tsx**

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
  {
    variants: {
      variant: {
        default:   "bg-inset text-fg border-border",
        success:   "bg-success-subtle text-success border-transparent",
        info:      "bg-[#ddf4ff] text-accent border-transparent",
        warning:   "bg-warning-subtle text-warning border-transparent",
        danger:    "bg-danger-subtle text-danger border-transparent",
        done:      "bg-[#fbefff] text-[#8250df] border-transparent",
        outline:   "bg-transparent text-fg border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ui/badge.tsx
git commit -m "refactor(ui): 重写 Badge 组件，补充原型状态 variant"
```

---

## Chunk 2: 补充 globals.css 颜色变量

### Task 4: 将硬编码颜色迁移到 CSS 变量

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/tailwind.config.ts`

页面中仍有 `#1a7f37`（success-hover）和 `#8250df`（done 色）未在变量中定义。

- [ ] **Step 1: 在 globals.css 中补充缺失变量**

在 `:root` 块末尾添加：

```css
--success-hover: #1a7f37;
--done-subtle: #fbefff;
--info: #0969da;
--info-subtle: #ddf4ff;
```

- [ ] **Step 2: 在 tailwind.config.ts 中注册新 token**

```ts
// 在 colors 对象中添加：
info: {
  DEFAULT: 'var(--info)',
  subtle: 'var(--info-subtle)',
},
done: {
  DEFAULT: 'var(--done)',
  subtle: 'var(--done-subtle)',
},
// 修改 success：
success: {
  DEFAULT: 'var(--success)',
  hover: 'var(--success-hover)',
  subtle: 'var(--success-subtle)',
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/tailwind.config.ts
git commit -m "feat(design-tokens): 补充 success-hover/done-subtle/info 颜色变量"
```

---

## Chunk 3: 页面批量替换

### Task 5: 替换 dashboard/page.tsx

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

目标：将所有内联 Button/Input 样式替换为 `<Button>` / `<Input>` 组件。

- [ ] **Step 1: 添加组件导入**

在文件顶部添加：
```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
```

- [ ] **Step 2: 替换主操作按钮**

将以下内联 className：
```
className="inline-flex items-center gap-1.5 px-4 py-[5px] bg-[#1f883d] hover:bg-[#1a7f37] text-white text-sm rounded-[6px] border border-[rgba(31,35,40,0.15)] transition-colors"
```
替换为：
```tsx
<Button variant="primary" size="md">
```

- [ ] **Step 3: 替换搜索输入框**

将内联 input className 替换为 `<Input>` 组件。

- [ ] **Step 4: 替换次要按钮（筛选、分页等）**

将 `px-3 py-[3px] text-xs border border-border rounded-[6px] bg-surface hover:bg-inset...` 替换为 `<Button variant="secondary" size="sm">`。

- [ ] **Step 5: 替换状态 Badge**

将状态标签的内联 className 替换为 `<Badge variant="...">` 对应状态。

- [ ] **Step 6: 验证页面正常渲染**

```bash
cd apps/web && pnpm dev &
# 在浏览器中访问 http://localhost:3000/dashboard 验证视觉无变化
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "refactor(dashboard): 使用 Button/Input/Badge 组件替换内联样式"
```

---

### Task 6: 替换 tenders/page.tsx

**Files:**
- Modify: `apps/web/src/app/(dashboard)/tenders/page.tsx`

与 Task 5 相同的替换模式：Button/Input/Badge。

- [ ] **Step 1-5:** 同 Task 5 步骤，在 tenders/page.tsx 中执行相同替换

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/tenders/page.tsx
git commit -m "refactor(tenders): 使用 Button/Input/Badge 组件替换内联样式"
```

---

### Task 7: 替换 tenders/new/page.tsx

**Files:**
- Modify: `apps/web/src/app/(dashboard)/tenders/new/page.tsx`

- [ ] **Step 1-5:** 同上，重点在表单组件（Input、Textarea、Button）

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/tenders/new/page.tsx
git commit -m "refactor(tender-new): 使用 Input/Textarea/Button 组件替换内联样式"
```

---

### Task 8: 替换 settings/ 页面组件

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/components/CompanyTab.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/components/MembersTab.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/components/MaterialsTab.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/components/DangerTab.tsx`

- [ ] **Step 1-5:** 同上替换模式

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/settings/
git commit -m "refactor(settings): 使用 Button/Input/Badge 组件替换内联样式"
```

---

## 完成验证

- [ ] **全量构建检查**

```bash
cd apps/web && pnpm build 2>&1 | tail -20
```

期望：无 TypeScript 错误，构建成功

- [ ] **视觉回归检查**

访问以下页面，逐一确认视觉效果与原型一致：
1. `http://localhost:3000/dashboard`
2. `http://localhost:3000/tenders`
3. `http://localhost:3000/tenders/new`
4. `http://localhost:3000/settings`
