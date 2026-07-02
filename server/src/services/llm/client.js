/**
 * LLM 客户端模块
 *
 * @module server/src/services/llm/client
 */

import { resolveLlmConfig, buildLlmRequestHeaders, buildLlmRequestBody } from './config.js'
import {
  llmAnswerCache,
  makeLlmAnswerCacheKey,
} from '../../utils/cacheManager.js'
import { buildRagPrompt } from './prompts/index.js'
import { ensurePoemListCoverage } from './fallback/index.js'
import { reportPhoenixTrace } from './phoenixTracer.js'

/**
 * 解析 SSE 行
 */
function parseSseLine(line) {
  if (!line.startsWith('data: ')) return null
  const data = line.slice(6).trim()
  if (data === '[DONE]') return { done: true, content: '' }
  try {
    const parsed = JSON.parse(data)
    const delta = parsed?.choices?.[0]?.delta
    const content = delta?.content || ''
    if (parsed?.error) {
      return { done: false, content: '', error: parsed.error.message || 'Unknown error' }
    }
    return { done: false, content }
  } catch {
    return null
  }
}

/**
 * LLM 客户端类
 */
export class LlmClient {
  constructor(config = {}) {
    this.config = { ...resolveLlmConfig(), ...config }
  }

  isAvailable() {
    return this.config.runtimeEnabled && this.config.baseUrl.length > 0
  }

  buildModelSequence(preferredModel = '') {
    const firstModel = String(preferredModel || this.config.model || '').trim()
    const fallbackModels = Array.isArray(this.config.fallbackModels) ? this.config.fallbackModels : []
    const ordered = [firstModel, ...fallbackModels]
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    const deduped = []
    const seen = new Set()
    for (const item of ordered) {
      if (seen.has(item)) continue
      seen.add(item)
      deduped.push(item)
    }
    return deduped
  }

  /**
   * 调用 LLM 生成回答
   *
   * @param {object} params
   * @param {string} params.query - 用户问题
   * @param {Array} params.entities - 实体列表
   * @param {Array} params.citations - 证据列表
   * @param {Array} [params.iiifMatches] - IIIF 匹配结果
   * @param {Array} [params.conversationHistory] - 对话历史(多轮对话)
   * @param {boolean} [params.skipCache] - 是否跳过缓存
   * @returns {Promise<{success: boolean, text: string, error?: string, elapsedMs?: number, usage?: object, fromCache?: boolean}>}
   */
  async generate(params) {
    if (!this.isAvailable()) {
      return { success: false, text: '', error: 'LLM_SERVICE_DISABLED' }
    }

    const effectiveSkipCache = Boolean(params.skipCache)
    const entityIds = (params.entities || []).map((e) => e.id || e.uri).filter(Boolean)
    const cacheKey = makeLlmAnswerCacheKey({ query: params.query, entityIds })
    if (!effectiveSkipCache && (params.conversationHistory || []).length === 0) {
      const cached = llmAnswerCache.get(cacheKey)
      if (cached) {
        console.log(`[LLM Cache] 卽中: ${cacheKey}`)
        return { ...cached, fromCache: true }
      }
      console.log(`[LLM Cache] 服务器未命中: ${cacheKey}`)
    }
    const startTime = Date.now()
    const messages = buildRagPrompt(params)
    let timeoutId = null

    const requestId = `llm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const modelSequence = this.buildModelSequence(params.model)
    let lastError = 'LLM_REQUEST_ERROR: UNKNOWN'
    try {
      for (const modelName of modelSequence) {
        const modelStart = Date.now()
        try {
          const controller = new AbortController()
          timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
          const response = await fetch(`${this.config.baseUrl}${this.config.chatPath}`, {
            method: 'POST',
            headers: buildLlmRequestHeaders(this.config),
            body: JSON.stringify(buildLlmRequestBody({
              model: modelName,
              messages,
              maxTokens: this.config.maxTokens,
              temperature: this.config.temperature,
              stream: false,
            })),
            signal: controller.signal,
          })
          if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            lastError = `LLM_API_ERROR: ${response.status} ${errorText.slice(0, 200)}`
            await reportPhoenixTrace(this.config, {
              requestId,
              event: 'llm_attempt_failed',
              provider: this.config.provider,
              model: modelName,
              elapsedMs: Date.now() - modelStart,
              error: lastError,
            })
            continue
          }
          const data = await response.json()
          const generatedText = data?.choices?.[0]?.message?.content || ''
          const result = {
            success: true,
            text: generatedText.trim(),
            elapsedMs: Date.now() - startTime,
            usage: data?.usage,
            model: modelName,
          }
          await reportPhoenixTrace(this.config, {
            requestId,
            event: 'llm_attempt_succeeded',
            provider: this.config.provider,
            model: modelName,
            elapsedMs: Date.now() - modelStart,
            totalElapsedMs: result.elapsedMs,
            cached: false,
          })
          if (!effectiveSkipCache && (params.conversationHistory || []).length === 0) {
            llmAnswerCache.set(cacheKey, result)
            console.log(`[LLM Cache] 结果已缓存: ${cacheKey}`)
          }
          return result
        } catch (error) {
          lastError = error.name === 'AbortError'
            ? 'LLM_TIMEOUT'
            : `LLM_REQUEST_ERROR: ${error.message}`
          await reportPhoenixTrace(this.config, {
            requestId,
            event: 'llm_attempt_failed',
            provider: this.config.provider,
            model: modelName,
            elapsedMs: Date.now() - modelStart,
            error: lastError,
          })
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
        }
      }
      return {
        success: false,
        text: '',
        error: lastError,
        elapsedMs: Date.now() - startTime,
      }
    } finally {
      if (!effectiveSkipCache && (params.conversationHistory || []).length === 0) {
        await reportPhoenixTrace(this.config, {
          requestId,
          event: 'llm_request_finished',
          provider: this.config.provider,
          queryLength: String(params?.query || '').length,
          entityCount: (params?.entities || []).length,
          citationCount: (params?.citations || []).length,
        })
      }
    }
  }

  /**
   * 调用 LLM 生成流式回答（SSE）
   *
   * @param {object} params
   * @param {string} params.query - 用户问题
   * @param {Array} params.entities - 实体列表
   * @param {Array} params.citations - 证据列表
   * @param {Array} [params.iiifMatches] - IIIF 匹配结果
   * @param {Array} [params.conversationHistory] - 对话历史(多轮对话)
   * @param {function} onChunk - 每次收到数据块的回调
   * @returns {Promise<{success: boolean, text: string, error?: string, elapsedMs?: number}>}
   */
  async generateStream(params, onChunk) {
    if (!this.isAvailable()) {
      return { success: false, text: '', error: 'LLM_SERVICE_DISABLED' }
    }
    const startTime = Date.now()
    const messages = buildRagPrompt(params)
    let timeoutId = null
    const requestId = `llm-stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const modelSequence = this.buildModelSequence(params.model)
    let lastError = 'LLM_REQUEST_ERROR: UNKNOWN'
    try {
      for (const modelName of modelSequence) {
        const modelStart = Date.now()
        try {
          const controller = new AbortController()
          timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
          const response = await fetch(`${this.config.baseUrl}${this.config.chatPath}`, {
            method: 'POST',
            headers: buildLlmRequestHeaders(this.config, { Accept: 'text/event-stream' }),
            body: JSON.stringify(buildLlmRequestBody({
              model: modelName,
              messages,
              maxTokens: this.config.maxTokens,
              temperature: this.config.temperature,
              stream: true,
            })),
            signal: controller.signal,
          })
          if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            lastError = `LLM_API_ERROR: ${response.status} ${errorText.slice(0, 200)}`
            await reportPhoenixTrace(this.config, {
              requestId,
              event: 'llm_stream_attempt_failed',
              provider: this.config.provider,
              model: modelName,
              elapsedMs: Date.now() - modelStart,
              error: lastError,
            })
            continue
          }
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let fullText = ''
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              const parsed = parseSseLine(line)
              if (!parsed) continue
              if (parsed.error) {
                return {
                  success: false,
                  text: fullText,
                  error: parsed.error,
                  elapsedMs: Date.now() - startTime,
                }
              }
              if (parsed.done) {
                break
              }
              if (parsed.content && typeof onChunk === 'function') {
                onChunk(parsed.content)
              }
              fullText += parsed.content
            }
          }
          await reportPhoenixTrace(this.config, {
            requestId,
            event: 'llm_stream_attempt_succeeded',
            provider: this.config.provider,
            model: modelName,
            elapsedMs: Date.now() - modelStart,
            totalElapsedMs: Date.now() - startTime,
            outputLength: fullText.length,
          })
          return {
            success: true,
            text: fullText.trim(),
            elapsedMs: Date.now() - startTime,
            model: modelName,
          }
        } catch (error) {
          lastError = error.name === 'AbortError'
            ? 'LLM_TIMEOUT'
            : `LLM_REQUEST_ERROR: ${error.message}`
          await reportPhoenixTrace(this.config, {
            requestId,
            event: 'llm_stream_attempt_failed',
            provider: this.config.provider,
            model: modelName,
            elapsedMs: Date.now() - modelStart,
            error: lastError,
          })
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
        }
      }
      return {
        success: false,
        text: '',
        error: lastError,
        elapsedMs: Date.now() - startTime,
      }
    } finally {
      await reportPhoenixTrace(this.config, {
        requestId,
        event: 'llm_stream_finished',
        provider: this.config.provider,
        queryLength: String(params?.query || '').length,
      })
    }
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
  async generateByPrompt({ systemPrompt = '', userPrompt = '', maxTokens, temperature }) {
    if (!this.isAvailable()) {
      return { success: false, text: '', error: 'LLM_SERVICE_DISABLED' }
    }
    const startTime = Date.now()
    let timeoutId = null
    try {
      const controller = new AbortController()
      timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
      const response = await fetch(`${this.config.baseUrl}${this.config.chatPath}`, {
        method: 'POST',
        headers: buildLlmRequestHeaders(this.config),
        body: JSON.stringify(buildLlmRequestBody({
          model: this.config.model,
          messages: [
            { role: 'system', content: String(systemPrompt || '').trim() },
            { role: 'user', content: String(userPrompt || '').trim() },
          ],
          maxTokens: Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 1
            ? Number(maxTokens)
            : this.config.maxTokens,
          temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : this.config.temperature,
          stream: false,
        })),
        signal: controller.signal,
      })
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        return {
          success: false,
          text: '',
          error: `LLM_API_ERROR: ${response.status} ${errorText.slice(0, 200)}`,
          elapsedMs: Date.now() - startTime,
        }
      }
      const data = await response.json()
      const generatedText = data?.choices?.[0]?.message?.content || ''
      return {
        success: true,
        text: generatedText.trim(),
        elapsedMs: Date.now() - startTime,
        usage: data?.usage,
      }
    } catch (error) {
      const errorMessage = error.name === 'AbortError'
        ? 'LLM_TIMEOUT'
        : `LLM_REQUEST_ERROR: ${error.message}`
      return {
        success: false,
        text: '',
        error: errorMessage,
        elapsedMs: Date.now() - startTime,
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}
