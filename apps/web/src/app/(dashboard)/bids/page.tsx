'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { listTenders, type Tender } from '@/lib/tenders-api'
import { bidApi, type BidData } from '@/lib/api/bid.api'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

// ─── 类型 ──────────────────────────────────────────────────────────────────

type BidStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SUBMITTED' | 'WON' | 'LOST'

interface FlatBid extends BidData {
  tenderTitle: string
  tenderDeadline?: string
}

// ─── 配置 ──────────────────────────────────────────────────────────────────

type StatusVariant = 'default' | 'success' | 'info' | 'warning' | 'danger' | 'done'

const STATUS_MAP: Record<BidStatus, { label: string; variant: StatusVariant; className?: string }> = {
  DRAFT:     { label: '草稿',   variant: 'default' },
  IN_REVIEW: { label: '审查中', variant: 'warning' },
  APPROVED:  { label: '已批准', variant: 'success' },
  SUBMITTED: { label: '已提交', variant: 'info' },
  WON:       { label: '已中标', variant: 'success', className: 'bg-success text-white' },
  LOST:      { label: '未中标', variant: 'danger' },
}

const FILTER_TABS: { value: BidStatus | 'ALL'; label: string }[] = [
  { value: 'ALL',       label: '全部' },
  { value: 'DRAFT',     label: '草稿' },
  { value: 'IN_REVIEW', label: '审查中' },
  { value: 'APPROVED',  label: '已批准' },
  { value: 'SUBMITTED', label: '已提交' },
  { value: 'WON',       label: '已中标' },
  { value: 'LOST',      label: '未中标' },
]

// 按状态推算完成进度（后端暂无 progress 字段）
const STATUS_PROGRESS: Record<BidStatus, number> = {
  DRAFT: 30, IN_REVIEW: 70, APPROVED: 90, SUBMITTED: 100, WON: 100, LOST: 100,
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────

function formatQuote(v?: number) {
  if (!v) return '—'
  if (v >= 1_000_000) return `HK$${(v / 1_000_000).toFixed(2)}M`
  return `HK$${(v / 1_000).toFixed(0)}K`
}

function formatDate(d?: string) {
  if (!d) return '—'
  return d.slice(0, 10)
}

// ─── 主组件 ───────────────────────────────────────────────────────────────

export default function BidsPage() {
  const router = useRouter()
  const [bids, setBids] = useState<FlatBid[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<BidStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

  // 并发拉取：先获取所有 tenders，再获取每个 tender 下的 bids
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const tendersRes = await listTenders({ pageSize: 200 })
      const tenders: Tender[] = tendersRes.data

      const results = await Promise.allSettled(
        tenders.map((t) =>
          bidApi
            .getByTender(t.id)
            .then((res) => {
              const data = (res.data as { data: BidData[] }).data
              return data.map((b): FlatBid => ({
                ...b,
                tenderTitle: t.title,
                tenderDeadline: t.deadline,
              }))
            })
        )
      )

      const flat: FlatBid[] = []
      for (const r of results) {
        if (r.status === 'fulfilled') flat.push(...r.value)
      }
      // 按创建时间倒序
      flat.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      setBids(flat)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const filtered = bids.filter((b) => {
    if (activeTab !== 'ALL' && b.status !== activeTab) return false
    if (search && !b.tenderTitle.includes(search) && !b.name?.includes(search)) return false
    return true
  })

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between bg-bg sticky top-0 z-10">
        <div>
          <div className="text-xl font-semibold text-fg">投标工作台</div>
          <div className="text-xs text-muted mt-0.5">管理所有进行中的投标</div>
        </div>
      </header>

      {/* Filter */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <Input
          type="search"
          placeholder="搜索项目名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-60"
        />
        <div className="flex gap-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-[5px] rounded-[6px] text-xs border transition-colors ${
                activeTab === tab.value
                  ? 'bg-accent text-white border-accent'
                  : 'bg-bg text-muted border-border hover:bg-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <main className="px-6 py-4 flex-1">
        <div className="border border-border rounded-[6px] overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">投标项目</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">版本</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">截标日期</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">完成进度</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted">总报价</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">状态</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-inset rounded animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted text-sm">
                    暂无投标方案
                  </td>
                </tr>
              ) : (
                filtered.map((bid) => {
                  const s = STATUS_MAP[bid.status as BidStatus] ?? STATUS_MAP.DRAFT
                  const progress = STATUS_PROGRESS[bid.status as BidStatus] ?? 0
                  return (
                    <tr
                      key={bid.id}
                      className="border-b border-border hover:bg-surface cursor-pointer transition-colors last:border-0"
                      onClick={() => router.push(`/bids/${bid.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <a
                          href={`/bids/${bid.id}`}
                          className="font-medium text-accent hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {bid.tenderTitle}
                        </a>
                        {bid.name && (
                          <div className="text-[11px] text-muted mt-0.5">{bid.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted text-xs">{bid.name ?? '主方案'}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatDate(bid.tenderDeadline)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted tabular-nums">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatQuote(bid.totalBidPrice)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={s.variant} className={s.className}>
                          {s.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <a
                          href={`/bids/${bid.id}`}
                          className="inline-flex items-center px-3 py-[3px] text-xs border border-border rounded-[6px] bg-surface hover:bg-inset transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          编辑
                        </a>
                        {bid.status === 'APPROVED' && (
                          <button
                            className="ml-1 inline-flex items-center px-3 py-[3px] text-xs rounded-[6px] bg-success text-white hover:bg-success/90 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/bids/${bid.id}`)
                            }}
                          >
                            提交
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* Footer count */}
          {!loading && (
            <div className="px-4 py-2.5 border-t border-border bg-surface text-xs text-muted">
              共 {filtered.length} 条记录
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
