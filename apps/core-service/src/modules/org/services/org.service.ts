import { randomBytes } from 'crypto'
import bcrypt from 'bcrypt'
import { Prisma } from '@decoration-bidding/database'
import { createLogger } from '@decoration-bidding/shared-utils'
import * as repo from '../repositories/org.repository.js'
import { sendInviteEmail } from '../../auth/services/mail.service.js'

const logger = createLogger('org-service')
const SALT_ROUNDS = 10

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class OrgError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 400) {
    super(message)
    this.name = 'OrgError'
  }
}

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

export async function getCompany(companyId: string) {
  const company = await repo.findCompanyById(companyId)
  if (!company) throw new OrgError('NOT_FOUND', '公司不存在', 404)
  return company
}

export async function updateCompany(
  companyId: string,
  data: {
    name?: string
    address?: string
    capabilities?: string[]
    licenses?: string[]
    contactEmail?: string
    contactPhone?: string
  }
) {
  await getCompany(companyId)
  return repo.updateCompany(companyId, data)
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function listMembers(
  companyId: string,
  opts: { page: number; pageSize: number; status?: string }
) {
  return repo.listMembersByCompany(companyId, opts)
}

export async function inviteMember(
  companyId: string,
  data: { email: string; name: string; role: string }
) {
  const roleRecord = await repo.findRoleByName(data.role)
  if (!roleRecord) throw new OrgError('VALIDATION_ERROR', '角色不存在', 400)

  const tempPassword = randomBytes(8).toString('hex')
  const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS)

  let user: Awaited<ReturnType<typeof repo.createPendingUser>>
  try {
    user = await repo.createPendingUser({
      email: data.email,
      name: data.name,
      companyId,
      roleId: roleRecord.id,
      passwordHash,
      status: 'pending',
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new OrgError('DUPLICATE', '该邮箱已被注册', 409)
    }
    throw err
  }

  // 异步发送邀请邮件，不阻塞主流程（未配置 SMTP 时自动跳过）
  sendInviteEmail(data.email, data.name, tempPassword).catch((err: unknown) => {
    logger.error({ err }, 'sendInviteEmail 发送失败')
  })

  return user
}

export async function updateMemberRole(
  companyId: string,
  userId: string,
  data: { role?: string; status?: string }
) {
  const user = await repo.findUserById(userId)
  if (!user || user.companyId !== companyId) throw new OrgError('NOT_FOUND', '成员不存在', 404)

  let roleId: string | undefined
  if (data.role) {
    const roleRecord = await repo.findRoleByName(data.role)
    if (!roleRecord) throw new OrgError('VALIDATION_ERROR', '角色不存在', 400)
    roleId = roleRecord.id
  }

  return repo.updateUserRoleAndStatus(userId, { roleId, status: data.status })
}

export async function removeMember(companyId: string, userId: string) {
  const user = await repo.findUserById(userId)
  if (!user || user.companyId !== companyId) throw new OrgError('NOT_FOUND', '成员不存在', 404)
  return repo.deleteUser(userId)
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export async function listMaterials(
  companyId: string,
  opts: { page: number; pageSize: number; search?: string; category?: string }
) {
  return repo.listMaterials(companyId, opts)
}

export async function createMaterial(
  companyId: string,
  data: { name: string; spec?: string; unitCost: number; supplier?: string; category?: string }
) {
  return repo.createMaterial({ ...data, companyId })
}

export async function updateMaterial(
  companyId: string,
  id: string,
  data: { name?: string; spec?: string; unitCost?: number; supplier?: string; category?: string }
) {
  const existing = await repo.findMaterialById(id, companyId)
  if (!existing) throw new OrgError('NOT_FOUND', '物料不存在', 404)
  return repo.updateMaterial(id, companyId, data)
}

export async function deleteMaterial(companyId: string, id: string) {
  const existing = await repo.findMaterialById(id, companyId)
  if (!existing) throw new OrgError('NOT_FOUND', '物料不存在', 404)
  await repo.deleteMaterial(id, companyId)
}

export async function importMaterials(
  companyId: string,
  rows: Array<{ name: string; spec?: string; unitCost: number; supplier?: string; category?: string }>
) {
  const errors: Array<{ row: number; reason: string }> = []
  const valid: typeof rows = []

  rows.forEach((row, i) => {
    if (!row.name || row.name.trim() === '') {
      errors.push({ row: i + 2, reason: 'name 不能为空' })
      return
    }
    if (typeof row.unitCost !== 'number' || row.unitCost < 0) {
      errors.push({ row: i + 2, reason: 'unitCost 必须为非负数' })
      return
    }
    valid.push(row)
  })

  if (valid.length > 0) {
    await repo.bulkCreateMaterials(valid.map((row) => ({ ...row, companyId })))
  }

  return { imported: valid.length, skipped: errors.length, errors }
}
