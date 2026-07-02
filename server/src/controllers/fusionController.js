/**
 * 融合问答控制器
 *
 * 处理 /api/v1/fusion/query 和 /api/v1/fusion/stream 请求
 * 负责参数解析、调用 UseCase、响应格式化（含 SSE 流式响应）
 *
 * @module server/src/controllers/fusionController
 */

import { apiV1Response, apiV1Error } from './healthController.js'

// ============================================================================
// 参数解析工具（从 domain/fusion/queryPlanner.js 重新导出，保持统一）
// ============================================================================

export {
  normalizeFusionMode,
  parseFusionDims,
  parseFusionTopK,
  parseFusionBoolean,
  parseFusionConversationHistory,
} from '../domain/fusion/queryPlanner.js'

// 从 queryPlanner.js 导入以便内部使用
import {
  normalizeFusionMode,
  parseFusionDims,
  parseFusionTopK,
  parseFusionBoolean,
  parseFusionConversationHistory,
} from '../domain/fusion/queryPlanner.js'

// ============================================================================
// 控制器工厂
// ============================================================================

/**
 * 创建融合问答控制器
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.useCases - 用例依赖
 * @param {object} dependencies.config - 配置依赖
 * @param {string} dependencies.config.marklogicBaseUrl - MarkLogic 基础 URL
 * @param {number} dependencies.config.scopeTimeoutMs - 超时时间
 * @param {number} dependencies.config.vectorTimeoutMs - 向量搜索超时时间
 * @param {Function} dependencies.marklogicFetch - MarkLogic fetch 函数
 * @returns {object} 控制器方法
 */
export function createFusionController(dependencies) {
  const { useCases, config, marklogicFetch } = dependencies
  const { fusionQuery, fusionStream } = useCases
  const { scopeTimeoutMs, marklogicBaseUrl, vectorTimeoutMs } = config

  return {
    /**
     * POST /api/v1/fusion/query
     * 融合问答（非流式）
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async query(req, res) {
      const startAt = Date.now()
      const requestId = `fusion-${startAt}-${Math.random().toString(36).slice(2, 8)}`

      try {
        // 参数解析
        const rawQuery = String(req.body?.query || '').trim()
        if (!rawQuery) {
          throw apiV1Error('INVALID_PARAMS', 'query 不能为空', null, 400)
        }

        const mode = normalizeFusionMode(req.body?.mode)
        const requestedDims = parseFusionDims(req.body?.dims)
        const topK = parseFusionTopK(req.body?.topK)
        const includeIiif = parseFusionBoolean(req.body?.includeIiif, true)
        const skipCache = parseFusionBoolean(req.body?.skipCache, false)
        const conversationHistory = parseFusionConversationHistory(req.body?.conversationHistory)

        // 调用 UseCase
        const result = await fusionQuery.execute({
          query: rawQuery,
          mode,
          dims: requestedDims,
          topK,
          includeIiif,
          conversationHistory,
        }, {
          marklogicFetch,
          marklogicBaseUrl,
          skipCache,
        })

        const elapsedMs = Date.now() - startAt

        res.json(
          apiV1Response({
            query: rawQuery,
            mode,
            answer: result.answer,
            entities: result.entities,
            citations: result.citations,
            queryPlan: result.queryPlan,
            iiifMatches: result.iiifMatches,
            sidebar: result.sidebar,
            trace: {
              ...(result.trace || {}),
              requestId,
              elapsedMs,
            },
          })
        )
      } catch (error) {
        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        console.error('Error in POST /api/v1/fusion/query:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * POST /api/v1/fusion/stream
     * 融合问答流式响应（SSE）
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async stream(req, res) {
      const startAt = Date.now()
      const requestId = `fusion-stream-${startAt}-${Math.random().toString(36).slice(2, 8)}`
      let streamClosed = false

      // 监听连接关闭事件
      req.on('aborted', () => {
        streamClosed = true
      })
      res.on('close', () => {
        streamClosed = true
      })

      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')

      const isStreamWritable = () => !streamClosed && !res.writableEnded && !res.destroyed

      /**
       * 发送 SSE 事件
       * @param {string} event - 事件类型
       * @param {object} data - 数据对象
       * @returns {boolean} 是否发送成功
       */
      const sendEvent = (event, data) => {
        if (!isStreamWritable()) return false
        try {
          res.write(`event: ${event}\n`)
          res.write(`data: ${JSON.stringify(data)}\n\n`)
          return true
        } catch {
          streamClosed = true
          return false
        }
      }

      /**
       * 结束流
       */
      const finishStream = () => {
        if (!isStreamWritable()) return
        try {
          res.end()
        } catch {
          streamClosed = true
        }
      }

      try {
        // 参数解析
        const rawQuery = String(req.body?.query || '').trim()
        if (!rawQuery) {
          sendEvent('error', { code: 'INVALID_PARAMS', message: 'query 不能为空' })
          finishStream()
          return
        }

        const mode = normalizeFusionMode(req.body?.mode)
        const requestedDims = parseFusionDims(req.body?.dims)
        const topK = parseFusionTopK(req.body?.topK)
        const includeIiif = parseFusionBoolean(req.body?.includeIiif, true)
        const conversationHistory = parseFusionConversationHistory(req.body?.conversationHistory)

        // 构建适配 UseCase 期望的回调接口
        const callbacks = {
          onStatus: (data) => sendEvent('status', data),
          onEvidence: (data) => sendEvent('evidence', data),
          onChunk: (data) => sendEvent('chunk', data),
          onDone: (data) => {
            sendEvent('done', data)
            finishStream()
          },
          onError: (data) => {
            sendEvent('error', data)
            finishStream()
          },
          isClosed: () => !isStreamWritable(),
        }

        const options = {
          timeoutMs: scopeTimeoutMs,
          marklogicFetch,
          marklogicBaseUrl,
          vectorTimeoutMs,
        }

        // 调用 UseCase（流式）
        await fusionStream.execute(
          {
            query: rawQuery,
            mode,
            dims: requestedDims,
            topK,
            includeIiif,
            conversationHistory,
          },
          callbacks,
          options,
        )
      } catch (error) {
        console.error('Error in POST /api/v1/fusion/stream:', error)
        if (isStreamWritable()) {
          sendEvent('error', { code: 'INTERNAL_ERROR', message: '服务器内部错误' })
          finishStream()
        }
      }
    },

  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createFusionController,
  normalizeFusionMode,
  parseFusionDims,
  parseFusionTopK,
  parseFusionBoolean,
  parseFusionConversationHistory,
}
