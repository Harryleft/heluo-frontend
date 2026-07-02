/**
 * Phoenix 轻量追踪上报器
 *
 * @module server/src/services/llm/phoenixTracer
 */

/**
 * 安全序列化错误对象
 *
 * @param {unknown} error - 错误对象
 * @returns {string}
 */
function stringifyError(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return `${error.name}: ${error.message}`
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/**
 * 非阻塞上报 Phoenix 追踪事件
 *
 * @param {object} config - LLM 配置
 * @param {object} payload - 追踪载荷
 * @returns {Promise<void>}
 */
export async function reportPhoenixTrace(config, payload = {}) {
  const endpoint = String(config?.phoenixEndpoint || '').trim()
  if (!config?.phoenixEnabled || !endpoint) return

  const body = {
    project: String(config?.phoenixProject || 'heluo-rag'),
    timestamp: new Date().toISOString(),
    ...payload,
  }

  const headers = {
    'Content-Type': 'application/json',
  }
  if (config?.phoenixApiKey) {
    headers.Authorization = `Bearer ${String(config.phoenixApiKey).trim()}`
  }

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(1500),
    })
  } catch (error) {
    // 追踪失败只记录日志，不影响主链路
    console.warn('[PhoenixTracer] 上报失败:', stringifyError(error))
  }
}

export default {
  reportPhoenixTrace,
}

