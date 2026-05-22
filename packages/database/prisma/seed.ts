// packages/database/prisma/seed.ts
// 演示种子数据：创建 Company → TenderProject → Bid(id="test-bid")
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 0. 创建基础角色
  await prisma.role.upsert({ where: { name: 'COMPANY_ADMIN' }, update: {}, create: { name: 'COMPANY_ADMIN', permissions: ['*'] } })
  await prisma.role.upsert({ where: { name: 'MANAGER' }, update: {}, create: { name: 'MANAGER', permissions: ['bid:read', 'bid:write', 'tender:read'] } })
  await prisma.role.upsert({ where: { name: 'BIDDER' }, update: {}, create: { name: 'BIDDER', permissions: ['bid:read', 'bid:write'] } })
  await prisma.role.upsert({ where: { name: 'SUPER_ADMIN' }, update: {}, create: { name: 'SUPER_ADMIN', permissions: ['*'] } })
  console.log('✓ Roles created')

  // 1. 创建演示公司
  const company = await prisma.company.upsert({
    where: { id: 'demo-company' },
    update: {},
    create: {
      id: 'demo-company',
      name: '演示装修公司',
      capabilities: {},
    },
  })
  console.log('✓ Company:', company.id)

  // 2. 创建演示标书项目
  const tender = await prisma.tenderProject.upsert({
    where: { id: 'demo-tender' },
    update: {},
    create: {
      id: 'demo-tender',
      companyId: company.id,
      title: '演示标书项目',
      status: 'new',
    },
  })
  console.log('✓ TenderProject:', tender.id)

  // 3. 创建演示 Bid（固定 id = "test-bid"，供前端演示使用）
  const bid = await prisma.bid.upsert({
    where: { id: 'test-bid' },
    update: {},
    create: {
      id: 'test-bid',
      tenderId: tender.id,
      status: 'draft',
    },
  })
  console.log('✓ Bid:', bid.id)

  console.log('\n🎉 种子数据已就绪，可使用 /bids/test-bid 进行演示')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
