// apps/core-service/src/modules/bid/schemas/bid.schema.ts
import { z } from 'zod'

export const CreateBidSchema = z.object({
  tenderId: z.string().min(1),
  name: z.string().default('默认方案'),
  assignedTo: z.string().optional(),
  currency: z.string().default('HKD'),
})

export const UpdateBidSchema = z.object({
  name: z.string().optional(),
  assignedTo: z.string().optional(),
  profitMarginPct: z.number().min(0).max(100).optional(),
})

export const BidStatusSchema = z.object({
  status: z.enum(['IN_REVIEW', 'APPROVED', 'DRAFT', 'SUBMITTED', 'WON', 'LOST']),
  comment: z.string().optional(),
})

export const UpdateCommercialSchema = z.object({
  companyName: z.string().optional(),
  registrationNo: z.string().optional(),
  licenses: z.array(z.object({
    name: z.string(),
    no: z.string(),
    expiresAt: z.string().optional(),
  })).optional(),
  keyPersonnel: z.array(z.object({
    name: z.string(),
    title: z.string(),
    certificate: z.string().optional(),
    yearsExp: z.number().optional(),
    role: z.string().optional(),
  })).optional(),
  pastProjects: z.array(z.object({
    title: z.string(),
    client: z.string().optional(),
    contractAmount: z.number().optional(),
    completedAt: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
  companyProfile: z.string().optional(),
})

export const UpdateTechnicalSchema = z.object({
  constructionMethod: z.string().optional(),
  siteManagement: z.string().optional(),
  safetyMeasures: z.string().optional(),
  qualityControl: z.string().optional(),
  durationDays: z.number().int().positive().optional(),
  milestonePlan: z.array(z.object({
    phase: z.string(),
    startDay: z.number().int(),
    endDay: z.number().int(),
  })).optional(),
})

export const CreateBidItemSchema = z.object({
  itemCode: z.string().optional(),
  itemName: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().min(0).default(0),
  unit: z.string().optional(),
  costPrice: z.number().min(0).default(0),
  sellPrice: z.number().min(0).default(0),
  isSpecial: z.boolean().default(false),
  remark: z.string().optional(),
  drawingPage: z.string().optional(),
  drawingRegion: z.string().optional(),
})

export const UpdateBidItemSchema = CreateBidItemSchema.partial().extend({
  isManualPrice: z.boolean().optional(),
})

export const ReorderItemsSchema = z.object({
  orderedIds: z.array(z.string()),
})

export const ProfitMarginSchema = z.object({
  profitMarginPct: z.number().min(0).max(100),
})
