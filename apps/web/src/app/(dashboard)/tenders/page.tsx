'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Calendar, Building2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { listTenders, type Tender, type TenderStatus } from '@/lib/tenders-api'

// ─── 状态配置 ─────────────────────────────────────────────────────────────────

const STATUS_TABS: { value: TenderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING', label: '待决策' },
  { value: 'BIDDING', label: '投标中' },
  { value: 'SUBMITTED', label: '已提交' },
  { value: 'WON', label: '已中标' },
  { value: 'LOST', label: '已落标' },
  { value: 'DECLINED', label: '已放弃' },
]

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: '待决策', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  DECIDED: { label: '已决策', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  BIDDING: { label: '投标中', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  SUBMITTED: { label: '已提交', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  WON: { label: '已中标', className: 'bg-green-100 text-green-800 border-green-200' },
  LOST: { label: '已落标', className: 'bg-red-100 text-red-800 border-red-200' },
  DECLINED: { label: '已放弃', className: 'bg-gray-100 text-gray-600 border-gray-200' },
}

function formatBudget(budget?: number) {
  if (!budget) return '—'
  if (budget >= 1_000_000) return `HK$ ${(budget / 1_000_000).toFixed(1)}M`
  if (budget >= 1_000) return `HK$ ${(budget / 1_000).toFixed(0)}K`
  return `HK$ ${budget}`
}

function formatDeadline(deadline?: string) {
  if (!deadline) return '—'
  const d = new Date(deadline)
  const now = new Date()
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const dateStr = d.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' })
  if (diffDays < 0) return <span className="text-red-500">{dateStr}（已截止）</span>
  if (diffDays <= 7) return <span className="text-orange-500">{dateStr}（{diffDays}天后）</span>
  return <span>{dateStr}</span>
}

// ─── TenderCard ───────────────────────────────────────────────────────────────

function TenderCard({ tender, onClick }: { tender: Tender; onClick: () => void }) {
  const statusInfo = STATUS_BADGE[tender.status] ?? { label: tender.status, className: '' }
  return (
    <div
      className="bg-surface border border-border rounded-lg p-4 hover:border-accent/50 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-medium text-fg text-sm leading-snug line-clamp-2 flex-1">
          {tender.title}
        </h3>
        <Badge variant="outline" className={cn('text-xs shrink-0', statusInfo.className)}>
          {statusInfo.label}
        </Badge>
      </div>

      <div className="space-y-1 text-xs text-muted">
        {tender.clientName && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3" />
            <span>{tender.clientName}</span>
            {tender.location && <span>· {tender.location}</span>}
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            {formatDeadline(tender.deadline)}
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" />
            <span>{formatBudget(tender.budgetEstimate)}</span>
          </div>
        </div>
      </div>

      {tender.riskLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tender.riskLabels.slice(0, 3).map((label) => (
            <span key={label} className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TendersPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TenderStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [tenders, setTenders] = useState<Tender[]>([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [loading, setLoading] = useState(true)

  const fetchTenders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listTenders({
        page: pagination.page,
        status: activeTab === 'ALL' ? undefined : activeTab,
        search: search || undefined,
      })
      setTenders(res.data)
      setPagination((p) => ({ ...p, total: res.pagination.total, totalPages: res.pagination.totalPages }))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [activeTab, search, pagination.page])

  useEffect(() => {
    const t = setTimeout(fetchTenders, 200)
    return () => clearTimeout(t)
  }, [fetchTenders])

  // 统计
  const stats = [
    { label: '全部项目', value: pagination.total },
  ]

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">招标管理</h1>
          <p className="text-sm text-muted mt-0.5">管理招标项目，追踪投标进度</p>
        </div>
        <Button onClick={() => router.push('/tenders/new')} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          新建招标
        </Button>
      </div>

      {/* 搜索 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <Input
          placeholder="搜索招标项目..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPagination((p) => ({ ...p, page: 1 }))
          }}
          className="pl-9"
        />
      </div>

      {/* 状态 Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveTab(tab.value)
              setPagination((p) => ({ ...p, page: 1 }))
            }}
            className={cn(
              'px-3 py-1.5 text-sm transition-colors border-b-2 -mb-px',
              activeTab === tab.value
                ? 'border-accent text-accent font-medium'
                : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-inset rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tenders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Building2 className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">暂无招标项目</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push('/tenders/new')}
          >
            创建第一个招标项目
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenders.map((tender) => (
              <TenderCard
                key={tender.id}
                tender={tender}
                onClick={() => router.push(`/tenders/${tender.id}`)}
              />
            ))}
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                上一页
              </Button>
              <span className="text-sm text-muted py-1.5">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
