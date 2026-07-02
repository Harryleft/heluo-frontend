/**
 * Fusion 错误处理工具
 *
 * 统一处理问答加载阶段提示、错误归类和重试逻辑。
 */

export type LoadingStage = 'idle' | 'retrieving' | 'generating' | 'complete' | 'error'

export interface FusionHandledError {
  type: 'NETWORK_ERROR' | 'TIMEOUT' | 'LLM_ERROR' | 'UPSTREAM_ERROR' | 'INVALID_QUERY' | 'UNKNOWN'
  retryable: boolean
  userMessage: string
  suggestion: string
  raw: unknown
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function extractErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const errorRecord = error as { error?: { code?: unknown } }
  return String(errorRecord.error?.code || '').trim().toUpperCase()
}

function extractErrorMessage(error: unknown): string {
  if (!error) return ''
  if (error instanceof Error) return String(error.message || '').trim()
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const nested = (error as { error?: { message?: unknown } }).error?.message
    return String(nested || '').trim()
  }
  return String(error || '').trim()
}

export function handleFusionError(error: unknown): FusionHandledError {
  const code = extractErrorCode(error)
  const message = extractErrorMessage(error).toLowerCase()

  if (code === 'INVALID_PARAMS') {
    return {
      type: 'INVALID_QUERY',
      retryable: false,
      userMessage: '查询参数无效',
      suggestion: '请检查问题描述后重试',
      raw: error,
    }
  }

  if (code === 'UPSTREAM_ERROR') {
    return {
      type: 'UPSTREAM_ERROR',
      retryable: true,
      userMessage: '上游服务暂时不可用',
      suggestion: '请稍后重试',
      raw: error,
    }
  }

  if (error instanceof TypeError || message.includes('network') || message.includes('fetch')) {
    return {
      type: 'NETWORK_ERROR',
      retryable: true,
      userMessage: '网络连接失败',
      suggestion: '请检查网络后重试',
      raw: error,
    }
  }

  if (message.includes('timeout') || message.includes('timed out') || message.includes('aborted')) {
    return {
      type: 'TIMEOUT',
      retryable: true,
      userMessage: '请求超时',
      suggestion: '请稍后重试',
      raw: error,
    }
  }

  if (message.includes('llm')) {
    return {
      type: 'LLM_ERROR',
      retryable: true,
      userMessage: '回答生成失败',
      suggestion: '可以稍后重试，或切换为简化回答',
      raw: error,
    }
  }

  return {
    type: 'UNKNOWN',
    retryable: false,
    userMessage: '未知错误',
    suggestion: '请稍后重试',
    raw: error,
  }
}

export function isEmptyResponse(payload: { entities?: unknown[]; citations?: unknown[] }): boolean {
  const entities = Array.isArray(payload?.entities) ? payload.entities : []
  const citations = Array.isArray(payload?.citations) ? payload.citations : []
  return entities.length === 0 && citations.length === 0
}

export function getRetryDelay(attempt: number, baseDelay = 1000): number {
  const safeAttempt = Math.max(0, Number(attempt) || 0)
  const safeBaseDelay = Math.max(1, Number(baseDelay) || 1000)
  return Math.min(10000, safeBaseDelay * (2 ** safeAttempt))
}

export function getLoadingMessage(stage: LoadingStage): string {
  const messageMap: Record<LoadingStage, string> = {
    idle: '',
    retrieving: '正在检索相关内容...',
    generating: '正在生成回答...',
    complete: '完成',
    error: '出错了',
  }
  return messageMap[stage] || ''
}

export async function withRetry<T>(
  requestFn: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    shouldRetry?: (error: FusionHandledError) => boolean
  } = {},
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelay = 1000,
    shouldRetry,
  } = options

  let attempt = 0
  while (attempt <= maxRetries) {
    try {
      return await requestFn()
    } catch (error) {
      const handledError = handleFusionError(error)
      const retryDecision = typeof shouldRetry === 'function'
        ? shouldRetry(handledError)
        : handledError.retryable

      if (!retryDecision || attempt >= maxRetries) {
        throw handledError
      }

      await sleep(getRetryDelay(attempt, baseDelay))
      attempt += 1
    }
  }

  throw handleFusionError(new Error('retry loop exhausted'))
}

export default {
  getLoadingMessage,
  getRetryDelay,
  handleFusionError,
  isEmptyResponse,
  withRetry,
}
