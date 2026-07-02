/**
 * 向量检索器
 *
 * 基于 Embedding 向量相似度实现语义检索。
 * 使用 embeddingGateway 获取查询向量，通过 vectorSearchService 执行搜索。
 *
 * @module server/src/infra/retrievers/vectorRetriever
 */

import { BaseRetriever } from './baseRetriever.js'
import { getEmbedding } from '../gateways/embeddingGateway.js'
import { mlVectorSearch } from '../../services/vectorSearchService.js'
import { getMarklogicConfig } from '../gateways/marklogicGateway.js'

// ============================================================================
// 向量检索器类
// ============================================================================

/**
 * 向量检索器
 *
 * 使用向量相似度进行语义搜索。
 */
export class VectorRetriever extends BaseRetriever {
  /**
   * @param {object} gateways - 网关依赖
   * @param {object} gateways.marklogic - MarkLogic 网关（提供 fetch 函数）
   * @param {object} gateways.embedding - Embedding 网关
   * @param {object} config - 配置对象
   */
  constructor(gateways, config) {
    super(gateways, config)
    this.name = 'vector'
  }

  /**
   * 获取 MarkLogic fetch 函数
   *
   * @returns {Function} fetch 函数
   */
  getMarklogicFetch() {
    // 如果网关提供了自定义 fetch，使用它；否则使用默认配置
    if (this.gateways?.marklogic?.fetch) {
      return this.gateways.marklogic.fetch
    }
    // 返回 null，由 vectorSearchService 处理默认情况
    return null
  }

  /**
   * 获取 MarkLogic 基础 URL
   *
   * @returns {string} 基础 URL
   */
  getMarklogicBaseUrl() {
    const mlConfig = getMarklogicConfig()
    return mlConfig.baseUrl
  }

  /**
   * 执行向量搜索
   *
   * @param {string} query - 查询文本
   * @param {string} scope - 实体类型
   * @param {object} options - 搜索选项
   * @param {number} [options.pageLength=20] - 每页结果数（对应 topK）
   * @returns {Promise<{rows: Array, total: number}>} 搜索结果
   */
  async search(query, scope, options = {}) {
    const { pageLength = 20 } = options

    try {
      // 1. 获取查询向量
      const queryVector = await getEmbedding(query)
      if (!queryVector || queryVector.length === 0) {
        console.warn(`[VectorRetriever] 无法获取查询向量: ${query}`)
        return { rows: [], total: 0 }
      }

      // 2. 执行向量搜索
      const marklogicFetch = this.getMarklogicFetch()
      const marklogicBaseUrl = this.getMarklogicBaseUrl()

      const vectorResults = await mlVectorSearch(
        scope,
        queryVector,
        { topK: pageLength, queryText: query },
        marklogicFetch,
        marklogicBaseUrl,
      )

      // 3. 转换为统一格式
      const rows = vectorResults.map((result) => ({
        uri: result.uri,
        id: result.uri,
        title: result.title,
        name: result.title,
        _label: result.title,
        snippet: result.snippet,
        type: result.type,
        score: result.score,
        confidence: result.confidence,
        similarity: result.similarity,
        vectorScore: result.similarity,
        source: 'vector',
        // 保留向量搜索的额外字段
        poemId: result.poemId,
        author: result.author,
        dynasty: result.dynasty,
        fullText: result.fullText,
        frontendUrl: result.frontendUrl,
      }))

      return { rows, total: rows.length }
    } catch (error) {
      console.error('[VectorRetriever] 向量搜索失败:', error.message)
      return { rows: [], total: 0 }
    }
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default VectorRetriever
