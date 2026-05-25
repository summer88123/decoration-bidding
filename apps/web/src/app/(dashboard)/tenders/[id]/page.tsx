'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Edit2, Trash2, Upload, ExternalLink, Plus, Loader2 } from 'lucide-react'
import Link from 'next/link'
import {
  getTender,
  updateTender,
  deleteTender,
  decideTender,
  uploadTenderDocument,
  type Tender,
} from '@/lib/tenders-api'

// ─── 状态配置 ─────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  PENDING:   { label: '待决策',   className: 'bg-warning-subtle text-warning' },
  DECIDED:   { label: '决定投标', className: 'bg-info-subtle text-accent' },
  BIDDING:   { label: '投标中',   className: 'bg-info-subtle text-accent' },
  SUBMITTED: { label: '已提交',   className: 'bg-success-subtle text-success' },
  WON:       { label: '已中标',   className: 'bg-success text-white' },
  LOST:      { label: '已落标',   className: 'bg-danger-subtle text-danger' },
  DECLINED:  { label: '已放弃',   className: 'bg-surface text-muted' },
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ deadline }: { deadline?: string }) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (!deadline) { setText('—'); return }
    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setText('已截标'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000).toString().padStart(2, '0')
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')
      setText(`${d}天 ${h}:${m}:${s}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadline])

  const isExpired = deadline ? new Date(deadline).getTime() <= Date.now() : false

  return (
    <div className="border border-border rounded-[6px] mb-4">
      <div className="card-header px-4 py-3 border-b border-border bg-surface rounded-t-[6px]">
        <h3 className="text-sm font-semibold text-fg">截标倒计时</h3>
      </div>
      <div className="px-4 py-4 text-center">
        <div
          className={`text-[28px] font-bold tabular-nums font-mono ${isExpired ? 'text-muted' : 'text-danger'}`}
        >
          {text}
        </div>
        {deadline && (
          <div className="text-xs text-muted mt-1">
            {deadline.slice(0, 10)} 截止
          </div>
        )}
      </div>
    </div>
  )
}

// ─── InfoGrid ─────────────────────────────────────────────────────────────────

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted block mb-1">{label}</label>
      <div className="text-sm font-medium text-fg">{children}</div>
    </div>
  )
}

// ─── EditForm ─────────────────────────────────────────────────────────────────

function EditForm({
  tender,
  onSave,
  onCancel,
}: {
  tender: Tender
  onSave: (data: Partial<Tender>) => Promise<void>
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: tender.title,
    clientName: tender.clientName ?? '',
    location: tender.location ?? '',
    budgetEstimate: tender.budgetEstimate?.toString() ?? '',
    deadline: tender.deadline ? tender.deadline.slice(0, 10) : '',
    sourceUrl: tender.sourceUrl ?? '',
  })

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      ...form,
      budgetEstimate: form.budgetEstimate ? Number(form.budgetEstimate) : undefined,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
    } as Partial<Tender>)
    setSaving(false)
  }

  const field = (
    id: keyof typeof form,
    label: string,
    type = 'text',
    placeholder = '',
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-medium text-fg">{label}</label>
      <input
        type={type}
        value={form[id]}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
        className="w-full px-3 py-[5px] border border-border rounded-[6px] text-sm bg-bg text-fg focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20"
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {field('title', '项目名称')}
      <div className="grid grid-cols-2 gap-4">
        {field('clientName', '业主 / 甲方')}
        {field('location', '项目地点')}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {field('budgetEstimate', '预算估算（HK$）', 'number')}
        {field('deadline', '截标日期', 'date')}
      </div>
      {field('sourceUrl', '招标来源网址', 'url', 'https://...')}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-[3px] text-xs border border-border rounded-[6px] bg-surface hover:bg-inset text-fg transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1 px-3 py-[3px] text-xs bg-success hover:bg-success-hover text-white rounded-[6px] transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          保存
        </button>
      </div>
    </div>
  )
}

// ─── StatusFlow ───────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { status: 'PENDING', label: '待决策' },
  { status: 'BIDDING', label: '投标中' },
  { status: 'SUBMITTED', label: '已提交' },
  { status: 'result', label: '结果待定' },
]

function StatusFlow({
  status,
  onDecide,
  onDecline,
  deciding,
}: {
  status: string
  onDecide: () => void
  onDecline: () => void
  deciding: boolean
}) {
  const currentIdx = STATUS_STEPS.findIndex((s) => s.status === status)
  const canDecide = status === 'PENDING'
  const canDecline = ['PENDING', 'BIDDING'].includes(status)

  return (
    <div className="border border-border rounded-[6px]">
      <div className="px-4 py-3 border-b border-border bg-surface rounded-t-[6px]">
        <h3 className="text-sm font-semibold text-fg">状态流转</h3>
      </div>
      <div className="px-4 py-4">
        <div className="flex flex-col gap-2 mb-4">
          {STATUS_STEPS.map((step, i) => {
            const isActive = i === currentIdx
            const isDone = i < currentIdx
            return (
              <div key={step.status}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isActive ? 'bg-accent border-0' : isDone ? 'bg-success border-0' : 'bg-transparent border-2 border-border'
                    }`}
                  />
                  <span
                    className={`text-[13px] ${isActive ? 'font-medium text-fg' : 'text-muted'}`}
                  >
                    {step.label}
                  </span>
                  {isActive && (
                    <span className="text-[11px] text-muted">当前</span>
                  )}
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className="ml-[3px] w-0.5 h-4 bg-border" />
                )}
              </div>
            )
          })}
        </div>

        {canDecide && (
          <button
            onClick={onDecide}
            disabled={deciding}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-[5px] bg-success hover:bg-success-hover text-white text-sm rounded-[6px] border border-[rgba(31,35,40,0.15)] font-medium transition-colors disabled:opacity-60 mb-2"
          >
            {deciding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            决定投标
          </button>
        )}
        {canDecline && (
          <button
            onClick={onDecline}
            disabled={deciding}
            className="w-full inline-flex items-center justify-center px-4 py-[5px] text-sm border border-border rounded-[6px] bg-bg text-danger hover:bg-danger hover:text-white font-medium transition-colors disabled:opacity-60"
          >
            放弃此项目
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = 'docs' | 'bids' | 'history'

export default function TenderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [tender, setTender] = useState<Tender | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('docs')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTender(id)
      setTender(res.data)
    } catch {
      setTender(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<Tender>) => {
    await updateTender(id, data as Parameters<typeof updateTender>[1])
    await load()
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm('确认删除此招标项目？此操作不可撤销。')) return
    await deleteTender(id)
    router.push('/tenders')
  }

  const handleDecide = async () => {
    setDeciding(true)
    try {
      await decideTender(id, 'BID')
      await load()
    } finally {
      setDeciding(false)
    }
  }

  const handleDecline = async () => {
    if (!confirm('确认放弃此项目？此操作不可撤销。')) return
    setDeciding(true)
    try {
      await decideTender(id, 'DECLINE')
      await load()
    } finally {
      setDeciding(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadTenderDocument(id, file, 'TENDER_DOC')
      await load()
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-[1100px]">
        <div className="h-4 w-48 bg-inset rounded animate-pulse mb-4" />
        <div className="h-6 w-96 bg-inset rounded animate-pulse mb-6" />
        <div className="h-48 bg-inset rounded-[6px] animate-pulse" />
      </div>
    )
  }

  if (!tender) {
    return (
      <div className="p-6 text-center text-muted">招标项目不存在或已被删除</div>
    )
  }

  const statusInfo = STATUS_MAP[tender.status] ?? STATUS_MAP.PENDING
  const canEdit = ['PENDING', 'DECIDED'].includes(tender.status)
  const canDelete = tender.status === 'PENDING'

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between bg-bg sticky top-0 z-10">
        <nav className="flex items-center gap-1.5 text-[13px] text-muted">
          <Link href="/dashboard" className="text-muted hover:text-accent">商机仪表板</Link>
          <span>/</span>
          <span className="text-fg truncate max-w-xs">{tender.title}</span>
        </nav>
        <div className="flex gap-2">
          {canDelete && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1 px-3 py-[3px] text-xs border border-border rounded-[6px] bg-bg text-danger hover:bg-danger hover:text-white transition-colors"
            >
              放弃投标
            </button>
          )}
          <Link
            href={`/bids/new?tenderId=${tender.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-[5px] bg-success hover:bg-success-hover text-white text-sm rounded-[6px] border border-[rgba(31,35,40,0.15)] font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            创建投标
          </Link>
        </div>
      </header>

      <main className="p-6 max-w-[1100px]">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}
              >
                {statusInfo.label}
              </span>
              <span className="text-xs text-muted">
                创建于 {tender.createdAt?.slice(0, 10)}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-fg leading-snug">{tender.title}</h1>
            {(tender.clientName || tender.location) && (
              <div className="text-[13px] text-muted mt-1">
                {[tender.clientName, tender.location].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 px-3 py-[3px] text-xs border border-border rounded-[6px] bg-surface hover:bg-inset text-fg transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                编辑信息
              </button>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-[1fr_280px] gap-6 items-start">
          {/* Left main */}
          <div className="flex flex-col gap-4">
            {/* Info card / Edit form */}
            <div className="border border-border rounded-[6px]">
              <div className="px-4 py-3 border-b border-border bg-surface rounded-t-[6px] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-fg">基本信息</h2>
              </div>
              <div className="px-4 py-4">
                {editing ? (
                  <EditForm tender={tender} onSave={handleSave} onCancel={() => setEditing(false)} />
                ) : (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <InfoItem label="业主 / 甲方">{tender.clientName || '—'}</InfoItem>
                    <InfoItem label="项目地点">{tender.location || '—'}</InfoItem>
                    <InfoItem label="预算估算">
                      {tender.budgetEstimate ? `HK$ ${Number(tender.budgetEstimate).toLocaleString()}` : '—'}
                    </InfoItem>
                    <InfoItem label="截标日期">{tender.deadline?.slice(0, 10) || '—'}</InfoItem>
                    <InfoItem label="来源网址">
                      {tender.sourceUrl ? (
                        <a href={tender.sourceUrl} target="_blank" rel="noreferrer"
                          className="text-accent hover:underline inline-flex items-center gap-1">
                          查看原文 <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : '—'}
                    </InfoItem>
                    <InfoItem label="AI 评分">
                      <span className="text-muted text-xs">（评估中...）</span>
                    </InfoItem>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border border-border rounded-[6px]">
              {/* Tab nav */}
              <div className="flex border-b border-border bg-surface rounded-t-[6px] overflow-x-auto">
                {([
                  { id: 'docs',    label: '文件' },
                  { id: 'bids',    label: '投标方案' },
                  { id: 'history', label: '操作记录' },
                ] as { id: TabId; label: string }[]).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-accent text-accent font-semibold'
                        : 'border-transparent text-muted font-normal'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-4">
                {activeTab === 'docs' && (
                  <div>
                    {tender.rawDocumentUrl ? (
                      <div className="flex items-center justify-between p-3 border border-border rounded-[6px] mb-3">
                        <span className="text-sm text-fg truncate max-w-xs">
                          {tender.rawDocumentUrl.split('/').pop()}
                        </span>
                        <a
                          href={tender.rawDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                           className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                        >
                          下载 <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-muted mb-3">尚未上传任何文件。</p>
                    )}
                    <label className="inline-flex items-center gap-1.5 px-3 py-[5px] border border-border rounded-[6px] text-sm bg-surface hover:bg-inset text-fg cursor-pointer transition-colors">
                      {uploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      上传文件
                      <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                  </div>
                )}

                {activeTab === 'bids' && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted mb-3">暂无投标方案</p>
                    <Link
                      href={`/bids/new?tenderId=${tender.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-[5px] bg-success hover:bg-success-hover text-white text-sm rounded-[6px] font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      创建投标方案
                    </Link>
                  </div>
                )}

                {activeTab === 'history' && (
                  <ul className="flex flex-col gap-0">
                    <li className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-accent mt-1 shrink-0" />
                        <div className="w-0.5 flex-1 bg-border mt-1" />
                      </div>
                      <div className="pb-4">
                        <div className="text-sm font-medium text-fg">创建招标项目</div>
                        <div className="text-xs text-muted mt-0.5">
                          {tender.createdAt?.slice(0, 16).replace('T', ' ')}
                        </div>
                      </div>
                    </li>
                    {tender.rawDocumentUrl && (
                      <li className="flex gap-3">
                        <div className="flex flex-col items-center">
                           <div className="w-2 h-2 rounded-full bg-success mt-1 shrink-0" />
                        </div>
                        <div className="pb-4">
                          <div className="text-sm font-medium text-fg">上传招标文件</div>
                          <div className="text-xs text-muted mt-0.5">系统记录</div>
                        </div>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div>
            <Countdown deadline={tender.deadline ?? undefined} />
            <StatusFlow
              status={tender.status}
              onDecide={handleDecide}
              onDecline={handleDecline}
              deciding={deciding}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
