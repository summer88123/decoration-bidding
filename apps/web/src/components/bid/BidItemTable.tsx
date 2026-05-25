'use client'

// apps/web/src/components/bid/BidItemTable.tsx
import { useEffect, useRef, useState } from 'react'
import type { BidItemData } from '../../lib/api/bid.api'

interface DrawingRegion {
  page: number
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  items: BidItemData[]
  selectedIndex?: number | null
  onSelect: (item: BidItemData, index: number) => void
  // 行内编辑支持（可选）
  editable?: boolean
  onUpdate?: (itemId: string, data: Partial<BidItemData>) => void
  onDelete?: (itemId: string) => void
}

function parseRegion(raw?: string): DrawingRegion | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as DrawingRegion
  } catch {
    return null
  }
}

const BOTTOM_THRESHOLD = 60

export function BidItemTable({ items, selectedIndex, onSelect, editable, onUpdate, onDelete }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<BidItemData>>({})

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      isAtBottomRef.current = distFromBottom <= BOTTOM_THRESHOLD
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isAtBottomRef.current) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [items.length])

  function startEdit(item: BidItemData) {
    setEditingId(item.id)
    setEditValues({
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      costPrice: item.costPrice,
      sellPrice: item.sellPrice,
    })
  }

  function commitEdit(item: BidItemData) {
    if (onUpdate && editingId === item.id) {
      onUpdate(item.id, editValues)
    }
    setEditingId(null)
    setEditValues({})
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        暂无物料清单数据
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="overflow-auto h-full">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600 border-b w-8">#</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">项目名称</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600 border-b w-20">数量</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 border-b w-16">单位</th>
            {editable && (
              <>
                <th className="px-3 py-2 text-right font-medium text-gray-600 border-b w-24">成本价</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 border-b w-24">售价</th>
              </>
            )}
            <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">说明</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600 border-b w-14">页码</th>
            {editable && (
              <th className="px-3 py-2 text-center font-medium text-gray-600 border-b w-16">操作</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const region = parseRegion(item.drawingRegion)
            const isSelected = selectedIndex === idx
            const isEditing = editable && editingId === item.id

            return (
              <tr
                key={item.id ?? idx}
                className={`cursor-pointer border-b transition-colors ${
                  isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
                onClick={() => !isEditing && onSelect(item, idx)}
              >
                <td className="px-3 py-2 text-gray-400">{idx + 1}</td>

                {/* 项目名称 */}
                <td className="px-3 py-2 font-medium text-gray-800">
                  {isEditing ? (
                    <input
                      className="w-full border rounded px-1 py-0.5 text-sm"
                      value={editValues.itemName ?? ''}
                      onChange={(e) => setEditValues((v) => ({ ...v, itemName: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : item.itemName}
                </td>

                {/* 数量 */}
                <td className="px-3 py-2 text-right tabular-nums">
                  {isEditing ? (
                    <input
                      type="number"
                      className="w-16 border rounded px-1 py-0.5 text-sm text-right"
                      value={editValues.quantity ?? 0}
                      onChange={(e) => setEditValues((v) => ({ ...v, quantity: parseFloat(e.target.value) }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : item.quantity}
                </td>

                {/* 单位 */}
                <td className="px-3 py-2 text-gray-600">
                  {isEditing ? (
                    <input
                      className="w-14 border rounded px-1 py-0.5 text-sm"
                      value={editValues.unit ?? ''}
                      onChange={(e) => setEditValues((v) => ({ ...v, unit: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (item.unit ?? '—')}
                </td>

                {/* 成本价 / 售价（仅 editable 模式显示）*/}
                {editable && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-20 border rounded px-1 py-0.5 text-sm text-right"
                          value={editValues.costPrice ?? 0}
                          onChange={(e) => setEditValues((v) => ({ ...v, costPrice: parseFloat(e.target.value) }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : Number(item.costPrice).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-600">
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-20 border rounded px-1 py-0.5 text-sm text-right"
                          value={editValues.sellPrice ?? 0}
                          onChange={(e) => setEditValues((v) => ({
                            ...v,
                            sellPrice: parseFloat(e.target.value),
                            isManualPrice: true,
                          }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : Number(item.sellPrice).toFixed(2)}
                    </td>
                  </>
                )}

                <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">
                  {item.description ?? '—'}
                </td>
                <td className="px-3 py-2 text-center text-gray-500">
                  {region ? `P${region.page}` : (item.drawingPage ? `P${item.drawingPage}` : '—')}
                </td>

                {/* 操作列 */}
                {editable && (
                  <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <button
                        className="text-xs text-green-600 hover:underline"
                        onClick={() => commitEdit(item)}
                      >
                        保存
                      </button>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <button
                          className="text-xs text-blue-500 hover:underline"
                          onClick={() => startEdit(item)}
                        >
                          编辑
                        </button>
                        <button
                          className="text-xs text-red-400 hover:underline"
                          onClick={() => onDelete?.(item.id)}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
