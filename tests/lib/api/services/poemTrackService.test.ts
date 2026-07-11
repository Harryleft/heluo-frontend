/**
 * 人物诗文轨迹前端服务测试
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/http', () => ({
  http: {
    get: vi.fn(),
  },
}))

import { http } from '@/lib/api/http'
import { fetchPersonPoemTrack } from '@/lib/api/services/poemTrackService'

describe('fetchPersonPoemTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Axios 请求超时不应被误判为主动取消', async () => {
    vi.mocked(http.get).mockRejectedValueOnce({
      name: 'AxiosError',
      code: 'ECONNABORTED',
      message: 'timeout of 20000ms exceeded',
    })

    const result = await fetchPersonPoemTrack('17270-timeout')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR')
    }
  })

  it('Axios 主动取消仍应返回 REQUEST_CANCELED', async () => {
    vi.mocked(http.get).mockRejectedValueOnce({
      name: 'CanceledError',
      code: 'ERR_CANCELED',
    })

    const result = await fetchPersonPoemTrack('17270-canceled')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('REQUEST_CANCELED')
    }
  })
})
