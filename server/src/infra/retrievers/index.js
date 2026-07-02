/**
 * Retrievers 统一入口
 *
 * 导出所有检索器组件，提供统一的搜索接口。
 *
 * @module server/src/infra/retrievers
 */

// ============================================================================
// 基类导出
// ============================================================================

export { BaseRetriever } from './baseRetriever.js'

// ============================================================================
// 具体检索器导出
// ============================================================================

export { KeywordRetriever } from './keywordRetriever.js'
export { VectorRetriever } from './vectorRetriever.js'
export { HybridRetriever } from './hybridRetriever.js'

// ============================================================================
// 工厂函数
// ============================================================================

import { BaseRetriever } from './baseRetriever.js'
import { KeywordRetriever } from './keywordRetriever.js'
import { VectorRetriever } from './vectorRetriever.js'
import { HybridRetriever } from './hybridRetriever.js'

/**
 * 检索器类型枚举
 *
 * @enum {string}
 */
export const RetrieverType = {
  KEYWORD: 'keyword',
  VECTOR: 'vector',
  HYBRID: 'hybrid',
}

/**
 * 创建检索器实例
 *
 * @param {string} type - 检索器类型: 'keyword' | 'vector' | 'hybrid'
 * @param {object} gateways - 网关依赖
 * @param {object} config - 配置对象
 * @returns {import('./baseRetriever.js').BaseRetriever} 检索器实例
 */
export function createRetriever(type, gateways, config) {
  switch (type) {
    case RetrieverType.KEYWORD:
      return new KeywordRetriever(gateways, config)
    case RetrieverType.VECTOR:
      return new VectorRetriever(gateways, config)
    case RetrieverType.HYBRID:
      return new HybridRetriever(gateways, config)
    default:
      throw new Error(`未知的检索器类型: ${type}`)
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  BaseRetriever,
  KeywordRetriever,
  VectorRetriever,
  HybridRetriever,
  RetrieverType,
  createRetriever,
}
