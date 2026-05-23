'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

const inviteSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  name: z.string().min(1, '姓名不能为空'),
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'BIDDER']),
})
type InviteForm = z.infer<typeof inviteSchema>

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

const roleLabelMap: Record<string, string> = {
  COMPANY_ADMIN: '公司管理员',
  MANAGER: '经理',
  BIDDER: '投标员',
}

type Member = {
  id: string
  name: string
  email: string
  role: string
  status: string
}

export function MembersTab() {
  const [open, setOpen] = useState(false)
  const { data, mutate } = useSWR('/api/org/members?pageSize=50', fetcher)
  const members: Member[] = data?.data ?? []

  // 计算当前活跃的公司管理员数量，用于判断是否为最后一名管理员
  const activeAdminCount = members.filter(
    (m) => m.role === 'COMPANY_ADMIN' && m.status === 'active'
  ).length

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'BIDDER' },
  })

  const onInvite = async (values: InviteForm) => {
    try {
      await apiClient.post('/api/org/members/invite', values)
      await mutate()
      toast.success(`已发送邀请至 ${values.email}`)
      reset()
      setOpen(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      toast.error(msg ?? '邀请失败')
    }
  }

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`确认移除成员 ${name}？`)) return
    try {
      await apiClient.delete(`/api/org/members/${userId}`)
      await mutate()
      toast.success('成员已移除')
    } catch {
      toast.error('移除失败')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>成员管理</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">邀请成员</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>邀请新成员</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onInvite)} className="space-y-4 mt-2">
              <div>
                <Label>邮箱</Label>
                <Input type="email" {...register('email')} />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>
              <div>
                <Label>姓名</Label>
                <Input {...register('name')} />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>
              <div>
                <Label>角色</Label>
                <Select
                  defaultValue="BIDDER"
                  onValueChange={(v) => setValue('role', v as InviteForm['role'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BIDDER">投标员</SelectItem>
                    <SelectItem value="MANAGER">经理</SelectItem>
                    <SelectItem value="COMPANY_ADMIN">公司管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? '发送中...' : '发送邀请'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{roleLabelMap[m.role] ?? m.role}</Badge>
                <Badge variant={m.status === 'active' ? 'default' : 'outline'}>
                  {m.status === 'active' ? '活跃' : m.status === 'pending' ? '待激活' : m.status}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id, m.name)}
                  disabled={m.role === 'COMPANY_ADMIN' && m.status === 'active' && activeAdminCount <= 1}
                  title={m.role === 'COMPANY_ADMIN' && m.status === 'active' && activeAdminCount <= 1 ? '公司至少需要保留一名活跃管理员' : undefined}
                >
                  移除
                </Button>
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">暂无成员</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
