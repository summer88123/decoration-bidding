// apps/web/src/lib/api/bid.api.ts
import { apiClient } from '../api-client'

export interface BidItemData {
  id: string
  bidId: string
  documentId?: string
  itemName: string
  description?: string
  quantity: number
  unit: string
  costPrice: number
  sellPrice: number
  drawingPage?: number
  drawingRegion?: string
  sortOrder: number
}

export interface DocumentStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  pageCount?: number
  errorMsg?: string
}

export interface UploadResult {
  documentId: string
  status: 'processing'
}

export const bidApi = {
  uploadDrawing: async (bidId: string, file: File): Promise<UploadResult> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post<{ data: UploadResult }>(
      `/bids/${bidId}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data
  },

  getDocumentStatus: async (bidId: string, docId: string): Promise<DocumentStatus> => {
    const res = await apiClient.get<{ data: DocumentStatus }>(
      `/bids/${bidId}/documents/${docId}/status`,
    )
    return res.data.data
  },

  getBidItems: async (bidId: string): Promise<BidItemData[]> => {
    const res = await apiClient.get<{ data: BidItemData[] }>(
      `/bids/${bidId}/items`,
    )
    return res.data.data
  },
}
