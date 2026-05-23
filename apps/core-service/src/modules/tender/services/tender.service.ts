import { prisma } from '@decoration-bidding/database'
import { createLogger } from '@decoration-bidding/shared-utils'
import {
  createTender,
  findTenderById,
  listTendersByCompany,
  updateTender,
  deleteTender,
  updateTenderStatus,
  type CreateTenderData,
  type UpdateTenderData,
  type ListTenderOptions,
  type TenderStatus,
} from '../repositories/tender.repository.js'
import { createStorageService } from '../../bid/storage/storage.factory.js'

const logger = createLogger('tender-service')

function getStorage() {
  const driver = process.env.STORAGE_DRIVER ?? 'local'
  const uploadDir = process.env.UPLOAD_DIR ?? './uploads'
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:8080'
  return createStorageService(driver, uploadDir, baseUrl)
}

// ─── 状态流转规则 ─────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, TenderStatus[]> = {
  PENDING: ['DECIDED', 'DECLINED'],
  DECIDED: ['BIDDING', 'DECLINED'],
  BIDDING: ['SUBMITTED'],
  SUBMITTED: ['WON', 'LOST'],
  WON: [],
  LOST: [],
  DECLINED: [],
}

function canTransition(from: string, to: TenderStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to)
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function createTenderService(
  companyId: string,
  dto: Omit<CreateTenderData, 'companyId'>,
) {
  return createTender({ ...dto, companyId })
}

export async function getTenderService(id: string, companyId: string) {
  const tender = await findTenderById(id, companyId)
  if (!tender) throw Object.assign(new Error('招标项目不存在'), { statusCode: 404 })
  return tender
}

export async function listTendersService(companyId: string, query: ListTenderOptions) {
  return listTendersByCompany(companyId, query)
}

export async function updateTenderService(
  id: string,
  companyId: string,
  dto: UpdateTenderData,
) {
  const tender = await findTenderById(id, companyId)
  if (!tender) throw Object.assign(new Error('招标项目不存在'), { statusCode: 404 })
  if (!['PENDING', 'DECIDED'].includes(tender.status)) {
    throw Object.assign(new Error('当前状态不允许编辑'), { statusCode: 400 })
  }
  return updateTender(id, dto)
}

export async function deleteTenderService(id: string, companyId: string) {
  const tender = await findTenderById(id, companyId)
  if (!tender) throw Object.assign(new Error('招标项目不存在'), { statusCode: 404 })
  if (tender.status !== 'PENDING') {
    throw Object.assign(new Error('仅 PENDING 状态可删除'), { statusCode: 400 })
  }
  return deleteTender(id)
}

export async function decideTenderService(
  id: string,
  companyId: string,
  decision: 'BID' | 'DECLINE',
  reason?: string,
) {
  const tender = await findTenderById(id, companyId)
  if (!tender) throw Object.assign(new Error('招标项目不存在'), { statusCode: 404 })

  const targetStatus: TenderStatus = decision === 'BID' ? 'BIDDING' : 'DECLINED'
  if (!canTransition(tender.status, targetStatus)) {
    throw Object.assign(
      new Error(`状态 ${tender.status} 不允许此操作`),
      { statusCode: 400 },
    )
  }

  logger.info({ tenderId: id, decision, reason }, '执行投标决策')
  return updateTenderStatus(id, targetStatus)
}

export async function uploadTenderDocumentService(
  tenderId: string,
  companyId: string,
  file: Buffer,
  filename: string,
  fileType: string,
) {
  const tender = await findTenderById(tenderId, companyId)
  if (!tender) throw Object.assign(new Error('招标项目不存在'), { statusCode: 404 })

  const storage = getStorage()
  const fileKey = await storage.save(file, filename)
  const fileUrl = storage.getUrl(fileKey)

  const doc = await prisma.bidDocument.create({
    data: {
      bidId: tenderId, // 复用 BidDocument 存招标文件（tenderId 作为 bidId 占位）
      fileType,
      fileUrl,
      status: 'completed',
    },
  })

  logger.info({ tenderId, docId: doc.id, filename }, '招标文件上传成功')
  return doc
}

export async function listTenderDocumentsService(tenderId: string, companyId: string) {
  const tender = await findTenderById(tenderId, companyId)
  if (!tender) throw Object.assign(new Error('招标项目不存在'), { statusCode: 404 })

  // 这里使用独立的 TenderDocument 表（若 Schema 中没有则先用 rawDocumentUrl）
  // 暂时返回 tender 的 rawDocumentUrl 信息
  return { tenderId, rawDocumentUrl: tender.rawDocumentUrl }
}

export async function deleteTenderDocumentService(
  tenderId: string,
  _docId: string,
  companyId: string,
) {
  const tender = await findTenderById(tenderId, companyId)
  if (!tender) throw Object.assign(new Error('招标项目不存在'), { statusCode: 404 })
  // TODO: 实现文件删除（需要 TenderDocument 独立表）
  return { success: true }
}
