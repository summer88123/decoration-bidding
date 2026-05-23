'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

const inviteSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'BIDDER']),
})
type InviteForm = z.infer<typeof inviteSchema>

const fetcher = (url: string) => apiClient.get(url).then(r => r.data)

const ROLE_LABEL: Record<string, string> = {
  COMPANY_ADMIN: '超级管理员',
  MANAGER: '投标经理',
  BIDDER: '成员',
}

type Member = {
  id: string
  email: string
  role: string
  status: string
}

function inputCls() {
  return 'w-full px-3 py-[5px] border border-border rounded-[6px] text-sm bg-bg text-fg focus:outline-none focus:border-[#0969da] focus:ring-[3px] focus:ring-[rgba(9,105,218,0.2)]'
}

export function MembersTab() {
  const [showInvite, setShowInvite] = useState(false)
  const [search, setSearch] = useState('')
  const { data, mutate } = useSWR('/api/org/members?pageSize=50', fetcher)
  const allMembers: Member[] = data?.data ?? []
  const members = allMembers.filter(
    m => !search || m.email.includes(search)
  )
  const activeAdminCount = allMembers.filter(
    m => m.role === 'COMPANY_ADMIN' && m.status === 'active'
  ).length

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'BIDDER' },
  })

  const onInvite = async (values: InviteForm) => {
    try {
      await apiClient.post('/api/org/members/invite', values)
      await mutate()
      toast.success(`已发送邀请至 ${values.email}`)
      reset()
      setShowInvite(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      toast.error(msg ?? '邀请失败')
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await apiClient.put(`/api/org/members/${userId}`, { role })
      await mutate()
      toast.success('角色已更新')
    } catch {
      toast.error('更新失败')
    }
  }

  const handleRemove = async (userId: string, email: string) => {
    if (!confirm(`确认移除成员 ${email}？`)) return
    try {
      await apiClient.delete(`/api/org/members/${userId}`)
      await mutate()
      toast.success('成员已移除')
    } catch {
      toast.error('移除失败')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-fg mb-1">成员管理</h2>
        <p className="text-xs text-muted mb-4">管理团队成员及其权限角色。</p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1.5 px-4 py-[5px] bg-[#1f883d] hover:bg-[#1a7f37] text-white text-sm rounded-[6px] font-medium transition-colors"
          >
            + 邀请成员
          </button>
        </div>

        <div className="border border-border rounded-[6px]">
          <div className="px-4 py-3 bg-surface border-b border-border rounded-t-[6px] flex items-center justify-between">
            <span className="text-sm font-semibold text-fg">成员列表（{allMembers.length} 人）</span>
            <input
              type="text"
              placeholder="搜索成员…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs px-3 py-[3px] border border-border rounded-[6px] bg-bg focus:outline-none focus:border-[#0969da] w-44"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-surface border-b border-border">
                <tr>
                  {['电邮', '角色', '状态', '操作'].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-medium text-fg">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => {
                  const isLastAdmin = m.role === 'COMPANY_ADMIN' && m.status === 'active' && activeAdminCount <= 1
                  const isPending = m.status === 'pending'
                  return (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-muted">{m.email}</td>
                      <td className="px-4 py-2.5">
                        {m.role === 'COMPANY_ADMIN' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#ddf4ff] text-[#0969da] border border-[#b6d4f8]">
                            超级管理员
                          </span>
                        ) : (
                          <select
                            defaultValue={m.role}
                            onChange={e => handleRoleChange(m.id, e.target.value)}
                            className="text-xs px-1.5 py-[3px] border border-border rounded-[4px] bg-bg focus:outline-none focus:border-[#0969da]"
                          >
                            <option value="MANAGER">投标经理</option>
                            <option value="BIDDER">成员</option>
                            <option value="COMPANY_ADMIN">超级管理员</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {isPending ? (
                          <span className="text-muted">○ 邀请中</span>
                        ) : (
                          <span style={{ color: '#1a7f37' }}>● 活跃</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {isPending ? (
                          <button
                            onClick={() => handleRemove(m.id, m.email)}
                            className="text-xs px-2 py-[3px] border border-border rounded-[4px] hover:bg-inset transition-colors"
                          >
                            撤销邀请
                          </button>
                        ) : isLastAdmin ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <button
                            onClick={() => handleRemove(m.id, m.email)}
                            className="text-xs px-2 py-[3px] border border-border rounded-[4px] text-[#cf222e] hover:bg-[#ffebe9] hover:border-[#cf222e] transition-colors"
                          >
                            移除
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">暂无成员</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-bg border border-border rounded-[6px] w-[440px] max-w-[90vw]">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-sm text-fg">邀请新成员</span>
              <button onClick={() => setShowInvite(false)} className="text-muted hover:text-fg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onInvite)} className="px-4 py-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-fg block mb-1">邮箱</label>
                <input type="email" {...register('email')} className={inputCls()} />
                {errors.email && <p className="text-xs text-[#cf222e] mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-fg block mb-1">角色</label>
                <select {...register('role')} className={inputCls()}>
                  <option value="BIDDER">成员</option>
                  <option value="MANAGER">投标经理</option>
                  <option value="COMPANY_ADMIN">超级管理员</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-1 border-t border-border mt-1">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="px-3 py-[3px] text-xs border border-border rounded-[6px] bg-surface hover:bg-inset text-fg">
                  取消
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="inline-flex items-center gap-1 px-4 py-[3px] text-xs bg-[#1f883d] hover:bg-[#1a7f37] text-white rounded-[6px] font-medium transition-colors disabled:opacity-60">
                  {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                  发送邀请
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
