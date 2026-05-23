'use client'

import { useEffect, useState, KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import useSWR from 'swr'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

const schema = z.object({
  name: z.string().min(1, '公司名称不能为空'),
  licenseNo: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email('请输入有效邮箱').optional().or(z.literal('')),
  address: z.string().optional(),
  description: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const fetcher = (url: string) => apiClient.get(url).then(r => r.data.data)

function inputCls() {
  return 'w-full px-3 py-[5px] border border-border rounded-[6px] text-sm bg-bg text-fg focus:outline-none focus:border-[#0969da] focus:ring-[3px] focus:ring-[rgba(9,105,218,0.2)]'
}

export function CompanyTab() {
  const { data, mutate } = useSWR('/api/org/company', fetcher)
  const [qualifications, setQualifications] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (data) {
      reset({
        name: data.name ?? '',
        licenseNo: data.licenseNo ?? '',
        contactPhone: data.contactPhone ?? '',
        contactEmail: data.contactEmail ?? '',
        address: data.address ?? '',
        description: data.description ?? '',
      })
      setQualifications(data.qualifications ?? [])
    }
  }, [data, reset])

  const addTag = () => {
    const v = tagInput.trim()
    if (v && !qualifications.includes(v)) {
      setQualifications(prev => [...prev, v])
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => setQualifications(prev => prev.filter(q => q !== tag))

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag() }
  }

  const onSubmit = async (values: FormData) => {
    try {
      await apiClient.put('/api/org/company', { ...values, qualifications })
      await mutate()
      toast.success('公司信息已更新')
    } catch {
      toast.error('更新失败，请重试')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
      {/* 基础信息 */}
      <div>
        <h2 className="text-base font-semibold text-fg mb-1">公司基础信息</h2>
        <p className="text-xs text-muted mb-4">此信息将用于 AI 投标匹配，请保持准确。</p>
        <div className="border border-border rounded-[6px]">
          <div className="px-4 py-3 bg-surface border-b border-border rounded-t-[6px] text-sm font-semibold text-fg">基础信息</div>
          <div className="px-4 py-4 flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-fg block mb-1">公司名称 *</label>
                <input {...register('name')} className={inputCls()} />
                {errors.name && <p className="text-xs text-[#cf222e] mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-fg block mb-1">营业执照号</label>
                <input {...register('licenseNo')} className={`${inputCls()} font-mono`} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-fg block mb-1">联系电话</label>
                <input {...register('contactPhone')} className={inputCls()} />
              </div>
              <div>
                <label className="text-xs font-medium text-fg block mb-1">电子邮箱</label>
                <input type="email" {...register('contactEmail')} className={inputCls()} />
                {errors.contactEmail && <p className="text-xs text-[#cf222e] mt-1">{errors.contactEmail.message}</p>}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-fg block mb-1">公司地址</label>
              <input {...register('address')} className={inputCls()} />
            </div>
            <div>
              <label className="text-xs font-medium text-fg block mb-1">公司简介</label>
              <textarea
                {...register('description')}
                rows={3}
                className={`${inputCls()} resize-y`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 专业资质 */}
      <div>
        <h2 className="text-base font-semibold text-fg mb-1">专业资质</h2>
        <p className="text-xs text-muted mb-4">选择公司具备的专业资质，AI 将据此进行投标匹配。</p>
        <div className="border border-border rounded-[6px]">
          <div className="px-4 py-3">
            <div
              className="flex flex-wrap gap-1.5 items-center border border-border rounded-[6px] px-2 py-1.5 min-h-[38px] cursor-text bg-bg focus-within:border-[#0969da] focus-within:ring-[3px] focus-within:ring-[rgba(9,105,218,0.2)]"
              onClick={() => document.getElementById('qual-input')?.focus()}
            >
              {qualifications.map((q) => (
                <span key={q} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#ddf4ff] text-[#0969da] border border-[#b6d4f8]">
                  {q}
                  <button type="button" onClick={() => removeTag(q)} className="text-[#0969da] leading-none hover:text-[#0550ae]">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <input
                id="qual-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                onBlur={addTag}
                placeholder={qualifications.length === 0 ? '输入资质后回车添加' : ''}
                className="border-none outline-none text-sm flex-1 min-w-[120px] px-1 bg-transparent text-fg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-4 py-[5px] bg-[#1f883d] hover:bg-[#1a7f37] text-white text-sm rounded-[6px] border border-[rgba(31,35,40,0.15)] font-medium transition-colors disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          保存公司信息
        </button>
        <button
          type="button"
          onClick={() => { reset(); if (data) setQualifications(data.qualifications ?? []) }}
          className="px-4 py-[5px] border border-border rounded-[6px] text-sm bg-surface hover:bg-inset text-fg transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  )
}
