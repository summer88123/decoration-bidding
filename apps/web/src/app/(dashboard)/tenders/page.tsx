'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { listTenders, type Tender, type TenderStatus } from '@/lib/tenders-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// ─── 状态配置（匹配原型精确颜色）────────────────────────────────────────────

type StatusVariant = 'default' | 'success' | 'info' | 'warning' | 'danger' | 'done'
const STATUS_MAP: Record<string, { label: string; variant: StatusVariant; className?: string }> = {
  PENDING:   { label: '待决策',   variant: 'warning' },
  DECIDED:   { label: '决定投标', variant: 'info' },
  BIDDING:   { label: '投标中',   variant: 'info' },
  SUBMITTED: { label: '已提交',   variant: 'success' },
  WON:       { label: '已中标',   variant: 'success', className: 'bg-success text-white' },
  LOST:      { label: '已落标',   variant: 'danger' },
  DECLINED:  { label: '已放弃',   variant: 'default' },
}

const FILTER_TABS: { value: TenderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING', label: '待决策' },
  { value: 'BIDDING', label: '投标中' },
  { value: 'SUBMITTED', label: '已提交' },
  { value: 'WON', label: '已中标' },
  { value: 'DECLINED', label: '已放弃' },
]

function formatBudget(budget?: number) {
  if (!budget) return '—'
  if (budget >= 1_000_000) return `HK$${(budget / 1_000_000).toFixed(1)}M`
  if (budget >= 1_000) return `HK$${Math.round(budget / 1_000)}K`
  return `HK$${budget}`
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return dateStr.slice(0, 10)
}

function isUrgent(deadline?: string) {
  if (!deadline) return false
  return new Date(deadline).getTime() - Date.now() < 7 * 86400 * 1000
}

export default function TendersPage() {
  const router = useRouter()
  const [tenders, setTenders] = useState<Tender[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TenderStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchTenders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listTenders({
        page,
        pageSize,
        status: activeTab === 'ALL' ? undefined : activeTab,
        search: search || undefined,
        sortBy: 'deadline',
        sortOrder: sortBy === 'desc' ? 'desc' : 'asc',
      })
      setTenders(res.data)
      setTotal(res.pagination.total)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, activeTab, search, sortBy])

  useEffect(() => {
    const t = setTimeout(fetchTenders, 150)
    return () => clearTimeout(t)
  }, [fetchTenders])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between bg-bg sticky top-0 z-10">
        <div>
          <div className="text-xl font-semibold text-fg">招标项目</div>
          <div className="text-xs text-muted mt-0.5">管理所有招标机会</div>
        </div>
        <Button variant="primary" size="md" onClick={() => router.push('/tenders/new')}>
          <Plus className="w-3.5 h-3.5" />
          新建招标项目
        </Button>
      </header>

      <main className="p-6 flex-1">
        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Input
            type="search"
            placeholder="搜索项目名称、业主…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-[240px]"
          />
          <div className="flex gap-0.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setActiveTab(tab.value); setPage(1) }}
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
          <button
            onClick={() => setSortBy((s) => (s === 'asc' ? 'desc' : 'asc'))}
            className="ml-auto flex items-center gap-1 px-[10px] py-[5px] border border-border rounded-[6px] text-xs text-muted bg-bg hover:bg-surface transition-colors"
          >
            截标日期
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"
              className={`transition-transform ${sortBy === 'desc' ? 'rotate-180' : ''}`}>
              <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="border border-border rounded-[6px] overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted whitespace-nowrap">项目名称</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted whitespace-nowrap">业主 / 甲方</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted whitespace-nowrap">截标日期</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted whitespace-nowrap">预算估算</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">状态</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-4 bg-inset rounded animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              ) : tenders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted text-sm">
                    <div className="mb-3">暂无招标项目</div>
                    <Button variant="primary" size="md" onClick={() => router.push('/tenders/new')}>
                      <Plus className="w-3.5 h-3.5" />
                      创建第一个招标项目
                    </Button>
                  </td>
                </tr>
              ) : (
                tenders.map((t) => {
                  const s = STATUS_MAP[t.status] ?? STATUS_MAP.PENDING
                  const urgent = isUrgent(t.deadline)
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-border hover:bg-surface cursor-pointer transition-colors"
                      onClick={() => router.push(`/tenders/${t.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <a
                          href={`/tenders/${t.id}`}
                          className="font-medium text-accent hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.title}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{t.clientName ?? '—'}</td>
                      <td
                        className={`px-4 py-2.5 tabular-nums ${urgent ? 'text-danger font-medium' : ''}`}
                      >
                        {formatDate(t.deadline)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatBudget(t.budgetEstimate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={s.variant} className={s.className}>
                          {s.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <a
                          href={`/tenders/${t.id}`}
                          className="inline-flex items-center px-3 py-[3px] text-xs border border-border rounded-[6px] bg-surface hover:bg-inset transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          查看
                        </a>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {!loading && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-surface">
              <span className="text-xs text-muted">
                共 {total} 条记录{totalPages > 1 && `，第 ${page} / ${totalPages} 页`}
              </span>
              {totalPages > 1 && (
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-[3px] text-xs border border-border rounded-[6px] bg-surface hover:bg-inset disabled:opacity-40 transition-colors"
                  >
                    上一页
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-[3px] text-xs border rounded-[6px] transition-colors ${
                        p === page
                          ? 'bg-accent text-white border-accent'
                          : 'bg-surface border-border hover:bg-inset'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-[3px] text-xs border border-border rounded-[6px] bg-surface hover:bg-inset disabled:opacity-40 transition-colors"
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Footer: record count (when no pagination) */}
        {!loading && totalPages <= 1 && (
          <div className="pt-2.5 text-xs text-muted">共 {total} 条记录</div>
        )}
      </main>
    </div>
  )
}
