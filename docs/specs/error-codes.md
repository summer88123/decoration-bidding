# 错误码规范（Error Codes）

> 本文档定义香港建筑投标辅助系统所有服务的标准错误码，是错误处理的权威来源。
> 所有错误码须在 `@decoration-bidding/shared-types` 的 `ErrorCode` 枚举中维护。

---

## 错误码格式

```
{MODULE}_{三位数字序号}
```

- **MODULE**：大写模块名，标识错误所属业务域
- **序号**：三位数字，从 `001` 开始顺序编号
- **示例**：`AUTH_001`、`TENDER_003`、`COMMON_002`

所有 API 响应的错误格式（来自 `shared-types` 的 `ApiResponse<T>`）：

```ts
// 错误响应结构
{
  "success": false,
  "error": {
    "code": "AUTH_002",           // ErrorCode 枚举值
    "message": "邮箱或密码错误",   // 人类可读的错误描述
    "fields": { ... }             // 可选，仅 COMMON_001 参数校验时使用
  }
}
```

---

## Auth 模块（AUTH\_）

身份认证与授权相关错误。

| 错误码 | HTTP 状态 | 含义 | 触发场景 |
|--------|-----------|------|----------|
| `AUTH_001` | 409 | 邮箱已注册 | 注册时邮箱已存在于系统 |
| `AUTH_002` | 401 | 邮箱或密码错误 | 登录时凭据不匹配（不区分具体原因，防止枚举攻击） |
| `AUTH_003` | 401 | 账号已锁定 | 连续登录失败超过阈值，附 `unlockAt` 时间戳 |
| `AUTH_004` | 401 | Token 无效或已过期 | Bearer Token 校验失败或 JWT 过期 |
| `AUTH_005` | 401 | RefreshToken 已失效 | Refresh Token 过期或已被撤销 |
| `AUTH_006` | 400 | 重置密码链接无效或已过期 | 重置密码 Token 不存在或超过有效期 |
| `AUTH_007` | 403 | 邮箱未验证 | 邮箱验证未完成，禁止登录 |

### AUTH_003 附加字段示例

```json
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "账号已被锁定，请稍后再试",
    "unlockAt": "2026-05-22T10:30:00.000Z"
  }
}
```

---

## Organization 模块（ORG\_）

组织与成员管理相关错误。

| 错误码 | HTTP 状态 | 含义 | 触发场景 |
|--------|-----------|------|----------|
| `ORG_001` | 403 | 无权限操作 | 非 `COMPANY_ADMIN` 角色尝试管理操作 |
| `ORG_002` | 409 | 邀请已发送 | 对同一邮箱重复发送邀请，邀请仍在有效期内 |
| `ORG_003` | 400 | 邀请链接无效或已过期 | 邀请 Token 不存在、已使用或超过有效期 |
| `ORG_004` | 422 | 不能删除最后一位管理员 | 公司内仅剩一位 `COMPANY_ADMIN`，删除将导致无管理员 |
| `ORG_005` | 403 | 用户不属于该公司 | 跨公司操作被拒绝 |

### ORG_002 附加字段示例

```json
{
  "success": false,
  "error": {
    "code": "ORG_002",
    "message": "该邮箱已有待接受的邀请",
    "invitedAt": "2026-05-20T08:00:00.000Z",
    "expiresAt": "2026-05-27T08:00:00.000Z"
  }
}
```

---

## Tender 模块（TENDER\_）

招标项目管理相关错误。

| 错误码 | HTTP 状态 | 含义 | 触发场景 |
|--------|-----------|------|----------|
| `TENDER_001` | 404 | 招标项目不存在 | 通过 ID 查询招标但记录不存在 |
| `TENDER_002` | 403 | 无权限操作该招标 | 用户不属于该招标所在公司 |
| `TENDER_003` | 422 | 当前状态不允许此操作 | 如对 `WON` 状态的招标发起"决定投标"操作 |
| `TENDER_004` | 400 | 文件大小超过限制 | 上传文件超过 100MB 限制 |
| `TENDER_005` | 400 | 不支持的文件类型 | 上传了不在白名单内的文件格式 |

### TENDER_004 附加字段示例

```json
{
  "success": false,
  "error": {
    "code": "TENDER_004",
    "message": "文件大小超过限制（最大 100MB）",
    "maxBytes": 104857600,
    "actualBytes": 120000000
  }
}
```

---

## Bid 模块（BID\_）

投标管理相关错误。

| 错误码 | HTTP 状态 | 含义 | 触发场景 |
|--------|-----------|------|----------|
| `BID_001` | 404 | 投标不存在 | 通过 ID 查询投标但记录不存在 |
| `BID_002` | 403 | 无权限操作该投标 | 用户不属于该投标所在公司 |
| `BID_003` | 422 | 当前状态不允许此操作 | 如对已提交的投标重复提交 |
| `BID_004` | 422 | 招标未决定投标 | 招标状态非 `DECIDED`，不能创建/操作投标 |
| `BID_005` | 422 | 经济标清单为空 | 经济标清单无任何条目，无法提交审查 |

---

## 通用错误（COMMON\_）

跨模块通用的基础错误。

| 错误码 | HTTP 状态 | 含义 | 触发场景 |
|--------|-----------|------|----------|
| `COMMON_001` | 400 | 请求参数验证失败 | Zod/请求体校验不通过，附 `fields` 字段详情 |
| `COMMON_002` | 404 | 资源不存在 | 通用资源未找到（无具体业务上下文时使用） |
| `COMMON_003` | 500 | 服务内部错误 | 未预期的异常，服务端错误 |
| `COMMON_004` | 429 | 请求频率超限 | 触发限流，附 `retryAfter` 秒数 |

### COMMON_001 附加字段示例

```json
{
  "success": false,
  "error": {
    "code": "COMMON_001",
    "message": "请求参数验证失败",
    "fields": {
      "email": "请输入有效的邮箱地址",
      "password": "密码长度不能少于 8 位"
    }
  }
}
```

---

## HTTP 状态码映射

| HTTP 状态码 | 语义 | 对应错误码 |
|-------------|------|-----------|
| `400 Bad Request` | 请求参数错误 | `COMMON_001`、`AUTH_006`、`TENDER_004`、`TENDER_005`、`ORG_003` |
| `401 Unauthorized` | 未认证 / 凭据无效 | `AUTH_002`、`AUTH_003`、`AUTH_004`、`AUTH_005` |
| `403 Forbidden` | 已认证但无权限 | `AUTH_007`、`ORG_001`、`ORG_005`、`TENDER_002`、`BID_002` |
| `404 Not Found` | 资源不存在 | `COMMON_002`、`TENDER_001`、`BID_001` |
| `409 Conflict` | 资源冲突 | `AUTH_001`、`ORG_002` |
| `422 Unprocessable Entity` | 业务规则违反 | `TENDER_003`、`BID_003`、`BID_004`、`BID_005`、`ORG_004` |
| `429 Too Many Requests` | 请求频率超限 | `COMMON_004` |
| `500 Internal Server Error` | 服务内部错误 | `COMMON_003` |

---

## TypeScript 枚举（shared-types）

在 `packages/shared-types/src/errors.ts` 中维护完整枚举：

```ts
// packages/shared-types/src/errors.ts

export enum ErrorCode {
  // ── Auth ──────────────────────────────────────────────
  AUTH_001 = 'AUTH_001', // 邮箱已注册
  AUTH_002 = 'AUTH_002', // 邮箱或密码错误
  AUTH_003 = 'AUTH_003', // 账号已锁定
  AUTH_004 = 'AUTH_004', // Token 无效或已过期
  AUTH_005 = 'AUTH_005', // RefreshToken 已失效
  AUTH_006 = 'AUTH_006', // 重置密码链接无效或已过期
  AUTH_007 = 'AUTH_007', // 邮箱未验证

  // ── Organization ──────────────────────────────────────
  ORG_001 = 'ORG_001',   // 无权限（非 COMPANY_ADMIN）
  ORG_002 = 'ORG_002',   // 邀请已发送（重复邀请）
  ORG_003 = 'ORG_003',   // 邀请链接无效或已过期
  ORG_004 = 'ORG_004',   // 不能删除最后一位 COMPANY_ADMIN
  ORG_005 = 'ORG_005',   // 用户不属于该公司

  // ── Tender ────────────────────────────────────────────
  TENDER_001 = 'TENDER_001', // 招标项目不存在
  TENDER_002 = 'TENDER_002', // 无权限操作该招标
  TENDER_003 = 'TENDER_003', // 当前状态不允许此操作
  TENDER_004 = 'TENDER_004', // 文件大小超过限制
  TENDER_005 = 'TENDER_005', // 不支持的文件类型

  // ── Bid ───────────────────────────────────────────────
  BID_001 = 'BID_001',   // 投标不存在
  BID_002 = 'BID_002',   // 无权限操作该投标
  BID_003 = 'BID_003',   // 当前状态不允许此操作
  BID_004 = 'BID_004',   // 招标未决定投标
  BID_005 = 'BID_005',   // 经济标清单为空

  // ── Common ────────────────────────────────────────────
  COMMON_001 = 'COMMON_001', // 请求参数验证失败
  COMMON_002 = 'COMMON_002', // 资源不存在
  COMMON_003 = 'COMMON_003', // 服务内部错误
  COMMON_004 = 'COMMON_004', // 请求频率超限
}

/** 业务错误响应体 */
export interface ApiError {
  code: ErrorCode
  message: string
  /** 字段级验证错误，仅 COMMON_001 时存在 */
  fields?: Record<string, string>
  /** 账号解锁时间，仅 AUTH_003 时存在 */
  unlockAt?: string
  /** 限流重试等待秒数，仅 COMMON_004 时存在 */
  retryAfter?: number
}
```

### 在 core-service 中使用

```ts
// apps/core-service/src/shared/middleware/error-handler.ts
import { ErrorCode } from '@decoration-bidding/shared-types'

export function throwBizError(
  code: ErrorCode,
  message: string,
  extra?: Record<string, unknown>,
  httpStatus = 400
): never {
  const err = Object.assign(new Error(message), { code, httpStatus, ...extra })
  throw err
}

// 使用示例
throwBizError(ErrorCode.TENDER_001, '招标项目不存在', {}, 404)
throwBizError(ErrorCode.AUTH_003, '账号已锁定', { unlockAt: unlockTime.toISOString() }, 401)
```

---

*文档版本：v1.0 | 最后更新：2026-05*
