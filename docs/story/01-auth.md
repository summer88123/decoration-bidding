# 用户认证与登录

| 属性 | 值 |
|------|-----|
| 版本 | V1.0 |
| 日期 | 2026-05-19 |
| 模块 | Auth / User |

---

## 1. 功能范围

- 用户注册（首次创建公司账号）
- 用户登录 / 登出
- JWT 认证与刷新
- 密码重置
- 角色与权限

---

## 2. 用户角色

| 角色 | 标识 | 说明 |
|------|------|------|
| 超级管理员 | `SUPER_ADMIN` | 系统运营方，可管理所有公司 |
| 公司管理员 | `COMPANY_ADMIN` | 公司内最高权限，管理成员与设定 |
| 管理层 | `MANAGER` | 审核标书、筛选投标机会、决策 |
| 投标负责人 | `BIDDER` | 成本估算、标书填写、文件整合 |

权限矩阵：

| 操作 | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | BIDDER |
|------|:-----------:|:-------------:|:-------:|:------:|
| 查看商机列表 | ✅ | ✅ | ✅ | ✅ |
| 创建投标 | ✅ | ✅ | ✅ | ✅ |
| 审批投标 | ✅ | ✅ | ✅ | ❌ |
| 管理公司成员 | ✅ | ✅ | ❌ | ❌ |
| 管理公司设定 | ✅ | ✅ | ❌ | ❌ |
| 管理所有公司 | ✅ | ❌ | ❌ | ❌ |

---

## 3. 用户故事

### US-AUTH-01：首次注册创建公司

**作为** 新用户，**我希望** 注册账号同时创建公司，**以便** 开始使用系统。

**验收条件：**
- 输入公司名称、个人姓名、Email、密码完成注册
- 注册后自动成为该公司的 `COMPANY_ADMIN`
- 发送 Email 验证邮件，验证后账号激活
- 未验证账号不能登录

**API：** `POST /api/auth/register`

```json
// Request
{
  "companyName": "ABC 装修工程有限公司",
  "name": "张三",
  "email": "zhangsan@abc.com",
  "password": "••••••••"
}

// Response 201
{
  "userId": "uuid",
  "companyId": "uuid",
  "message": "注册成功，请查收验证邮件"
}
```

---

### US-AUTH-02：用户登录

**作为** 已注册用户，**我希望** 用 Email + 密码登录，**以便** 访问系统功能。

**验收条件：**
- 登录成功返回 `accessToken`（15 分钟）和 `refreshToken`（7 天）
- 密码错误 5 次后锁定账号 30 分钟
- 登录记录写入审计日志（IP、时间、设备）

**API：** `POST /api/auth/login`

```json
// Request
{
  "email": "zhangsan@abc.com",
  "password": "••••••••"
}

// Response 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "name": "张三",
    "email": "zhangsan@abc.com",
    "roles": ["COMPANY_ADMIN"],
    "companyId": "uuid",
    "companyName": "ABC 装修工程有限公司"
  }
}
```

---

### US-AUTH-03：刷新 Token

**作为** 已登录用户，**我希望** 在 accessToken 过期后自动刷新，**以便** 无缝使用系统。

**验收条件：**
- 客户端检测 401 后自动用 `refreshToken` 换取新 `accessToken`
- `refreshToken` 使用一次后轮换（Rotation）
- `refreshToken` 过期需重新登录

**API：** `POST /api/auth/refresh`

---

### US-AUTH-04：登出

**作为** 已登录用户，**我希望** 安全退出登录，**以便** 防止他人使用我的账号。

**验收条件：**
- 登出后服务端将 `refreshToken` 加入黑名单
- 前端清除本地 Token 存储

**API：** `POST /api/auth/logout`

---

### US-AUTH-05：密码重置

**作为** 忘记密码的用户，**我希望** 通过 Email 重置密码。

**验收条件：**
- 发送重置链接到注册 Email
- 重置链接有效期 1 小时，单次使用
- 重置成功后所有设备的 `refreshToken` 失效

**API：**
- `POST /api/auth/forgot-password` — 发送重置邮件
- `POST /api/auth/reset-password` — 用 token 重置密码

---

## 4. 数据模型

```prisma
model User {
  id           String   @id @default(uuid())
  companyId    String
  email        String   @unique
  passwordHash String
  name         String
  phone        String?
  status       UserStatus @default(PENDING_VERIFY)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company      Company   @relation(fields: [companyId], references: [id])
  userRoles    UserRole[]
  bids         Bid[]     @relation("AssignedBids")

  @@index([companyId])
  @@index([email])
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  permissions String[]
  userRoles   UserRole[]
}

model UserRole {
  userId String
  roleId String
  user   User @relation(fields: [userId], references: [id])
  role   Role @relation(fields: [roleId], references: [id])

  @@id([userId, roleId])
}

enum UserStatus {
  PENDING_VERIFY
  ACTIVE
  SUSPENDED
}
```

---

## 5. 安全要求

| 要求 | 实现方式 |
|------|----------|
| 密码存储 | bcrypt，cost factor ≥ 12 |
| Token 签名 | RS256 非对称签名 |
| HTTPS | 全站强制 TLS 1.2+ |
| 防暴力破解 | 登录失败 5 次锁定 30 分钟 |
| 审计日志 | 记录每次登录 IP、时间、结果 |

---

## 6. 前端页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 登录页 | `/login` | Email + 密码，登录按钮 |
| 注册页 | `/register` | 公司名、姓名、Email、密码 |
| 邮件验证 | `/verify-email` | 验证链接跳转落地页 |
| 忘记密码 | `/forgot-password` | 输入 Email 发送重置邮件 |
| 重置密码 | `/reset-password` | 新密码 + 确认密码 |
