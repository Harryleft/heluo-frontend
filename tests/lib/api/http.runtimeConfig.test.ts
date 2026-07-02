/**
 * http.ts 运行时配置优先级测试
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

function setWindowMock(value: unknown) {
  Object.defineProperty(globalThis, 'window', {
    value,
    writable: true,
    configurable: true,
  })
}

describe('HTTP 客户端运行时 baseURL', () => {
  afterEach(() => {
    vi.resetModules()
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('应优先使用运行时 backendBaseUrl', async () => {
    setWindowMock({
      location: { hostname: 'heluo.site' },
      __HELUO_RUNTIME_CONFIG__: {
        backendBaseUrl: 'https://runtime.example.com/api',
      },
    })

    const { http } = await import('@/lib/api/http')
    expect(http.defaults.baseURL).toBe('https://runtime.example.com/api/')
  })

  it('本地浏览器主机下且无 runtime 配置时应使用本地后端兜底', async () => {
    setWindowMock({
      location: { hostname: 'localhost' },
    })

    const { http } = await import('@/lib/api/http')
    expect(http.defaults.baseURL).toBe('http://127.0.0.1:9011/')
  })

  it('请求显式传入 baseURL 时不应被拦截器覆盖', async () => {
    setWindowMock({
      location: { hostname: 'heluo.site' },
      __HELUO_RUNTIME_CONFIG__: {
        backendBaseUrl: 'https://runtime.example.com/api',
      },
    })

    const { http } = await import('@/lib/api/http')
    const response = await http.request({
      method: 'GET',
      url: '/health',
      baseURL: 'https://custom.example.com/',
      adapter: async (config) => ({
        data: { requestBaseUrl: config.baseURL },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }),
    })

    expect(response.data.requestBaseUrl).toBe('https://custom.example.com/')
  })
})
