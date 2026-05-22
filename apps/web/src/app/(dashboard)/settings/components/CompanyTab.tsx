'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

const schema = z.object({
  name: z.string().min(1, '公司名称不能为空'),
  address: z.string().optional(),
  contactEmail: z.string().email('请输入有效邮箱').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const fetcher = (url: string) => apiClient.get(url).then(r => r.data.data)

export function CompanyTab() {
  const { data, mutate } = useSWR('/api/org/company', fetcher)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (data) {
      reset({
        name: data.name ?? '',
        address: data.address ?? '',
        contactEmail: data.contactEmail ?? '',
        contactPhone: data.contactPhone ?? '',
      })
    }
  }, [data, reset])

  const onSubmit = async (values: FormData) => {
    try {
      await apiClient.put('/api/org/company', values)
      await mutate()
      toast.success('公司资料已更新')
    } catch {
      toast.error('更新失败，请重试')
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>公司资料</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
          <div>
            <Label htmlFor="name">公司名称</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="address">地址</Label>
            <Input id="address" {...register('address')} />
          </div>
          <div>
            <Label htmlFor="contactEmail">联系邮箱</Label>
            <Input id="contactEmail" type="email" {...register('contactEmail')} />
            {errors.contactEmail && <p className="text-sm text-red-500 mt-1">{errors.contactEmail.message}</p>}
          </div>
          <div>
            <Label htmlFor="contactPhone">联系电话</Label>
            <Input id="contactPhone" {...register('contactPhone')} />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
