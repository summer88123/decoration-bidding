'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

const materialSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  spec: z.string().optional(),
  unitCost: z.coerce.number().min(0, '单价不能为负'),
  supplier: z.string().optional(),
  category: z.string().optional(),
})
type MaterialForm = z.infer<typeof materialSchema>

type Material = {
  id: string
  name: string
  spec?: string
  unitCost: number
  supplier?: string
  category?: string
}

type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

export function MaterialsTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, mutate } = useSWR(
    `/api/org/materials?page=${page}&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    fetcher,
  )
  const materials: Material[] = data?.data ?? []
  const pagination: Pagination | undefined = data?.pagination

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MaterialForm>({
    resolver: zodResolver(materialSchema),
  })

  const onCreate = async (values: MaterialForm) => {
    try {
      await apiClient.post('/api/org/materials', values)
      await mutate()
      toast.success('物料已添加')
      reset()
      setOpen(false)
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle>物料库</CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="搜索名称/规格..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-48"
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            Excel 导入
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">新增物料</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增物料</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onCreate)} className="space-y-4 mt-2">
                <div>
                  <Label>名称</Label>
                  <Input {...register('name')} />
                  {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                </div>
                <div>
                  <Label>规格</Label>
                  <Input {...register('spec')} />
                </div>
                <div>
                  <Label>单价（港元）</Label>
                  <Input type="number" step="0.01" {...register('unitCost')} />
                  {errors.unitCost && <p className="text-sm text-red-500">{errors.unitCost.message}</p>}
                </div>
                <div>
                  <Label>分类</Label>
                  <Input {...register('category')} />
                </div>
                <div>
                  <Label>供应商</Label>
                  <Input {...register('supplier')} />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? '保存中...' : '保存'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4">名称</th>
                <th className="text-left py-2 pr-4">规格</th>
                <th className="text-left py-2 pr-4">分类</th>
                <th className="text-right py-2 pr-4">单价</th>
                <th className="text-left py-2 pr-4">供应商</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 pr-4 font-medium">{m.name}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{m.spec ?? '-'}</td>
                  <td className="py-2 pr-4">{m.category ?? '-'}</td>
                  <td className="py-2 pr-4 text-right">HK$ {m.unitCost}</td>
                  <td className="py-2 pr-4">{m.supplier ?? '-'}</td>
                  <td className="py-2">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id, m.name)}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
              {materials.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    暂无物料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </Button>
            <span className="text-sm self-center">
              {page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
