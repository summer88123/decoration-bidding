import { apiClient } from '@/lib/api-client'

export type TenderStatus = 'PENDING' | 'DECIDED' | 'BIDDING' | 'SUBMITTED' | 'WON' | 'LOST' | 'DECLINED'

export interface Tender {
  id: string
  title: string
  clientName?: string
  location?: string
  deadline?: string
  budgetEstimate?: number
  status: string
  matchScore?: number
  riskLabels: string[]
  aiSummary?: string
  rawDocumentUrl?: string
  sourceUrl?: string
  createdAt: string
  updatedAt: string
}

export interface ListTendersParams {
  page?: number
  pageSize?: number
  status?: TenderStatus
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface CreateTenderDto {
  title: string
  description?: string
  clientName?: string
  location?: string
  deadline?: string
  budgetEstimate?: number
  sourceUrl?: string
  category?: string
}

export async function listTenders(params?: ListTendersParams) {
  const res = await apiClient.get('/api/tenders', { params })
  return res.data as {
    success: boolean
    data: Tender[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
  }
}

export async function getTender(id: string) {
  const res = await apiClient.get(`/api/tenders/${id}`)
  return res.data as { success: boolean; data: Tender }
}

export async function createTender(dto: CreateTenderDto) {
  const res = await apiClient.post('/api/tenders', dto)
  return res.data as { success: boolean; data: Tender }
}

export async function updateTender(id: string, dto: Partial<CreateTenderDto>) {
  const res = await apiClient.put(`/api/tenders/${id}`, dto)
  return res.data as { success: boolean; data: Tender }
}

export async function deleteTender(id: string) {
  await apiClient.delete(`/api/tenders/${id}`)
}

export async function decideTender(id: string, decision: 'BID' | 'DECLINE', reason?: string) {
  const res = await apiClient.post(`/api/tenders/${id}/decide`, { decision, reason })
  return res.data as { success: boolean; data: Tender }
}

export async function uploadTenderDocument(tenderId: string, file: File, fileType: string) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiClient.post(`/api/tenders/${tenderId}/documents?fileType=${fileType}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
