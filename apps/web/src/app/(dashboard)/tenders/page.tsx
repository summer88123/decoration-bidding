'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { listTenders, type Tender, type TenderStatus } from '@/lib/tenders-api'

// ─── 状态配置（匹配原型精确颜色）────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:   { label: '待决策',   bg: '#fff8c5', color: '#9a6700' },
  DECIDED:   { label: '决定投标', bg: '#ddf4ff', color: '#0969da' },
  BIDDING:   { label: '投标中',   bg: '#ddf4ff', color: '#0969da' },
  SUBMITTED: { label: '已提交',   bg: '#dafbe1', color: '#1a7f37' },
  WON:       { label: '已中标',   bg: '#1a7f37', color: '#fff' },
  LOST:      { label: '已落标',   bg: '#ffebe9', color: '#cf222e' },
  DECLINED:  { label: '已放弃',   bg: '#f6f8fa', color: '#656d76' },
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
  return 'HK$' + budget.toLocaleString()
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return dateStr.slice(0, 10)
}

function isUrgent(deadline?: string) {
  if (!deadline) return false
  return new Date(deadline).getTime() - Date.now() < 14 * 86400 * 1000
}

export default function TendersPage() {
  const router = useRouter()
  const [tenders, setTenders] = useState<Tender[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TenderStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'deadline-asc' | 'deadline-desc' | 'createdAt'>('deadline-asc')
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
        sortBy: sortBy === 'createdAt' ? 'createdAt' : 'deadline',
        sortOrder: sortBy === 'deadline-desc' ? 'desc' : 'asc',
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
        <button
          onClick={() => router.push('/tenders/new')}
          className="inline-flex items-center gap-1.5 px-4 py-[5px] bg-[#1f883d] hover:bg-[#1a7f37] text-white text-sm rounded-[6px] border border-[rgba(31,35,40,0.15)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新建招标项目
        </button>
      </header>

      <main className="p-6 flex-1">
        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <input
            type="search"
            placeholder="搜索项目名称、业主…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 min-w-[200px] max-w-xs px-3 py-[5px] border border-border rounded-[6px] text-sm bg-bg text-fg focus:outline-none focus:border-[#0969da] focus:ring-[3px] focus:ring-[rgba(9,105,218,0.3)]"
          />
          <div className="flex gap-0.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setActiveTab(tab.value); setPage(1) }}
                className={`px-3 py-[5px] rounded-[6px] text-xs border transition-colors ${
                  activeTab === tab.value
                    ? 'bg-[#0969da] text-white border-[#0969da]'
                    : 'bg-bg text-muted border-border hover:bg-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-[5px] text-xs border border-border rounded-[6px] bg-surface text-fg cursor-pointer"
          >
            <option value="deadline-asc">截标日期 ↑</option>
            <option value="deadline-desc">截标日期 ↓</option>
            <option value="createdAt">创建时间</option>
          </select>
        </div>

        {/* Table */}
        <div className="border border-border rounded-[6px] overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-4 py-2.5 text-left font-semibold text-fg">项目名称</th>
                <th className="px-4 py-2.5 text-left font-semibold text-fg">业主 / 甲方</th>
                <th className="px-4 py-2.5 text-left font-semibold text-fg">截标日期</th>
                <th className="px-4 py-2.5 text-right font-semibold text-fg">预算估算</th>
                <th className="px-4 py-2.5 text-left font-semibold text-fg">状态</th>
                <th className="px-4 py-2.5 text-left font-semibold text-fg">操作</th>
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
                    <button
                      onClick={() => router.push('/tenders/new')}
                      className="inline-flex items-center gap-1.5 px-4 py-[5px] bg-[#1f883d] hover:bg-[#1a7f37] text-white text-sm rounded-[6px] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      创建第一个招标项目
                    </button>
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
                          className="font-medium text-[#0969da] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.title}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{t.clientName ?? '—'}</td>
                      <td
                        className={`px-4 py-2.5 tabular-nums ${urgent ? 'text-[#cf222e] font-medium' : ''}`}
                      >
                        {formatDate(t.deadline)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatBudget(t.budgetEstimate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
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
                          ? 'bg-[#0969da] text-white border-[#0969da]'
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
      </main>
    </div>
  )
}
