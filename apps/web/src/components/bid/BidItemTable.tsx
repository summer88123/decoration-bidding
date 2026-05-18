'use client'

// apps/web/src/components/bid/BidItemTable.tsx
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

export function BidItemTable({ items, selectedId, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        暂无物料清单数据
      </div>
    )
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50 sticky top-0">
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
                key={item.id}
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
