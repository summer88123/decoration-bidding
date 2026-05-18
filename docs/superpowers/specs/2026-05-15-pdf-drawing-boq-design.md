# PDF 图纸上传 → AI 物料清单生成 — 设计规格

| 属性 | 值 |
|------|-----|
| 版本 | V1.0 |
| 日期 | 2026-05-15 |
| 状态 | 设计通过，待实施 |

---

## 1. 功能目标

用户上传 PDF 格式图纸后，系统自动：

1. 存储 PDF 文件
2. 解析图纸内容（文字 + 页面图片）
3. 调用 Vision LLM 识别构件，生成物料清单（BOQ），每项附带图纸区域坐标
4. 前端左右分屏展示：左侧物料清单列表，右侧 PDF 查看器；点击列表项自动跳转并高亮对应区域

---

## 2. 架构

### 2.1 数据流

```
前端
  │  POST /api/bids/:bidId/documents  (multipart/form-data)
  ▼
bid-service  (Node.js, port 3003)
  ├── StorageService.save(file) → 返回 fileKey
  ├── 写入 BidDocument 记录
  ├── 同步调用 bim-service: POST /bim/parse-pdf
  │
  ▼
bim-service  (Python, port 3008)
  ├── PyMuPDF: 提取每页文字 + 坐标
  ├── PyMuPDF: 每页渲染为 PNG → base64
  └── 返回 ParsedPDF { pages: [{ pageNum, text, imageBase64 }] }
  │
  ▼  (bid-service 收到后调用)
ai-agent-service  (Node.js, port 3005)
  POST /ai/skills/parse-drawing
  ├── 对每页调用 GPT-4o vision（图片 + prompt）
  ├── Prompt: 识别建筑构件 → 返回 BOQ 清单 + bbox
  ├── 写入 BidItem 记录（drawingRegion = bbox JSON）
  └── 返回 { jobId, status: "completed", items: [...] }
  │
  ▼
前端
  ├── 轮询 GET /api/bids/:bidId/items?status=ready
  ├── 左侧：物料清单表格
  └── 右侧：react-pdf + SVG 高亮覆盖层
```

### 2.2 异步策略

- 处理整体耗时预估 10-60s（视页数和 LLM 响应）
- **第一期采用同步返回 + 前端轮询**：
  - 上传后立即返回 `{ documentId, status: "processing" }`
  - 前端每 2s 轮询 `GET /api/bids/:bidId/documents/:docId/status`
  - 完成后拉取 items 列表

---

## 3. 存储抽象层

### 3.1 接口定义（shared-types）

```ts
interface StorageService {
  save(file: Buffer, filename: string): Promise<string>   // 返回 fileKey
  getUrl(fileKey: string): string                         // 返回访问 URL
  getStream(fileKey: string): Promise<Readable>
  delete(fileKey: string): Promise<void>
}
```

### 3.2 实现

| 实现 | 环境 | 说明 |
|------|------|------|
| `LocalStorageService` | 开发/验证 | 存储到 `./uploads/` 目录，URL 通过静态文件服务暴露 |
| `S3StorageService` | 生产 | 接入 MinIO / AWS S3 |

通过环境变量 `STORAGE_DRIVER=local|s3` 切换，**默认 `local`**。

---

## 4. 数据模型变更

### 4.1 BidItem.drawingRegion 格式

原 `String?` 改为存储 JSON 字符串：

```json
{ "page": 2, "x": 0.15, "y": 0.30, "w": 0.25, "h": 0.12 }
```

- `page`：1-indexed 页码
- `x, y`：左上角坐标（相对页面宽/高的比例 0-1）
- `w, h`：宽高（相对页面宽/高的比例 0-1）

### 4.2 BidDocument 新增字段

```prisma
model BidDocument {
  // 新增：
  status      String  @default("pending")  // pending | processing | completed | failed
  errorMsg    String?
  pageCount   Int?
}
```

---

## 5. API 接口

### bid-service

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/bids/:bidId/documents` | 上传 PDF，触发解析 |
| `GET` | `/bids/:bidId/documents/:docId/status` | 查询解析状态 |
| `GET` | `/bids/:bidId/items` | 获取物料清单（解析完成后可用）|

### bim-service

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/bim/parse-pdf` | 解析 PDF：提取文字 + 页面图片 |

### ai-agent-service

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/ai/skills/parse-drawing` | Vision LLM 分析，生成 BOQ + bbox |

---

## 6. 前端页面

**路由：** `/bids/[id]`（对应现有 `apps/web/src/app/(dashboard)/bids/[id]/page.tsx`）

**布局：**
```
┌────────────────┬────────────────┐
│  物料清单       │  PDF 图纸       │
│  ─────────     │  查看器         │
│  [上传按钮]     │                │
│                │  [高亮覆盖层]   │
│  # 名称 数量   │                │
│  1 墙面 12m²  │                │
│  2 地板 8m²   │                │
│  ...           │                │
└────────────────┴────────────────┘
```

**交互：**
- 左侧行点击 → 右侧 react-pdf 跳转到 `page`，渲染 SVG `<rect>` 高亮 bbox

---

## 7. LLM Prompt 设计

```
你是一位专业的建筑及室内设计投标顾问。
以下是建筑图纸的某一页（图片），请：

1. 识别图中所有可见的建筑构件/材料（如墙面、地板、天花、门、窗、灯具等）
2. 估算每项的数量和单位
3. 标注每项在图纸中的大致位置（用比例坐标 x,y,w,h 表示，范围 0-1）

返回 JSON 数组，每项格式：
{
  "itemName": "string",
  "quantity": number,
  "unit": "string",
  "bbox": { "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0 }
}

只返回 JSON，不要任何解释文字。
```

---

## 8. 不在本期范围内

- RabbitMQ 异步消息队列处理（第一期用同步 HTTP 调用）
- DWG / IFC 文件格式
- 多页合并去重逻辑
- 用户手动修改清单后重新关联坐标
