// apps/web/src/lib/api/bid.api.ts
import { apiClient } from '../api-client'

export interface BidItemData {
  id: string
  bidId: string
  documentId?: string
  sortOrder: number
  itemCode?: string
  itemName: string
  description?: string
  quantity: number
  unit?: string
  costPrice: number
  sellPrice: number
  isSpecial?: boolean
  isManualPrice?: boolean
  remark?: string
  drawingPage?: string
  drawingRegion?: string
  ifcElementId?: string
}

export interface DocumentStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  pageCount?: number
  errorMsg?: string
}

export interface BidDocumentItem {
  id: string
  originalName: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  fileUrl: string
}

export interface UploadResult {
  documentId: string
  status: 'processing'
}

// ─── Bid 主体 ─────────────────────────────────────────────────
export interface BidData {
  id: string
  tenderId: string
  companyId: string
  name: string
  assignedTo?: string
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SUBMITTED' | 'WON' | 'LOST'
  profitMarginPct: number
  totalCost: number
  totalBidPrice: number
  currency: string
  submittedAt?: string
  createdAt: string
  commercial?: BidCommercialData
  technical?: BidTechnicalData
  bidItems?: BidItemData[]
  statusHistory?: BidStatusLogData[]
}

export interface BidCommercialData {
  id: string
  companyName?: string
  registrationNo?: string
  licenses: Array<{ name: string; no: string; expiresAt?: string }>
  keyPersonnel: Array<{ name: string; title: string; certificate?: string; yearsExp?: number; role?: string }>
  pastProjects: Array<{ title: string; client?: string; contractAmount?: number; completedAt?: string; description?: string }>
  companyProfile?: string
}

export interface BidTechnicalData {
  id: string
  constructionMethod?: string
  siteManagement?: string
  safetyMeasures?: string
  qualityControl?: string
  durationDays?: number
  milestonePlan: Array<{ phase: string; startDay: number; endDay: number }>
}

export interface BidStatusLogData {
  id: string
  fromStatus?: string
  toStatus: string
  operatorId: string
  comment?: string
  createdAt: string
}

// ─── 旧版 API（兼容现有 useBidDocument hook）──────────────────
export const bidApi = {
  uploadDrawing: async (bidId: string, file: File, customPrompt?: string): Promise<UploadResult> => {
    const formData = new FormData()
    formData.append('file', file)
    if (customPrompt?.trim()) formData.append('customPrompt', customPrompt.trim())
    const res = await apiClient.post<{ data: UploadResult }>(
      `/api/bids/${bidId}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data
  },

  getDocumentStatus: async (bidId: string, docId: string): Promise<DocumentStatus> => {
    const res = await apiClient.get<{ data: DocumentStatus }>(
      `/api/bids/${bidId}/documents/${docId}/status`,
    )
    return res.data.data
  },

  getBidItems: async (bidId: string, documentId?: string): Promise<BidItemData[]> => {
    const params = documentId ? { documentId } : {}
    const res = await apiClient.get<{ success: boolean; data: BidItemData[] }>(
      `/api/bids/${bidId}/items`,
      { params },
    )
    return res.data.data
  },

  // ── Bid 主体 ────────────────────────────────────────────────
  create: (data: { tenderId: string; name?: string; assignedTo?: string; currency?: string }) =>
    apiClient.post('/api/bids', data),

  getById: (bidId: string) =>
    apiClient.get(`/api/bids/${bidId}`),

  getByTender: (tenderId: string) =>
    apiClient.get(`/api/tenders/${tenderId}/bids`),

  update: (bidId: string, data: { name?: string; assignedTo?: string }) =>
    apiClient.patch(`/api/bids/${bidId}`, data),

  changeStatus: (bidId: string, data: { status: string; comment?: string }) =>
    apiClient.patch(`/api/bids/${bidId}/status`, data),

  applyProfitMargin: (bidId: string, profitMarginPct: number) =>
    apiClient.patch(`/api/bids/${bidId}/profit-margin`, { profitMarginPct }),

  // ── 商务标 ──────────────────────────────────────────────────
  getCommercial: (bidId: string) =>
    apiClient.get(`/api/bids/${bidId}/commercial`),

  updateCommercial: (bidId: string, data: Partial<BidCommercialData>) =>
    apiClient.patch(`/api/bids/${bidId}/commercial`, data),

  // ── 技术标 ──────────────────────────────────────────────────
  getTechnical: (bidId: string) =>
    apiClient.get(`/api/bids/${bidId}/technical`),

  updateTechnical: (bidId: string, data: Partial<BidTechnicalData>) =>
    apiClient.patch(`/api/bids/${bidId}/technical`, data),

  // ── 文档 ─────────────────────────────────────────────────────
  listDocuments: async (bidId: string): Promise<BidDocumentItem[]> => {
    const res = await apiClient.get<{ success: boolean; data: BidDocumentItem[] }>(
      `/api/bids/${bidId}/documents`,
    )
    return res.data.data
  },

  deleteDocument: (bidId: string, docId: string) =>
    apiClient.delete(`/api/bids/${bidId}/documents/${docId}`),

  deleteBid: (bidId: string) =>
    apiClient.delete(`/api/bids/${bidId}`),

  // ── 经济标条目 ───────────────────────────────────────────────
  listItems: (bidId: string, documentId?: string) => {
    const params = documentId ? { documentId } : {}
    return apiClient.get(`/api/bids/${bidId}/items`, { params })
  },

  createItem: (bidId: string, data: Partial<BidItemData>) =>
    apiClient.post(`/api/bids/${bidId}/items`, data),

  updateItem: (bidId: string, itemId: string, data: Partial<BidItemData>) =>
    apiClient.patch(`/api/bids/${bidId}/items/${itemId}`, data),

  deleteItem: (bidId: string, itemId: string) =>
    apiClient.delete(`/api/bids/${bidId}/items/${itemId}`),

  reorderItems: (bidId: string, orderedIds: string[]) =>
    apiClient.patch(`/api/bids/${bidId}/items/reorder`, { orderedIds }),
}
