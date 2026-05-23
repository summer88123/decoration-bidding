'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { listTenders, type Tender } from '@/lib/tenders-api'

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

const FILTER_TABS = [
  { value: 'all', label: '全部' },
  { value: 'PENDING', label: '待决策' },
  { value: 'BIDDING', label: '投标中' },
  { value: 'SUBMITTED', label: '已提交' },
  { value: 'WON', label: '已中标' },
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

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueColor,
  delta,
  deltaUp,
}: {
  label: string
  value: string | number
  valueColor: string
  delta?: string
  deltaUp?: boolean
}) {
  return (
    <div className="bg-bg border border-border rounded-[6px] p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="text-2xl font-semibold tabular-nums" style={{ color: valueColor }}>
        {value}
      </div>
      {delta && (
        <div className={`text-xs mt-0.5 ${deltaUp ? 'text-[#1a7f37]' : 'text-muted'}`}>
          {delta}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [allTenders, setAllTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'deadline-asc' | 'deadline-desc' | 'createdAt'>('deadline-asc')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 加载全部数据用于统计（取最多 200 条）
      const res = await listTenders({ pageSize: 200, sortBy: 'deadline', sortOrder: 'asc' })
      setAllTenders(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 统计
  const stats = {
    pending: allTenders.filter((t) => t.status === 'PENDING').length,
    bidding: allTenders.filter((t) => t.status === 'BIDDING').length,
    submitted: allTenders.filter((t) => t.status === 'SUBMITTED').length,
    won: allTenders.filter((t) => t.status === 'WON').length,
    lost: allTenders.filter((t) => t.status === 'LOST').length,
  }
  const winRate = stats.won + stats.lost > 0
    ? Math.round(stats.won / (stats.won + stats.lost) * 100)
    : 0

  // 筛选
  let filtered = allTenders
  if (activeFilter !== 'all') filtered = filtered.filter((t) => t.status === activeFilter)
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.clientName?.toLowerCase().includes(q) ?? false),
    )
  }

  // 排序
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'deadline-asc') return (a.deadline ?? '9999') < (b.deadline ?? '9999') ? -1 : 1
    if (sortBy === 'deadline-desc') return (a.deadline ?? '') > (b.deadline ?? '') ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between bg-bg sticky top-0 z-10">
        <div>
          <div className="text-xl font-semibold text-fg">商机仪表板</div>
          <div className="text-xs text-muted mt-0.5">追踪所有招标机会与投标进展</div>
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
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="待决策" value={stats.pending} valueColor="#9a6700" delta="招标项目" />
          <StatCard label="投标中" value={stats.bidding} valueColor="#0969da" delta={`↑ 共 ${stats.bidding} 个`} deltaUp />
          <StatCard label="已提交" value={stats.submitted} valueColor="#8250df" delta="本季度" />
          <StatCard label="中标率" value={`${winRate}%`} valueColor="#1a7f37" delta={stats.won + stats.lost > 0 ? `${stats.won} 中 / ${stats.won + stats.lost} 投` : '暂无记录'} deltaUp={winRate > 0} />
        </div>

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
                onClick={() => { setActiveFilter(tab.value); setPage(1) }}
                className={`px-3 py-[5px] rounded-[6px] text-xs border transition-colors ${
                  activeFilter === tab.value
                    ? 'bg-[#0969da] text-white border-[#0969da]'
                    : 'bg-bg text-muted border-border hover:bg-surface'
                }`}
              >
                {tab.label}
                {tab.value === 'PENDING' && stats.pending > 0 && (
                  <span className="ml-1 bg-[#fff8c5] text-[#9a6700] px-1 rounded-full text-[11px]">
                    {stats.pending}
                  </span>
                )}
                {tab.value === 'BIDDING' && stats.bidding > 0 && (
                  <span className="ml-1 bg-[#ddf4ff] text-[#0969da] px-1 rounded-full text-[11px]">
                    {stats.bidding}
                  </span>
                )}
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
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted text-sm">
                    暂无招标项目
                  </td>
                </tr>
              ) : (
                pageItems.map((t) => {
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
          <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-surface">
            <span className="text-xs text-muted">
              共 {filtered.length} 条记录
              {totalPages > 1 && `，第 ${page} / ${totalPages} 页`}
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
        </div>
      </main>
    </div>
  )
}
