/**
 * OverviewTab 组件类型定义
 *
 * 包含 OverviewTab 及相关子组件所需的类型接口
 *
 * @module OverviewTab
 */

import type { ReactNode } from 'react'
import type { BiographyData } from '@/lib/parse/data/biographyParser'
import type { DetailResourceType } from '@/features/details/utils/uriParser'
import type { DetailViewModel, InternalLinkViewModel, SearchResultItemV1 } from '@/types/api'

// ============================================================================
// 类型定义
// ============================================================================

/** 支持 CSS 变量的内联样式类型 */
export type InlineStyleWithVar = Record<string, string | number | undefined>

/** 相关度等级配置 */
export interface RelevanceConfig {
  /** 1-5，5 为最高相关度 */
  level: number
  /** CSS 缩进值 */
  indent: string
  /** 实心圆点数量 */
  filledDots: number
}

/** 主组件 Props */
export interface OverviewTabProps {
  data: DetailViewModel
  summary: {
    title: string
    snippet: string
    biography?: BiographyData
  }
  entity?: Record<string, unknown>
  internalLinks?: InternalLinkViewModel[]
  externalUris?: string[]
  query?: string
  resourceType?: DetailResourceType
  className?: string
  /** 渲染到主栏顶部的外部内容（如 Mirador 查看器），与侧栏共享 grid 布局 */
  mainContent?: ReactNode
}

/** 类型特定区块 Props */
export interface TypeSpecificSectionProps {
  resourceType?: DetailResourceType
  data: DetailViewModel
  summary: { snippet: string; biography?: BiographyData }
  entity?: Record<string, unknown>
}

/** 向量相关卡片 Props */
export interface VectorRelatedCardProps {
  items: SearchResultItemV1[]
  state: 'idle' | 'loading' | 'success' | 'error'
  anchorId?: string
}

/** 内部链接卡片 Props */
export interface InternalLinksCardProps {
  items: InternalLinkViewModel[]
}

/** 分组后的人物关系（按原始关系类型） */
export interface RelationGroup {
  relationType: string
  items: InternalLinkViewModel[]
  colorTheme: string
  defaultExpanded: boolean
}

/** 图书 Hero 区块 Props */
export interface BookHeroSectionProps {
  title: string
  snippet: string
  isbn: string
  coverUrl?: string
}

/** 相关资源选择上下文 */
export interface RelatedPickContext {
  normalizedCurrentUri: string
  resourceType: DetailResourceType
  currentTitle: string
  currentIsbn: string
  currentResourceKey: string
}

/** 地点上级链接视图 */
export interface PlaceParentLinkView {
  name: string
  route: string
}
