/**
 * LLM 服务可观测性模块
 * 提供日志、指标收集和健康检查功能
 */

// ========== 类型定义 ==========

/**
 * @typedef {Object} LlmRequestLog
 * @property {string} requestId - 请求 ID
 * @property {string} query - 查询文本（截断）
 * @property {number} entityCount - 实体数量
 * @property {number} citationCount - 证据数量
 * @property {boolean} stream - 是否流式
 * @property {number} startTime - 开始时间戳
 */

/**
 * @typedef {Object} LlmResponseLog
 * @property {string} requestId - 请求 ID
 * @property {boolean} success - 是否成功
 * @property {string} [error] - 错误信息
 * @property {number} elapsedMs - 耗时（毫秒）
 * @property {string} strategy - 策略（llm/template）
 * @property {number} [tokenCount] - Token 数量
 * @property {number} [llmElapsedMs] - LLM 耗时
 */

/**
 * @typedef {Object} LlmMetrics
 * @property {number} totalRequests - 总请求数
 * @property {number} successRequests - 成功请求数
 * @property {number} failedRequests - 失败请求数
 * @property {number} llmCalls - LLM 调用次数
 * @property {number} templateFallbacks - 模板降级次数
 * @property {number} avgLatency - 平均延迟（毫秒）
 * @property {number} avgLlmLatency - 平均 LLM 延迟
 * @property {number} totalTokens - 总 Token 数
 */

// ========== 状态存储 ==========

/** @type {Map<string, LlmRequestLog>} */
const activeRequests = new Map()

/** @type {LlmMetrics} */
const metrics = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  llmCalls: 0,
  templateFallbacks: 0,
  avgLatency: 0,
  avgLlmLatency: 0,
  totalTokens: 0,
}

// 用于计算平均值的临时存储
const latencySamples = []
const llmLatencySamples = []
const MAX_SAMPLES = 100

// ========== 日志函数 ==========

/**
 * 记录 LLM 请求开始
 * @param {string} requestId - 请求 ID
 * @param {object} params - 请求参数
 */
export function logLlmRequestStart(requestId, params) {
  const { query, entities = [], citations = [], stream = false } = params

  activeRequests.set(requestId, {
    requestId,
    query: query.slice(0, 50) + (query.length > 50 ? '...' : ''),
    entityCount: entities.length,
    citationCount: citations.length,
    stream,
    startTime: Date.now(),
  })

  console.log(`[LLM] 请求开始: ${requestId} | 查询: "${query.slice(0, 30)}..." | 实体: ${entities.length} | 证据: ${citations.length}`)
}

/**
 * 记录 LLM 请求结束
 * @param {string} requestId - 请求 ID
 * @param {object} result - 请求结果
 */
export function logLlmRequestEnd(requestId, result) {
  const requestLog = activeRequests.get(requestId)
  if (!requestLog) {
    console.warn(`[LLM] 未找到请求日志: ${requestId}`)
    return
  }

  const { success, error, elapsedMs, strategy, tokenCount, llmElapsedMs } = result
  const totalElapsedMs = elapsedMs || (Date.now() - requestLog.startTime)

  // 更新指标
  metrics.totalRequests++
  if (success) {
    metrics.successRequests++
  } else {
    metrics.failedRequests++
  }

  if (strategy === 'llm') {
    metrics.llmCalls++
  } else if (strategy === 'template') {
    metrics.templateFallbacks++
  }

  // 更新延迟统计
  latencySamples.push(totalElapsedMs)
  if (latencySamples.length > MAX_SAMPLES) {
    latencySamples.shift()
  }
  metrics.avgLatency = latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length

  if (llmElapsedMs) {
    llmLatencySamples.push(llmElapsedMs)
    if (llmLatencySamples.length > MAX_SAMPLES) {
      llmLatencySamples.shift()
    }
    metrics.avgLlmLatency = llmLatencySamples.reduce((a, b) => a + b, 0) / llmLatencySamples.length
  }

  if (tokenCount) {
    metrics.totalTokens += tokenCount
  }

  // 清理活跃请求
  activeRequests.delete(requestId)

  // 输出日志
  const status = success ? '成功' : '失败'
  const strategyLabel = strategy === 'llm' ? 'LLM生成' : '模板回答'
  console.log(
    `[LLM] 请求结束: ${requestId} | 状态: ${status} | 策略: ${strategyLabel} | 耗时: ${totalElapsedMs}ms` +
    (llmElapsedMs ? ` | LLM耗时: ${llmElapsedMs}ms` : '') +
    (tokenCount ? ` | Tokens: ${tokenCount}` : '') +
    (error ? ` | 错误: ${error}` : '')
  )
}

/**
 * 记录 LLM 降级事件
 * @param {string} requestId - 请求 ID
 * @param {string} reason - 降级原因
 */
export function logLlmFallback(requestId, reason) {
  console.warn(`[LLM] 降级: ${requestId} | 原因: ${reason}`)
}

/**
 * 记录 LLM 错误
 * @param {string} requestId - 请求 ID
 * @param {Error|string} error - 错误对象
 */
export function logLlmError(requestId, error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  console.error(`[LLM] 错误: ${requestId} | ${errorMessage}`)
}

// ========== 指标函数 ==========

/**
 * 获取当前指标
 * @returns {LlmMetrics & { activeRequests: number }}
 */
export function getLlmMetrics() {
  return {
    ...metrics,
    activeRequests: activeRequests.size,
  }
}

/**
 * 重置指标
 */
export function resetLlmMetrics() {
  metrics.totalRequests = 0
  metrics.successRequests = 0
  metrics.failedRequests = 0
  metrics.llmCalls = 0
  metrics.templateFallbacks = 0
  metrics.avgLatency = 0
  metrics.avgLlmLatency = 0
  metrics.totalTokens = 0
  latencySamples.length = 0
  llmLatencySamples.length = 0
  activeRequests.clear()
  console.log('[LLM] 指标已重置')
}

// ========== 健康检查 ==========

/**
 * 执行 LLM 服务健康检查
 * @returns {Promise<{status: string, details: object}>}
 */
export async function checkLlmHealth() {
  const { isLlmEnabled, getLlmConfig } = await import('./llmService.js')

  if (!isLlmEnabled()) {
    return {
      status: 'disabled',
      details: {
        message: 'LLM 服务未启用',
        config: getLlmConfig(),
      },
    }
  }

  const config = getLlmConfig()
  const startTime = Date.now()

  try {
    // 尝试连接 LLM 服务的 /health 或 /models 端点
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${config.baseUrl}/v1/models`, {
      method: 'GET',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const latency = Date.now() - startTime

    if (response.ok) {
      const data = await response.json()
      return {
        status: 'healthy',
        details: {
          message: 'LLM 服务正常',
          latency: `${latency}ms`,
          model: config.model,
          availableModels: data?.data?.map((m) => m.id).slice(0, 5) || [],
        },
      }
    }

    return {
      status: 'degraded',
      details: {
        message: `LLM 服务响应异常: ${response.status}`,
        latency: `${latency}ms`,
        model: config.model,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      status: 'unhealthy',
      details: {
        message: `LLM 服务连接失败: ${errorMessage}`,
        model: config.model,
        baseUrl: config.baseUrl,
      },
    }
  }
}

export default {
  logLlmRequestStart,
  logLlmRequestEnd,
  logLlmFallback,
  logLlmError,
  getLlmMetrics,
  resetLlmMetrics,
  checkLlmHealth,
}
