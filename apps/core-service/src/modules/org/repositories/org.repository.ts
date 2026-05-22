import { prisma } from '@decoration-bidding/database'

// ─── Company ────────────────────────────────────────────────────────────────

export async function findCompanyById(id: string) {
  return prisma.company.findUnique({ where: { id } })
}

export async function updateCompany(
  id: string,
  data: {
    name?: string
    address?: string
    capabilities?: string[]
    licenses?: string[]
    contactEmail?: string
    contactPhone?: string
  },
) {
  return prisma.company.update({ where: { id }, data })
}

// ─── Member ──────────────────────────────────────────────────────────────────

export async function listMembersByCompany(
  companyId: string,
  opts: { page: number; pageSize: number; status?: string },
) {
  const { page, pageSize, status } = opts
  const where = { companyId, ...(status ? { status } : {}) }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { role: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
  // TODO(Task 8): 移除 as any，schema 添加 name/phone 字段后直接传入即可
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return prisma.user.create({
    data: data as any,
    include: { role: true },
  })
}

export async function updateUserRoleAndStatus(
  id: string,
  data: { roleId?: string; status?: string },
) {
  return prisma.user.update({ where: { id }, data, include: { role: true } })
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } })
}

// ─── Material ────────────────────────────────────────────────────────────────

export async function listMaterials(
  companyId: string,
  opts: { page: number; pageSize: number; search?: string; category?: string },
) {
  const { page, pageSize, search, category } = opts
  const where = {
    companyId,
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { spec: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.materialDb.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
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

export async function updateMaterial(
  id: string,
  companyId: string,
  data: {
    name?: string
    spec?: string
    unitCost?: number
    supplier?: string
    category?: string
  },
) {
  return prisma.materialDb.update({ where: { id, companyId }, data })
}

export async function deleteMaterial(id: string, companyId: string) {
  return prisma.materialDb.delete({ where: { id, companyId } })
}

export async function findMaterialById(id: string, companyId: string) {
  return prisma.materialDb.findFirst({ where: { id, companyId } })
}

export async function bulkCreateMaterials(
  items: Array<{
    companyId: string
    name: string
    spec?: string
    unitCost: number
    supplier?: string
    category?: string
  }>,
) {
  return prisma.materialDb.createMany({ data: items })
}
