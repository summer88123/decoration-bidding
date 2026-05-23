'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createTender } from '@/lib/tenders-api'

const schema = z.object({
  title: z.string().min(1, '请输入标题'),
  clientName: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  budgetEstimate: z.coerce.number().positive('请输入正确的预算').optional().or(z.literal('')),
  deadline: z.string().optional(),
  sourceUrl: z.string().url('请输入有效的网址').optional().or(z.literal('')),
  category: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewTenderPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setError('')
    try {
      const res = await createTender({
        title: values.title,
        clientName: values.clientName || undefined,
        location: values.location || undefined,
        description: values.description || undefined,
        budgetEstimate: values.budgetEstimate ? Number(values.budgetEstimate) : undefined,
        deadline: values.deadline ? new Date(values.deadline).toISOString() : undefined,
        sourceUrl: values.sourceUrl || undefined,
        category: values.category || undefined,
      })
      router.push(`/tenders/${res.data.id}`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? '创建失败，请重试'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-1 text-muted"
        onClick={() => router.push('/tenders')}
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        返回
      </Button>

      <h1 className="text-2xl font-bold text-fg mb-6">新建招标项目</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* 基本信息 */}
        <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-fg">基本信息</h2>

          <div className="space-y-1.5">
            <Label htmlFor="title">
              项目标题 <span className="text-red-500">*</span>
            </Label>
            <Input id="title" placeholder="例：旺角商场室内装修工程" {...register('title')} />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="clientName">客户名称</Label>
              <Input id="clientName" placeholder="业主或招标方" {...register('clientName')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">地点</Label>
              <Input id="location" placeholder="例：香港九龙旺角" {...register('location')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">项目类别</Label>
            <Input id="category" placeholder="例：商业室内、住宅装修、酒店翻新" {...register('category')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">项目描述</Label>
            <Textarea
              id="description"
              placeholder="简要描述招标范围、工程要求等..."
              rows={3}
              {...register('description')}
            />
          </div>
        </div>

        {/* 商务信息 */}
        <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-fg">商务信息</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="budgetEstimate">预算估算（HK$）</Label>
              <Input
                id="budgetEstimate"
                type="number"
                placeholder="5000000"
                {...register('budgetEstimate')}
              />
              {errors.budgetEstimate && (
                <p className="text-xs text-red-500">{errors.budgetEstimate.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline">截止日期</Label>
              <Input id="deadline" type="date" {...register('deadline')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sourceUrl">招标来源链接</Label>
            <Input
              id="sourceUrl"
              type="url"
              placeholder="https://..."
              {...register('sourceUrl')}
            />
            {errors.sourceUrl && (
              <p className="text-xs text-red-500">{errors.sourceUrl.message}</p>
            )}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.push('/tenders')}>
            取消
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            创建招标
          </Button>
        </div>
      </form>
    </div>
  )
}
