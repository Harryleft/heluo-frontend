/**
 * LLM 配置模块
 *
 * @module server/src/services/llm/config
 */

/**
 * 解析 LLM 配置
 * @returns {object}
 */
export function resolveLlmConfig() {
  const baseUrl = (process.env.LLM_BASE_URL || '').replace(/\/+$/, '')
  const model = process.env.LLM_MODEL || 'Xunzi-Qwen1.5-4B'
  const provider = String(process.env.LLM_PROVIDER || 'openai').trim().toLowerCase()
  const timeout = Number(process.env.LLM_TIMEOUT || 30000)
  const maxTokensRaw = String(process.env.LLM_MAX_TOKENS || '').trim()
  const parsedMaxTokens = Number(maxTokensRaw)
  const maxTokens = Number.isFinite(parsedMaxTokens) && parsedMaxTokens > 0 ? parsedMaxTokens : null
  const temperature = Number(process.env.LLM_TEMPERATURE || 0.4)
  const apiKey = String(process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '').trim()
  const apiKeyHeader = String(process.env.LLM_API_KEY_HEADER || 'Authorization').trim() || 'Authorization'
  const apiKeyPrefix = String(process.env.LLM_API_KEY_PREFIX || 'Bearer').trim()
  const chatPathRaw = String(process.env.LLM_CHAT_PATH || '/v1/chat/completions').trim()
  const chatPath = chatPathRaw.startsWith('/') ? chatPathRaw : `/${chatPathRaw}`
  const rawEnabled = String(process.env.LLM_ENABLED || '').trim().toLowerCase()
  const configuredEnabled = rawEnabled ? rawEnabled === 'true' : baseUrl.length > 0
  const fallbackModels = String(process.env.LLM_FALLBACK_MODELS || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && item !== model)
  const phoenixEndpoint = String(process.env.PHOENIX_COLLECTOR_URL || '').trim()
  const phoenixApiKey = String(process.env.PHOENIX_API_KEY || '').trim()
  const phoenixProject = String(process.env.PHOENIX_PROJECT || 'heluo-rag').trim()
  const rawPhoenixEnabled = String(process.env.PHOENIX_ENABLED || '').trim().toLowerCase()
  const phoenixEnabled = rawPhoenixEnabled
    ? rawPhoenixEnabled === 'true'
    : phoenixEndpoint.length > 0

  return {
    baseUrl,
    model,
    provider,
    fallbackModels,
    timeout,
    maxTokens,
    temperature,
    apiKey,
    apiKeyHeader,
    apiKeyPrefix,
    chatPath,
    phoenixEnabled,
    phoenixEndpoint,
    phoenixApiKey,
    phoenixProject,
    configuredEnabled,
    runtimeEnabled: configuredEnabled && baseUrl.length > 0,
  }
}

/**
 * 检查 LLM 服务是否启用
 * @returns {boolean}
 */
export function isLlmEnabled() {
  return resolveLlmConfig().runtimeEnabled
}

/**
 * 获取 LLM 配置信息
 * @returns {object}
 */
export function getLlmConfig() {
  const config = resolveLlmConfig()
  return {
    enabled: config.runtimeEnabled,
    baseUrl: config.baseUrl,
    model: config.model,
    provider: config.provider,
    fallbackModels: config.fallbackModels,
    timeout: config.timeout,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    chatPath: config.chatPath,
    phoenixEnabled: config.phoenixEnabled,
    phoenixEndpoint: config.phoenixEndpoint,
    phoenixProject: config.phoenixProject,
  }
}

/**
 * 构建请求头
 * @param {object} llmConfig
 * @param {object} extraHeaders
 * @returns {object}
 */
export function buildLlmRequestHeaders(llmConfig, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }
  if (llmConfig.apiKey) {
    const authValue = llmConfig.apiKeyPrefix
      ? `${llmConfig.apiKeyPrefix} ${llmConfig.apiKey}`
      : llmConfig.apiKey
    headers[llmConfig.apiKeyHeader] = authValue
  }
  return headers
}

/**
 * 构建请求体
 * @param {object} options
 * @returns {object}
 */
export function buildLlmRequestBody({ model, messages, temperature, stream }) {
  return {
    model,
    messages,
    temperature,
    stream,
  }
}
