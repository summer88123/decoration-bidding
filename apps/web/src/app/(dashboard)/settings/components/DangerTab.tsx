'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function DangerTab() {
  const router = useRouter()
  const [dissolving, setDissolving] = useState(false)

  const handleDissolve = async () => {
    if (!confirm('确认解散组织？此操作不可撤销，所有数据将被永久删除。')) return
    setDissolving(true)
    try {
      await apiClient.delete('/api/org')
      toast.success('组织已解散')
      router.push('/login')
    } catch {
      toast.error('操作失败，请重试')
      setDissolving(false)
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-fg mb-1">危险操作</h2>
      <p className="text-xs text-muted mb-4">以下操作不可逆，请谨慎操作。</p>

      <div className="border border-danger rounded-[6px]">
        <div className="px-4 py-3 bg-danger-subtle border-b border-danger rounded-t-[6px] text-sm font-semibold text-danger">
          危险区域
        </div>
        <div className="divide-y divide-border">
          {/* Transfer */}
          <div className="px-4 py-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-fg mb-1">转让组织</div>
              <div className="text-xs text-muted">将组织所有权转让给其他成员，您将失去超级管理员权限。</div>
            </div>
            <Button
              variant="secondary"
              size="md"
              className="shrink-0 text-danger hover:border-danger"
              onClick={() => toast.info('转让功能即将上线')}
            >
              转让所有权
            </Button>
          </div>

          {/* Dissolve */}
          <div className="px-4 py-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-danger mb-1">解散组织</div>
              <div className="text-xs text-muted">永久删除此组织及所有关联数据，此操作无法撤销。</div>
            </div>
            <Button
              variant="danger"
              size="md"
              className="shrink-0"
              disabled={dissolving}
              onClick={handleDissolve}
            >
              {dissolving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              解散组织
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
