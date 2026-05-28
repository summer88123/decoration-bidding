'use client'
// apps/web/src/components/bid/CreateBidModal.tsx
import { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

interface Props {
  open: boolean
  onClose: () => void
  /** 确认创建，返回输入的名称 */
  onCreate: (name: string) => Promise<void>
}

export function CreateBidModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setError('')
      setLoading(false)
      // 下一帧 focus
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  async function handleConfirm() {
    if (!name.trim()) {
      setError('请输入投标名称')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onCreate(name.trim())
    } catch {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void handleConfirm()
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-md w-[440px] max-w-[90vw] border border-border shadow-lg">
        <div className="px-4 py-4 border-b border-border font-semibold text-fg">
          新建投标版本
        </div>
        <div className="px-4 py-5">
          <Label htmlFor="bid-name-input" className="text-sm font-semibold mb-1.5 block">
            投标名称 <span className="text-red-500">*</span>
          </Label>
          <Input
            ref={inputRef}
            id="bid-name-input"
            placeholder="例如：A 方案 — 标准配置"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full"
          />
          {error && (
            <p className="mt-1.5 text-xs text-red-500">{error}</p>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={loading}>
            {loading ? '创建中…' : '创建并进入工作台'}
          </Button>
        </div>
      </div>
    </div>
  )
}
