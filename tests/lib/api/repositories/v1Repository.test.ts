/**
 * v1Repository 单元测试
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockPersonList, mockSearchApiResponse } from '../__mocks__/responses'

vi.mock('axios', () => ({
  default: {
    isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
  },
}))

vi.mock('@/lib/api/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { http } from '@/lib/api/http'
import {
  fetchAncientBookByIdRepo,
  fetchEntityCountsRepo,
  fetchPersonsRepo,
  queryFusionRepo,
  searchUnifiedRepo,
} from '@/lib/api/repositories/v1Repository'

describe('v1Repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchPersonsRepo 应请求 /api/v1/persons', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({ data: mockPersonList })

    const result = await fetchPersonsRepo({ q: '杜甫' })

    expect(http.get).toHaveBeenCalledWith('/api/v1/persons', { params: { q: '杜甫' } })
    expect(result.success).toBe(true)
  })

  it('searchUnifiedRepo 应请求 /api/v1/search', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({ data: mockSearchApiResponse })

    const result = await searchUnifiedRepo('杜甫', 'person')

    expect(http.get).toHaveBeenCalledWith('/api/v1/search', { params: { q: '杜甫', type: 'person' } })
    expect(result.success).toBe(true)
  })

  it('searchUnifiedRepo 传入 mode 时应透传到查询参数', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({ data: mockSearchApiResponse })

    const result = await searchUnifiedRepo('杜甫', 'person', 'keyword')

    expect(http.get).toHaveBeenCalledWith('/api/v1/search', {
      params: { q: '杜甫', type: 'person', mode: 'keyword' },
    })
    expect(result.success).toBe(true)
  })

  it('searchUnifiedRepo 传入分页参数时应透传到查询参数', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({ data: mockSearchApiResponse })

    const result = await searchUnifiedRepo('杜甫', 'poem', 'keyword', { page: 2, pageSize: 24 })

    expect(http.get).toHaveBeenCalledWith('/api/v1/search', {
      params: { q: '杜甫', type: 'poem', mode: 'keyword', page: 2, pageSize: 24 },
    })
    expect(result.success).toBe(true)
  })

  it('searchUnifiedRepo 应保留后端返回的结构化错误', async () => {
    const apiError = {
      success: false as const,
      error: {
        code: 'SEARCH_BACKEND_UNAVAILABLE',
        message: '检索服务暂不可用',
      },
    }
    vi.mocked(http.get).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 503, data: apiError },
    })

    const result = await searchUnifiedRepo('杜甫', 'person', 'keyword', { page: 1, pageSize: 12 })

    expect(result).toEqual(apiError)
    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('fetchAncientBookByIdRepo 应支持传递 uri 参数', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({
      data: { success: true, data: { id: '17270_2263_15', title: '卷十五', uri: '/x' } },
    })

    await fetchAncientBookByIdRepo('17270_2263_15', '/processed/json-ld/ancient-book/object/volume/17270_2263_15.json')

    expect(http.get).toHaveBeenCalledWith('/api/v1/ancient-books/17270_2263_15', {
      params: { uri: '/processed/json-ld/ancient-book/object/volume/17270_2263_15.json' },
    })
  })

  it('fetchEntityCountsRepo 遇到 500 应重试后成功', async () => {
    vi.mocked(http.get)
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } })
      .mockResolvedValueOnce({
        data: { person: 1, poemSet: 2, book: 3, ancientBook: 4, geography: 5, concept: 6 },
      })

    const result = await fetchEntityCountsRepo()

    expect(http.get).toHaveBeenCalledTimes(2)
    expect(result.person).toBe(1)
    expect(result.concept).toBe(6)
  })

  it('queryFusionRepo 应请求 /api/v1/fusion/query', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          query: '杜甫',
          mode: 'hybrid',
          answer: { text: 'ok', confidence: 0.9 },
          entities: [],
          citations: [],
          iiifMatches: [],
          sidebar: { autoOpen: true, defaultTab: 'evidence', items: [] },
        },
      },
    })

    const result = await queryFusionRepo({
      query: '杜甫',
      mode: 'hybrid',
      dims: ['person', 'poem'],
      topK: 12,
      includeIiif: true,
    })

    expect(http.post).toHaveBeenCalledWith('/api/v1/fusion/query', {
      query: '杜甫',
      mode: 'hybrid',
      dims: ['person', 'poem'],
      topK: 12,
      includeIiif: true,
    })
    expect(result.success).toBe(true)
  })
})
