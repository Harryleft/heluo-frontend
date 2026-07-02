/**
 * fusionErrors 单元测试
 * @vitest-environment node
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  getLoadingMessage,
  getRetryDelay,
  handleFusionError,
  isEmptyResponse,
  type LoadingStage,
  withRetry,
} from '@/features/fusion/fusionErrors'

describe('fusionErrors', () => {
  describe('handleFusionError', () => {
    it('应识别网络错误', () => {
      const error = new TypeError('Failed to fetch')
      const result = handleFusionError(error)

      expect(result.type).toBe('NETWORK_ERROR')
      expect(result.retryable).toBe(true)
      expect(result.userMessage).toBe('网络连接失败')
    })

    it('应识别超时错误', () => {
      const error = new Error('Request timeout')
      const result = handleFusionError(error)

      expect(result.type).toBe('TIMEOUT')
      expect(result.retryable).toBe(true)
    })

    it('应识别 Abort 错误为超时', () => {
      const error = new Error('Aborted')
      const result = handleFusionError(error)

      expect(result.type).toBe('TIMEOUT')
    })

    it('应识别 LLM 错误', () => {
      const error = new Error('LLM service unavailable')
      const result = handleFusionError(error)

      expect(result.type).toBe('LLM_ERROR')
      expect(result.suggestion).toContain('简化回答')
    })

    it('应从 API 错误中提取类型', () => {
      const error = {
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Service unavailable',
        },
      }
      const result = handleFusionError(error)

      expect(result.type).toBe('UPSTREAM_ERROR')
    })

    it('应识别 INVALID_PARAMS 为 INVALID_QUERY', () => {
      const error = {
        error: {
          code: 'INVALID_PARAMS',
          message: 'Invalid query',
        },
      }
      const result = handleFusionError(error)

      expect(result.type).toBe('INVALID_QUERY')
      expect(result.retryable).toBe(false)
    })

    it('未知错误应返回 UNKNOWN 类型', () => {
      const error = new Error('Something weird happened')
      const result = handleFusionError(error)

      expect(result.type).toBe('UNKNOWN')
    })
  })

  describe('isEmptyResponse', () => {
    it('应识别空响应', () => {
      expect(isEmptyResponse({ entities: [], citations: [] })).toBe(true)
      expect(isEmptyResponse({ entities: [], citations: undefined })).toBe(true)
    })

    it('应识别非空响应', () => {
      expect(isEmptyResponse({ entities: [{ id: '1' }], citations: [] })).toBe(false)
      expect(isEmptyResponse({ entities: [], citations: [{ id: '1' }] })).toBe(false)
    })
  })

  describe('getRetryDelay', () => {
    it('应返回指数退避延迟', () => {
      expect(getRetryDelay(0, 1000)).toBe(1000)
      expect(getRetryDelay(1, 1000)).toBe(2000)
      expect(getRetryDelay(2, 1000)).toBe(4000)
    })

    it('应限制最大延迟为 10 秒', () => {
      expect(getRetryDelay(10, 1000)).toBe(10000)
    })

    it('应支持自定义基础延迟', () => {
      expect(getRetryDelay(1, 500)).toBe(1000)
    })
  })

  describe('getLoadingMessage', () => {
    it('应返回正确的加载消息', () => {
      expect(getLoadingMessage('idle')).toBe('')
      expect(getLoadingMessage('retrieving')).toBe('正在检索相关内容...')
      expect(getLoadingMessage('generating')).toBe('正在生成回答...')
      expect(getLoadingMessage('complete')).toBe('完成')
      expect(getLoadingMessage('error')).toBe('出错了')
    })
  })

  describe('withRetry', () => {
    it('成功时直接返回结果', async () => {
      const requestFn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(requestFn, { baseDelay: 1 })

      expect(result).toBe('success')
      expect(requestFn).toHaveBeenCalledTimes(1)
    })

    it('不可重试错误应立即抛出', async () => {
      const error = { error: { code: 'INVALID_PARAMS' } }
      const requestFn = vi.fn().mockRejectedValue(error)

      await expect(withRetry(requestFn, { baseDelay: 1 })).rejects.toMatchObject({
        type: 'INVALID_QUERY',
        retryable: false,
      })
      expect(requestFn).toHaveBeenCalledTimes(1)
    })

    it('可重试错误应重试指定次数', async () => {
      const error = new Error('Network error')
      const requestFn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success')

      const result = await withRetry(requestFn, { maxRetries: 2, baseDelay: 1 })
      expect(result).toBe('success')
      expect(requestFn).toHaveBeenCalledTimes(3)
    })

    it('达到最大重试次数后抛出错误', async () => {
      const error = new Error('Network error')
      const requestFn = vi.fn().mockRejectedValue(error)

      try {
        await withRetry(requestFn, { maxRetries: 2, baseDelay: 1 })
        expect.fail('Expected error to be thrown')
      } catch (e) {
        expect(e).toMatchObject({
          type: 'NETWORK_ERROR',
        })
      }
      expect(requestFn).toHaveBeenCalledTimes(3) // 初始 + 2 次重试
    })

    it('应支持自定义 shouldRetry 函数', async () => {
      const error = new Error('Network error')
      const requestFn = vi.fn().mockRejectedValue(error)

      const shouldRetry = vi.fn().mockReturnValue(false)

      await expect(withRetry(requestFn, { shouldRetry, baseDelay: 1 })).rejects.toMatchObject({
        type: 'NETWORK_ERROR',
      })
      expect(shouldRetry).toHaveBeenCalled()
      expect(requestFn).toHaveBeenCalledTimes(1)
    })
  })
})
