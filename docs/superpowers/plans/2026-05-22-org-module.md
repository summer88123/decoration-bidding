# 组织管理模块（阶段 2）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现组织管理模块，包含公司信息管理、成员管理、物料库 CRUD 及 Excel 批量导入

**Architecture:** 后端遵循 core-service 模块化单体结构（repository → service → handler → routes），前端使用 Next.js App Router + shadcn/ui + React Hook Form + Zustand。

**Tech Stack:** Fastify 4, Prisma ORM, Zod, xlsx, Next.js 14, shadcn/ui, React Hook Form, TailwindCSS

---

## 文件清单

### 后端（core-service）

| 操作 | 文件 |
|------|------|
| 创建 | `apps/core-service/src/modules/org/repositories/org.repository.ts` |
| 创建 | `apps/core-service/src/modules/org/services/org.service.ts` |
| 创建 | `apps/core-service/src/modules/org/handlers/company.handler.ts` |
| 创建 | `apps/core-service/src/modules/org/handlers/member.handler.ts` |
| 创建 | `apps/core-service/src/modules/org/handlers/material.handler.ts` |
| 创建 | `apps/core-service/src/modules/org/routes.ts` |
| 修改 | `apps/core-service/src/app.ts`（注册 org 路由） |

### 前端（web）

| 操作 | 文件 |
|------|------|
| 创建 | `apps/web/src/app/(dashboard)/settings/page.tsx` |
| 创建 | `apps/web/src/app/(dashboard)/settings/components/CompanyTab.tsx` |
| 创建 | `apps/web/src/app/(dashboard)/settings/components/MembersTab.tsx` |
| 创建 | `apps/web/src/app/(dashboard)/settings/components/MaterialsTab.tsx` |

---
## Task 1：org.repository.ts

**Files:**
- 创建: `apps/core-service/src/modules/org/repositories/org.repository.ts`

- [ ] **Step 1: 创建 repository 文件**

```ts
// apps/core-service/src/modules/org/repositories/org.repository.ts
import { prisma } from '@decoration-bidding/database'

// ── Company ──────────────────────────────────────────────

export async function findCompanyById(id: string) {
  return prisma.company.findUnique({ where: { id } })
}

export async function updateCompany(id: string, data: {
  name?: string
  address?: string
  capabilities?: string[]
  licenses?: string[]
  contactEmail?: string
  contactPhone?: string
}) {
  return prisma.company.update({ where: { id }, data })
}

// ── Member ───────────────────────────────────────────────

export async function listMembersByCompany(companyId: string, opts: {
  page: number
  pageSize: number
  status?: string
}) {
  const where = { companyId, ...(opts.status ? { status: opts.status } : {}) }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { role: true },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ])
  return { items, total }
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { role: true } })
}

export async function findRoleByName(name: string) {
  return prisma.role.findUnique({ where: { name } })
}

export async function createPendingUser(data: {
  email: string
  name: string
  companyId: string
  roleId: string
  passwordHash: string
  status: string
}) {
  return prisma.user.create({
    data,
    include: { role: true },
  })
}

export async function updateUserRoleAndStatus(id: string, data: {
  roleId?: string
  status?: string
}) {
  return prisma.user.update({ where: { id }, data, include: { role: true } })
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } })
}
```

- [ ] **Step 2: 继续添加 Material 相关函数**

```ts
// 追加到同文件末尾

// ── Material ─────────────────────────────────────────────

export async function listMaterials(companyId: string, opts: {
  page: number
  pageSize: number
  search?: string
  category?: string
}) {
  const where = {
    companyId,
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.search ? {
      OR: [
        { name: { contains: opts.search, mode: 'insensitive' as const } },
        { spec: { contains: opts.search, mode: 'insensitive' as const } },
      ],
    } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.materialDb.findMany({
      where,
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.materialDb.count({ where }),
  ])
  return { items, total }
}

export async function createMaterial(data: {
  companyId: string
  name: string
  spec?: string
  unitCost: number
  supplier?: string
  category?: string
}) {
  return prisma.materialDb.create({ data })
}

export async function updateMaterial(id: string, companyId: string, data: {
  name?: string
  spec?: string
  unitCost?: number
  supplier?: string
  category?: string
}) {
  return prisma.materialDb.update({ where: { id, companyId }, data })
}

export async function deleteMaterial(id: string, companyId: string) {
  return prisma.materialDb.delete({ where: { id, companyId } })
}

export async function bulkCreateMaterials(items: Array<{
  companyId: string
  name: string
  spec?: string
  unitCost: number
  supplier?: string
  category?: string
}>) {
  return prisma.materialDb.createMany({ data: items, skipDuplicates: false })
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/core-service/src/modules/org/repositories/org.repository.ts
git commit -m "feat(org): add org repository"
```

---
## Task 2：org.service.ts

**Files:**
- 创建: `apps/core-service/src/modules/org/services/org.service.ts`

- [ ] **Step 1: 创建 service 文件（公司 + 成员部分）**

```ts
// apps/core-service/src/modules/org/services/org.service.ts
import bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import * as repo from '../repositories/org.repository.js'
import { sendInviteEmail } from '../../auth/services/mail.service.js'

export class OrgError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message)
    this.name = 'OrgError'
  }
}

// ── Company ──────────────────────────────────────────────

export async function getCompany(companyId: string) {
  const company = await repo.findCompanyById(companyId)
  if (!company) throw new OrgError('NOT_FOUND', '公司不存在', 404)
  return company
}

export async function updateCompany(companyId: string, data: {
  name?: string
  address?: string
  capabilities?: string[]
  licenses?: string[]
  contactEmail?: string
  contactPhone?: string
}) {
  const company = await repo.findCompanyById(companyId)
  if (!company) throw new OrgError('NOT_FOUND', '公司不存在', 404)
  return repo.updateCompany(companyId, data)
}

// ── Member ───────────────────────────────────────────────

export async function listMembers(companyId: string, opts: {
  page: number
  pageSize: number
  status?: string
}) {
  return repo.listMembersByCompany(companyId, opts)
}

export async function inviteMember(companyId: string, data: {
  email: string
  name: string
  role: string
}) {
  // 检查角色是否存在
  const roleRecord = await repo.findRoleByName(data.role)
  if (!roleRecord) throw new OrgError('VALIDATION_ERROR', `角色 ${data.role} 不存在`, 400)

  // 生成临时密码（邀请流程）
  const tempPassword = randomBytes(8).toString('hex')
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const user = await repo.createPendingUser({
    email: data.email,
    name: data.name,
    companyId,
    roleId: roleRecord.id,
    passwordHash,
    status: 'pending',
  }).catch(() => {
    throw new OrgError('DUPLICATE', '该邮箱已被注册', 409)
  })

  // 发送邀请邮件（复用 mail.service）
  await sendInviteEmail(data.email, data.name, tempPassword).catch(() => {
    // 邮件失败不回滚，记录日志即可
    console.error(`Failed to send invite email to ${data.email}`)
  })

  return user
}

export async function updateMemberRole(companyId: string, userId: string, data: {
  role?: string
  status?: string
}) {
  const user = await repo.findUserById(userId)
  if (!user || user.companyId !== companyId) {
    throw new OrgError('NOT_FOUND', '成员不存在', 404)
  }

  let roleId: string | undefined
  if (data.role) {
    const roleRecord = await repo.findRoleByName(data.role)
    if (!roleRecord) throw new OrgError('VALIDATION_ERROR', `角色 ${data.role} 不存在`, 400)
    roleId = roleRecord.id
  }

  return repo.updateUserRoleAndStatus(userId, {
    ...(roleId ? { roleId } : {}),
    ...(data.status ? { status: data.status } : {}),
  })
}

export async function removeMember(companyId: string, userId: string) {
  const user = await repo.findUserById(userId)
  if (!user || user.companyId !== companyId) {
    throw new OrgError('NOT_FOUND', '成员不存在', 404)
  }
  await repo.deleteUser(userId)
}
```

- [ ] **Step 2: 继续追加物料库 service 函数**

```ts
// 追加到同文件末尾

// ── Material ─────────────────────────────────────────────

export async function listMaterials(companyId: string, opts: {
  page: number
  pageSize: number
  search?: string
  category?: string
}) {
  return repo.listMaterials(companyId, opts)
}

export async function createMaterial(companyId: string, data: {
  name: string
  spec?: string
  unitCost: number
  supplier?: string
  category?: string
}) {
  return repo.createMaterial({ ...data, companyId })
}

export async function updateMaterial(companyId: string, id: string, data: {
  name?: string
  spec?: string
  unitCost?: number
  supplier?: string
  category?: string
}) {
  return repo.updateMaterial(id, companyId, data).catch(() => {
    throw new OrgError('NOT_FOUND', '物料不存在', 404)
  })
}

export async function deleteMaterial(companyId: string, id: string) {
  await repo.deleteMaterial(id, companyId).catch(() => {
    throw new OrgError('NOT_FOUND', '物料不存在', 404)
  })
}

export async function importMaterials(companyId: string, rows: Array<{
  name: string
  spec?: string
  unitCost: number
  supplier?: string
  category?: string
}>) {
  const valid: typeof rows = []
  const errors: Array<{ row: number; reason: string }> = []

  rows.forEach((row, i) => {
    if (!row.name) {
      errors.push({ row: i + 2, reason: '名称不能为空' })
    } else if (isNaN(row.unitCost) || row.unitCost < 0) {
      errors.push({ row: i + 2, reason: '单价必须为非负数' })
    } else {
      valid.push(row)
    }
  })

  if (valid.length > 0) {
    await repo.bulkCreateMaterials(valid.map(r => ({ ...r, companyId })))
  }

  return { imported: valid.length, skipped: errors.length, errors }
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/core-service/src/modules/org/services/org.service.ts
git commit -m "feat(org): add org service"
```

---
## Task 3：mail.service.ts 补充 sendInviteEmail

**Files:**
- 修改: `apps/core-service/src/modules/auth/services/mail.service.ts`

- [ ] **Step 1: 读取现有 mail.service.ts，确认当前内容**

运行: `cat apps/core-service/src/modules/auth/services/mail.service.ts`

- [ ] **Step 2: 追加 sendInviteEmail 函数**

在文件末尾追加：

```ts
export async function sendInviteEmail(email: string, name: string, tempPassword: string) {
  const transporter = createTransporter()
  await transporter.sendMail({
    from: config.MAIL_FROM,
    to: email,
    subject: '您已被邀请加入装饰投标系统',
    html: `
      <h2>您好，${name}</h2>
      <p>您已被邀请加入装饰投标辅助系统。</p>
      <p>请使用以下临时密码登录，登录后请立即修改密码：</p>
      <p><strong>邮箱：</strong>${email}</p>
      <p><strong>临时密码：</strong>${tempPassword}</p>
      <p><a href="${config.FRONTEND_URL}/login">立即登录</a></p>
    `,
  })
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/core-service/src/modules/auth/services/mail.service.ts
git commit -m "feat(auth): add sendInviteEmail to mail service"
```

---

## Task 4：handlers — company.handler.ts

**Files:**
- 创建: `apps/core-service/src/modules/org/handlers/company.handler.ts`

- [ ] **Step 1: 创建 company handler**

```ts
// apps/core-service/src/modules/org/handlers/company.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as svc from '../services/org.service.js'

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  licenses: z.array(z.string()).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
})

export async function getCompanyHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.user as { companyId: string }
  const company = await svc.getCompany(user.companyId)
  return reply.send({ success: true, data: company })
}

export async function updateCompanyHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.user as { companyId: string }
  const body = updateCompanySchema.parse(req.body)
  const company = await svc.updateCompany(user.companyId, body)
  return reply.send({ success: true, data: company })
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/core-service/src/modules/org/handlers/company.handler.ts
git commit -m "feat(org): add company handler"
```

---

## Task 5：handlers — member.handler.ts

**Files:**
- 创建: `apps/core-service/src/modules/org/handlers/member.handler.ts`

- [ ] **Step 1: 创建 member handler**

```ts
// apps/core-service/src/modules/org/handlers/member.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as svc from '../services/org.service.js'

const listMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
})

const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'BIDDER']),
})

const updateMemberSchema = z.object({
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'BIDDER']).optional(),
  status: z.enum(['active', 'pending', 'disabled']).optional(),
})

export async function listMembersHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.user as { companyId: string }
  const query = listMembersQuerySchema.parse(req.query)
  const { items, total } = await svc.listMembers(user.companyId, query)
  const totalPages = Math.ceil(total / query.pageSize)
  return reply.send({
    success: true,
    data: items.map(u => ({
      id: u.id,
      name: (u as any).name,
      email: u.email,
      role: u.role.name,
      status: u.status,
    })),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages },
  })
}

export async function inviteMemberHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.user as { companyId: string }
  const body = inviteMemberSchema.parse(req.body)
  const member = await svc.inviteMember(user.companyId, body)
  return reply.status(201).send({
    success: true,
    data: { id: member.id, email: member.email, status: member.status },
  })
}

export async function updateMemberHandler(
  req: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply,
) {
  const user = req.user as { companyId: string }
  const body = updateMemberSchema.parse(req.body)
  const updated = await svc.updateMemberRole(user.companyId, req.params.userId, body)
  return reply.send({
    success: true,
    data: { id: updated.id, role: updated.role.name, status: updated.status },
  })
}

export async function deleteMemberHandler(
  req: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply,
) {
  const user = req.user as { companyId: string }
  await svc.removeMember(user.companyId, req.params.userId)
  return reply.send({ success: true })
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/core-service/src/modules/org/handlers/member.handler.ts
git commit -m "feat(org): add member handler"
```

---
## Task 6：handlers — material.handler.ts

**Files:**
- 创建: `apps/core-service/src/modules/org/handlers/material.handler.ts`

- [ ] **Step 1: 创建 material handler（列表、CRUD）**

```ts
// apps/core-service/src/modules/org/handlers/material.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as svc from '../services/org.service.js'
import * as xlsx from 'xlsx'

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
})

const createMaterialSchema = z.object({
  name: z.string().min(1),
  spec: z.string().optional(),
  unitCost: z.number().min(0),
  supplier: z.string().optional(),
  category: z.string().optional(),
})

const updateMaterialSchema = createMaterialSchema.partial()

export async function listMaterialsHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.user as { companyId: string }
  const query = listQuerySchema.parse(req.query)
  const { items, total } = await svc.listMaterials(user.companyId, query)
  const totalPages = Math.ceil(total / query.pageSize)
  return reply.send({
    success: true,
    data: items,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages },
  })
}

export async function createMaterialHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.user as { companyId: string }
  const body = createMaterialSchema.parse(req.body)
  const material = await svc.createMaterial(user.companyId, body)
  return reply.status(201).send({ success: true, data: material })
}

export async function updateMaterialHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = req.user as { companyId: string }
  const body = updateMaterialSchema.parse(req.body)
  const material = await svc.updateMaterial(user.companyId, req.params.id, body)
  return reply.send({ success: true, data: material })
}

export async function deleteMaterialHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = req.user as { companyId: string }
  await svc.deleteMaterial(user.companyId, req.params.id)
  return reply.send({ success: true })
}
```

- [ ] **Step 2: 追加 importMaterialsHandler**

```ts
// 追加到同文件末尾

export async function importMaterialsHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.user as { companyId: string }

  // @fastify/multipart 已解析，获取文件 buffer
  const data = await (req as any).file()
  if (!data) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: '请上传 Excel 文件' } })
  }

  const chunks: Buffer[] = []
  for await (const chunk of data.file) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)

  // 解析 xlsx
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet)

  // 映射列（支持中英文表头）
  const mapped = rows.map(row => ({
    name: String(row['名称'] ?? row['name'] ?? ''),
    spec: row['规格'] != null ? String(row['规格']) : (row['spec'] != null ? String(row['spec']) : undefined),
    unitCost: Number(row['单价'] ?? row['unitCost'] ?? 0),
    supplier: row['供应商'] != null ? String(row['供应商']) : (row['supplier'] != null ? String(row['supplier']) : undefined),
    category: row['分类'] != null ? String(row['分类']) : (row['category'] != null ? String(row['category']) : undefined),
  }))

  const result = await svc.importMaterials(user.companyId, mapped)
  return reply.send({ success: true, data: result })
}
```

- [ ] **Step 3: 安装 xlsx 依赖**

```bash
cd apps/core-service && pnpm add xlsx
```

- [ ] **Step 4: 提交**

```bash
git add apps/core-service/src/modules/org/handlers/material.handler.ts
git commit -m "feat(org): add material handler with Excel import"
```

---

## Task 7：routes.ts + 注册到 app.ts

**Files:**
- 创建: `apps/core-service/src/modules/org/routes.ts`
- 修改: `apps/core-service/src/app.ts`

- [ ] **Step 1: 创建 org routes**

```ts
// apps/core-service/src/modules/org/routes.ts
import type { FastifyPluginAsync } from 'fastify'
import { ZodError } from 'zod'
import { OrgError } from './services/org.service.js'
import { getCompanyHandler, updateCompanyHandler } from './handlers/company.handler.js'
import {
  listMembersHandler,
  inviteMemberHandler,
  updateMemberHandler,
  deleteMemberHandler,
} from './handlers/member.handler.js'
import {
  listMaterialsHandler,
  createMaterialHandler,
  updateMaterialHandler,
  deleteMaterialHandler,
  importMaterialsHandler,
} from './handlers/material.handler.js'
import { authenticate, requireRole } from '../../shared/middleware/auth.js'

export const orgRoutes: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof OrgError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
      })
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0]?.message ?? '输入验证失败' },
      })
    }
    app.log.error(error)
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
    })
  })

  // Company
  app.get('/org/company', { preHandler: [authenticate] }, getCompanyHandler)
  app.put('/org/company', { preHandler: [authenticate, requireRole(['COMPANY_ADMIN'])] }, updateCompanyHandler)

  // Members
  app.get('/org/members', { preHandler: [authenticate, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, listMembersHandler)
  app.post('/org/members/invite', { preHandler: [authenticate, requireRole(['COMPANY_ADMIN'])] }, inviteMemberHandler)
  app.put('/org/members/:userId', { preHandler: [authenticate, requireRole(['COMPANY_ADMIN'])] }, updateMemberHandler)
  app.delete('/org/members/:userId', { preHandler: [authenticate, requireRole(['COMPANY_ADMIN'])] }, deleteMemberHandler)

  // Materials
  app.get('/org/materials', { preHandler: [authenticate] }, listMaterialsHandler)
  app.post('/org/materials', { preHandler: [authenticate, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, createMaterialHandler)
  app.put('/org/materials/:id', { preHandler: [authenticate, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, updateMaterialHandler)
  app.delete('/org/materials/:id', { preHandler: [authenticate, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, deleteMaterialHandler)
  app.post('/org/materials/import', { preHandler: [authenticate, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, importMaterialsHandler)
}
```

- [ ] **Step 2: 读取 app.ts，找到注册路由的位置**

运行: `cat apps/core-service/src/app.ts`

- [ ] **Step 3: 在 app.ts 中注册 orgRoutes**

在已有的 `authRoutes` 注册行后面添加：

```ts
import { orgRoutes } from './modules/org/routes.js'
// ...
app.register(orgRoutes, { prefix: '/api' })
```

- [ ] **Step 4: 提交**

```bash
git add apps/core-service/src/modules/org/routes.ts apps/core-service/src/app.ts
git commit -m "feat(org): register org routes"
```

---
## Task 8：User 模型补充 name 字段

**Files:**
- 修改: `packages/database/prisma/schema.prisma`

> 现有 User 模型无 name 字段，API 规范要求返回 name。

- [ ] **Step 1: 在 schema.prisma 的 User model 中添加 name 字段**

在 `email String @unique` 行之后添加：

```prisma
name         String   @default("")
phone        String?
```

- [ ] **Step 2: 执行迁移**

```bash
cd packages/database
pnpm db:migrate
pnpm db:generate
```

- [ ] **Step 3: 更新 auth.service.ts register 函数，接受并保存 name**

在 `apps/core-service/src/modules/auth/services/auth.service.ts` 的 `register` 函数签名中，添加 `name` 参数：

```ts
export async function register(data: {
  email: string
  password: string
  companyId: string
  roleId: string
  name?: string
  phone?: string
}) {
  const existing = await repo.findUserByEmail(data.email)
  if (existing) throw new AuthError('EMAIL_TAKEN', '邮箱已被注册', 409)

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
  const user = await repo.createUser({
    email: data.email,
    companyId: data.companyId,
    roleId: data.roleId,
    passwordHash,
    name: data.name ?? '',
    phone: data.phone,
  })
  return user
}
```

- [ ] **Step 4: 更新 auth.repository.ts createUser 函数签名**

```ts
export async function createUser(data: {
  email: string
  passwordHash: string
  companyId: string
  roleId: string
  name?: string
  phone?: string
}) {
  return prisma.user.create({ data, include: { role: true } })
}
```

- [ ] **Step 5: 提交**

```bash
git add packages/database/prisma/schema.prisma \
  apps/core-service/src/modules/auth/services/auth.service.ts \
  apps/core-service/src/modules/auth/repositories/auth.repository.ts
git commit -m "feat(db): add name and phone fields to User model"
```

---

## Task 9：前端 — settings/page.tsx（Tab 容器）

**Files:**
- 创建: `apps/web/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: 创建 settings 页面（Tab 容器）**

```tsx
// apps/web/src/app/(dashboard)/settings/page.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompanyTab } from './components/CompanyTab'
import { MembersTab } from './components/MembersTab'
import { MaterialsTab } from './components/MaterialsTab'

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">设置</h1>
      <Tabs defaultValue="company">
        <TabsList className="mb-6">
          <TabsTrigger value="company">公司资料</TabsTrigger>
          <TabsTrigger value="members">成员管理</TabsTrigger>
          <TabsTrigger value="materials">物料库</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <CompanyTab />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab />
        </TabsContent>
        <TabsContent value="materials">
          <MaterialsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat(web): add settings page with tab layout"
```

---

## Task 10：前端 — CompanyTab.tsx

**Files:**
- 创建: `apps/web/src/app/(dashboard)/settings/components/CompanyTab.tsx`

- [ ] **Step 1: 创建 CompanyTab 组件**

```tsx
// apps/web/src/app/(dashboard)/settings/components/CompanyTab.tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

const schema = z.object({
  name: z.string().min(1, '公司名称不能为空'),
  address: z.string().optional(),
  contactEmail: z.string().email('请输入有效邮箱').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const fetcher = (url: string) => apiClient.get(url).then(r => r.data.data)

export function CompanyTab() {
  const { data, mutate } = useSWR('/api/org/company', fetcher)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (data) reset({ name: data.name, address: data.address ?? '', contactEmail: data.contactEmail ?? '', contactPhone: data.contactPhone ?? '' })
  }, [data, reset])

  const onSubmit = async (values: FormData) => {
    try {
      await apiClient.put('/api/org/company', values)
      await mutate()
      toast.success('公司资料已更新')
    } catch {
      toast.error('更新失败，请重试')
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>公司资料</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
          <div>
            <Label htmlFor="name">公司名称</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="address">地址</Label>
            <Input id="address" {...register('address')} />
          </div>
          <div>
            <Label htmlFor="contactEmail">联系邮箱</Label>
            <Input id="contactEmail" type="email" {...register('contactEmail')} />
            {errors.contactEmail && <p className="text-sm text-red-500 mt-1">{errors.contactEmail.message}</p>}
          </div>
          <div>
            <Label htmlFor="contactPhone">联系电话</Label>
            <Input id="contactPhone" {...register('contactPhone')} />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/\(dashboard\)/settings/components/CompanyTab.tsx
git commit -m "feat(web): add CompanyTab component"
```

---
## Task 11：前端 — MembersTab.tsx

**Files:**
- 创建: `apps/web/src/app/(dashboard)/settings/components/MembersTab.tsx`

- [ ] **Step 1: 创建 MembersTab 组件**

```tsx
// apps/web/src/app/(dashboard)/settings/components/MembersTab.tsx
'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

const inviteSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  name: z.string().min(1, '姓名不能为空'),
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'BIDDER']),
})
type InviteForm = z.infer<typeof inviteSchema>

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

const roleLabelMap: Record<string, string> = {
  COMPANY_ADMIN: '公司管理员',
  MANAGER: '经理',
  BIDDER: '投标员',
}

export function MembersTab() {
  const [open, setOpen] = useState(false)
  const { data, mutate } = useSWR('/api/org/members?pageSize=50', fetcher)
  const members = data?.data ?? []

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'BIDDER' },
  })

  const onInvite = async (values: InviteForm) => {
    try {
      await apiClient.post('/api/org/members/invite', values)
      await mutate()
      toast.success(`已发送邀请至 ${values.email}`)
      reset()
      setOpen(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? '邀请失败')
    }
  }

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`确认移除成员 ${name}？`)) return
    try {
      await apiClient.delete(`/api/org/members/${userId}`)
      await mutate()
      toast.success('成员已移除')
    } catch {
      toast.error('移除失败')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>成员管理</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">邀请成员</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>邀请新成员</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onInvite)} className="space-y-4 mt-2">
              <div>
                <Label>邮箱</Label>
                <Input type="email" {...register('email')} />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>
              <div>
                <Label>姓名</Label>
                <Input {...register('name')} />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>
              <div>
                <Label>角色</Label>
                <Select defaultValue="BIDDER" onValueChange={v => setValue('role', v as InviteForm['role'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BIDDER">投标员</SelectItem>
                    <SelectItem value="MANAGER">经理</SelectItem>
                    <SelectItem value="COMPANY_ADMIN">公司管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? '发送中...' : '发送邀请'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {members.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{roleLabelMap[m.role] ?? m.role}</Badge>
                <Badge variant={m.status === 'active' ? 'default' : 'outline'}>
                  {m.status === 'active' ? '活跃' : m.status === 'pending' ? '待激活' : m.status}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id, m.name)}>移除</Button>
              </div>
            </div>
          ))}
          {members.length === 0 && <p className="text-muted-foreground text-sm">暂无成员</p>}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/\(dashboard\)/settings/components/MembersTab.tsx
git commit -m "feat(web): add MembersTab component"
```

---

## Task 12：前端 — MaterialsTab.tsx

**Files:**
- 创建: `apps/web/src/app/(dashboard)/settings/components/MaterialsTab.tsx`

- [ ] **Step 1: 创建 MaterialsTab（列表 + 新建 + 导入入口）**

```tsx
// apps/web/src/app/(dashboard)/settings/components/MaterialsTab.tsx
'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

const materialSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  spec: z.string().optional(),
  unitCost: z.coerce.number().min(0, '单价不能为负'),
  supplier: z.string().optional(),
  category: z.string().optional(),
})
type MaterialForm = z.infer<typeof materialSchema>

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

export function MaterialsTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, mutate } = useSWR(
    `/api/org/materials?page=${page}&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    fetcher,
  )
  const materials = data?.data ?? []
  const pagination = data?.pagination

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MaterialForm>({
    resolver: zodResolver(materialSchema),
  })

  const onCreate = async (values: MaterialForm) => {
    try {
      await apiClient.post('/api/org/materials', values)
      await mutate()
      toast.success('物料已添加')
      reset()
      setOpen(false)
    } catch {
      toast.error('添加失败')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认删除物料「${name}」？`)) return
    try {
      await apiClient.delete(`/api/org/materials/${id}`)
      await mutate()
      toast.success('物料已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await apiClient.post('/api/org/materials/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await mutate()
      const { imported, skipped } = res.data.data
      toast.success(`导入完成：成功 ${imported} 条，跳过 ${skipped} 条`)
    } catch {
      toast.error('导入失败')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle>物料库</CardTitle>
        <div className="flex gap-2">
          <Input
            placeholder="搜索名称/规格..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-48"
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            Excel 导入
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm">新增物料</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>新增物料</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(onCreate)} className="space-y-4 mt-2">
                <div>
                  <Label>名称</Label>
                  <Input {...register('name')} />
                  {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                </div>
                <div>
                  <Label>规格</Label>
                  <Input {...register('spec')} />
                </div>
                <div>
                  <Label>单价（港元）</Label>
                  <Input type="number" step="0.01" {...register('unitCost')} />
                  {errors.unitCost && <p className="text-sm text-red-500">{errors.unitCost.message}</p>}
                </div>
                <div>
                  <Label>分类</Label>
                  <Input {...register('category')} />
                </div>
                <div>
                  <Label>供应商</Label>
                  <Input {...register('supplier')} />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? '保存中...' : '保存'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4">名称</th>
                <th className="text-left py-2 pr-4">规格</th>
                <th className="text-left py-2 pr-4">分类</th>
                <th className="text-right py-2 pr-4">单价</th>
                <th className="text-left py-2 pr-4">供应商</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m: any) => (
                <tr key={m.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 pr-4 font-medium">{m.name}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{m.spec ?? '-'}</td>
                  <td className="py-2 pr-4">{m.category ?? '-'}</td>
                  <td className="py-2 pr-4 text-right">HK$ {m.unitCost}</td>
                  <td className="py-2 pr-4">{m.supplier ?? '-'}</td>
                  <td className="py-2">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id, m.name)}>删除</Button>
                  </td>
                </tr>
              ))}
              {materials.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">暂无物料</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
            <span className="text-sm self-center">{page} / {pagination.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/\(dashboard\)/settings/components/MaterialsTab.tsx
git commit -m "feat(web): add MaterialsTab component with Excel import"
```

---

## Task 13：验证与收尾

- [ ] **Step 1: 确认 @fastify/multipart 已安装**

```bash
cd apps/core-service && pnpm list @fastify/multipart
```

若未安装：`pnpm add @fastify/multipart`

- [ ] **Step 2: 在 app.ts 中注册 multipart 插件**

在 Fastify 实例配置处添加：

```ts
import multipart from '@fastify/multipart'
// ...
app.register(multipart)
```

- [ ] **Step 3: 重启服务并手动测试**

```bash
./dev.sh restart
```

测试顺序：
1. `GET /api/org/company` — 返回公司信息
2. `PUT /api/org/company` — 更新公司名称
3. `GET /api/org/members` — 返回成员列表
4. `POST /api/org/members/invite` — 邀请成员
5. `GET /api/org/materials` — 返回物料列表
6. `POST /api/org/materials` — 新增物料
7. `POST /api/org/materials/import` — 上传测试 Excel

- [ ] **Step 4: 浏览器访问 http://localhost:3000/settings**

验证三个 Tab 均可正常加载与操作。

- [ ] **Step 5: 更新 development-roadmap.md 标记阶段 2 完成**

将 `## 阶段 2：组织管理模块` 标题改为 `## 阶段 2：组织管理模块 ✅`，并添加：

```
> **实际完成日期：2026-05-22**
```

- [ ] **Step 6: 最终提交**

```bash
git add docs/specs/development-roadmap.md
git commit -m "docs: mark phase 2 org module as complete"
```

---

## 自检清单

- [ ] Prisma schema 已迁移（name/phone 字段）
- [ ] 所有 API 端点与 api-contracts.md 一致
- [ ] Excel 导入支持中英文列名
- [ ] 前端三个 Tab 均使用 shadcn/ui 组件
- [ ] OrgError 错误码与 error-codes.md 一致
- [ ] 成员邀请发送临时密码邮件
