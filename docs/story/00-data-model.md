# 整体数据关系图

| 属性 | 值 |
|------|-----|
| 版本 | V1.0 |
| 日期 | 2026-05-19 |
| 范围 | 核心投标流程（用户/组织、招标、投标） |

---

## 核心实体一览

| 实体 | 说明 |
|------|------|
| `companies` | 公司/组织，系统最顶层租户单位 |
| `users` | 系统用户，归属某个公司 |
| `roles` | 角色定义（管理层 / 投标负责人） |
| `user_roles` | 用户-角色多对多关联 |
| `tender_projects` | 招标项目，来源于爬虫或手动录入 |
| `bids` | 投标，一个招标项目可有多个投标版本 |
| `bid_commercial` | 商务标：公司资质、业绩、人员 |
| `bid_technical` | 技术标：施工方案、工期、安全措施 |
| `bid_items` | 经济标明细：工程量清单各行 |
| `bid_documents` | 投标附件：PDF / DWG / IFC 文件 |
| `material_db` | 物料资料库，用于经济标定价参考 |

---

## ER 图（Mermaid）

```mermaid
erDiagram
    companies {
        uuid    id PK
        string  name
        json    capabilities
        json    licenses
        json    regions
        string  budget_range
        timestamp created_at
        timestamp updated_at
    }

    users {
        uuid   id PK
        uuid   company_id FK
        string email
        string password_hash
        string name
        string phone
        string status
        timestamp created_at
        timestamp updated_at
    }

    roles {
        uuid   id PK
        string name
        json   permissions
    }

    user_roles {
        uuid user_id FK
        uuid role_id FK
    }

    tender_projects {
        uuid    id PK
        uuid    company_id FK
        string  title
        string  client_name
        string  location
        string  source_url
        date    deadline
        decimal budget_estimate
        int     match_score
        json    risk_labels
        string  status
        text    ai_summary
        timestamp created_at
        timestamp updated_at
    }

    bids {
        uuid    id PK
        uuid    tender_id FK
        uuid    company_id FK
        uuid    assigned_to FK
        string  status
        decimal profit_margin_pct
        decimal total_cost
        decimal total_bid_price
        string  currency
        timestamp submitted_at
        timestamp created_at
        timestamp updated_at
    }

    bid_commercial {
        uuid   id PK
        uuid   bid_id FK
        string company_name
        string registration_no
        json   licenses
        json   key_personnel
        json   past_projects
        text   company_profile
        timestamp updated_at
    }

    bid_technical {
        uuid   id PK
        uuid   bid_id FK
        text   construction_method
        text   project_schedule
        int    duration_days
        text   safety_measures
        text   quality_control
        text   site_management
        json   milestone_plan
        timestamp updated_at
    }

    bid_items {
        uuid    id PK
        uuid    bid_id FK
        int     sort_order
        string  item_code
        string  item_name
        text    description
        decimal quantity
        string  unit
        decimal cost_price
        decimal sell_price
        boolean is_special
        text    remark
        string  drawing_page
        string  drawing_region
        string  ifc_element_id
    }

    bid_documents {
        uuid   id PK
        uuid   bid_id FK
        string file_type
        string file_url
        string original_name
        int    file_size
        int    page_count
        json   drawing_links
        json   ifc_metadata
        timestamp uploaded_at
    }

    material_db {
        uuid    id PK
        uuid    company_id FK
        string  name
        string  spec
        string  unit
        decimal unit_cost
        string  supplier
        string  category
        timestamp updated_at
    }

    companies       ||--o{ users           : "has"
    companies       ||--o{ tender_projects  : "owns"
    companies       ||--o{ material_db      : "owns"
    users           }o--o{ roles            : "assigned"
    user_roles      }o--|| users            : "ref"
    user_roles      }o--|| roles            : "ref"
    tender_projects ||--o{ bids             : "has"
    bids            ||--|| bid_commercial   : "contains"
    bids            ||--|| bid_technical    : "contains"
    bids            ||--o{ bid_items        : "has"
    bids            ||--o{ bid_documents    : "has"
```

---

## 关键关系说明

### 1. 租户隔离

- 所有业务数据通过 `company_id` 隔离，不同公司数据完全独立。
- `tender_projects` 和 `bids` 均带 `company_id`，支持多租户查询过滤。

### 2. 投标三标结构

每个 `bid` 拥有：

| 子实体 | 类型 | 说明 |
|--------|------|------|
| `bid_commercial` | 1:1 | 商务标 — 资质证明、业绩、人员 |
| `bid_technical` | 1:1 | 技术标 — 施工方案、工期、安全 |
| `bid_items` | 1:N | 经济标 — 工程量清单各明细行 |

三标内容均存于独立表，便于分阶段填写和独立审查。

### 3. 投标状态流转

```
DRAFT → IN_REVIEW → APPROVED → SUBMITTED → [WON | LOST]
```

### 4. 文件关联

`bid_documents` 存储上传的 PDF/DWG/IFC 文件引用（S3 URL），`bid_items` 中的 `drawing_page` / `drawing_region` / `ifc_element_id` 字段实现项目清单与图纸/BIM 构件的双向定位。

---

## 状态枚举

### `tender_projects.status`

| 值 | 含义 |
|----|------|
| `PENDING` | 待决策 |
| `DECIDED` | 已决定投标 |
| `DECLINED` | 放弃投标 |
| `BIDDING` | 投标进行中 |
| `SUBMITTED` | 已提交 |
| `WON` | 中标 |
| `LOST` | 未中标 |

### `bids.status`

| 值 | 含义 |
|----|------|
| `DRAFT` | 草稿编辑中 |
| `IN_REVIEW` | 内部审查中 |
| `APPROVED` | 审查通过 |
| `SUBMITTED` | 已提交业主 |
| `WON` | 中标 |
| `LOST` | 未中标 |

---

## 文件列表

| 文件 | 内容 |
|------|------|
| [01-auth.md](./01-auth.md) | 用户注册、登录、JWT 认证、权限 |
| [02-organization.md](./02-organization.md) | 公司/组织创建与管理、成员管理 |
| [03-tender.md](./03-tender.md) | 招标项目创建与管理 |
| [04-bid.md](./04-bid.md) | 投标核心流程：商务标、技术标、经济标 |
