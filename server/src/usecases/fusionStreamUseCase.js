/**
 * 流式融合用例
 *
 * 编排流式融合：SSE 事件流生成
 * 逐步发送检索进度、候选结果、最终答案
 * 复用 fusionQueryUseCase 的核心逻辑
 *
 * @module server/src/usecases/fusionStreamUseCase
 */

import { searchConfig } from '../bootstrap/config.js'
import { createSearchOrchestrator } from '../domain/retrieval/index.js'
import {
  normalizeFusionMode,
  parseFusionDims,
  parseFusionTopK,
  parseFusionBoolean,
  parseFusionConversationHistory,
} from '../domain/fusion/index.js'
import { buildTemplateAnswer, prepareFusionEvidence } from './fusionShared.js'

// ============================================================================
// 用例类
// ============================================================================

/**
 * 创建流式融合用例
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.gateways - 网关依赖
 * @param {object} dependencies.retrievers - 检索器依赖
 * @param {object} dependencies.llmGateway - LLM 网关
 * @returns {object} 用例方法
 */
export function createFusionStreamUseCase(dependencies) {
  const { gateways, retrievers, llmGateway } = dependencies
  const { mlGetDoc } = gateways

  // 创建搜索编排器
  const searchOrchestrator = createSearchOrchestrator(gateways, retrievers)

  /**
   * 执行流式融合查询
   *
   * @param {object} params - 查询参数
   * @param {object} callbacks - SSE 回调
   * @param {object} options - 额外选项
   * @returns {Promise<void>}
   */
  async function execute(params, callbacks, options = {}) {
    const {
      query = '',
      mode = 'default',
      dims: requestedDims = ['poem', 'place', 'ancient_book', 'concept'],
      topK = 12,
      includeIiif = true,
      conversationHistory = [],
    } = params

    const {
      onStatus,
      onEvidence,
      onChunk,
      onDone,
      onError,
      isClosed,
    } = callbacks || {}

    const { marklogicFetch, marklogicBaseUrl, timeoutMs = searchConfig.scopeTimeoutMs } = options
    const startAt = Date.now()
    const requestId = `fusion-stream-${startAt}-${Math.random().toString(36).slice(2, 8)}`

    // 辅助函数：安全发送事件
    const sendStatus = (stage, message) => {
      if (isClosed?.()) return false
      onStatus?.({ stage, message })
      return true
    }

    const sendEvidence = (data) => {
      if (isClosed?.()) return false
      onEvidence?.(data)
      return true
    }

    const sendChunk = (content) => {
      if (isClosed?.()) return false
      onChunk?.({ content })
      return true
    }

    const sendDone = (data) => {
      if (isClosed?.()) return false
      onDone?.(data)
      return true
    }

    const sendError = (code, message, detail) => {
      if (isClosed?.()) return false
      onError?.({ code, message, detail })
      return true
    }

    try {
      if (!query.trim()) {
        sendError('INVALID_PARAMS', 'query 不能为空')
        return
      }

      // 1. 发送检索开始事件
      sendStatus('retrieving', '正在检索相关内容...')

      // 2. 多维检索（带超时处理）
      const {
        dims,
        queryPlan,
        scopeResults,
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
        settleVariants: true,
      })

      // 检查是否所有检索都失败
      const totalFailedVariants = scopeResults.reduce((sum, item) => sum + Number(item.failedCount || 0), 0)
      const totalTimeoutVariants = scopeResults.reduce((sum, item) => sum + Number(item.timeoutCount || 0), 0)
      const totalDegradedVariants = scopeResults.reduce((sum, item) => sum + Number(item.degradedCount || 0), 0)
      const totalSuccessVariants = scopeResults.reduce((sum, item) => sum + Number(item.successCount || 0), 0)

      if (totalSuccessVariants === 0 && totalFailedVariants > 0) {
        const errorCode = totalTimeoutVariants > 0 ? 'TIMEOUT' : 'UPSTREAM_UNAVAILABLE'
        throw Object.assign(new Error('FUSION_RETRIEVAL_UNAVAILABLE'), { code: errorCode })
      }

      // 只要出现上游降级迹象，直接进入降级响应，避免继续输出模板答案误导用户
      if (totalFailedVariants > 0 || totalTimeoutVariants > 0 || totalDegradedVariants > 0) {
        sendStatus('degraded', '检索服务暂不可用，已切换为降级响应。')
        sendEvidence({
          entities: [],
          citations: [],
          iiifMatches: [],
          sidebar: { autoOpen: true, defaultTab: 'evidence', items: [] },
          queryPlan,
        })
        sendDone({
          text: '当前检索服务暂不可用，请稍后重试。',
          confidence: 0,
          strategy: 'degraded',
          trace: { requestId, elapsedMs: Date.now() - startAt, slots: queryPlan.slots || null },
        })
        return
      }

      // 3. 发送检索结果事件
      sendEvidence({
        entities,
        citations,
        iiifMatches,
        sidebar: { autoOpen: true, defaultTab: 'evidence', items: sidebarItems },
        queryPlan,
      })

      // 4. 发送生成开始事件
      sendStatus('generating', '正在生成回答...')

      // 5. 流式生成答案
      if (llmGateway?.isLlmEnabled() && entities.length > 0) {
        try {
          const result = await llmGateway.generateStream(
            { query, entities, citations, iiifMatches, conversationHistory },
            (content) => {
              if (!sendChunk(content)) {
                const clientClosedError = new Error('SSE_CLIENT_CLOSED')
                clientClosedError.code = 'CLIENT_CLOSED'
                throw clientClosedError
              }
            },
          )

          if (result.success) {
            // 确保诗文列表覆盖
            const normalizedText = llmGateway.ensurePoemCoverage
              ? llmGateway.ensurePoemCoverage({ query, entities, citations, answerText: result.text })
              : result.text

            sendDone({
              text: normalizedText,
              confidence: 0.85,
              strategy: 'llm',
              trace: {
                requestId,
                elapsedMs: Date.now() - startAt,
                slots: queryPlan.slots || null,
                rerank: ranked[0]?._scoreDetail?.constraintBreakdown
                  ? { top1ConstraintBreakdown: ranked[0]._scoreDetail.constraintBreakdown }
                  : undefined,
                llm: { elapsedMs: result.elapsedMs },
              },
            })
          } else {
            // LLM 失败，降级到模板
            const templateText = buildTemplateAnswer(query, entities, dims)
            sendDone({
              text: templateText,
              confidence: 0.5,
              strategy: 'template',
              fallbackReason: result.error,
              trace: {
                requestId,
                elapsedMs: Date.now() - startAt,
                slots: queryPlan.slots || null,
                rerank: ranked[0]?._scoreDetail?.constraintBreakdown
                  ? { top1ConstraintBreakdown: ranked[0]._scoreDetail.constraintBreakdown }
                  : undefined,
              },
            })
          }
        } catch (streamError) {
          if (streamError.code === 'CLIENT_CLOSED') {
            console.log('[FusionStream] Client closed connection')
            return
          }
          console.error('[FusionStream] LLM stream error:', streamError.message)
          const templateText = buildTemplateAnswer(query, entities, dims)
          sendDone({
            text: templateText,
            confidence: 0.5,
            strategy: 'template',
            fallbackReason: streamError.message,
            trace: {
              requestId,
              elapsedMs: Date.now() - startAt,
              slots: queryPlan.slots || null,
              rerank: ranked[0]?._scoreDetail?.constraintBreakdown
                ? { top1ConstraintBreakdown: ranked[0]._scoreDetail.constraintBreakdown }
                : undefined,
            },
          })
        }
      } else {
        // 未启用 LLM 或无实体
        const templateText = entities.length > 0
          ? buildTemplateAnswer(query, entities, dims)
          : '当前未命中稳定证据，请尝试更具体的问题。'
        sendDone({
          text: templateText,
          confidence: entities.length > 0 ? 0.5 : 0,
          strategy: 'template',
          trace: {
            requestId,
            elapsedMs: Date.now() - startAt,
            slots: queryPlan.slots || null,
            rerank: ranked[0]?._scoreDetail?.constraintBreakdown
              ? { top1ConstraintBreakdown: ranked[0]._scoreDetail.constraintBreakdown }
              : undefined,
          },
        })
      }
    } catch (error) {
      console.error('[FusionStream] Error:', error.message)

      const errorText = String(error?.message || error || '')
      const isTimeoutError = error?.code === 'TIMEOUT' || /timeout|timed out/i.test(errorText)
      const isUpstreamUnavailableError = error?.code === 'UPSTREAM_UNAVAILABLE'

      if (isTimeoutError || isUpstreamUnavailableError || /fetch failed|econnrefused|enotfound|etimedout|ehostunreach/i.test(errorText)) {
        // 降级响应
        sendStatus('degraded', '检索服务暂不可用，已切换为降级响应。')
        sendEvidence({
          entities: [],
          citations: [],
          iiifMatches: [],
          sidebar: { autoOpen: true, defaultTab: 'evidence', items: [] },
        })
        sendDone({
          text: '当前检索服务暂不可用，请稍后重试。',
          confidence: 0,
          strategy: 'degraded',
          trace: { requestId, elapsedMs: Date.now() - startAt },
        })
      } else {
        sendError('INTERNAL_ERROR', '服务器内部错误', String(error))
      }
    }
  }

  return {
    execute,
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createFusionStreamUseCase,
}
