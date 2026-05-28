'use client'
// apps/web/src/components/bid/EconomicTab.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Card } from '../ui/card'
import { bidApi, type BidData, type BidDocumentItem } from '../../lib/api/bid.api'
import { useToast } from '../../hooks/use-toast'

interface Props { bidId: string }

export function EconomicTab({ bidId }: Props) {
  const [bid, setBid] = useState<BidData | null>(null)
  const [profitMargin, setProfitMargin] = useState<string>('0')
  const [applying, setApplying] = useState(false)
  const [documents, setDocuments] = useState<BidDocumentItem[]>([])
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    bidApi.getById(bidId)
      .then((res) => {
        setBid(res.data.data)
        setProfitMargin(String(res.data.data.profitMarginPct ?? 0))
      })
      .catch(() => {})
  }, [bidId])

  useEffect(() => {
    bidApi.listDocuments(bidId)
      .then(setDocuments)
      .catch(() => {})
  }, [bidId])

  async function applyMargin() {
    setApplying(true)
    try {
      const res = await bidApi.applyProfitMargin(bidId, parseFloat(profitMargin))
      setBid(res.data.data)
      toast({ title: `已应用 ${profitMargin}% 利润率` })
    } catch {
      toast({ title: '应用失败', variant: 'destructive' })
    } finally {
      setApplying(false)
    }
  }

  async function deleteDocument(docId: string) {
    if (!confirm('确认删除此文档及其所有工程量条目？')) return
    setDeletingDocId(docId)
    try {
      await bidApi.deleteDocument(bidId, docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
      toast({ title: '文档已删除' })
    } catch {
      toast({ title: '删除失败', variant: 'destructive' })
    } finally {
      setDeletingDocId(null)
    }
  }

  if (!bid) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalCost = Number(bid.totalCost)
  const totalBid = Number(bid.totalBidPrice)
  const actualMargin = totalCost > 0 ? ((totalBid - totalCost) / totalCost * 100).toFixed(1) : '—'

  function statusBadge(status: string) {
    const map: Record<string, { label: string; className: string }> = {
      pending:    { label: '等待中',  className: 'bg-gray-100 text-gray-600' },
      processing: { label: '解析中',  className: 'bg-yellow-100 text-yellow-700' },
      completed:  { label: '已完成',  className: 'bg-green-100 text-green-700' },
      failed:     { label: '失败',    className: 'bg-red-100 text-red-600' },
    }
    const { label, className } = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' }
    return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* 汇总统计 */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">总成本</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">
            {bid.currency} {totalCost.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">总报价</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {bid.currency} {totalBid.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">综合利润率</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{actualMargin}%</p>
        </Card>
      </div>

      {/* 利润率设定 */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium text-gray-900">统一利润率</h3>
        <p className="text-sm text-gray-500">
          设定后，所有非手动定价条目将按公式重新计算：售价 = 成本价 × (1 + 利润率%)
        </p>
        <div className="flex items-end gap-3">
          <div>
            <Label>利润率 (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={profitMargin}
              onChange={(e) => setProfitMargin(e.target.value)}
              className="w-32"
            />
          </div>
          <Button onClick={applyMargin} disabled={applying}>
            {applying ? '计算中…' : '应用利润率'}
          </Button>
        </div>
      </Card>

      {/* 已上传文件 */}
      {documents.length > 0 && (
        <Card className="p-4 space-y-2">
          <h3 className="font-medium text-gray-900 text-sm">已上传图纸</h3>
          <ul className="space-y-1">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between text-sm py-1 gap-2">
                <button
                  className="text-gray-700 truncate max-w-xs text-left hover:text-blue-600 transition-colors"
                  onClick={() => router.push(`/bids/${bidId}/economic?documentId=${doc.id}`)}
                >
                  {doc.originalName ?? '未命名文件'}
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(doc.status)}
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    disabled={deletingDocId === doc.id}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="删除此文档"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 进入经济标工作台 */}
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => router.push(`/bids/${bidId}/economic`)}
      >
        进入经济标工作台（详细清单）→
      </Button>
    </div>
  )
}
