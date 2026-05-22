// apps/web/src/app/(dashboard)/dashboard/page.tsx
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <h1 className="text-4xl font-bold text-gray-800">投标辅助系统</h1>
      <p className="mt-4 text-gray-500">AI 驱动的香港建筑及室内设计投标辅助平台</p>
      <div className="mt-10 flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/bids/test-bid"
          className="w-full text-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
        >
          打开标书工作台（演示）
        </Link>
        <p className="text-center text-xs text-gray-400">演示 Bid ID：test-bid</p>
      </div>
    </main>
  )
}
