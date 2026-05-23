import { prisma } from '@decoration-bidding/database'

export type TenderStatus =
  | 'PENDING'
  | 'DECIDED'
  | 'BIDDING'
  | 'SUBMITTED'
  | 'WON'
  | 'LOST'
  | 'DECLINED'

export interface CreateTenderData {
  companyId: string
  title: string
  description?: string
  clientName?: string
  location?: string
  deadline?: Date
  budgetEstimate?: number
  sourceUrl?: string
  category?: string
}

export interface UpdateTenderData {
  title?: string
  description?: string
  clientName?: string
  location?: string
  deadline?: Date
  budgetEstimate?: number
  sourceUrl?: string
  category?: string
}

export interface ListTenderOptions {
  page: number
  pageSize: number
  status?: string
  search?: string
  sortBy?: 'createdAt' | 'deadline' | 'budgetEstimate'
  sortOrder?: 'asc' | 'desc'
}

// ─── Tender CRUD ─────────────────────────────────────────────────────────────

export async function createTender(data: CreateTenderData) {
  return prisma.tenderProject.create({
    data: {
      companyId: data.companyId,
      title: data.title,
      clientName: data.clientName,
      location: data.location,
      deadline: data.deadline,
      budgetEstimate: data.budgetEstimate,
      sourceUrl: data.sourceUrl,
      status: 'PENDING',
      riskLabels: [],
    },
  })
}

export async function findTenderById(id: string, companyId: string) {
  return prisma.tenderProject.findFirst({
    where: { id, companyId },
  })
}

export async function listTendersByCompany(
  companyId: string,
  opts: ListTenderOptions,
) {
  const { page, pageSize, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = opts
  const where: Record<string, unknown> = { companyId }

  if (status) where.status = status
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { clientName: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.tenderProject.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.tenderProject.count({ where }),
  ])

  return { items, total }
}

export async function updateTender(id: string, data: UpdateTenderData) {
  return prisma.tenderProject.update({ where: { id }, data })
}

export async function deleteTender(id: string) {
  return prisma.tenderProject.delete({ where: { id } })
}

export async function updateTenderStatus(id: string, status: TenderStatus) {
  return prisma.tenderProject.update({ where: { id }, data: { status } })
}
