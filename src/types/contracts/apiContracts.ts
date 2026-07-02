// ============================================================
// API v1.0 类型定义
// 参考: docs/reference/api-contract-v1.md
// ============================================================

// ========== 基础类型 ==========

/** 资源类型枚举 */
export type ResourceType = 'person' | 'poem' | 'book' | 'ancient_book' | 'place' | 'concept' | 'iiif'

/** IIIF Manifest URI */
export type IiifManifestUriV1 = string

/** 古籍层级枚举（v1） */
export type AncientBookHierarchyLevelV1 = 'root' | 'department' | 'entry' | 'unknown'

/** 古籍当前卷文本状态（v1） */
export type AncientBookVolumeTextStatusV1 = 'available' | 'missing'

/** 排序方式 */
export type SortBy = 'relevance' | 'name' | 'id' | 'date'

/** 排序方向 */
export type SortOrder = 'asc' | 'desc'

/** 检索模式 */
export type SearchModeV1 = 'keyword' | 'vector' | 'hybrid'

/** 错误码枚举 */
export type ErrorCode =
  | 'INVALID_PARAMS'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'UPSTREAM_ERROR'
  | 'RATE_LIMIT_EXCEEDED'

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

/** API 响应联合类型 */
export type ApiResponseData<T = unknown> = ApiResponse<T> | ApiError

// ========== 地理信息 ==========

/** 地理信息 */
export interface PlaceInfo {
  label: string
  uri: string
  lat?: number
  lng?: number
}

// ========== 人物接口类型 ==========

/** 人物详情（v1） */
export interface PersonDetailV1 {
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
  relatedPoems?: PoemCardV1[]
  /** 外部链接 */
  externalUris?: string[]
  /** 原始 JSON-LD 文档（用于详情页元数据解析） */
  doc?: Record<string, unknown>
  /** 原始文档 URI */
  uri: string
}

/** 人物卡片（列表项） */
export interface PersonCardV1 {
  /** 人物 ID */
  id: string
  /** 姓名 */
  name: string
  /** 副标题（朝代、别称等） */
  subtitle?: string
  /** 匹配分数（搜索时） */
  score?: number
}

/** 人物列表响应 */
export type PersonListResponseV1 = PaginatedResponse<PersonCardV1>

/** 人物列表查询参数 */
export interface PersonListParamsV1 {
  /** 搜索关键词 */
  q?: string
  /** 页码 */
  page?: number
  /** 每页数量 */
  pageSize?: number
  /** 朝代筛选 */
  dynasty?: string
  /** 排序方式 */
  sortBy?: SortBy
  /** 排序方向 */
  sortOrder?: SortOrder
}

// ========== 诗文接口类型 ==========

/** 诗文校勘注释 */
export interface PoemCommentV1 {
  /** 对应的原文行 */
  text?: string
  /** 注释内容 */
  comment: string
}

/** 诗文详情（v1） */
export interface PoemDetailV1 {
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
  /** 体裁概念详情 URI */
  genreUri?: string
  /** 韵部（如有） */
  rhyme?: string
  /** 韵部概念详情 URI */
  rhymeUri?: string
  /** 全文内容 */
  fullText: string
  /** 出处/来源 */
  source?: string
  /** 校勘注释 */
  comments?: PoemCommentV1[]
  /** 关联地点 */
  relatedPlaces?: PlaceInfo[]
  /** 原始文档 URI */
  uri: string
  /** 文本 URI (如果与 set 分离) */
  textUri?: string
  /** 所属诗集信息 */
  set?: {
    id: string
    uri: string
    label: string
  }
}

/** 诗文卡片（列表项） */
export interface PoemCardV1 {
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

/** 诗文列表响应 */
export type PoemListResponseV1 = PaginatedResponse<PoemCardV1>

/** 诗文列表查询参数 */
export interface PoemListParamsV1 {
  /** 搜索关键词 */
  q?: string
  /** 页码 */
  page?: number
  /** 每页数量 */
  pageSize?: number
  /** 作者筛选（作者 ID 或姓名） */
  author?: string
  /** 朝代筛选 */
  dynasty?: string
  /** 体裁筛选 */
  genre?: string
  /** 韵部筛选 */
  rhyme?: string
  /** 排序方式 */
  sortBy?: SortBy
  /** 排序方向 */
  sortOrder?: SortOrder
}

/** 诗文详情查询参数 */
export interface PoemDetailParamsV1 {
  /** 返回格式：`set`(诗文集) / `txt`(纯文本) */
  format?: 'set' | 'txt'
}

// ========== 搜索接口类型 ==========

/** 搜索结果项 */
export interface SearchScoreDetailV1 {
  /** 最终混合分 */
  finalScore: number
  /** 向量分归一化值 */
  vector: number
  /** 词法命中分 */
  lexical: number
  /** 精确命中分 */
  exact: number
  /** 前缀命中分 */
  prefix: number
  /** 向量原始合并分（score + confidence） */
  vectorRaw: number
}

/** 搜索结果项 */
export interface SearchResultItemV1 {
  /** 资源类型 */
  type: ResourceType
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
  /** 评分明细（当后端启用混合排序时返回） */
  scoreDetail?: SearchScoreDetailV1 | null
  /** 资源是否可用（用于标记向量索引中存在但主数据库中不存在的资源） */
  available?: boolean
}

/** 统一搜索响应 */
export interface UnifiedSearchResponseV1 {
  /** 搜索关键词 */
  query: string
  /** 搜索类型过滤 */
  type: string
  /** 本次实际使用的检索模式 */
  mode?: SearchModeV1
  /** 结果总数 */
  total: number
  /** 当前页结果 */
  items: SearchResultItemV1[]
  /** 各类型命中数量 */
  counts?: Partial<Record<ResourceType, number>>
}

/** 统一搜索查询参数 */
export interface UnifiedSearchParamsV1 {
  /** 搜索关键词 */
  q: string
  /** 资源类型过滤，多个用逗号分隔 */
  type?: string
  /** 检索模式（不传时由后端按环境配置决定） */
  mode?: SearchModeV1
  /** 页码 */
  page?: number
  /** 每页数量，范围 5-30 */
  pageSize?: number
}

// ========== 融合问答接口类型 ==========

/** 融合检索模式 */
export type FusionModeV1 = 'rag' | 'graphrag' | 'hybrid'

/** 融合回答生成策略 */
export type FusionAnswerStrategyV1 = FusionModeV1 | 'llm' | 'template'

/** 多轮对话历史消息 */
export interface FusionConversationMessageV1 {
  role: 'user' | 'assistant'
  content: string
}

/** 融合问答请求参数 */
export interface FusionQueryParamsV1 {
  /** 用户自然语言问题 */
  query: string
  /** 融合模式 */
  mode?: FusionModeV1
  /** 维度过滤 */
  dims?: ResourceType[]
  /** 召回数量 */
  topK?: number
  /** 是否返回 IIIF 命中 */
  includeIiif?: boolean
  /** 多轮对话历史（可选） */
  conversationHistory?: FusionConversationMessageV1[]
  /** 是否跳过服务端融合缓存与 LLM 回答缓存 */
  skipCache?: boolean
  /** 是否输出调试辅助字段 */
  debug?: boolean
}

/** 融合回答 */
export interface FusionAnswerV1 {
  text: string
  confidence: number
  strategy?: FusionAnswerStrategyV1
}

/** 融合实体卡片 */
export interface FusionEntityItemV1 {
  id: string
  type: string
  title: string
  uri: string
  score: number
  snippet: string
  detailLink: string
}

/** 融合证据项 */
export interface FusionCitationV1 {
  citationId: string
  sourceType: string
  uri: string
  title: string
  snippet: string
  scoreDetail?: SearchScoreDetailV1 | null
  anchors?: Record<string, unknown>
}

/** IIIF 命中项 */
export interface FusionIiifMatchV1 {
  matchId: string
  manifest: string
  canvasId?: string
  canvasLabel?: string
  thumbnailUrl?: string
  segmentText?: string
  score: number
  openUrl: string
}

/** 右侧栏联动项 */
export interface FusionSidebarItemV1 {
  itemId: string
  itemType: string
  title: string
  snippet: string
  link: string
}

/** 融合右侧栏 */
export interface FusionSidebarV1 {
  autoOpen: boolean
  defaultTab: 'evidence' | 'iiif'
  items: FusionSidebarItemV1[]
}

/** 查询理解实体提示 */
export interface FusionQueryEntityHintV1 {
  text: string
  type: string
}

/** 查询理解计划 */
export interface FusionQueryPlanV1 {
  originalQuery: string
  normalizedQuery: string
  keywords: string[]
  entities: FusionQueryEntityHintV1[]
  ragQueries: string[]
  fallbackUsed: boolean
  mode: FusionModeV1
}

/** 融合问答响应 */
export interface FusionQueryResponseV1 {
  query: string
  mode: FusionModeV1
  answer: FusionAnswerV1
  entities: FusionEntityItemV1[]
  citations: FusionCitationV1[]
  queryPlan?: FusionQueryPlanV1
  iiifMatches: FusionIiifMatchV1[]
  sidebar: FusionSidebarV1
  trace?: {
    requestId: string
    elapsedMs: number
  }
}

// ========== 导出便捷类型 ==========

/** 人物详情 API 响应 */
export type PersonDetailApiResponse = ApiResponse<PersonDetailV1> | ApiError

/** 诗文详情 API 响应 */
export type PoemDetailApiResponse = ApiResponse<PoemDetailV1> | ApiError

/** 统一搜索 API 响应 */
export type UnifiedSearchApiResponse = ApiResponse<UnifiedSearchResponseV1> | ApiError

/** 融合问答 API 响应 */
export type FusionQueryApiResponse = ApiResponse<FusionQueryResponseV1> | ApiError

// ========== 图书接口类型 ==========

/** 图书详情（v1） */
export interface BookDetailV1 {
  /** 图书 ID */
  id: string
  /** 书名 */
  title: string
  /** 作者 */
  author?: string
  /** 作者 ID */
  authorId?: string
  /** 朝代 */
  dynasty?: string
  /** 内容简介 */
  abstract?: string
  /** 关联诗文 */
  relatedPoems?: PoemCardV1[]
  /** 外部链接 */
  externalUris?: string[]
  /** 原始 JSON-LD 文档 */
  doc?: Record<string, unknown>
  /** 原始文档 URI */
  uri: string
}

/** 图书详情 API 响应 */
export type BookDetailApiResponse = ApiResponse<BookDetailV1> | ApiError

// ========== 古籍接口类型 ==========

/** 古籍详情（v1） */
export interface AncientBookDetailV1 {
  /** 古籍 ID */
  id: string
  /** 书名 */
  title: string
  /** 编纂者 */
  compiler?: string
  /** 来源/版本 */
  source?: string
  /** 朝代/年代 */
  dynasty?: string
  /** IIIF 清单 */
  manifests?: IiifManifestUriV1[]
  /** 所属层级（根 -> 部类 -> 书目） */
  hierarchy?: AncientBookHierarchyNodeV1[]
  /** 卷列表 */
  texts?: AncientBookVolumeV1[]
  /** 当前卷标题（卷级详情时） */
  volumeLabel?: string
  /** 当前卷文本（卷级详情时） */
  volumeText?: string
  /** 当前卷文本状态（卷级详情时） */
  volumeTextStatus?: AncientBookVolumeTextStatusV1
  /** 当前卷文本提示（无正文时） */
  volumeTextMessage?: string
  /** 当前卷文本来源 URI（卷级详情时） */
  volumeTextSourceUri?: string
  /** 摘要 */
  summary?: string
  /** 原始 JSON-LD 文档 */
  doc?: Record<string, unknown>
  /** 原始文档 URI */
  uri: string
}

/** 古籍层级节点（v1） */
export interface AncientBookHierarchyNodeV1 {
  /** 节点层级 */
  level: AncientBookHierarchyLevelV1
  /** 节点 ID */
  id: string
  /** 节点名称 */
  label: string
  /** 对应文档 URI */
  uri?: string
  /** 原始 set id */
  docId?: string
}

/** 古籍卷项（v1） */
export interface AncientBookVolumeV1 {
  /** 卷唯一 ID */
  id: string
  /** 卷标题 */
  label: string
  /** 默认访问 URI（优先 textUri） */
  uri: string
  /** 文本卷 URI */
  textUri?: string
  /** 影像卷 URI */
  objectUri?: string
  /** IIIF 清单 URI */
  iiifUri?: string
  /** 卷序号 */
  volumeNo?: number
}

/** 古籍详情 API 响应 */
export type AncientBookDetailApiResponse = ApiResponse<AncientBookDetailV1> | ApiError

// ========== 地点接口类型 ==========

/** 地点详情（v1） */
export interface PlaceDetailV1 {
  /** 地点 ID */
  id: string
  /** 地名 */
  name: string
  /** 别名/古称 */
  aliases?: string[]
  /** 地理位置 */
  geo?: {
    lat: number
    lng: number
  }
  /** 描述 */
  description?: string
  /** 地点类型 */
  type?: string
  /** 相关人物 */
  relatedPersons?: PersonCardV1[]
  /** 相关诗文 */
  relatedPoems?: PoemCardV1[]
  /** 原始 JSON-LD 文档 */
  doc?: Record<string, unknown>
  /** 原始文档 URI */
  uri: string
}

/** 地点详情 API 响应 */
export type PlaceDetailApiResponse = ApiResponse<PlaceDetailV1> | ApiError

// ========== 概念接口类型 ==========

/** 概念子类型 */
export type ConceptType = 'rhyme' | 'poetic_form' | 'ancient_book_concept' | 'other'

/** 概念详情（v1） */
export interface ConceptDetailV1 {
  /** 概念 ID */
  id: string
  /** 概念名称 */
  label: string
  /** 概念类型 */
  type: ConceptType
  /** 定义说明 */
  definition?: string
  /** 上位概念 */
  broader?: Array<{ id: string; label: string; uri: string }>
  /** 下位概念 */
  narrower?: Array<{ id: string; label: string; uri: string }>
  /** 关联作品数量 */
  relatedWorksCount?: number
  /** 原始 JSON-LD 文档 */
  doc?: Record<string, unknown>
  /** 原始文档 URI */
  uri: string
}

/** 概念卡片（列表项） */
export interface ConceptCardV1 {
  /** 概念 ID */
  id: string
  /** 概念名称 */
  label: string
  /** 概念类型 */
  type: ConceptType
}

/** 概念详情 API 响应 */
export type ConceptDetailApiResponse = ApiResponse<ConceptDetailV1> | ApiError
