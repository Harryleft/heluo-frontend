// ============================================================
// 前端页面视图模型类型
// ============================================================

/**
 * 内部关联链接
 */
export interface InternalLinkViewModel {
  label: string
  uri: string
}

/**
 * 古籍层级枚举（视图层）
 */
export type AncientBookHierarchyLevelViewModel = 'root' | 'department' | 'entry' | 'unknown'

/**
 * 古籍当前卷文本状态（视图层）
 */
export type AncientBookVolumeTextStatusViewModel = 'available' | 'missing'

/**
 * 诗文校勘注释（视图层）
 */
export interface PoemCommentViewModel {
  /** 对应的原文行 */
  text?: string
  /** 注释内容 */
  comment: string
}

/**
 * 诗文详情展示模型
 */
export interface PoemDetailViewModel {
  title: string
  author: string
  authorId?: string
  dynasty?: string
  genre?: string
  genreUri?: string
  rhyme?: string
  rhymeUri?: string
  source?: string
  fullText: string
  textUri?: string
  comments?: PoemCommentViewModel[]
  set?: {
    id: string
    uri: string
    label: string
  }
  relatedPlaces?: Array<{
    label: string
    uri: string
    lat?: number
    lng?: number
  }>
}

/**
 * 古籍卷级展示模型
 */
export interface AncientBookVolumeViewModel {
  id: string
  label: string
  uri: string
  textUri?: string
  objectUri?: string
  iiifUri?: string
  volumeNo?: number
}

/**
 * 古籍层级展示模型
 */
export interface AncientBookHierarchyNodeViewModel {
  level: AncientBookHierarchyLevelViewModel
  id: string
  label: string
  uri?: string
  docId?: string
}

/**
 * 详情页展示模型
 */
export interface DetailViewModel {
  uri: string
  title: string
  summary: string
  poemDetail?: PoemDetailViewModel
  ancientBookHierarchy?: AncientBookHierarchyNodeViewModel[]
  ancientBookVolumes?: AncientBookVolumeViewModel[]
  ancientBookVolumeLabel?: string
  ancientBookVolumeText?: string
  ancientBookVolumeTextStatus?: AncientBookVolumeTextStatusViewModel
  ancientBookVolumeTextMessage?: string
  ancientBookVolumeTextSourceUri?: string
  internalLinks: InternalLinkViewModel[]
  externalUris: string[]
  doc: Record<string, unknown>
}

/**
 * 融合页卡片展示模型
 */
export interface FusionCardViewModel {
  uri: string
  title: string
  snippet: string
  score: number
  type: string
}
