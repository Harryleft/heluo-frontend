/**
 * V1 API 函数单元测试
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http } from '@/lib/api/http'
import {
  __resetRelatedResourceCacheForTest,
  fetchEntityCounts,
  fetchPersons,
  fetchPersonById,
  fetchPoems,
  fetchPoemById,
  searchUnified,
} from '@/lib/api/v1Api'
import {
  mockPersonList,
  mockPersonDetailResponse,
  mockPoemList,
  mockPoemDetailResponse,
  mockSearchApiResponse,
  mockNotFoundResponse,
  mockInternalErrorResponse,
  mockInvalidParamsResponse,
} from './__mocks__/responses'

// Mock axios HTTP 客户端
vi.mock('@/lib/api/http', () => ({
  http: {
    get: vi.fn(),
  },
}))

describe('API 函数测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRelatedResourceCacheForTest()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========== fetchPersons 测试 ==========
  describe('fetchPersons', () => {
    it('TP-001: 默认参数获取人物列表', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockPersonList })

      const result = await fetchPersons()

      expect(http.get).toHaveBeenCalledWith('/api/v1/persons', undefined)
      expect(result).toEqual(mockPersonList)
      expect(result.success).toBe(true)
      expect(result.data.items).toHaveLength(3)
    })

    it('TP-002: 分页查询人物列表', async () => {
      const paginatedResponse = {
        ...mockPersonList,
        data: { ...mockPersonList.data, page: 2, pageSize: 5 },
      }
      vi.mocked(http.get).mockResolvedValueOnce({ data: paginatedResponse })

      const result = await fetchPersons({ page: 2, pageSize: 5 })

      expect(http.get).toHaveBeenCalledWith('/api/v1/persons', { params: { page: 2, pageSize: 5 } })
      expect(result.data.page).toBe(2)
      expect(result.data.pageSize).toBe(5)
    })

    it('TP-003: 关键词搜索人物', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockPersonList })

      const result = await fetchPersons({ q: '杜甫' })

      expect(http.get).toHaveBeenCalledWith('/api/v1/persons', { params: { q: '杜甫' } })
      expect(result.success).toBe(true)
    })

    it('TP-004: 朝代筛选人物', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockPersonList })

      await fetchPersons({ dynasty: '唐' })

      expect(http.get).toHaveBeenCalledWith('/api/v1/persons', { params: { dynasty: '唐' } })
    })
  })

  // ========== fetchPersonById 测试 ==========
  describe('fetchPersonById', () => {
    it('TP-101: 获取人物详情成功', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockPersonDetailResponse })

      const result = await fetchPersonById('17270')

      expect(http.get).toHaveBeenCalledWith('/api/v1/persons/17270', undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('17270')
        expect(result.data.name).toBe('杜甫')
        expect(result.data.dynasty).toBe('唐')
      }
    })

    it('TP-102: 人物不存在返回错误', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockNotFoundResponse })

      const result = await fetchPersonById('invalid_id')

      expect(http.get).toHaveBeenCalledWith('/api/v1/persons/invalid_id', undefined)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  // ========== fetchPoems 测试 ==========
  describe('fetchPoems', () => {
    it('TP-201: 默认参数获取诗文列表', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockPoemList })

      const result = await fetchPoems()

      expect(http.get).toHaveBeenCalledWith('/api/v1/poems', undefined)
      expect(result.success).toBe(true)
      expect(result.data.items).toHaveLength(3)
    })

    it('TP-202: 分页查询诗文列表', async () => {
      const paginatedResponse = {
        ...mockPoemList,
        data: { ...mockPoemList.data, page: 1, pageSize: 20 },
      }
      vi.mocked(http.get).mockResolvedValueOnce({ data: paginatedResponse })

      const result = await fetchPoems({ page: 1, pageSize: 20 })

      expect(http.get).toHaveBeenCalledWith('/api/v1/poems', { params: { page: 1, pageSize: 20 } })
      expect(result.data.pageSize).toBe(20)
    })

    it('TP-203: 作者筛选诗文', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockPoemList })

      await fetchPoems({ author: '杜甫' })

      expect(http.get).toHaveBeenCalledWith('/api/v1/poems', { params: { author: '杜甫' } })
    })

    it('TP-204: 体裁筛选诗文', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockPoemList })

      await fetchPoems({ genre: '五言律诗' })

      expect(http.get).toHaveBeenCalledWith('/api/v1/poems', { params: { genre: '五言律诗' } })
    })
  })

  // ========== fetchPoemById 测试 ==========
  describe('fetchPoemById', () => {
    it('TP-301: 获取诗文详情成功', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockPoemDetailResponse })

      const result = await fetchPoemById('poem_001')

      expect(http.get).toHaveBeenCalledWith('/api/v1/poems/poem_001', undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('poem_001')
        expect(result.data.title).toBe('春望')
        expect(result.data.author).toBe('杜甫')
      }
    })

    it('TP-302: 获取 txt 格式诗文', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockPoemDetailResponse })

      await fetchPoemById('poem_001', { format: 'txt' })

      expect(http.get).toHaveBeenCalledWith('/api/v1/poems/poem_001', { params: { format: 'txt' } })
    })

    it('TP-303: 诗文不存在返回错误', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockNotFoundResponse })

      const result = await fetchPoemById('invalid_id')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  // ========== searchUnified 测试 ==========
  describe('searchUnified', () => {
    it('TP-401: 全类型搜索', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockSearchApiResponse })

      const result = await searchUnified('杜甫')

      expect(http.get).toHaveBeenCalledWith('/api/v1/search', { params: { q: '杜甫' } })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.query).toBe('杜甫')
        expect(result.data.total).toBe(2)
        expect(result.data.counts?.person).toBe(1)
        expect(result.data.counts?.poem).toBe(1)
      }
    })

    it('TP-402: 单类型过滤搜索', async () => {
      const personOnlyResponse = {
        ...mockSearchApiResponse,
        data: {
          ...mockSearchApiResponse.data,
          type: 'person',
          items: [mockSearchApiResponse.data.items[0]],
          total: 1,
          counts: { person: 1 },
        },
      }
      vi.mocked(http.get).mockResolvedValueOnce({ data: personOnlyResponse })

      const result = await searchUnified('杜甫', 'person')

      expect(http.get).toHaveBeenCalledWith('/api/v1/search', { params: { q: '杜甫', type: 'person' } })
      if (result.success) {
        expect(result.data.type).toBe('person')
      }
    })

    it('TP-403: 多类型过滤搜索', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockSearchApiResponse })

      await searchUnified('杜甫', 'person,poem')

      expect(http.get).toHaveBeenCalledWith('/api/v1/search', { params: { q: '杜甫', type: 'person,poem' } })
    })

    it('TP-404: 指定 mode=keyword 时应透传', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockSearchApiResponse })

      await searchUnified('杜甫', 'poem', 'keyword')

      expect(http.get).toHaveBeenCalledWith('/api/v1/search', {
        params: { q: '杜甫', type: 'poem', mode: 'keyword' },
      })
    })

    it('TP-405: 指定分页参数时应透传 page/pageSize', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({ data: mockSearchApiResponse })

      await searchUnified('杜甫', 'poem', 'keyword', { page: 2, pageSize: 24 })

      expect(http.get).toHaveBeenCalledWith('/api/v1/search', {
        params: { q: '杜甫', type: 'poem', mode: 'keyword', page: 2, pageSize: 24 },
      })
    })

    it('TP-406: 相关资源向量检索应过滤不可识别 URI 并补齐名称', async () => {
      vi.mocked(http.get)
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              query: '杜甫',
              type: 'all',
              mode: 'vector',
              total: 3,
              items: [
                { type: 'person', id: '17170', title: '未命名条目', snippet: '', score: 0.9, uri: '/person/17170' },
                { type: 'iiif', id: 'm1', title: '某影像', snippet: '', score: 0.8, uri: '/iiif/manifests/304/manifest.json' },
                { type: 'concept', id: '11', title: '', snippet: '', score: 0.7, uri: '/concept/rhyme/11.json' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              id: '17170',
              name: '杜甫',
              aliases: [],
              uri: '/person/17170',
            },
          },
        })

      const result = await searchUnified('杜甫', undefined, 'vector', { page: 1, pageSize: 6 })

      expect(http.get).toHaveBeenCalledWith('/api/v1/search', {
        params: { q: '杜甫', mode: 'vector', page: 1, pageSize: 6 },
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(2)
        expect(result.data.items.map((item) => item.uri)).toEqual(['/person/17170', '/concept/rhyme/11.json'])
        expect(result.data.items.map((item) => item.title)).toEqual(['人物 17170', '概念 11'])
      }
    })

    it('TP-406A: 相关资源应保留可构建详情路由的向量 URI', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            query: '杜甫',
            type: 'all',
            mode: 'vector',
            total: 2,
            items: [
              {
                type: 'person',
                id: '17170',
                title: '杜甫',
                snippet: '',
                score: 0.95,
                uri: '/processed/vector/person/17170.json',
              },
              {
                type: 'book',
                id: 'bk001',
                title: '杜工部集',
                snippet: '',
                score: 0.91,
                uri: '/processed/vector/book/bk001.json',
              },
            ],
          },
        },
      })

      const result = await searchUnified('杜甫', undefined, 'vector', { page: 1, pageSize: 6 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(2)
        expect(result.data.items.map((item) => item.uri)).toEqual([
          '/processed/vector/person/17170.json',
          '/processed/vector/book/bk001.json',
        ])
      }
    })

    it('TP-407: 相关资源首轮为空时应使用精简查询重试', async () => {
      vi.mocked(http.get)
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              query: '杜甫传，本书内容以杜甫的生平经历为经',
              type: 'all',
              mode: 'vector',
              total: 1,
              items: [
                { type: 'iiif', id: 'm1', title: '某影像', snippet: '', score: 0.9, uri: '/iiif/manifests/304/manifest.json' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              query: '杜甫传',
              type: 'all',
              mode: 'vector',
              total: 1,
              items: [
                { type: 'person', id: '17170', title: '未命名条目', snippet: '', score: 0.8, uri: '/person/17170' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              id: '17170',
              name: '杜甫',
              aliases: [],
              uri: '/person/17170',
            },
          },
        })

      const result = await searchUnified('杜甫传，本书内容以杜甫的生平经历为经', undefined, 'vector', { page: 1, pageSize: 6 })

      expect(http.get).toHaveBeenNthCalledWith(1, '/api/v1/search', {
        params: { q: '杜甫传，本书内容以杜甫的生平经历为经', mode: 'vector', page: 1, pageSize: 6 },
      })
      expect(http.get).toHaveBeenNthCalledWith(2, '/api/v1/search', {
        params: { q: '杜甫传', mode: 'vector', page: 1, pageSize: 6 },
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(1)
        expect(result.data.items[0].uri).toBe('/person/17170')
        expect(result.data.items[0].title).toBe('人物 17170')
      }
    })

    it('TP-408: 相关人物应标记 v1 人物详情可用性', async () => {
      vi.mocked(http.get)
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              query: '杜甫传',
              type: 'all',
              mode: 'vector',
              total: 2,
              items: [
                { type: 'person', id: '21163', title: '未命名条目', snippet: '', score: 0.9, uri: '/person/21163' },
                { type: 'person', id: '17270', title: '杜甫', snippet: '', score: 0.88, uri: '/person/17270' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: false,
            error: { code: 'NOT_FOUND', message: 'not found' },
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              id: '17270',
              name: '杜甫',
              aliases: [],
              uri: '/person/17270',
            },
          },
        })

      const result = await searchUnified('杜甫传', undefined, 'vector', { page: 1, pageSize: 6 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(2)
        expect(result.data.items[0].uri).toBe('/person/21163')
        expect(result.data.items[0].available).toBe(false)
        expect(result.data.items[1].uri).toBe('/person/17270')
        expect(result.data.items[1].available).toBe(true)
      }
    })

    it('TP-409: 相关资源可识别时即使 unavailable 也不触发关键词回退', async () => {
      vi.mocked(http.get)
        // 首轮 vector（含不可用人物）
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              query: '杜甫传',
              type: 'all',
              mode: 'vector',
              total: 2,
              items: [
                { type: 'person', id: '21163', title: '未命名条目', snippet: '', score: 0.9, uri: '/person/21163' },
                { type: 'person', id: '50851', title: '未命名条目', snippet: '', score: 0.88, uri: '/person/50851' },
              ],
            },
          },
        })
        // 校验 21163 不存在
        .mockResolvedValueOnce({
          data: {
            success: false,
            error: { code: 'NOT_FOUND', message: 'not found' },
          },
        })
        // 校验 50851 不存在
        .mockResolvedValueOnce({
          data: {
            success: false,
            error: { code: 'NOT_FOUND', message: 'not found' },
          },
        })
        // 关键词人物回退
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              query: '杜甫传',
              type: 'person',
              mode: 'keyword',
              total: 1,
              items: [
                { type: 'person', id: '17270', title: '杜甫', snippet: '', score: 0.95, uri: '/person/17270' },
              ],
            },
          },
        })
        // 校验 17270 存在
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              id: '17270',
              name: '杜甫',
              aliases: [],
              uri: '/person/17270',
            },
          },
        })

      const result = await searchUnified('杜甫传', undefined, 'vector', { page: 1, pageSize: 6 })

      expect(result.success).toBe(true)
      expect(http.get).toHaveBeenCalledTimes(3)
      if (result.success) {
        expect(result.data.items).toHaveLength(2)
        expect(result.data.items[0].uri).toBe('/person/21163')
        expect(result.data.items[0].available).toBe(false)
        expect(result.data.items[1].uri).toBe('/person/50851')
        expect(result.data.items[1].available).toBe(false)
      }
    })

    it('TP-410: 相同参数重复调用时应命中相关资源缓存', async () => {
      vi.mocked(http.get)
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              query: '杜甫传',
              type: 'all',
              mode: 'vector',
              total: 1,
              items: [
                { type: 'person', id: '17270', title: '杜甫', snippet: '', score: 0.95, uri: '/person/17270' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              id: '17270',
              name: '杜甫',
              aliases: [],
              uri: '/person/17270',
            },
          },
        })

      const first = await searchUnified('杜甫传', undefined, 'vector', { page: 1, pageSize: 6 })
      const second = await searchUnified('杜甫传', undefined, 'vector', { page: 1, pageSize: 6 })

      expect(first.success).toBe(true)
      expect(second.success).toBe(true)
      expect(http.get).toHaveBeenCalledTimes(2)
      expect(http.get).toHaveBeenNthCalledWith(1, '/api/v1/search', {
        params: { q: '杜甫传', mode: 'vector', page: 1, pageSize: 6 },
      })
      expect(http.get).toHaveBeenNthCalledWith(2, '/api/v1/persons/17270', undefined)
    })
  })

  // ========== 重试机制测试 ==========
  describe('重试机制', () => {
    it('TP-502: 500 错误重试', async () => {
      // 模拟 500 错误后成功
      const serverError = {
        response: { status: 500, data: mockInternalErrorResponse },
        isAxiosError: true,
      }
      vi.mocked(http.get)
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({ data: mockPersonList })

      const result = await fetchPersons()

      expect(http.get).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
    })

    it('TP-503: 4xx 错误不重试', async () => {
      // 模拟 400 错误（不应重试）
      const clientError = {
        response: { status: 400, data: mockInvalidParamsResponse },
        isAxiosError: true,
      }
      vi.mocked(http.get).mockRejectedValueOnce(clientError)

      await expect(fetchPersons()).rejects.toThrow()
      expect(http.get).toHaveBeenCalledTimes(1)
    })

    it('TP-504: 重试成功后返回正确结果', async () => {
      // 模拟 429 限流后成功
      const rateLimitError = {
        response: { status: 429 },
        isAxiosError: true,
      }
      vi.mocked(http.get)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: mockPersonList })

      const result = await fetchPersons()

      expect(http.get).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(3)
      }
    })
  })

  // ========== fetchEntityCounts 测试 ==========
  describe('fetchEntityCounts', () => {
    it('TP-601: 应兼容旧统计键并归一化为首页所需结构', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({
        data: {
          person: 12,
          poem: 345,
          books: 67,
          ancient_book: 8,
          places: 90,
          concepts: 21,
        },
      })

      const result = await fetchEntityCounts()

      expect(http.get).toHaveBeenCalledWith('/stats/entity-counts', undefined)
      expect(result).toEqual({
        person: 12,
        poemSet: 345,
        book: 67,
        ancientBook: 8,
        geography: 90,
        concept: 21,
      })
    })

    it('TP-602: 缺失或非法统计字段时应兜底为 0', async () => {
      vi.mocked(http.get).mockResolvedValueOnce({
        data: {
          person: '3',
          poemSet: null,
          book: Number.NaN,
          ancientBooks: '5',
          geography: undefined,
          conceptCount: 'bad',
        },
      })

      const result = await fetchEntityCounts()

      expect(result).toEqual({
        person: 3,
        poemSet: 0,
        book: 0,
        ancientBook: 5,
        geography: 0,
        concept: 0,
      })
    })
  })
})
