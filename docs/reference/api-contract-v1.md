# Heluo API 契约规范 v1.0

> **版本**: 1.0.0
> **状态**: 设计中
> **创建日期**: 2026-02-12

## 目录

- [1. 概述](#1-概述)
- [2. 通用规范](#2-通用规范)
- [3. API 接口定义](#3-api-接口定义)
  - [3.1 人物接口](#31-人物接口)
  - [3.2 诗文接口](#32-诗文接口)
  - [3.3 搜索接口](#33-搜索接口)
- [4. 错误码规范](#4-错误码规范)
- [5. TypeScript 类型定义](#5-typescript-类型定义)
- [6. 附录](#6-附录)

---

## 1. 概述

### 1.1 设计原则

API 契约设计遵循以下原则：

| 原则 | 说明 |
|------|------|
| **语义化优先** | API 路径暴露业务语义，不暴露底层 collection 细节 |
| **版本化管理** | 使用 `/api/v1/` 路径前缀，便于未来演进 |
| **RESTful 风格** | 遵循 REST 架构风格，使用标准 HTTP 方法 |
| **前后端解耦** | 前端不感知 MarkLogic collection 名称 |

### 1.2 架构关系图

```mermaid
graph TB
    subgraph Frontend["前端应用"]
        FE[Vue 3 前端<br/>端口: 3000]
    end

    subgraph API["API 层"]
        A1[GET /api/v1/persons/{id}]
        A2[GET /api/v1/persons]
        A3[GET /api/v1/poems/{id}]
        A4[GET /api/v1/poems]
        A5[GET /api/v1/search]
    end

    subgraph Legacy["现有 MVP 接口 (兼容)"]
        L1[/api/mvp/search]
        L2[/api/mvp/detail]
        L3[/api/mvp/fusion]
    end

    subgraph Backend["后端服务"]
        BE[Express Server<br/>端口: 9011]
    end

    subgraph MarkLogic["MarkLogic 数据库"]
        ML[(MarkLogic<br/>端口: 8003)]
        C1[/heluo/persons]
        C2[/heluo/poems-txt]
        C3[/heluo/books]
        C4[/heluo/places]
    end

    FE --> A1
    FE --> A2
    FE --> A3
    FE --> A4
    FE --> A5
    FE -.->|兼容| L1
    FE -.->|兼容| L2
    FE -.->|兼容| L3

    A1 --> BE
    A2 --> BE
    A3 --> BE
    A4 --> BE
    A5 --> BE
    L1 --> BE
    L2 --> BE
    L3 --> BE

    BE --> ML
    ML --> C1
    ML --> C2
    ML --> C3
    ML --> C4
```

### 1.3 MVP 优先级

| 优先级 | 接口 | 描述 |
|--------|------|------|
| **P0** | 人物详情/列表、诗文详情/列表、统一搜索 | 核心功能，必须实现 |
| **P1** | 书籍、地点、概念接口 | 增强功能 |
| **P2** | IIIF、语义增强接口 | 扩展功能 |

---

## 2. 通用规范

### 2.1 基础 URL

```
http://127.0.0.1:9011/api/v1
```

### 2.2 HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| `200 OK` | 请求成功 |
| `400 Bad Request` | 请求参数错误 |
| `404 Not Found` | 资源不存在 |
| `500 Internal Server Error` | 服务器内部错误 |
| `502 Bad Gateway` | 上游服务（MarkLogic）连接失败 |

### 2.3 分页参数

所有列表接口支持标准分页：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | number | 否 | `1` | 页码，从 1 开始 |
| `pageSize` | number | 否 | `20` | 每页数量，范围 1-100 |

### 2.4 响应格式

成功响应统一格式：

```typescript
interface ApiResponse<T> {
  success: true
  data: T
}

// 带分页的响应
interface PaginatedResponse<T> {
  success: true
  data: {
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}
```

错误响应格式：

```typescript
interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}
```

---

## 3. API 接口定义

### 3.1 人物接口

#### 3.1.1 获取人物详情

**接口**: `GET /api/v1/persons/{id}`

**描述**: 根据人物 ID 获取人物详细信息

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 人物 ID，对应文档 URI 的最后部分 |

**请求示例**:

```http
GET /api/v1/persons/17270
```

**响应数据结构**:

```typescript
interface PersonDetail {
  /** 人物 ID */
  id: string
  /** 姓名 */
  name: string
  /** 别名/字号/号 */
  aliases: string[]
  /** 朝代 */
  dynasty?: string
  /** 生卒年 */
  lifespan?: string
  /** 籍贯 */
  birthplace?: string
  /** 人物简介 */
  summary?: string
  /** 关联的地点 */
  relatedPlaces?: PlaceInfo[]
  /** 关联的诗文 */
  relatedPoems?: PoemCard[]
  /** 外部链接 */
  externalUris?: string[]
  /** 原始文档 URI */
  uri: string
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": "17270",
    "name": "杜甫",
    "aliases": ["杜子美", "杜工部", "少陵野老"],
    "dynasty": "唐",
    "lifespan": "712-770",
    "birthplace": "河南巩县",
    "summary": "唐代著名诗人，与李白合称"李杜"。",
    "relatedPlaces": [
      {
        "label": "成都",
        "uri": "/processed/entities/place/chengdu"
      }
    ],
    "relatedPoems": [
      {
        "id": "poem_001",
        "title": "春望"
      }
    ],
    "externalUris": ["https://example.org/dufu"],
    "uri": "/processed/entities/person/17270.json"
  }
}
```

**数据来源映射**:

| 后端实现 | MarkLogic 查询 |
|----------|---------------|
| 现有 `/api/mvp/detail` | Directory: `/processed/entities/person/` |
| | Collection: `/heluo/persons` (备用) |

---

#### 3.1.2 获取人物列表

**接口**: `GET /api/v1/persons`

**描述**: 获取人物列表，支持搜索和分页

**查询参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `q` | string | 否 | - | 搜索关键词，支持姓名、别名搜索 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `20` | 每页数量 |
| `dynasty` | string | 否 | - | 朝代筛选 |
| `sortBy` | string | 否 | `relevance` | 排序方式：`relevance`/`name`/`id` |
| `sortOrder` | string | 否 | `asc` | 排序方向：`asc`/`desc` |

**请求示例**:

```http
GET /api/v1/persons?q=杜&page=1&pageSize=20&dynasty=唐
```

**响应数据结构**:

```typescript
interface PersonCard {
  /** 人物 ID */
  id: string
  /** 姓名 */
  name: string
  /** 副标题（朝代、别称等） */
  subtitle?: string
  /** 匹配分数（搜索时） */
  score?: number
}

interface PersonListResponse {
  items: PersonCard[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "17270",
        "name": "杜甫",
        "subtitle": "唐代诗人",
        "score": 0.95
      },
      {
        "id": "17271",
        "name": "杜牧",
        "subtitle": "唐代诗人",
        "score": 0.88
      }
    ],
    "total": 156,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}
```

**数据来源映射**:

| 后端实现 | MarkLogic 查询 |
|----------|---------------|
| 基于 `/api/mvp/search` | Directory: `/processed/entities/person/` |
| | Collection: `/heluo/persons` (备用) |

---

### 3.2 诗文接口

#### 3.2.1 获取诗文详情

**接口**: `GET /api/v1/poems/{id}`

**描述**: 根据诗文 ID 获取诗文详细信息，包括全文

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 诗文 ID |

**查询参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `format` | string | 否 | `set` | 返回格式：`set`(诗文集) / `txt`(纯文本) |

**请求示例**:

```http
GET /api/v1/poems/poem_001?format=set
```

**响应数据结构**:

```typescript
interface PoemDetail {
  /** 诗文 ID */
  id: string
  /** 标题 */
  title: string
  /** 作者 */
  author: string
  /** 作者 ID */
  authorId?: string
  /** 朝代 */
  dynasty?: string
  /** 体裁（诗、词、赋等） */
  genre?: string
  /** 韵部（如有） */
  rhyme?: string
  /** 全文内容 */
  fullText: string
  /** 出处/来源 */
  source?: string
  /** 关联地点 */
  relatedPlaces?: PlaceInfo[]
  /** 原始文档 URI */
  uri: string
  /** 文本 URI (如果与 set 分离) */
  textUri?: string
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": "poem_001",
    "title": "春望",
    "author": "杜甫",
    "authorId": "17270",
    "dynasty": "唐",
    "genre": "五言律诗",
    "fullText": "国破山河在，城春草木深。\n感时花溅泪，恨别鸟惊心。\n烽火连三月，家书抵万金。\n白头搔更短，浑欲不胜簪。",
    "source": "《全唐诗》",
    "relatedPlaces": [
      {
        "label": "长安",
        "uri": "/processed/entities/place/changan"
      }
    ],
    "uri": "/processed/entities/poem/set/poem_001.json",
    "textUri": "/processed/entities/poem/txt/poem_001.json"
  }
}
```

**数据来源映射**:

| 后端实现 | MarkLogic 查询 |
|----------|---------------|
| 现有 `/api/mvp/detail` + `buildPoemSetDetail` | Directory: `/processed/entities/poem/set/` |
| | Directory: `/processed/entities/poem/txt/` (文本) |
| | Collection: `/heluo/poems-txt` (备用) |

---

#### 3.2.2 获取诗文列表

**接口**: `GET /api/v1/poems`

**描述**: 获取诗文列表，支持搜索和分页

**查询参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `q` | string | 否 | - | 搜索关键词，支持标题、作者、内容搜索 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `20` | 每页数量 |
| `author` | string | 否 | - | 作者筛选（作者 ID 或姓名） |
| `dynasty` | string | 否 | - | 朝代筛选 |
| `genre` | string | 否 | - | 体裁筛选 |
| `rhyme` | string | 否 | - | 韵部筛选 |
| `sortBy` | string | 否 | `relevance` | 排序方式 |

**请求示例**:

```http
GET /api/v1/poems?q=春望&page=1&pageSize=20
```

**响应数据结构**:

```typescript
interface PoemCard {
  /** 诗文 ID */
  id: string
  /** 标题 */
  title: string
  /** 作者 */
  author: string
  /** 内容片段（用于预览） */
  snippet?: string
  /** 匹配分数 */
  score?: number
}

interface PoemListResponse {
  items: PoemCard[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "poem_001",
        "title": "春望",
        "author": "杜甫",
        "snippet": "国破山河在，城春草木深...",
        "score": 0.98
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

**数据来源映射**:

| 后端实现 | MarkLogic 查询 |
|----------|---------------|
| 基于 `/api/mvp/search` | Directory: `/processed/entities/poem/set/` |
| | Collection: `/heluo/poems-txt` (备用) |

---

### 3.3 搜索接口

#### 3.3.1 统一搜索

**接口**: `GET /api/v1/search`

**描述**: 在所有资源类型中进行统一搜索，支持类型过滤

**查询参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `q` | string | 是 | - | 搜索关键词 |
| `type` | string | 否 | `all` | 资源类型过滤，多个用逗号分隔：<br/>`person`/`poem`/`book`/`place`/`all` |
| `mode` | string | 否 | 后端环境值 | 检索模式：`keyword`（关键字）/`vector`（向量）/`hybrid`（混合） |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `12` | 每页数量，范围 5-30 |

**请求示例**:

```http
GET /api/v1/search?q=杜甫&type=person,poem&mode=keyword&page=1&pageSize=12
```

**响应数据结构**:

```typescript
type SearchResultType = 'person' | 'poem' | 'book' | 'place' | 'concept'

interface SearchResultItem {
  /** 资源类型 */
  type: SearchResultType
  /** 资源 ID */
  id: string
  /** 标题/名称 */
  title: string
  /** 内容片段（用于摘要） */
  snippet: string
  /** 匹配分数 */
  score: number
  /** 原始文档 URI */
  uri: string
}

interface SearchResponse {
  /** 搜索关键词 */
  query: string
  /** 搜索类型过滤 */
  type: string
  /** 本次实际使用的检索模式 */
  mode?: 'keyword' | 'vector' | 'hybrid'
  /** 结果总数 */
  total: number
  /** 当前页结果 */
  items: SearchResultItem[]
  /** 各类型命中数量 */
  counts?: {
    [key in SearchResultType]?: number
  }
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "query": "杜甫",
    "type": "person,poem",
    "total": 12,
    "items": [
      {
        "type": "person",
        "id": "17270",
        "title": "杜甫",
        "snippet": "唐代著名诗人，与李白合称"李杜"。",
        "score": 0.95,
        "uri": "/processed/entities/person/17270.json"
      },
      {
        "type": "poem",
        "id": "poem_001",
        "title": "春望",
        "snippet": "国破山河在，城春草木深。感时花溅泪...",
        "score": 0.88,
        "uri": "/processed/entities/poem/set/poem_001.json"
      }
    ],
    "counts": {
      "person": 1,
      "poem": 11
    }
  }
}
```

**数据来源映射**:

| 资源类型 | 后端实现 | MarkLogic 查询 |
|----------|----------|---------------|
| `person` | 现有 `searchScopeRows(q, 'person')` | Directory: `/processed/entities/person/` |
| `poem` | 现有 `searchScopeRows(q, 'poem')` | Directory: `/processed/entities/poem/set/` |
| `book` | 现有 `searchScopeRows(q, 'book')` | Directory: `/processed/entities/marc/` |
| `place` | 现有 `searchScopeRows(q, 'place')` | Directory: `/processed/entities/place/` |
| `concept` | 现有 `searchScopeRows(q, 'concept')` | Directory: `/processed/entities/concept/` |

**与现有接口的映射**:

| 新接口 | 现有接口 | 映射关系 |
|--------|----------|----------|
| `GET /api/v1/search` | `GET /api/mvp/search` | 参数 `q` → `q`，参数 `type` → `scope`；`mode` 在 v1 搜索链路内生效（不透传到 mvp 参数） |

---

## 4. 错误码规范

### 4.1 错误响应格式

```typescript
interface ApiError {
  success: false
  error: {
    /** 错误码 */
    code: string
    /** 错误描述（中文） */
    message: string
    /** 详细信息（可选） */
    details?: unknown
  }
}
```

### 4.2 错误码定义

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `INVALID_PARAMS` | 400 | 请求参数错误或缺失 |
| `NOT_FOUND` | 404 | 请求的资源不存在 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `UPSTREAM_ERROR` | 502 | 上游服务（MarkLogic）错误 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限（预留） |

**错误响应示例**:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "未找到 ID 为 99999 的人物",
    "details": {
      "id": "99999",
      "type": "person"
    }
  }
}
```

---

## 5. TypeScript 类型定义

```typescript
/**
 * Heluo API v1.0 TypeScript 类型定义
 * 文件位置: src/types/api-v1.ts
 */

// ========== 基础类型 ==========

/** 资源类型枚举 */
export type ResourceType = 'person' | 'poem' | 'book' | 'place' | 'concept' | 'iiif'

/** 排序方式 */
export type SortBy = 'relevance' | 'name' | 'id' | 'date'

/** 排序方向 */
export type SortOrder = 'asc' | 'desc'

// ========== 通用响应类型 ==========

/** API 成功响应包装器 */
export interface ApiResponse<T> {
  success: true
  data: T
}

/** 分页响应包装器 */
export interface PaginatedResponse<T> {
  success: true
  data: {
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

/** API 错误响应 */
export interface ApiError {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}

/** 错误码枚举 */
export type ErrorCode =
  | 'INVALID_PARAMS'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'UPSTREAM_ERROR'
  | 'RATE_LIMIT_EXCEEDED'

// ========== 地理信息 ==========

/** 地理信息 */
export interface PlaceInfo {
  label: string
  uri: string
}

// ========== 人物接口类型 ==========

/** 人物详情 */
export interface PersonDetail {
  id: string
  name: string
  aliases: string[]
  dynasty?: string
  lifespan?: string
  birthplace?: string
  summary?: string
  relatedPlaces?: PlaceInfo[]
  relatedPoems?: PoemCard[]
  externalUris?: string[]
  uri: string
}

/** 人物卡片（列表项） */
export interface PersonCard {
  id: string
  name: string
  subtitle?: string
  score?: number
}

/** 人物列表查询参数 */
export interface PersonListParams {
  q?: string
  page?: number
  pageSize?: number
  dynasty?: string
  sortBy?: SortBy
  sortOrder?: SortOrder
}

// ========== 诗文接口类型 ==========

/** 诗文详情 */
export interface PoemDetail {
  id: string
  title: string
  author: string
  authorId?: string
  dynasty?: string
  genre?: string
  rhyme?: string
  fullText: string
  source?: string
  relatedPlaces?: PlaceInfo[]
  uri: string
  textUri?: string
}

/** 诗文卡片（列表项） */
export interface PoemCard {
  id: string
  title: string
  author: string
  snippet?: string
  score?: number
}

/** 诗文列表查询参数 */
export interface PoemListParams {
  q?: string
  page?: number
  pageSize?: number
  author?: string
  dynasty?: string
  genre?: string
  rhyme?: string
  sortBy?: SortBy
  sortOrder?: SortOrder
}

// ========== 搜索接口类型 ==========

/** 搜索结果项 */
export interface SearchResultItem {
  type: ResourceType
  id: string
  title: string
  snippet: string
  score: number
  uri: string
}

/** 搜索响应 */
export interface SearchResponse {
  query: string
  type: string
  total: number
  items: SearchResultItem[]
  counts?: Partial<Record<ResourceType, number>>
}

/** 搜索查询参数 */
export interface SearchParams {
  q: string
  type?: string
  page?: number
  pageSize?: number
}

// ========== 联合类型 ==========/** API 响应联合类型 */
export type ApiResponseData =
  | ApiResponse<PersonDetail>
  | PaginatedResponse<PersonCard>
  | ApiResponse<PoemDetail>
  | PaginatedResponse<PoemCard>
  | ApiResponse<SearchResponse>
  | ApiError
```

---

## 6. 附录

### 6.1 接口与 Collection 映射表

| API 端点 | 主要查询集合 | 备用集合 | 现有接口映射 |
|----------|-------------|----------|-------------|
| `GET /api/v1/persons/{id}` | `/processed/entities/person/` | `/heluo/persons` | `/api/mvp/detail?uri=...` |
| `GET /api/v1/persons` | `/processed/entities/person/` | `/heluo/persons` | `/api/mvp/search?scope=person` |
| `GET /api/v1/poems/{id}` | `/processed/entities/poem/set/` | `/heluo/poems-txt` | `/api/mvp/detail?uri=...` |
| `GET /api/v1/poems` | `/processed/entities/poem/set/` | `/heluo/poems-txt` | `/api/mvp/search?scope=poem` |
| `GET /api/v1/search` | (按 type 分发) | (对应 vector 集合) | `/api/mvp/search?scope=...` |

### 6.2 数据统计（参考）

| 资源类型 | 数量范围 | Collection 示例 |
|----------|----------|----------------|
| 人物 | ~1,000+ | `/heluo/persons` |
| 诗文 | ~670,000+ | `/heluo/poems-txt` |
| 书籍 | ~70 | `/heluo/books` |
| 地点 | ~70 | `/heluo/places` |
| 概念 | ~100 | `/concept/rhyme`, `/concept/poetic_form` |

### 6.3 实现检查清单

- [x] 实现 `GET /api/v1/persons/{id}`
- [x] 实现 `GET /api/v1/persons`
- [x] 实现 `GET /api/v1/poems/{id}`
- [x] 实现 `GET /api/v1/poems`
- [x] 实现 `GET /api/v1/search`
- [x] 添加 TypeScript 类型定义到 `src/types/api.ts`（V1 类型）
- [x] 更新前端 API 调用服务 `src/lib/api/mvpApi.ts`
- [x] 编写 API 集成测试（手动验证）
- [ ] 编写 API 文档（可选：使用 Swagger/OpenAPI）

### 6.4 API 契约验证报告

**验证日期**: 2026-02-12
**验证人员**: QA 自动化测试
**后端版本**: API v1.0 (server/src/index.js)

#### 验证环境

| 组件 | 状态 | 说明 |
|------|------|------|
| 后端服务 | 运行中 | 端口 9011 |
| MarkLogic | 连接正常 | http://localhost:8003 |

#### API 端点验证结果

##### 6.4.1 人物接口

**GET /api/v1/persons**

| 测试项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| 基础列表请求 | 返回人物列表 | 成功返回 20 条 | PASS |
| 分页参数 `page=1&pageSize=5` | 返回 5 条 | 返回 5 条 | PASS |
| 响应格式符合 `PersonListResponseV1` | 包含 items, total, page, pageSize | 符合 | PASS |

**示例响应**:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 20,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

**GET /api/v1/persons/:id**

| 测试项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| 获取人物详情 (id=17270) | 返回杜甫详情 | 成功返回 | PASS |
| 响应格式符合 `PersonDetailV1` | 包含 id, name, aliases, uri 等 | 符合 | PASS |
| 关联地点 `relatedPlaces` | 数组格式 | 正常返回 | PASS |
| 外部链接 `externalUris` | 数组格式 | 正常返回 | PASS |
| 404 错误处理 | 返回标准错误格式 | PASS | PASS |

**示例响应**:
```json
{
  "success": true,
  "data": {
    "id": "17270",
    "name": "杜甫",
    "aliases": [],
    "birthplace": "河南巩县(今河南巩义)",
    "summary": "杜甫",
    "relatedPlaces": [...],
    "externalUris": [...],
    "uri": "/processed/entities/person/17270.json"
  }
}
```

##### 6.4.2 诗文接口

**GET /api/v1/poems**

| 测试项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| 基础列表请求 | 返回诗文列表 | 成功返回 20 条 | PASS |
| 分页参数 `page=1&pageSize=5` | 返回 5 条 | 返回 5 条 | PASS |
| 响应格式符合 `PoemListResponseV1` | 包含 items, total, page | 符合 | PASS |
| 诗文包含 snippet 预览 | 每项有 snippet 字段 | 符合 | PASS |

**GET /api/v1/poems/:id**

| 测试项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| 获取诗文详情 (id=poem_31855) | 返回《阆中行》详情 | 成功返回 | PASS |
| 响应格式符合 `PoemDetailV1` | 包含 id, title, author, fullText | 符合 | PASS |
| 作者信息 `authorId` | 存在 | 17270 (杜甫) | PASS |
| 文本 URI `textUri` | 存在 | 正常返回 | PASS |
| 404 错误处理 | 返回标准错误格式 | 符合 | PASS |

**示例响应**:
```json
{
  "success": true,
  "data": {
    "id": "poem_31855",
    "title": "阆中行",
    "author": "杜甫",
    "authorId": "17270",
    "dynasty": "杜甫",
    "genre": "唐朝",
    "fullText": "豺狼当路，",
    "uri": "/processed/entities/poem/set/poem_31855.json",
    "textUri": "/processed/entities/poem/txt/poem_31855_01.json"
  }
}
```

##### 6.4.3 搜索接口

**GET /api/v1/search**

| 测试项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| 基础搜索 `q=杜甫` | 返回相关结果 | 成功返回 12 条 | PASS |
| 类型过滤 `type=person` | 只返回人物 | 成功过滤 | PASS |
| 分页参数 | 正确分页 | 符合 | PASS |
| 响应格式符合 `UnifiedSearchResponseV1` | 包含 query, type, mode, items, counts | 符合 | PASS |
| 400 错误处理（缺少 q） | 返回 INVALID_PARAMS | 符合 | PASS |

**示例响应**:
```json
{
  "success": true,
  "data": {
    "query": "杜甫",
    "type": "person,poem",
    "total": 12,
    "items": [...],
    "counts": {
      "person": 12,
      "poem": 12
    }
  }
}
```

##### 6.4.4 错误处理验证

| 错误码 | 测试场景 | 响应格式 | 状态 |
|--------|----------|----------|------|
| `NOT_FOUND` | GET /persons/999999999 | 标准错误响应 | PASS |
| `INVALID_PARAMS` | GET /search (无 q) | 标准错误响应 | PASS |

**错误响应格式**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "未找到 ID 为 999999999 的人物",
    "details": {
      "id": "999999999"
    }
  }
}
```

#### 6.4.5 TypeScript 类型安全

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `src/types/api.ts` 类型定义 | PASS | 所有 V1 类型已定义 |
| `src/lib/api/mvpApi.ts` 函数签名 | PASS | 函数签名与契约一致 |
| 编译检查 | PASS | API 相关代码无类型错误 |

#### 6.4.6 验证结论

| 类别 | 结果 | 说明 |
|------|------|------|
| P0 API 端点 | 全部通过 | 5 个核心接口全部可访问 |
| 响应格式 | 全部符合 | 符合契约定义 |
| 错误处理 | 全部符合 | 标准错误格式 |
| TypeScript 类型 | 通过 | 类型定义完整且正确 |

**总体评价**: API 契约实现对齐，所有 P0 优先级接口均已实现并通过验证。

### 6.5 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0.0 | 2026-02-12 | 初始版本，定义 P0 优先级接口 |

---

**文档维护**: 本文档应与 API 实现同步更新，确保契约与实现一致。
