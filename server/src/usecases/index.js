/**
 * UseCases 层统一入口
 *
 * 编排 domain 和 infra 层，提供业务用例接口。
 * 通过依赖注入解耦，不依赖 HTTP 层。
 *
 * ## 架构原则
 *
 * 1. UseCases 层依赖 domain 层（业务规则）
 * 2. UseCases 层依赖 infra 层（外部服务）
 * 3. UseCases 层不依赖 HTTP 层（routes/controllers）
 * 4. 通过构造函数注入依赖
 *
 * ## 模块结构
 *
 * - searchUnifiedUseCase: 统一搜索用例
 * - fusionQueryUseCase: 融合查询用例（非流式）
 * - fusionStreamUseCase: 流式融合用例（SSE）
 * - getDetailUseCase: 详情获取用例
 *
 * @module server/src/usecases
 */

// ============================================================================
// 搜索用例
// ============================================================================

export {
  createSearchUnifiedUseCase,
  parsePaginationParams,
  parseTypeFilter,
  parseSearchMode,
} from './searchUnifiedUseCase.js'

// ============================================================================
// 融合查询用例
// ============================================================================

export {
  createFusionQueryUseCase,
  normalizeFusionMode,
  parseFusionDims,
  parseFusionTopK,
  parseFusionBoolean,
  parseFusionConversationHistory,
} from './fusionQueryUseCase.js'

// ============================================================================
// 流式融合用例
// ============================================================================

export { createFusionStreamUseCase } from './fusionStreamUseCase.js'

// ============================================================================
// 详情获取用例
// ============================================================================

export { createGetDetailUseCase } from './getDetailUseCase.js'

// ============================================================================
// 工厂函数
// ============================================================================

import { createSearchUnifiedUseCase } from './searchUnifiedUseCase.js'
import { createFusionQueryUseCase } from './fusionQueryUseCase.js'
import { createFusionStreamUseCase } from './fusionStreamUseCase.js'
import { createGetDetailUseCase } from './getDetailUseCase.js'

/**
 * 创建所有用例实例
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.gateways - 网关依赖（marklogicGateway, embeddingGateway, llmGateway）
 * @param {object} dependencies.retrievers - 检索器依赖（keywordRetriever, vectorRetriever, hybridRetriever）
 * @returns {object} 所有用例实例
 *
 * @example
 * const useCases = createUseCases({
 *   gateways: {
 *     mlGetJson,
 *     mlGetDoc,
 *     mlSearchByDirectory,
 *     mlSearchByCollection,
 *     getEmbedding,
 *   },
 *   retrievers: {
 *     getEmbedding,
 *     mlVectorSearch,
 *     isVectorSearchEnabled,
 *   },
 * })
 *
 * // 使用搜索用例
 * const searchResult = await useCases.searchUnified.execute({ query: '杜甫', type: 'all' })
 *
 * // 使用融合查询用例
 * const fusionResult = await useCases.fusionQuery.execute({ query: '杜甫的诗歌风格' })
 *
 * // 使用详情获取用例
 * const detailResult = await useCases.getDetail.execute({ uri: '/processed/json-ld/person/xxx.json' })
 */
export function createUseCases(dependencies) {
  const { gateways, retrievers } = dependencies

  // 提取 LLM 网关（如果存在）
  const llmGateway = gateways.llmGateway || null

  return {
    // 统一搜索用例
    searchUnified: createSearchUnifiedUseCase({
      gateways,
      retrievers,
    }),

    // 融合查询用例（非流式）
    fusionQuery: createFusionQueryUseCase({
      gateways,
      retrievers,
      llmGateway,
    }),

    // 流式融合用例（SSE）
    fusionStream: createFusionStreamUseCase({
      gateways,
      retrievers,
      llmGateway,
    }),

    // 详情获取用例
    getDetail: createGetDetailUseCase({
      gateways,
      retrievers,
    }),
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createSearchUnifiedUseCase,
  createFusionQueryUseCase,
  createFusionStreamUseCase,
  createGetDetailUseCase,
  createUseCases,
}
