import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as xlsx from 'xlsx'
import * as svc from '../services/org.service.js'

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

type MappedRow = {
  name: string
  spec?: string
  unitCost: number
  supplier?: string
  category?: string
}

export async function listMaterialsHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.authUser
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
  const user = req.authUser
  const body = createMaterialSchema.parse(req.body)
  const material = await svc.createMaterial(user.companyId, body)
  return reply.status(201).send({ success: true, data: material })
}

export async function updateMaterialHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  const body = updateMaterialSchema.parse(req.body)
  const material = await svc.updateMaterial(user.companyId, req.params.id, body)
  return reply.send({ success: true, data: material })
}

export async function deleteMaterialHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  await svc.deleteMaterial(user.companyId, req.params.id)
  return reply.send({ success: true })
}

export async function importMaterialsHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.authUser
  const data = await (req as any).file()
  if (!data) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '请上传 Excel 文件' },
    })
  }

  const chunks: Buffer[] = []
  for await (const chunk of data.file) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)

  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet)

  const mapped: MappedRow[] = rows.map((row: Record<string, unknown>) => ({
    name: String(row['名称'] ?? row['name'] ?? ''),
    spec: row['规格'] != null ? String(row['规格']) : (row['spec'] != null ? String(row['spec']) : undefined),
    unitCost: Number(row['单价'] ?? row['unitCost'] ?? 0),
    supplier: row['供应商'] != null ? String(row['供应商']) : (row['supplier'] != null ? String(row['supplier']) : undefined),
    category: row['分类'] != null ? String(row['分类']) : (row['category'] != null ? String(row['category']) : undefined),
  }))

  const result = await svc.importMaterials(user.companyId, mapped)
  return reply.send({ success: true, data: result })
}
