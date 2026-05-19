# 组织管理

| 属性 | 值 |
|------|-----|
| 版本 | V1.0 |
| 日期 | 2026-05-19 |
| 模块 | Company / Organization |

---

## 1. 功能范围

- 公司基础信息管理
- 公司能力档案（资质、地区、预算范围）
- 成员邀请与管理
- 成员角色分配

---

## 2. 用户故事

### US-ORG-01：查看/编辑公司信息

**作为** 公司管理员，**我希望** 管理公司的基础信息和能力档案，**以便** AI 可以准确进行投标匹配。

**验收条件：**
- 可编辑公司名称、营业执照号、联系电话、地址
- 可管理「能力标签」（如：室内设计、玻璃幕墙、机电工程）
- 可管理「资质证书」列表（证书名称、编号、有效期）
- 可设定「承接地区」（香港岛、九龙、新界等）
- 可设定「预算区间」（如 HKD 50万 ~ 500万）
- 以上信息变更后，AI 匹配评分在下次分析时自动更新

**API：**
- `GET /api/companies/:id` — 获取公司详情
- `PATCH /api/companies/:id` — 更新公司信息

```json
// PATCH Request Body
{
  "name": "ABC 装修工程有限公司",
  "registrationNo": "12345678",
  "phone": "+852 2xxx xxxx",
  "address": "九龙观塘工业区...",
  "capabilities": ["室内设计", "玻璃幕墙", "机电工程"],
  "licenses": [
    { "name": "室内设计师注册证", "no": "IDD-001", "expiresAt": "2027-12-31" }
  ],
  "regions": ["KOWLOON", "NEW_TERRITORIES"],
  "budgetRange": { "min": 500000, "max": 5000000, "currency": "HKD" }
}
```

---

### US-ORG-02：邀请成员

**作为** 公司管理员，**我希望** 邀请同事加入公司账号，**以便** 团队协作完成投标。

**验收条件：**
- 输入 Email 和角色（MANAGER / BIDDER）发送邀请邮件
- 邀请链接有效期 48 小时
- 被邀请人点击链接后设置密码完成注册，自动关联到该公司
- 如被邀请人已有账号（其他公司），拒绝邀请（每用户只属于一个公司）
- 可查看所有待接受的邀请并撤销

**API：**
- `POST /api/companies/:id/invitations` — 发送邀请
- `GET /api/companies/:id/invitations` — 查看邀请列表
- `DELETE /api/companies/:id/invitations/:inviteId` — 撤销邀请
- `POST /api/auth/accept-invitation` — 接受邀请

```json
// POST /api/companies/:id/invitations
{
  "email": "lisi@abc.com",
  "roleId": "BIDDER",
  "name": "李四"  // 可选，显示在邮件中
}
```

---

### US-ORG-03：管理成员列表

**作为** 公司管理员，**我希望** 查看和管理所有公司成员，**以便** 控制访问权限。

**验收条件：**
- 列表展示：姓名、Email、角色、状态（激活/已停用）、加入时间
- 可修改成员角色
- 可停用/启用成员账号（停用后无法登录，数据保留）
- 不能停用或删除最后一个 `COMPANY_ADMIN`

**API：**
- `GET /api/companies/:id/members` — 获取成员列表
- `PATCH /api/companies/:id/members/:userId` — 修改成员角色/状态
- `DELETE /api/companies/:id/members/:userId` — 移除成员

---

### US-ORG-04：物料资料库管理

**作为** 公司管理员或投标负责人，**我希望** 维护公司的物料价格库，**以便** 快速填写经济标报价。

**验收条件：**
- 支持新增、编辑、删除物料记录
- 字段：名称、规格、单位、参考单价、供应商、分类
- 支持 Excel 批量导入（提供模板下载）
- 物料可在经济标明细填写时快速检索选取

**API：**
- `GET /api/companies/:id/materials` — 列表（支持分类筛选、关键词搜索）
- `POST /api/companies/:id/materials` — 新增
- `PATCH /api/companies/:id/materials/:materialId` — 编辑
- `DELETE /api/companies/:id/materials/:materialId` — 删除
- `POST /api/companies/:id/materials/import` — 批量导入 Excel

---

## 3. 数据模型

```prisma
model Company {
  id             String   @id @default(uuid())
  name           String
  registrationNo String?
  phone          String?
  address        String?
  capabilities   String[]
  licenses       Json     @default("[]")
  regions        String[]
  budgetRange    Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  users          User[]
  tenderProjects TenderProject[]
  materials      Material[]
}

model Invitation {
  id        String           @id @default(uuid())
  companyId String
  email     String
  roleId    String
  token     String           @unique
  status    InvitationStatus @default(PENDING)
  expiresAt DateTime
  createdAt DateTime         @default(now())

  company   Company @relation(fields: [companyId], references: [id])

  @@index([token])
  @@index([companyId])
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  REVOKED
  EXPIRED
}

model Material {
  id        String   @id @default(uuid())
  companyId String
  name      String
  spec      String?
  unit      String
  unitCost  Decimal
  supplier  String?
  category  String?
  updatedAt DateTime @updatedAt

  company   Company @relation(fields: [companyId], references: [id])

  @@index([companyId])
}
```

---

## 4. 前端页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 公司设置 | `/settings/company` | 基本信息 + 能力档案编辑 |
| 成员管理 | `/settings/members` | 成员列表、邀请、角色管理 |
| 物料资料库 | `/settings/materials` | 物料列表、增删改、批量导入 |
