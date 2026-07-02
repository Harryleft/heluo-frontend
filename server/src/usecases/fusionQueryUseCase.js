/**
 * 融合查询用例
 *
 * 编排融合查询：分析意图 → 多维检索 → 候选重排 → 生成答案
 * 非流式版本，返回完整结果
 *
 * @module server/src/usecases/fusionQueryUseCase
 */

import { searchConfig } from '../bootstrap/config.js'
import { createSearchOrchestrator } from '../domain/retrieval/index.js'
import {
  fusionQueryCache,
  makeFusionQueryCacheKey,
} from '../utils/cacheManager.js'
import {
  buildTemplateAnswer,
  prepareFusionEvidence,
} from './fusionShared.js'

// ============================================================================
// 参数解析工具（从 domain/fusion/queryPlanner 重导出）
// ============================================================================

export {
  normalizeFusionMode,
  parseFusionDims,
  parseFusionTopK,
  parseFusionBoolean,
  parseFusionConversationHistory,
} from '../domain/fusion/queryPlanner.js'

// ============================================================================
// 用例类
// ============================================================================

/**
 * 创建融合查询用例
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.gateways - 网关依赖
 * @param {object} dependencies.retrievers - 检索器依赖
 * @param {object} dependencies.llmGateway - LLM 网关
 * @returns {object} 用例方法
 */
  export function createFusionQueryUseCase(dependencies) {
  const { gateways, retrievers, llmGateway } = dependencies
  const { mlGetDoc } = gateways

  // 创建搜索编排器
  const searchOrchestrator = createSearchOrchestrator(gateways, retrievers)

  /**
   * 执行融合查询
   *
   * @param {object} params - 查询参数
   * @param {string} params.query - 查询文本
   * @param {string} params.mode - 查询模式
   * @param {string[]} params.dims - 查询维度
   * @param {number} params.topK - 返回数量
   * @param {boolean} params.includeIiif - 是否包含 IIIF
   * @param {Array} params.conversationHistory - 对话历史
   * @param {object} options - 额外选项
   * @returns {Promise<object>} 查询结果
   */
  async function execute(params, options = {}) {
    const {
      query = '',
      mode = 'default',
      dims: requestedDims = ['poem', 'place', 'ancient_book', 'concept'],
      topK = 12,
      includeIiif = true,
      conversationHistory = [],
    } = params

    const { marklogicFetch, marklogicBaseUrl, skipCache = false } = options
    const effectiveSkipCache = Boolean(skipCache)

    if (!query.trim()) {
      throw new Error('query 不能为空')
    }

    // 检查缓存（仅当无对话历史时启用缓存）
    const cacheKey = makeFusionQueryCacheKey({ query, mode, dims: requestedDims, topK, includeIiif })
    if (!effectiveSkipCache && conversationHistory.length === 0) {
      const cached = fusionQueryCache.get(cacheKey)
      if (cached) {
        console.log(`[FusionQuery] 缓存命中: ${cacheKey}`)
        return cached
      }
      console.log(`[FusionQuery] 缓存未命中: ${cacheKey}`)
    }

    const {
      dims,
      queryPlan,
      ranked,
      entities,
      citations,
      iiifMatches,
      sidebarItems,
    } = await prepareFusionEvidence({
      query,
      mode,
      requestedDims,
      topK,
      includeIiif,
      searchMode: searchConfig.mode,
      marklogicFetch,
      marklogicBaseUrl,
      searchScopeData: searchOrchestrator.searchScopeData,
      mlGetDoc,
      settleVariants: false,
    })

    // 8. 生成答案
    let answerText = ''
    let answerConfidence = 0
    let answerStrategy = mode
    let llmElapsedMs

    if (llmGateway?.isLlmEnabled() && entities.length > 0) {
      try {
        const answerResult = await llmGateway.buildAnswer({
          query,
          entities,
          citations,
          iiifMatches,
          dims,
          conversationHistory,
          skipCache: effectiveSkipCache,
        })
        answerText = answerResult.text
        answerConfidence = answerResult.confidence
        answerStrategy = answerResult.source === 'llm' ? 'llm' : mode
        llmElapsedMs = answerResult.llmElapsedMs
      } catch (error) {
        console.error('[FusionQuery] LLM answer generation failed:', error.message)
        answerText = buildTemplateAnswer(query, entities, dims)
        answerConfidence = 0.5
        answerStrategy = 'template'
      }
    } else {
      answerText = entities.length > 0
        ? buildTemplateAnswer(query, entities, dims)
        : '当前未命中稳定证据，请尝试更具体的问题。'
      answerConfidence = entities.length > 0 ? 0.5 : 0
      answerStrategy = 'template'
    }

    const result = {
      query,
      mode,
      answer: {
        text: answerText,
        confidence: answerConfidence,
        strategy: answerStrategy,
      },
      entities,
      citations,
      queryPlan,
      iiifMatches,
      sidebar: {
        autoOpen: true,
        defaultTab: 'evidence',
        items: sidebarItems,
      },
      trace: {
        slots: queryPlan.slots || null,
        rerank: ranked[0]?._scoreDetail?.constraintBreakdown
          ? { top1ConstraintBreakdown: ranked[0]._scoreDetail.constraintBreakdown }
          : undefined,
        llm: llmGateway?.isLlmEnabled() && answerStrategy === 'llm'
          ? { elapsedMs: llmElapsedMs }
          : undefined,
      },
    }

    // 存入缓存（仅当无对话历史时）
    if (!effectiveSkipCache && conversationHistory.length === 0) {
      fusionQueryCache.set(cacheKey, result)
      console.log(`[FusionQuery] 结果已缓存: ${cacheKey}`)
    }

    return result
  }

  return {
    execute,
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createFusionQueryUseCase,
}
