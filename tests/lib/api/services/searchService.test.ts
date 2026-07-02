/**
 * searchService 单元测试
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockSearchApiResponse } from '../__mocks__/responses'
import { searchByDimsService, searchUnifiedService } from '@/lib/api/services/searchService'

vi.mock('@/lib/api/repositories/v1Repository', () => ({
  searchUnifiedRepo: vi.fn(),
}))

import { searchUnifiedRepo } from '@/lib/api/repositories/v1Repository'

describe('searchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('searchUnifiedService', () => {
    it('应转调 repository 并返回响应', async () => {
      vi.mocked(searchUnifiedRepo).mockResolvedValueOnce(mockSearchApiResponse)

      const result = await searchUnifiedService('杜甫', 'person')

      expect(searchUnifiedRepo).toHaveBeenCalledWith('杜甫', 'person')
      expect(result).toEqual(mockSearchApiResponse)
    })

    it('传入 mode 时应透传给 repository', async () => {
      vi.mocked(searchUnifiedRepo).mockResolvedValueOnce(mockSearchApiResponse)

      const result = await searchUnifiedService('杜甫', 'person', 'keyword')

      expect(searchUnifiedRepo).toHaveBeenCalledWith('杜甫', 'person', 'keyword')
      expect(result).toEqual(mockSearchApiResponse)
    })

    it('传入分页参数时应透传给 repository', async () => {
      vi.mocked(searchUnifiedRepo).mockResolvedValueOnce(mockSearchApiResponse)

      const result = await searchUnifiedService('杜甫', 'poem', 'keyword', { page: 3, pageSize: 12 })

      expect(searchUnifiedRepo).toHaveBeenCalledWith('杜甫', 'poem', 'keyword', { page: 3, pageSize: 12 })
      expect(result).toEqual(mockSearchApiResponse)
    })

    it('空查询应归一化为通配符', async () => {
      vi.mocked(searchUnifiedRepo).mockResolvedValueOnce(mockSearchApiResponse)

      await searchUnifiedService('   ', 'person')

      expect(searchUnifiedRepo).toHaveBeenCalledWith('*', 'person')
    })
  })

  describe('searchByDimsService', () => {
    it('全部维度成功时返回完整结果', async () => {
      vi.mocked(searchUnifiedRepo).mockResolvedValue(mockSearchApiResponse)

      const result = await searchByDimsService('杜甫', ['person', 'poem'])

      expect(searchUnifiedRepo).toHaveBeenCalledTimes(2)
      expect(result.person.success).toBe(true)
      expect(result.poem.success).toBe(true)
    })

    it('单维度异常时应保留其他维度结果并返回错误维度', async () => {
      vi.mocked(searchUnifiedRepo)
        .mockResolvedValueOnce(mockSearchApiResponse)
        .mockRejectedValueOnce(new Error('network down'))

      const result = await searchByDimsService('杜甫', ['person', 'place'])

      expect(result.person.success).toBe(true)
      expect(result.place.success).toBe(false)
      if (!result.place.success) {
        expect(result.place.error.code).toBe('UPSTREAM_ERROR')
      }
    })

    it('分维度检索在空查询时应使用通配符', async () => {
      vi.mocked(searchUnifiedRepo).mockResolvedValue(mockSearchApiResponse)

      await searchByDimsService('', ['person', 'poem'])

      expect(searchUnifiedRepo).toHaveBeenCalledWith('*', 'person')
      expect(searchUnifiedRepo).toHaveBeenCalledWith('*', 'poem')
    })
  })
})
