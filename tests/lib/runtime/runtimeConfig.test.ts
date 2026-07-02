/**
 * runtimeConfig.ts 单元测试
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

function setWindowMock(value: unknown) {
  Object.defineProperty(globalThis, 'window', {
    value,
    writable: true,
    configurable: true,
  })
}

describe('运行时配置模块', () => {
  afterEach(() => {
    vi.resetModules()
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('应成功加载 /env 并归一化 backendBaseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { backendBaseUrl: 'https://api.example.com/runtime' }
      },
    })

    setWindowMock({
      fetch: fetchMock,
    })

    const runtimeModule = await import('@/lib/runtime/runtimeConfig')
    await runtimeModule.loadRuntimeConfig()

    expect(runtimeModule.getRuntimeBackendBaseUrl()).toBe('https://api.example.com/runtime/')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('当 /env 不可用时应静默回退为空配置', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failed'))

    setWindowMock({
      fetch: fetchMock,
    })

    const runtimeModule = await import('@/lib/runtime/runtimeConfig')
    await runtimeModule.loadRuntimeConfig()

    expect(runtimeModule.getRuntimeBackendBaseUrl()).toBe('')
  })

  it('首次失败后应允许再次调用重试', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce({
        ok: true,
        async json() {
          return { backendBaseUrl: 'https://retry.example.com/api' }
        },
      })

    setWindowMock({
      fetch: fetchMock,
    })

    const runtimeModule = await import('@/lib/runtime/runtimeConfig')

    await runtimeModule.loadRuntimeConfig()
    expect(runtimeModule.getRuntimeBackendBaseUrl()).toBe('')

    await runtimeModule.loadRuntimeConfig()
    expect(runtimeModule.getRuntimeBackendBaseUrl()).toBe('https://retry.example.com/api/')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
