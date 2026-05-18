// 共享类型定义 - 对应规格书 4.1 核心实体

// ─── 用户与公司 ────────────────────────────────────────────────

export type UserRole = 'management' | 'bid-owner'

export interface Company {
  id: string
  name: string
  capabilities: Record<string, unknown>
  licenses: string[]
  budgetRange?: { min: number; max: number }
  regions: string[]
  createdAt: Date
}

export interface User {
  id: string
  companyId: string
  email: string
  roleId: string
  status: 'active' | 'inactive'
  createdAt: Date
}

// ─── 招标与投标 ────────────────────────────────────────────────

export type TenderStatus = 'new' | 'reviewing' | 'bidding' | 'submitted' | 'won' | 'lost'
export type RiskLabel = 'high-value' | 'tight-deadline' | 'complex-scope' | 'license-required'

export interface TenderProject {
  id: string
  companyId: string
  sourceUrl?: string
  title: string
  clientName?: string
  location?: string
  deadline?: Date
  budgetEstimate?: number
  matchScore?: number
  riskLabels: RiskLabel[]
  status: TenderStatus
  aiSummary?: string
  rawDocumentUrl?: string
  createdAt: Date
}

export interface Bid {
  id: string
  tenderId: string
  assignedTo?: string
  status: 'draft' | 'in-progress' | 'review' | 'submitted'
  profitMarginPercent?: number
  totalCost?: number
  totalBidPrice?: number
  createdAt: Date
}

export interface BidItem {
  id: string
  bidId: string
  itemName: string
  description?: string
  quantity: number
  unit: string
  costPrice: number
  sellPrice: number
  isSpecial: boolean
  remark?: string
  drawingPage?: number
  drawingRegion?: string
  sortOrder: number
}

export type DocumentFileType = 'pdf' | 'dwg' | 'ifc'

export interface BidDocument {
  id: string
  bidId: string
  fileType: DocumentFileType
  fileUrl: string
  pageCount?: number
  drawingLinks: string[]
  ifcMetadata?: Record<string, unknown>
  createdAt: Date
}

// ─── AI Skill ─────────────────────────────────────────────────

export interface SkillResult<T = unknown> {
  skillName: string
  success: boolean
  data?: T
  error?: string
  tokensUsed?: number
  durationMs?: number
}

export interface MatchTenderResult {
  score: number  // 0-100
  reasons: string[]
  recommendations: string[]
}

export interface RiskAssessmentResult {
  riskLabels: RiskLabel[]
  details: Array<{ label: string; description: string; suggestion: string }>
}

// ─── 存储抽象层 ────────────────────────────────────────────────

export interface StorageService {
  save(file: Buffer, filename: string, mimeType?: string): Promise<string>
  getUrl(fileKey: string): string
  delete(fileKey: string): Promise<void>
}

// ─── 图纸解析 ─────────────────────────────────────────────────

export interface DrawingRegion {
  page: number   // 1-indexed
  x: number      // 左上角 x，占页面宽度比例 0-1
  y: number      // 左上角 y，占页面高度比例 0-1
  w: number      // 宽度比例 0-1
  h: number      // 高度比例 0-1
}

export interface BidItemFromAI {
  itemName: string
  quantity: number
  unit: string
  description?: string
  region: DrawingRegion
}

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ─── 通用 API 响应 ──────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
}
