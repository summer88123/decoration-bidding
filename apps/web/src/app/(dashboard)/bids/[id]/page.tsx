// apps/web/src/app/(dashboard)/bids/[id]/page.tsx
// 服务端组件：负责传递 bidId 给客户端工作台
// Next.js 15+ 中 params 是 Promise，需要 async/await
import { BidWorkspace } from '../../../../components/bid/BidWorkspace'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BidWorkspacePage({ params }: Props) {
  const { id } = await params
  return <BidWorkspace bidId={id} />
}
