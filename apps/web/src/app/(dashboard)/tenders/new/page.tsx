'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Paperclip, X } from 'lucide-react'
import Link from 'next/link'
import { createTender } from '@/lib/tenders-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  title: z.string().min(1, '请输入项目名称'),
  clientName: z.string().optional(),
  deadline: z.string().optional(),
  location: z.string().optional(),
  budgetEstimate: z.coerce.number().positive('请输入正确的预算').optional().or(z.literal('')),
  sourceUrl: z.string().url('请输入有效的网址').optional().or(z.literal('')),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewTenderPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.type === 'application/pdf') setFile(dropped)
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Page header with breadcrumb */}
      <div className="px-6 py-3 border-b border-border bg-bg flex items-center gap-2">
        <nav className="flex items-center gap-1.5 text-[13px] text-muted">
          <Link href="/dashboard" className="text-accent hover:underline">商机仪表板</Link>
          <span>/</span>
          <span>新建招标项目</span>
        </nav>
      </div>

      <main className="p-6">
        <div className="max-w-[800px]">
          {/* Title row with status preview */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-xl font-semibold text-fg mb-1">新建招标项目</h1>
              <p className="text-[13px] text-muted">录入招标信息，创建后状态默认为"待决策"</p>
            </div>
            <span className="inline-flex items-center gap-1.5 bg-warning-subtle text-warning border border-warning/60 rounded-full px-2.5 py-0.5 text-xs font-medium">
              ● 待决策
            </span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* 基本信息 */}
            <div className="border border-border rounded-[6px] overflow-hidden mb-4">
              <div className="bg-surface border-b border-border px-4 py-3 font-semibold text-sm text-fg">
                基本信息
              </div>
              <div className="p-4 flex flex-col gap-4">
                {/* 项目名称（全宽） */}
                <div className="flex flex-col gap-1">
                   <label className="text-[13px] font-medium text-fg">
                     项目名称 <span className="text-danger">*</span>
                   </label>
                  <Input
                    type="text"
                    placeholder="例：尖东某商业大厦 B2 层装修工程"
                    className="w-full"
                    {...register('title')}
                  />
                  {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
                </div>

                {/* 业主 + 截标日期 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-medium text-fg">业主 / 甲方名称</label>
                    <Input
                      type="text"
                      placeholder="例：XX 地产集团"
                      className="w-full"
                      {...register('clientName')}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-medium text-fg">截标日期</label>
                    <Input
                      type="date"
                      className="w-full"
                      {...register('deadline')}
                    />
                  </div>
                </div>

                {/* 地点 + 预算 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-medium text-fg">项目地点</label>
                    <Input
                      type="text"
                      placeholder="例：香港九龙尖沙咀"
                      className="w-full"
                      {...register('location')}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-medium text-fg">预算估算（港元）</label>
                    <Input
                      type="number"
                      placeholder="3000000"
                      className="w-full font-mono"
                      {...register('budgetEstimate')}
                    />
                    {errors.budgetEstimate && (
                      <p className="text-xs text-danger">{errors.budgetEstimate.message}</p>
                    )}
                  </div>
                </div>

                {/* 来源链接 */}
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-fg">招标来源网址</label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    className="w-full"
                    {...register('sourceUrl')}
                  />
                  {errors.sourceUrl && (
                    <p className="text-xs text-danger">{errors.sourceUrl.message}</p>
                  )}
                  <p className="text-xs text-muted">可选，用于追溯招标来源</p>
                </div>

                {/* 备注 */}
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-fg">备注</label>
                  <Textarea
                    placeholder="例：需提供 BIM 模型，报价需含 5 年维保…"
                    rows={3}
                    className="w-full"
                    {...register('description')}
                  />
                </div>
              </div>
            </div>

            {/* 招标文件上传 */}
            <div className="border border-border rounded-[6px] overflow-hidden mb-4">
              <div className="bg-surface border-b border-border px-4 py-3 font-semibold text-sm text-fg">
                招标文件（可选，创建后亦可上传）
              </div>
              <div className="p-4">
                {file ? (
                  <div className="flex items-center gap-3 border border-border rounded-[6px] px-3 py-2">
                    <Paperclip className="w-4 h-4 text-danger shrink-0" />
                    <span className="text-sm flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-muted hover:text-fg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="border border-dashed border-border rounded-[6px] px-6 py-6 text-center text-muted cursor-pointer bg-surface hover:border-accent hover:bg-accent/5 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <div className="text-2xl mb-2">📎</div>
                    <div className="text-[13px]">点击或拖拽上传招标文件</div>
                    <div className="text-xs mt-1">支持 PDF，单文件最大 50 MB</div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setFile(f)
                  }}
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-danger bg-danger-subtle border border-danger/40 rounded-[6px] px-3 py-2 mb-4">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                创建招标项目
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => router.push('/tenders')}
              >
                取消
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
