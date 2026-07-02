/**
 * LLM 服务模块入口
 *
 * 统一导出所有 LLM 服务功能
 *
 * @module server/src/services/llm
 */

// ========================================
// 配置管理
// ========================================
import {
  resolveLlmConfig,
  isLlmEnabled,
  getLlmConfig,
  buildLlmRequestHeaders,
  buildLlmRequestBody,
} from './config.js'

// ========================================
// 提示词构建
// ========================================
import {
  buildRagPrompt,
  buildPoemAiAnalysisPrompt,
  buildPoemAiAnalysisFallback,
  normalizePoemAnalysisInput,
} from './prompts/index.js'

// ========================================
// 降级策略
// ========================================
import {
  ensurePoemListCoverage,
  buildPersonAiIntroFallback,
} from './fallback/index.js'

// ========================================
// 工具函数
// ========================================
import {
  normalizePlainText,
  extractPersonReferredContents,
  clipEvidenceText,
} from './utils/index.js'

// ========================================
// 缓存管理
// ========================================
import {
  llmAnswerCache,
  makeLlmAnswerCacheKey,
} from '../../utils/cacheManager.js'

// ========================================
// LLM 客户端
// ========================================
import { LlmClient } from './client.js'

// 创建默认客户端实例
const defaultClient = new LlmClient()

// ========================================
// 核心生成函数
// ========================================

/**
 * 调用 LLM 生成回答
 *
 * @param {object} params
 * @param {string} params.query - 用户问题
 * @param {Array} params.entities - 实体列表
 * @param {Array} params.citations - 证据列表
 * @param {Array} [params.iiifMatches] - IIIF 匹配结果
 * @param {Array} [params.conversationHistory] - 对话历史
 * @param {boolean} [params.skipCache] - 是否跳过缓存
 * @returns {Promise<{success: boolean, text: string, error?: string, elapsedMs?: number, usage?: object, fromCache?: boolean}>}
 */
export async function generateLlmAnswer(params) {
  const result = await defaultClient.generate(params)

  // 后处理：确保诗单覆盖
  if (result.success && result.text) {
    const normalizedText = ensurePoemListCoverage({
      query: params.query,
      entities: params.entities,
      citations: params.citations,
      answerText: result.text,
    })
    result.text = normalizedText
  }

  return result
}

/**
 * 调用 LLM 生成流式回答（SSE）
 *
 * @param {object} params
 * @param {string} params.query - 用户问题
 * @param {Array} params.entities - 实体列表
 * @param {Array} params.citations - 证据列表
 * @param {Array} [params.iiifMatches] - IIIF 匹配结果
 * @param {Array} [params.conversationHistory] - 对话历史
 * @param {function} onChunk - 每次收到数据块的回调
 * @returns {Promise<{success: boolean, text: string, error?: string, elapsedMs?: number}>}
 */
export async function generateLlmAnswerStream(params, onChunk) {
  return defaultClient.generateStream(params, onChunk)
}

/**
 * 基于自定义提示词调用 LLM 生成文本
 *
 * @param {object} params
 * @param {string} params.systemPrompt - 系统提示词
 * @param {string} params.userPrompt - 用户提示词
 * @param {number} [params.maxTokens] - 最大 token 数
 * @param {number} [params.temperature] - 采样温度
 * @returns {Promise<{success: boolean, text: string, error?: string, elapsedMs?: number, usage?: object}>}
 */
export async function generateLlmTextByPrompt(params) {
  return defaultClient.generateByPrompt(params)
}

/**
 * 构建融合问答回答（带降级）
 *
 * @param {object} params
 * @param {string} params.query - 用户问题
 * @param {Array} params.entities - 实体列表
 * @param {Array} params.citations - 证据列表
 * @param {Array} params.iiifMatches - IIIF 匹配结果
 * @param {Array} params.dims - 维度列表
 * @param {Array} [params.conversationHistory] - 对话历史
 * @param {boolean} [params.skipCache] - 是否跳过缓存
 * @returns {Promise<{text: string, source: 'llm' | 'template', confidence: number, llmElapsedMs?: number, usage?: object}>}
 */
export async function buildFusionAnswer(params) {
  const { query, entities = [], citations = [], iiifMatches = [], dims = [], conversationHistory = [], skipCache = false } = params

  // 如果没有实体，返回默认消息
  if (!entities.length) {
    return {
      text: '当前未命中稳定证据，请尝试更具体的问题。',
      source: 'template',
      confidence: 0,
    }
  }

  // 尝试使用 LLM 生成回答
  if (isLlmEnabled()) {
    const result = await generateLlmAnswer({
      query,
      entities,
      citations,
      iiifMatches,
      conversationHistory,
      skipCache,
    })

    if (result.success && result.text) {
      return {
        text: result.text,
        source: 'llm',
        confidence: 0.85,
        llmElapsedMs: result.elapsedMs,
        usage: result.usage,
      }
    }

    // LLM 失败时记录日志并降级
    console.warn('[LLM] 降级到模板回答: ' + result.error)
  }

  // 降级到模板回答
  const topTitles = entities
    .slice(0, 3)
    .map((item) => item.title || '未命名条目')
    .join('、')
  const dimText = dims.join('、')
  const templateText = `围绕"${query}"在 ${dimText} 维度共命中 ${entities.length} 条候选，重点线索包括:${topTitles}。`

  return {
    text: templateText,
    source: 'template',
    confidence: 0.5,
  }
}

// ========================================
// 重新导出所有导入的函数
// ========================================

// 配置管理
export {
  resolveLlmConfig,
  isLlmEnabled,
  getLlmConfig,
  buildLlmRequestHeaders,
  buildLlmRequestBody,
}

// 提示词构建
export {
  buildRagPrompt,
  buildPoemAiAnalysisPrompt,
  buildPoemAiAnalysisFallback,
  normalizePoemAnalysisInput,
}

// 降级策略
export {
  ensurePoemListCoverage,
  buildPersonAiIntroFallback,
}

// 工具函数
export {
  normalizePlainText,
  extractPersonReferredContents,
  clipEvidenceText,
}

// 缓存管理
export {
  llmAnswerCache,
  makeLlmAnswerCacheKey,
}

// 客户端类
export { LlmClient }

