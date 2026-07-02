/**
 * 大语言模型网关
 *
 * 封装大语言模型服务，提供统一的文本生成接口。
 * 底层使用 llmService 实现，支持同步和流式生成。
 *
 * @module server/src/infra/gateways/llmGateway
 */

import {
  isLlmEnabled,
  getLlmConfig,
  generateLlmAnswer,
  generateLlmTextByPrompt,
  generateLlmAnswerStream,
  buildRagPrompt,
  ensurePoemListCoverage,
  buildFusionAnswer,
} from '../../services/llmService.js'

// ============================================================================
// 公共接口
// ============================================================================

/**
 * 检查 LLM 服务是否启用
 *
 * @returns {boolean} 是否启用
 */
export function isEnabled() {
  return isLlmEnabled()
}

/**
 * 获取 LLM 配置信息
 *
 * @returns {object} 配置对象
 */
export function getConfig() {
  return getLlmConfig()
}

/**
 * 生成补全（基于 RAG 上下文）
 *
 * @param {object} params - 参数对象
 * @param {string} params.query - 用户问题
 * @param {Array} params.entities - 实体列表
 * @param {Array} params.citations - 证据列表
 * @param {Array} [params.iiifMatches] - IIIF 匹配列表
 * @param {Array} [params.conversationHistory] - 对话历史
 * @returns {Promise<{success: boolean, text: string, error?: string, elapsedMs?: number, usage?: object}>}
 */
export async function generateCompletion(params) {
  return generateLlmAnswer(params)
}

/**
 * 基于自定义提示词生成文本
 *
 * @param {object} params - 参数对象
 * @param {string} params.systemPrompt - 系统提示词
 * @param {string} params.userPrompt - 用户提示词
 * @param {number} [params.maxTokens] - 最大 token 数
 * @param {number} [params.temperature] - 采样温度
 * @returns {Promise<{success: boolean, text: string, error?: string, elapsedMs?: number, usage?: object}>}
 */
export async function generateByPrompt(params) {
  return generateLlmTextByPrompt(params)
}

/**
 * 流式生成补全（SSE）
 *
 * @param {object} params - 参数对象
 * @param {string} params.query - 用户问题
 * @param {Array} params.entities - 实体列表
 * @param {Array} params.citations - 证据列表
 * @param {Array} [params.iiifMatches] - IIIF 匹配列表
 * @param {Array} [params.conversationHistory] - 对话历史
 * @param {function} onChunk - 数据块回调函数
 * @returns {Promise<{success: boolean, text: string, error?: string, elapsedMs?: number}>}
 */
export async function generateStream(params, onChunk) {
  return generateLlmAnswerStream(params, onChunk)
}

/**
 * 构建 RAG 提示词
 *
 * @param {object} params - 参数对象
 * @param {string} params.query - 用户问题
 * @param {Array} params.entities - 实体列表
 * @param {Array} params.citations - 证据列表
 * @param {Array} [params.iiifMatches] - IIIF 匹配列表
 * @param {Array} [params.conversationHistory] - 对话历史
 * @returns {Array<{role: string, content: string}>} 消息数组
 */
export function buildPrompt(params) {
  return buildRagPrompt(params)
}

/**
 * 确保诗词列表覆盖完整性
 *
 * @param {object} params - 参数对象
 * @param {string} params.query - 用户问题
 * @param {Array} params.entities - 实体列表
 * @param {Array} params.citations - 证据列表
 * @param {string} params.answerText - 生成的回答文本
 * @returns {string} 补充后的回答文本
 */
export function ensurePoemCoverage(params) {
  return ensurePoemListCoverage(params)
}

/**
 * 构建融合问答回答（带降级）
 *
 * @param {object} params - 参数对象
 * @param {string} params.query - 用户问题
 * @param {Array} params.entities - 实体列表
 * @param {Array} params.citations - 证据列表
 * @param {Array} [params.iiifMatches] - IIIF 匹配列表
 * @param {Array} [params.dims] - 维度列表
 * @param {Array} [params.conversationHistory] - 对话历史
 * @returns {Promise<{text: string, source: 'llm'|'template', confidence: number, llmElapsedMs?: number}>}
 */
export async function buildAnswer(params) {
  return buildFusionAnswer(params)
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  isEnabled,
  getConfig,
  generateCompletion,
  generateByPrompt,
  generateStream,
  buildPrompt,
  ensurePoemCoverage,
  buildAnswer,
}
