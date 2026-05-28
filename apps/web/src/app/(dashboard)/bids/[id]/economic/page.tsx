// apps/web/src/app/(dashboard)/bids/[id]/economic/page.tsx
import { Suspense } from 'react'
import { EconomicWorkspace } from '../../../../../components/bid/EconomicWorkspace'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EconomicWorkspacePage({ params }: Props) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">加载中…</div>}>
      <EconomicWorkspace bidId={id} />
    </Suspense>
  )
}
