// apps/web/src/app/(dashboard)/bids/[id]/page.tsx
// 服务端组件：负责传递 bidId 给客户端工作台
import { BidWorkspace } from '../../../../components/bid/BidWorkspace'

interface Props {
  params: { id: string }
}

export default function BidWorkspacePage({ params }: Props) {
  return <BidWorkspace bidId={params.id} />
}
