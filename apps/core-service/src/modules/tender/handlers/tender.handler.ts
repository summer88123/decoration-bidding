import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as svc from '../services/tender.service.js'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['PENDING', 'DECIDED', 'BIDDING', 'SUBMITTED', 'WON', 'LOST', 'DECLINED'])
    .optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'deadline', 'budgetEstimate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const createBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  clientName: z.string().optional(),
  location: z.string().optional(),
  deadline: z.string().datetime().optional(),
  budgetEstimate: z.number().positive().optional(),
  sourceUrl: z.string().url().optional(),
  category: z.string().optional(),
})

const updateBodySchema = createBodySchema.partial()

const decideBodySchema = z.object({
  decision: z.enum(['BID', 'DECLINE']),
  reason: z.string().optional(),
})

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function listTendersHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.authUser
  const query = listQuerySchema.parse(req.query)
  const { items, total } = await svc.listTendersService(user.companyId, query)
  const totalPages = Math.ceil(total / query.pageSize)
  return reply.send({
    success: true,
    data: items,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages },
  })
}

export async function createTenderHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.authUser
  const body = createBodySchema.parse(req.body)
  const tender = await svc.createTenderService(user.companyId, {
    ...body,
    deadline: body.deadline ? new Date(body.deadline) : undefined,
  })
  return reply.status(201).send({ success: true, data: tender })
}

export async function getTenderHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  const tender = await svc.getTenderService(req.params.id, user.companyId)
  return reply.send({ success: true, data: tender })
}

export async function updateTenderHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  const body = updateBodySchema.parse(req.body)
  const tender = await svc.updateTenderService(req.params.id, user.companyId, {
    ...body,
    deadline: body.deadline ? new Date(body.deadline) : undefined,
  })
  return reply.send({ success: true, data: tender })
}

export async function deleteTenderHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  await svc.deleteTenderService(req.params.id, user.companyId)
  return reply.status(204).send()
}

export async function decideTenderHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  const body = decideBodySchema.parse(req.body)
  const tender = await svc.decideTenderService(
    req.params.id,
    user.companyId,
    body.decision,
    body.reason,
  )
  return reply.send({ success: true, data: tender })
}

export async function uploadDocumentHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  const data = await req.file()
  if (!data) {
    return reply.status(400).send({ success: false, error: '未提供文件' })
  }
  const chunks: Buffer[] = []
  for await (const chunk of data.file) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)
  const fileType = (req.query as Record<string, string>).fileType ?? 'TENDER_DOC'
  const doc = await svc.uploadTenderDocumentService(
    req.params.id,
    user.companyId,
    buffer,
    data.filename,
    fileType,
  )
  return reply.status(201).send({ success: true, data: doc })
}

export async function listDocumentsHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  const result = await svc.listTenderDocumentsService(req.params.id, user.companyId)
  return reply.send({ success: true, data: result })
}

export async function deleteDocumentHandler(
  req: FastifyRequest<{ Params: { id: string; docId: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  await svc.deleteTenderDocumentService(req.params.id, req.params.docId, user.companyId)
  return reply.status(204).send()
}
