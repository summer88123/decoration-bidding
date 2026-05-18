'use client'

// apps/web/src/components/bid/BidItemTable.tsx
import { useEffect, useRef } from 'react'
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
  selectedId?: string
  onSelect: (item: BidItemData) => void
}

function parseRegion(raw?: string): DrawingRegion | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as DrawingRegion
  } catch {
    return null
  }
}

const BOTTOM_THRESHOLD = 60 // px，距离底部多少以内算"在底部"

export function BidItemTable({ items, selectedId, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // 记录是否"贴近底部"，用 ref 避免触发额外 render
  const isAtBottomRef = useRef(true)

  // 监听滚动，判断用户是否手动上滚
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

  // 当 items 更新时，若在底部则自动滚到最新
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isAtBottomRef.current) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [items.length])

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
            <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">#</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">项目名称</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">数量</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">单位</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">说明</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600 border-b">页码</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const region = parseRegion(item.drawingRegion)
            const isSelected = item.id === selectedId
            return (
              <tr
                key={item.id ?? idx}
                className={`cursor-pointer border-b transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => onSelect(item)}
              >
                <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-gray-800">{item.itemName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="px-3 py-2 text-gray-600">{item.unit}</td>
                <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">
                  {item.description ?? '—'}
                </td>
                <td className="px-3 py-2 text-center text-gray-500">
                  {region ? `P${region.page}` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
