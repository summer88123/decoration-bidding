'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, Plus } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const materialSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  spec: z.string().optional(),
  unit: z.string().optional(),
  unitCost: z.coerce.number().min(0, '单价不能为负'),
  category: z.string().optional(),
  supplier: z.string().optional(),
})
type MaterialForm = z.infer<typeof materialSchema>

type Material = {
  id: string
  name: string
  spec?: string
  unit?: string
  unitCost: number
  category?: string
  supplier?: string
}
type Pagination = { page: number; pageSize: number; total: number; totalPages: number }

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

function inputCls() {
  return 'w-full'
}

// Category → badge color
const CAT_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  '地面材料': { bg: '#ddf4ff', color: '#0969da', border: '#b6d4f8' },
  '墙面材料': { bg: '#dafbe1', color: '#1a7f37', border: '#aceebb' },
  '门窗':    { bg: '#fff8c5', color: '#9a6700', border: '#e3b341' },
}
function catBadge(cat?: string) {
  const s = cat ? (CAT_STYLE[cat] ?? { bg: '#ddf4ff', color: '#0969da', border: '#b6d4f8' }) : { bg: '#f6f8fa', color: '#656d76', border: '#d0d7de' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {cat ?? '—'}
    </span>
  )
}

export function MaterialsTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, mutate } = useSWR(
    `/api/org/materials?page=${page}&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    fetcher,
  )
  const materials: Material[] = data?.data ?? []
  const pagination: Pagination | undefined = data?.pagination

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MaterialForm>({
    resolver: zodResolver(materialSchema),
    defaultValues: { unit: 'm²' },
  })

  const onCreate = async (values: MaterialForm) => {
    try {
      await apiClient.post('/api/org/materials', values)
      await mutate()
      toast.success('物料已添加')
      reset()
      setShowAdd(false)
    } catch {
      toast.error('添加失败')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认删除物料「${name}」？`)) return
    try {
      await apiClient.delete(`/api/org/materials/${id}`)
      await mutate()
      toast.success('物料已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await apiClient.post('/api/org/materials/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await mutate()
      const { imported, skipped } = res.data.data as { imported: number; skipped: number }
      toast.success(`导入完成：成功 ${imported} 条，跳过 ${skipped} 条`)
    } catch {
      toast.error('导入失败')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-fg mb-1">物料资料库</h2>
        <p className="text-xs text-muted mb-4">管理常用物料单价，用于经济标自动计算。</p>

        <div className="border border-border rounded-[6px]">
          <div className="px-4 py-3 bg-surface border-b border-border rounded-t-[6px] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-semibold text-fg">物料清单</span>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="text"
                placeholder="搜索名称/规格..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="text-xs w-44"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Excel 导入
              </Button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAdd(true)}
              >
                <Plus className="w-3 h-3" />
                添加物料
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-surface border-b border-border">
                <tr>
                  {['物料名称', '规格', '单位', '参考单价(HKD)', '类别', '操作'].map((h, i) => (
                    <th key={h} className={`px-4 py-2 font-medium text-muted ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-2.5 font-medium text-fg">{m.name}</td>
                    <td className="px-4 py-2.5 text-muted">{m.spec ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{m.unit ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(m.unitCost).toFixed(2)}</td>
                    <td className="px-4 py-2.5">{catBadge(m.category)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleDelete(m.id, m.name)}
                        className="text-xs px-2 py-[3px] border border-border rounded-[4px] text-danger hover:bg-danger-subtle hover:border-danger transition-colors"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {materials.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">暂无物料</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
              <span className="text-xs self-center text-muted">{page} / {pagination.totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
            </div>
          )}
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-bg border border-border rounded-[6px] w-[440px] max-w-[90vw]">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-sm text-fg">添加物料</span>
              <button onClick={() => setShowAdd(false)} className="text-muted hover:text-fg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onCreate)} className="px-4 py-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-fg block mb-1">物料名称 *</label>
                  <Input {...register('name')} className="w-full" />
                  {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-fg block mb-1">规格</label>
                  <Input {...register('spec')} className="w-full" placeholder="如 600×600mm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-fg block mb-1">单位</label>
                  <Input {...register('unit')} className="w-full" placeholder="m²" />
                </div>
                <div>
                  <label className="text-xs font-medium text-fg block mb-1">参考单价（HKD） *</label>
                  <Input type="number" step="0.01" {...register('unitCost')} className="w-full" />
                  {errors.unitCost && <p className="text-xs text-danger mt-1">{errors.unitCost.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-fg block mb-1">类别</label>
                  <Input {...register('category')} className="w-full" placeholder="如 地面材料" />
                </div>
                <div>
                  <label className="text-xs font-medium text-fg block mb-1">供应商</label>
                  <Input {...register('supplier')} className="w-full" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1 border-t border-border mt-1">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAdd(false)}>
                  取消
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                  保存
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
