// apps/web/src/app/(dashboard)/bids/[id]/economic/page.tsx
import { EconomicWorkspace } from '../../../../../components/bid/EconomicWorkspace'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EconomicWorkspacePage({ params }: Props) {
  const { id } = await params
  return <EconomicWorkspace bidId={id} />
}
