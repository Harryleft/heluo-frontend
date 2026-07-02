/**
 * llmObservability 单元测试
 * @vitest-environment node
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  getLlmMetrics,
  resetLlmMetrics,
  logLlmRequestStart,
  logLlmRequestEnd,
  logLlmFallback,
  logLlmError,
} from '../../server/src/services/llmObservability.js'

// Mock console 方法
const originalLog = console.log
const originalWarn = console.warn
const originalError = console.error

describe('llmObservability', () => {
  beforeEach(() => {
    // 重置指标
    resetLlmMetrics()
    // Mock console
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  afterEach(() => {
    // 恢复 console
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
  })

  describe('getLlmMetrics', () => {
    it('初始指标应为零', () => {
      const metrics = getLlmMetrics()

      expect(metrics.totalRequests).toBe(0)
      expect(metrics.successRequests).toBe(0)
      expect(metrics.failedRequests).toBe(0)
      expect(metrics.llmCalls).toBe(0)
      expect(metrics.templateFallbacks).toBe(0)
      expect(metrics.activeRequests).toBe(0)
    })
  })

  describe('logLlmRequestStart', () => {
    it('应记录请求开始', () => {
      logLlmRequestStart('test-1', {
        query: '杜甫是谁？',
        entities: [{ id: '1' }],
        citations: [{ id: 'c1' }],
      })

      const metrics = getLlmMetrics()
      expect(metrics.activeRequests).toBe(1)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[LLM] 请求开始')
      )
    })

    it('应截断长查询', () => {
      const longQuery = 'a'.repeat(100)
      logLlmRequestStart('test-2', {
        query: longQuery,
        entities: [],
        citations: [],
      })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('...')
      )
    })
  })

  describe('logLlmRequestEnd', () => {
    it('应记录成功的 LLM 请求', () => {
      // 先开始请求
      logLlmRequestStart('test-3', {
        query: '测试',
        entities: [],
        citations: [],
      })

      logLlmRequestEnd('test-3', {
        success: true,
        strategy: 'llm',
        elapsedMs: 500,
        llmElapsedMs: 450,
        tokenCount: 100,
      })

      const metrics = getLlmMetrics()
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.successRequests).toBe(1)
      expect(metrics.llmCalls).toBe(1)
      expect(metrics.activeRequests).toBe(0)
    })

    it('应记录失败的请求', () => {
      logLlmRequestStart('test-4', {
        query: '测试',
        entities: [],
        citations: [],
      })

      logLlmRequestEnd('test-4', {
        success: false,
        strategy: 'template',
        error: 'LLM_TIMEOUT',
        elapsedMs: 3000,
      })

      const metrics = getLlmMetrics()
      expect(metrics.failedRequests).toBe(1)
      expect(metrics.templateFallbacks).toBe(1)
    })

    it('未找到请求日志时应警告', () => {
      logLlmRequestEnd('unknown-id', {
        success: true,
        strategy: 'llm',
      })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('未找到请求日志')
      )
    })
  })

  describe('logLlmFallback', () => {
    it('应记录降级事件', () => {
      logLlmFallback('test-5', 'LLM_TIMEOUT')

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[LLM] 降级')
      )
    })
  })

  describe('logLlmError', () => {
    it('应记录 Error 对象', () => {
      logLlmError('test-6', new Error('Connection failed'))

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Connection failed')
      )
    })

    it('应记录字符串错误', () => {
      logLlmError('test-7', 'Network error')

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Network error')
      )
    })
  })

  describe('resetLlmMetrics', () => {
    it('应重置所有指标', () => {
      // 添加一些数据
      logLlmRequestStart('test-8', { query: 'test', entities: [], citations: [] })
      logLlmRequestEnd('test-8', { success: true, strategy: 'llm', elapsedMs: 100 })

      // 重置
      resetLlmMetrics()

      const metrics = getLlmMetrics()
      expect(metrics.totalRequests).toBe(0)
      expect(metrics.successRequests).toBe(0)
    })
  })

  describe('延迟计算', () => {
    it('应计算平均延迟', () => {
      for (let i = 1; i <= 3; i++) {
        logLlmRequestStart(`test-${i}`, { query: 'test', entities: [], citations: [] })
        logLlmRequestEnd(`test-${i}`, {
          success: true,
          strategy: 'llm',
          elapsedMs: 100 * i,
        })
      }

      const metrics = getLlmMetrics()
      expect(metrics.avgLatency).toBe(200) // (100 + 200 + 300) / 3
    })
  })
})
