'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Check,
  X,
  Upload,
  ExternalLink,
  Calendar,
  MapPin,
  Building2,
  TrendingUp,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  getTender,
  updateTender,
  deleteTender,
  decideTender,
  uploadTenderDocument,
  type Tender,
} from '@/lib/tenders-api'

// ─── 状态配置 ─────────────────────────────────────────────────────────────────

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
  if (budget >= 1_000_000) return `HK$ ${(budget / 1_000_000).toFixed(2)}M`
  if (budget >= 1_000) return `HK$ ${(budget / 1_000).toFixed(0)}K`
  return `HK$ ${budget}`
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

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
      title: form.title,
      clientName: form.clientName || undefined,
      location: form.location || undefined,
      budgetEstimate: form.budgetEstimate ? Number(form.budgetEstimate) : undefined,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
      sourceUrl: form.sourceUrl || undefined,
    })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>项目标题</Label>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>客户名称</Label>
          <Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>地点</Label>
          <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>预算（HK$）</Label>
          <Input type="number" value={form.budgetEstimate} onChange={(e) => setForm((f) => ({ ...f, budgetEstimate: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>截止日期</Label>
          <Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>来源链接</Label>
        <Input type="url" value={form.sourceUrl} onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
          保存
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [tender, setTender] = useState<Tender | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deciding, setDeciding] = useState<'BID' | 'DECLINE' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTender(id)
      setTender(res.data)
    } catch {
      setError('加载失败')
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
    if (!confirm('确认删除此招标项目？')) return
    await deleteTender(id)
    router.push('/tenders')
  }

  const handleDecide = async (decision: 'BID' | 'DECLINE') => {
    setDeciding(decision)
    try {
      await decideTender(id, decision)
      await load()
    } finally {
      setDeciding(null)
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
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="h-8 w-64 bg-inset rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-inset rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!tender) {
    return (
      <div className="container mx-auto py-6 max-w-4xl text-center text-muted">
        {error || '招标项目不存在'}
      </div>
    )
  }

  const statusInfo = STATUS_BADGE[tender.status] ?? { label: tender.status, className: '' }
  const canEdit = ['PENDING', 'DECIDED'].includes(tender.status)
  const canDelete = tender.status === 'PENDING'
  const canDecide = tender.status === 'PENDING'

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Button variant="ghost" size="sm" className="-ml-1 mt-0.5 text-muted" onClick={() => router.push('/tenders')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cn('text-xs', statusInfo.className)}>
              {statusInfo.label}
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-fg leading-snug">{tender.title}</h1>
        </div>
        <div className="flex gap-2 shrink-0">
          {canEdit && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              编辑
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 主内容 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 基本信息 */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-fg mb-4">基本信息</h2>
            {editing ? (
              <EditForm tender={tender} onSave={handleSave} onCancel={() => setEditing(false)} />
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <Building2 className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <div>
                    <div className="text-muted text-xs mb-0.5">客户名称</div>
                    <div className="text-fg">{tender.clientName || '—'}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <MapPin className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <div>
                    <div className="text-muted text-xs mb-0.5">地点</div>
                    <div className="text-fg">{tender.location || '—'}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <TrendingUp className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <div>
                    <div className="text-muted text-xs mb-0.5">预算估算</div>
                    <div className="text-fg">{formatBudget(tender.budgetEstimate)}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Calendar className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <div>
                    <div className="text-muted text-xs mb-0.5">截止日期</div>
                    <div className="text-fg">
                      {tender.deadline
                        ? new Date(tender.deadline).toLocaleDateString('zh-HK', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })
                        : '—'}
                    </div>
                  </div>
                </div>
                {tender.sourceUrl && (
                  <div className="flex gap-2">
                    <ExternalLink className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                    <div>
                      <div className="text-muted text-xs mb-0.5">来源链接</div>
                      <a
                        href={tender.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline truncate block max-w-xs"
                      >
                        {tender.sourceUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 文件上传区 */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-fg">招标文件</h2>
              <label className="cursor-pointer">
                <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.dwg" onChange={handleUpload} />
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 mr-1" />
                    )}
                    上传文件
                  </span>
                </Button>
              </label>
            </div>
            {tender.rawDocumentUrl ? (
              <a
                href={tender.rawDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                查看原始文件
              </a>
            ) : (
              <p className="text-sm text-muted">暂无文件，点击「上传文件」添加招标文件</p>
            )}
          </div>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-4">
          {/* AI 匹配评分（占位） */}
          {tender.matchScore !== undefined && tender.matchScore !== null ? (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-fg mb-3">AI 匹配评分</h2>
              <div className="text-3xl font-bold text-accent">
                {tender.matchScore.toFixed(0)}
                <span className="text-sm font-normal text-muted ml-1">/ 100</span>
              </div>
            </div>
          ) : (
            <div className="bg-inset border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-muted mb-1">AI 匹配评分</h2>
              <p className="text-xs text-muted">上传招标文件后，AI 将自动分析匹配度（阶段 5）</p>
            </div>
          )}

          {/* 决策操作 */}
          {canDecide && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-fg mb-3">投标决策</h2>
              <p className="text-xs text-muted mb-3">请选择是否参与此招标</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDecide('BID')}
                  disabled={deciding !== null}
                >
                  {deciding === 'BID' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  )}
                  决定投标
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-red-500 hover:text-red-600"
                  onClick={() => handleDecide('DECLINE')}
                  disabled={deciding !== null}
                >
                  {deciding === 'DECLINE' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5 mr-1" />
                  )}
                  放弃
                </Button>
              </div>
            </div>
          )}

          {/* 风险标签 */}
          {tender.riskLabels.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-fg mb-3">风险标签</h2>
              <div className="flex flex-wrap gap-1.5">
                {tender.riskLabels.map((label) => (
                  <span key={label} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 创建时间 */}
          <div className="text-xs text-muted px-1">
            创建于 {new Date(tender.createdAt).toLocaleDateString('zh-HK')}
          </div>
        </div>
      </div>
    </div>
  )
}
