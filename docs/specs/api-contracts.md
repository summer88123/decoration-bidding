# API 接口规范文档

> 香港建筑及室内设计行业投标辅助系统  
> 核心服务：`apps/core-service`（Fastify，port 8080）  
> 文档版本：v1.0  
> 最后更新：2026-05-22

---

## 通用规范

### Base URL

```
开发环境：http://localhost:8080
生产环境：https://api.decoration-bidding.com
```

### 认证方式

所有需要认证的接口须在请求头中携带 JWT Access Token：

```
Authorization: Bearer <accessToken>
```

### 统一响应格式

```ts
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
```

### 错误码规范

| code | 说明 |
|------|------|
| `AUTH_REQUIRED` | 未携带或无效的 Token |
| `FORBIDDEN` | 权限不足 |
| `NOT_FOUND` | 资源不存在 |
| `VALIDATION_ERROR` | 请求参数校验失败 |
| `DUPLICATE` | 资源已存在（如邮箱重复） |
| `EXPIRED_TOKEN` | Token 已过期 |
| `INVALID_TOKEN` | Token 无效 |
| `INTERNAL_ERROR` | 服务器内部错误 |

### 权限角色说明

| 角色 | 说明 |
|------|------|
| `SUPER_ADMIN` | 超级管理员，平台级权限 |
| `COMPANY_ADMIN` | 公司管理员，管理本公司全部资源 |
| `MANAGER` | 经理，可审批投标 |
| `BIDDER` | 投标员，创建和编辑投标 |

### 枚举值

```
TenderStatus: PENDING | DECIDED | BIDDING | SUBMITTED | WON | LOST | DECLINED
BidStatus:    DRAFT | IN_REVIEW | APPROVED | SUBMITTED | WON | LOST
UserRole:     SUPER_ADMIN | COMPANY_ADMIN | MANAGER | BIDDER
```

---

## Auth 模块（`/api/auth`）

### 1. POST /api/auth/register — 注册

创建新公司及管理员账号。

**权限：** 无需认证

**请求体：**
```json
{
  "companyName": "香港装饰工程有限公司",
  "email": "admin@example.com",
  "password": "P@ssw0rd123",
  "name": "张三",
  "phone": "+85291234567"
}
```

**响应示例（201）：**
```json
{
  "success": true,
  "data": {
    "user": { "id": "usr_01", "email": "admin@example.com", "name": "张三", "role": "COMPANY_ADMIN" },
    "company": { "id": "cmp_01", "name": "香港装饰工程有限公司" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

---

### 2. POST /api/auth/login — 登录

**权限：** 无需认证

**请求体：**
```json
{
  "email": "admin@example.com",
  "password": "P@ssw0rd123"
}
```

**响应示例（200）：**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "usr_01", "email": "admin@example.com", "name": "张三", "role": "COMPANY_ADMIN" }
  }
}
```

---

### 3. POST /api/auth/refresh — 刷新 Token

**权限：** 无需认证（携带 refreshToken）

**请求体：**
```json
{ "refreshToken": "eyJ..." }
```

**响应示例（200）：**
```json
{
  "success": true,
  "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
}
```

---

### 4. POST /api/auth/logout — 登出

**权限：** 需要认证

**请求体：**
```json
{ "refreshToken": "eyJ..." }
```

**响应示例（200）：**
```json
{ "success": true }
```

---

### 5. POST /api/auth/forgot-password — 申请重置密码邮件

**权限：** 无需认证

**请求体：**
```json
{ "email": "admin@example.com" }
```

**响应示例（200）：**
```json
{ "success": true, "data": { "message": "重置密码邮件已发送" } }
```

---

### 6. POST /api/auth/reset-password — 重置密码

**权限：** 无需认证（携带邮件中的 token）

**请求体：**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewP@ss456"
}
```

**响应示例（200）：**
```json
{ "success": true, "data": { "message": "密码重置成功" } }
```

---

## User 模块（`/api/users`）

### 7. GET /api/users/me — 获取当前用户信息

**权限：** 需要认证

**响应示例（200）：**
```json
{
  "success": true,
  "data": {
    "id": "usr_01",
    "email": "admin@example.com",
    "name": "张三",
    "phone": "+85291234567",
    "role": "COMPANY_ADMIN",
    "companyId": "cmp_01",
    "createdAt": "2026-01-01T00:00:00Z"
  }
}
```

---

## Organization 模块（`/api/org`）

### 8. GET /api/org/company — 获取公司信息

**权限：** 需要认证（任意角色）

**响应示例（200）：**
```json
{
  "success": true,
  "data": {
    "id": "cmp_01",
    "name": "香港装饰工程有限公司",
    "address": "香港九龙旺角...",
    "capabilities": ["室内设计", "机电工程"],
    "qualifications": ["ISO9001", "建筑牌照"],
    "contactEmail": "info@example.com",
    "contactPhone": "+85221234567"
  }
}
```

---

### 9. PUT /api/org/company — 更新公司信息

**权限：** `COMPANY_ADMIN`

**请求体：**
```json
{
  "name": "香港装饰工程有限公司（更新）",
  "address": "香港九龙旺角弥敦道100号",
  "capabilities": ["室内设计", "机电工程", "幕墙"],
  "qualifications": ["ISO9001"],
  "contactEmail": "info@example.com",
  "contactPhone": "+85221234567"
}
```

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "cmp_01", "name": "香港装饰工程有限公司（更新）" } }
```

---

### 10. GET /api/org/members — 成员列表

**权限：** `COMPANY_ADMIN` / `MANAGER`

**Query 参数：**
```
page=1&pageSize=20&status=ACTIVE
```

**响应示例（200）：**
```json
{
  "success": true,
  "data": [
    { "id": "usr_01", "name": "张三", "email": "admin@example.com", "role": "COMPANY_ADMIN", "status": "ACTIVE" }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 5, "totalPages": 1 }
}
```

---

### 11. POST /api/org/members/invite — 邀请成员

**权限：** `COMPANY_ADMIN`

**请求体：**
```json
{
  "email": "bidder@example.com",
  "name": "李四",
  "role": "BIDDER"
}
```

**响应示例（201）：**
```json
{ "success": true, "data": { "id": "usr_02", "email": "bidder@example.com", "status": "PENDING" } }
```

---

### 12. PUT /api/org/members/:userId — 修改成员角色/状态

**权限：** `COMPANY_ADMIN`

**请求体：**
```json
{ "role": "MANAGER", "status": "ACTIVE" }
```

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "usr_02", "role": "MANAGER", "status": "ACTIVE" } }
```

---

### 13. DELETE /api/org/members/:userId — 移除成员

**权限：** `COMPANY_ADMIN`

**响应示例（200）：**
```json
{ "success": true }
```

---

### 14. GET /api/org/materials — 物料库列表

**权限：** 需要认证

**Query 参数：**
```
page=1&pageSize=20&search=石材&category=地板
```

**响应示例（200）：**
```json
{
  "success": true,
  "data": [
    { "id": "mat_01", "name": "意大利大理石", "category": "地板", "unit": "m²", "unitPrice": 580, "supplier": "XX石材" }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 }
}
```

---

### 15. POST /api/org/materials — 新增物料

**权限：** `COMPANY_ADMIN` / `MANAGER`

**请求体：**
```json
{ "name": "意大利大理石", "category": "地板", "unit": "m²", "unitPrice": 580, "supplier": "XX石材", "remarks": "进口" }
```

**响应示例（201）：**
```json
{ "success": true, "data": { "id": "mat_01", "name": "意大利大理石" } }
```

---

### 16. PUT /api/org/materials/:id — 更新物料

**权限：** `COMPANY_ADMIN` / `MANAGER`

**请求体：**
```json
{ "unitPrice": 620, "remarks": "2026年报价" }
```

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "mat_01", "unitPrice": 620 } }
```

---

### 17. DELETE /api/org/materials/:id — 删除物料

**权限：** `COMPANY_ADMIN` / `MANAGER`

**响应示例（200）：**
```json
{ "success": true }
```

---

### 18. POST /api/org/materials/import — Excel 批量导入

**权限：** `COMPANY_ADMIN` / `MANAGER`

**请求类型：** `multipart/form-data`

**表单字段：**
```
file: <Excel 文件，.xlsx>
```

**响应示例（200）：**
```json
{ "success": true, "data": { "imported": 50, "skipped": 2, "errors": [] } }
```

---

## Tender 模块（`/api/tenders`）

### 19. GET /api/tenders — 招标列表

**权限：** 需要认证

**Query 参数：**
```
page=1&pageSize=20&status=PENDING&search=商场&sortBy=createdAt&order=desc
```

**响应示例（200）：**
```json
{
  "success": true,
  "data": [
    {
      "id": "tdr_01",
      "title": "旺角商场室内装修工程",
      "status": "PENDING",
      "budget": 5000000,
      "deadline": "2026-06-30T00:00:00Z",
      "createdAt": "2026-01-10T00:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 30, "totalPages": 2 }
}
```

---

### 20. POST /api/tenders — 创建招标项目

**权限：** `COMPANY_ADMIN` / `MANAGER` / `BIDDER`

**请求体：**
```json
{
  "title": "旺角商场室内装修工程",
  "description": "商场公区改造，包含地板、天花、灯光...",
  "budget": 5000000,
  "deadline": "2026-06-30T00:00:00Z",
  "location": "香港九龙旺角",
  "category": "商业室内",
  "sourceUrl": "https://hkgov.example/tender/123"
}
```

**响应示例（201）：**
```json
{
  "success": true,
  "data": { "id": "tdr_01", "title": "旺角商场室内装修工程", "status": "PENDING" }
}
```

---

### 21. GET /api/tenders/:id — 招标详情

**权限：** 需要认证

**响应示例（200）：**
```json
{
  "success": true,
  "data": {
    "id": "tdr_01",
    "title": "旺角商场室内装修工程",
    "description": "商场公区改造...",
    "status": "BIDDING",
    "budget": 5000000,
    "deadline": "2026-06-30T00:00:00Z",
    "location": "香港九龙旺角",
    "category": "商业室内",
    "sourceUrl": "https://hkgov.example/tender/123",
    "documents": [],
    "createdAt": "2026-01-10T00:00:00Z",
    "updatedAt": "2026-01-15T00:00:00Z"
  }
}
```

---

### 22. PUT /api/tenders/:id — 编辑招标

**权限：** `COMPANY_ADMIN` / `MANAGER` / `BIDDER`（仅 PENDING/DECIDED 状态）

**请求体：**
```json
{
  "title": "旺角商场室内装修工程（修订版）",
  "budget": 5500000,
  "deadline": "2026-07-15T00:00:00Z"
}
```

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "tdr_01", "title": "旺角商场室内装修工程（修订版）" } }
```

---

### 23. DELETE /api/tenders/:id — 删除招标

**权限：** `COMPANY_ADMIN`（仅 PENDING 状态）

**响应示例（200）：**
```json
{ "success": true }
```

---

### 24. POST /api/tenders/:id/decide — 投标/放弃决策

**权限：** `COMPANY_ADMIN` / `MANAGER`

**请求体：**
```json
{
  "decision": "BID",
  "reason": "符合公司资质，利润率预估合理"
}
```
> `decision` 枚举：`BID`（决定投标）| `DECLINE`（放弃）

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "tdr_01", "status": "BIDDING" } }
```

---

### 25. POST /api/tenders/:id/documents — 上传招标文件

**权限：** 需要认证

**请求类型：** `multipart/form-data`

**表单字段：**
```
file: <文件>
type: TENDER_DOC | DRAWING | BOQ | OTHER
```

**响应示例（201）：**
```json
{
  "success": true,
  "data": { "id": "doc_01", "name": "招标文件.pdf", "url": "https://storage.example/doc_01.pdf", "type": "TENDER_DOC" }
}
```

---

### 26. GET /api/tenders/:id/documents — 获取招标文件列表

**权限：** 需要认证

**响应示例（200）：**
```json
{
  "success": true,
  "data": [
    { "id": "doc_01", "name": "招标文件.pdf", "url": "https://storage.example/doc_01.pdf", "type": "TENDER_DOC", "size": 2048000 }
  ]
}
```

---

### 27. DELETE /api/tenders/:id/documents/:docId — 删除招标文件

**权限：** `COMPANY_ADMIN` / `MANAGER`

**响应示例（200）：**
```json
{ "success": true }
```

---

## Bid 模块（`/api/bids`）

### 28. POST /api/bids — 创建投标

**权限：** `COMPANY_ADMIN` / `MANAGER` / `BIDDER`

**请求体：**
```json
{ "tenderId": "tdr_01", "assigneeId": "usr_02" }
```

**响应示例（201）：**
```json
{
  "success": true,
  "data": { "id": "bid_01", "tenderId": "tdr_01", "status": "DRAFT", "createdAt": "2026-01-15T00:00:00Z" }
}
```

---

### 29. GET /api/bids/:id — 投标详情

**权限：** 需要认证

**响应示例（200）：**
```json
{
  "success": true,
  "data": {
    "id": "bid_01",
    "tenderId": "tdr_01",
    "status": "DRAFT",
    "commercial": { "companyProfile": "...", "experience": "..." },
    "technical": { "methodology": "...", "schedule": "..." },
    "totalAmount": 4800000,
    "profitMargin": 0.12,
    "assignee": { "id": "usr_02", "name": "李四" },
    "createdAt": "2026-01-15T00:00:00Z"
  }
}
```

---

### 30. GET /api/bids/tender/:tenderId — 某招标的所有投标

**权限：** 需要认证

**响应示例（200）：**
```json
{
  "success": true,
  "data": [
    { "id": "bid_01", "status": "DRAFT", "totalAmount": 4800000, "assignee": { "id": "usr_02", "name": "李四" } }
  ]
}
```

---

### 31. PUT /api/bids/:id/commercial — 保存商务标

**权限：** `BIDDER` / `MANAGER`（DRAFT 状态）

**请求体：**
```json
{
  "companyProfile": "公司成立于2005年，专注香港高端室内设计...",
  "experience": "完成超过200个商业项目...",
  "teamMembers": [{ "name": "王工", "title": "项目总监", "years": 15 }],
  "certifications": ["ISO9001", "建筑牌照"],
  "pastProjects": [{ "name": "中环某商场", "value": 8000000, "year": 2024 }]
}
```

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "bid_01", "commercial": { "companyProfile": "公司成立于2005年..." } } }
```

---

### 32. PUT /api/bids/:id/technical — 保存技术标

**权限：** `BIDDER` / `MANAGER`（DRAFT 状态）

**请求体：**
```json
{
  "methodology": "采用BIM技术进行施工模拟...",
  "schedule": "预计工期120天，分三阶段完成...",
  "qualityPlan": "严格执行ISO9001质量管理体系...",
  "safetyPlan": "设专职安全主任，每周安全巡检...",
  "environmentPlan": "使用低VOC涂料，减少施工噪音..."
}
```

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "bid_01", "technical": { "methodology": "采用BIM技术..." } } }
```

---

### 33. GET /api/bids/:id/items — 经济标清单列表

**权限：** 需要认证

**响应示例（200）：**
```json
{
  "success": true,
  "data": [
    {
      "id": "item_01",
      "bidId": "bid_01",
      "description": "意大利大理石地板铺装",
      "unit": "m²",
      "quantity": 500,
      "unitPrice": 580,
      "amount": 290000,
      "category": "地板工程",
      "sortOrder": 1
    }
  ]
}
```

---

### 34. POST /api/bids/:id/items — 新增清单行

**权限：** `BIDDER` / `MANAGER`

**请求体：**
```json
{
  "description": "意大利大理石地板铺装",
  "unit": "m²",
  "quantity": 500,
  "unitPrice": 580,
  "category": "地板工程",
  "sortOrder": 1
}
```

**响应示例（201）：**
```json
{
  "success": true,
  "data": { "id": "item_01", "description": "意大利大理石地板铺装", "amount": 290000 }
}
```

---

### 35. PUT /api/bids/:id/items/:itemId — 更新清单行

**权限：** `BIDDER` / `MANAGER`

**请求体：**
```json
{ "quantity": 550, "unitPrice": 600 }
```

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "item_01", "quantity": 550, "unitPrice": 600, "amount": 330000 } }
```

---

### 36. DELETE /api/bids/:id/items/:itemId — 删除清单行

**权限：** `BIDDER` / `MANAGER`

**响应示例（200）：**
```json
{ "success": true }
```

---

### 37. PUT /api/bids/:id/profit-margin — 设置利润率

**权限：** `MANAGER` / `COMPANY_ADMIN`

**请求体：**
```json
{ "profitMargin": 0.15 }
```
> `profitMargin` 为小数，0.15 代表 15%

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "bid_01", "profitMargin": 0.15, "totalAmount": 5520000 } }
```

---

### 38. POST /api/bids/:id/submit-review — 提交审查

**权限：** `BIDDER`（DRAFT 状态）

**请求体：**
```json
{ "remarks": "请审查商务标第3页的公司简介部分" }
```

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "bid_01", "status": "IN_REVIEW" } }
```

---

### 39. PUT /api/bids/:id/review — 审查结果

**权限：** `MANAGER` / `COMPANY_ADMIN`（IN_REVIEW 状态）

**请求体：**
```json
{
  "result": "APPROVED",
  "comments": "整体方案完善，价格具竞争力，批准提交"
}
```
> `result` 枚举：`APPROVED` | `REJECTED`

**响应示例（200）：**
```json
{ "success": true, "data": { "id": "bid_01", "status": "APPROVED" } }
```

---

### 40. POST /api/bids/:id/documents — 上传投标文件

**权限：** `BIDDER` / `MANAGER`

**请求类型：** `multipart/form-data`

**表单字段：**
```
file: <文件，支持 PDF / DWG / DXF / PNG / JPG>
type: DRAWING | SPECIFICATION | PHOTO | OTHER
```

**响应示例（201）：**
```json
{
  "success": true,
  "data": { "id": "bdoc_01", "name": "平面图.pdf", "url": "https://storage.example/bdoc_01.pdf", "type": "DRAWING" }
}
```

---

### 41. GET /api/bids/:id/documents — 获取投标文件列表

**权限：** 需要认证

**响应示例（200）：**
```json
{
  "success": true,
  "data": [
    { "id": "bdoc_01", "name": "平面图.pdf", "url": "https://storage.example/bdoc_01.pdf", "type": "DRAWING", "size": 3145728 }
  ]
}
```

---

### 42. POST /api/bids/:id/export — 导出投标文件

**权限：** `MANAGER` / `COMPANY_ADMIN`（APPROVED 状态）

**请求体：**
```json
{
  "format": "pdf",
  "sections": ["commercial", "technical", "economic"]
}
```
> `format` 枚举：`pdf` | `excel`  
> `sections` 可选项：`commercial`（商务标）| `technical`（技术标）| `economic`（经济标）

**响应示例（200）：**
```json
{
  "success": true,
  "data": {
    "jobId": "export_job_01",
    "status": "PROCESSING",
    "downloadUrl": null
  }
}
```

> 导出为异步任务，前端可轮询或通过 WebSocket 订阅 `bid.exported` 事件获取下载链接。

---

*文档结束 — 共 42 个端点*

