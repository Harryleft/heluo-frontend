/**
 * OverviewTab 常量定义
 *
 * 包含 OverviewTab 组件使用的所有常量
 *
 * @module OverviewTab
 */

import type { RelevanceConfig } from '@/features/details/types/overviewTab'

/** 最大外部链接显示数 */
export const MAX_EXTERNAL_LINKS = 8

/** 最大推荐资源数 */
export const MAX_RELATED_RESOURCES = 5

/** 相关资源获取数量（增大以确保有足够数据供类型配额选择） */
export const RELATED_RESOURCE_FETCH_SIZE = 20

/** 搜索模式 */
export const RELATED_SEARCH_MODE = 'vector'

/** 推荐资源搜索类型（排除 person，因为向量索引中的人物可能不存在于主数据库） */
export const RELATED_RESOURCE_TYPES = 'poem,book,place,concept,ancient_book'
export const RELATED_RESOURCE_FALLBACK_TYPES = 'person,poem,book,place,concept,ancient_book'

/** 图书多样性补充搜索类型 */
export const BOOK_DIVERSITY_RESOURCE_TYPES = 'person,poem,place,concept,ancient_book'

/** AI 介绍 API 端点 */
export const PERSON_AI_INTRO_ENDPOINT = '/api/v1/persons/ai-intro'
export const POEM_AI_ANALYSIS_ENDPOINT = '/api/v1/poems/ai-analysis'

/** AI 介绍空消息 */
export const AI_INTRO_EMPTY_MESSAGE = '暂未生成介绍文本。'
export const POEM_AI_ANALYSIS_EMPTY_MESSAGE = '暂未生成赏析文本。'

/** AI 介绍错误消息 */
export const AI_INTRO_FALLBACK_ERROR_MESSAGE = '生成失败，请稍后重试。'
export const POEM_AI_ANALYSIS_FALLBACK_ERROR_MESSAGE = '赏析生成失败，请稍后重试。'

/** 圆点位置常量，用于相关度指示器渲染 */
export const DOT_POSITIONS = [1, 2, 3, 4, 5] as const

/** 关系类型对应的语义颜色（简化为 3 种） */
export const RELATION_TYPE_COLORS: Record<string, string> = {
  // 核心关系 - 主色（深蓝）
  '父': 'primary',
  '母': 'primary',
  '子': 'primary',
  '女': 'primary',
  '兄弟': 'primary',
  '姐妹': 'primary',
  '配偶': 'primary',
  '师': 'primary',
  '徒': 'primary',
  // 社交关系 - 辅助色（翠绿）
  '友': 'secondary',
  '诗友': 'secondary',
  '友人': 'secondary',
  '朋友': 'secondary',
  '同乡': 'secondary',
  '赠诗': 'secondary',
  '收到赠诗': 'secondary',
  '合作': 'secondary',
  // 职业/时代 - 第三色（中性灰）
  '同僚': 'tertiary',
  '门生': 'tertiary',
  '学生': 'tertiary',
  '同代': 'tertiary',
  '相关': 'tertiary',
}

/**
 * 相关度阈值配置
 * 阈值基于归一化分数（0-1范围）：
 * - 0.8+ : 高度相关（同主题、直接引用）
 * - 0.6+ : 较相关（同作者、同时期）
 * - 0.4+ : 中等相关（同类型、同地域）
 * - 0.2+ : 低相关（间接关联）
 * - 0+   : 最低相关（仅向量相似）
 */
export const RELEVANCE_THRESHOLDS: Array<{ min: number; config: RelevanceConfig }> = [
  { min: 0.8, config: { level: 5, indent: '0', filledDots: 5 } },
  { min: 0.6, config: { level: 4, indent: '0.5rem', filledDots: 4 } },
  { min: 0.4, config: { level: 3, indent: '1rem', filledDots: 3 } },
  { min: 0.2, config: { level: 2, indent: '1.5rem', filledDots: 2 } },
  { min: 0, config: { level: 1, indent: '2rem', filledDots: 1 } },
]

/**
 * 类型配额配置
 * 确保推荐资源的多样性，避免单一类型占据全部推荐位
 */
export const TYPE_QUOTA: Record<string, number> = {
  poem: 2, // 诗词是核心内容
  book: 2, // 相关书籍
  place: 1, // 相关地点
  ancient_book: 1, // 古籍（备用）
  concept: 1, // 概念（备用）
}

/**
 * 回填优先级（当某类型配额用不完时，按此顺序回填）
 * 确保即使某类型无数据，也能保持合理的多样性分布
 */
export const TYPE_BACKFILL_PRIORITY = ['poem', 'book', 'place', 'ancient_book', 'concept']
