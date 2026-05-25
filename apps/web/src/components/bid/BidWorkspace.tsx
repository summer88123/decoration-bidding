'use client'
// apps/web/src/components/bid/BidWorkspace.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { bidApi, type BidData } from '../../lib/api/bid.api'
import { CommercialTab } from './CommercialTab'
import { TechnicalTab } from './TechnicalTab'
import { EconomicTab } from './EconomicTab'
import { useToast } from '../../hooks/use-toast'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'info' | 'warning' | 'danger' | 'done' | 'outline' }> = {
  DRAFT: { label: '草稿', variant: 'outline' },
  IN_REVIEW: { label: '审查中', variant: 'info' },
  APPROVED: { label: '已批准', variant: 'success' },
  SUBMITTED: { label: '已提交', variant: 'done' },
  WON: { label: '已中标', variant: 'success' },
  LOST: { label: '已落标', variant: 'danger' },
}

const NEXT_STATUS: Record<string, { label: string; status: string }> = {
  DRAFT: { label: '提交审查', status: 'IN_REVIEW' },
  IN_REVIEW: { label: '批准', status: 'APPROVED' },
  APPROVED: { label: '提交业主', status: 'SUBMITTED' },
}

interface Props {
  bidId: string
}

export function BidWorkspace({ bidId }: Props) {
  const [bid, setBid] = useState<BidData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    bidApi.getById(bidId)
      .then((res) => setBid(res.data.data))
      .catch(() => toast({ title: '加载失败', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [bidId])

  async function handleStatusChange(status: string) {
    setStatusLoading(true)
    try {
      const res = await bidApi.changeStatus(bidId, { status })
      setBid(res.data.data)
      toast({ title: '状态已更新' })
    } catch {
      toast({ title: '操作失败', variant: 'destructive' })
    } finally {
      setStatusLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!bid) return <div className="p-8 text-gray-500">投标不存在</div>

  const statusInfo = STATUS_MAP[bid.status] ?? { label: bid.status, variant: 'secondary' as const }
  const nextAction = NEXT_STATUS[bid.status]

  return (
    <div className="flex flex-col h-full">
      {/* 顶部信息栏 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{bid.name}</h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              总报价：<span className="font-medium text-gray-800">
                {bid.currency} {Number(bid.totalBidPrice).toLocaleString()}
              </span>
              {' · '}
              总成本：{bid.currency} {Number(bid.totalCost).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => router.back()}>
              返回
            </Button>
            {nextAction && (
              <Button
                size="sm"
                disabled={statusLoading}
                onClick={() => handleStatusChange(nextAction.status)}
              >
                {statusLoading ? '处理中…' : nextAction.label}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 三标 Tab */}
      <Tabs defaultValue="commercial" className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b px-6">
          <TabsList className="h-10">
            <TabsTrigger value="commercial">商务标</TabsTrigger>
            <TabsTrigger value="technical">技术标</TabsTrigger>
            <TabsTrigger value="economic">经济标</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-auto">
          <TabsContent value="commercial" className="m-0 h-full">
            <CommercialTab bidId={bidId} />
          </TabsContent>
          <TabsContent value="technical" className="m-0 h-full">
            <TechnicalTab bidId={bidId} />
          </TabsContent>
          <TabsContent value="economic" className="m-0 h-full">
            <EconomicTab bidId={bidId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
