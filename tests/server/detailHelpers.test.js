import { describe, expect, it, vi } from 'vitest'
import {
  buildPossibleUris,
  extractCandidateUris,
  inferEntityType,
} from '../../server/src/usecases/detail/uri.js'
import { createSimpleCache } from '../../server/src/usecases/detail/cache.js'
import {
  buildIiifMarklogicCandidates,
  buildIiifSearchResponse,
  extractIiifSearchMatches,
  parseIiifPublicPath,
  rewriteIiifPublicDocument,
} from '../../server/src/usecases/detail/iiif.js'
import { createSearchWithFallback } from '../../server/src/usecases/detail/search.js'

describe('详情用例提取出的无状态逻辑', () => {
  it('应保持实体类型推断与 ID URI 候选顺序', () => {
    expect(inferEntityType('/processed/json-ld/person/dufu.json')).toBe('person')
    expect(inferEntityType('/processed/vector/poem/dufu.json')).toBe('poem')
    expect(inferEntityType('/unknown/item.json')).toBe('entity')
    expect(buildPossibleUris('dufu', 'poem')).toEqual([
      '/processed/json-ld/poem/set/dufu.json',
      '/processed/json-ld/poem/set/dufu',
      '/processed/json-ld/poem/text/dufu.json',
      '/processed/json-ld/poem/text/dufu',
    ])
  })

  it('应按深度优先顺序提取去重后的候选 URI', () => {
    expect(extractCandidateUris({
      first: '/one',
      nested: ['https://example.com/two', '/one', 'ignored'],
    })).toEqual(['/one', 'https://example.com/two'])
  })

  it('应保持缓存的 TTL、LRU 和清理行为', () => {
    vi.useFakeTimers()
    const cache = createSimpleCache(1000, 100)

    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
    vi.advanceTimersByTime(1001)
    expect(cache.get('a')).toBeNull()
    expect(cache.size()).toBe(0)
    cache.set('b', 2)
    cache.clear()
    expect(cache.size()).toBe(0)
    vi.useRealTimers()
  })

  it('应保持 IIIF 公共路径与 MarkLogic 候选 URI 规则', () => {
    expect(parseIiifPublicPath('https://example.com/iiif/manifests/303/manifest.json'))
      .toBe('/iiif/manifests/303/manifest.json')
    expect(buildIiifMarklogicCandidates('/iiif/3/collection/person/303')).toEqual([
      '/processed/iiif/collections/303/collection.json',
    ])
  })

  it('应递归改写 IIIF 文档中的本地公开地址', () => {
    const document = {
      id: 'http://localhost:8083/iiif/manifests/303/manifest.json',
      nested: ['http://localhost:8083/iiif/3/collection/person/303'],
    }

    expect(rewriteIiifPublicDocument(document, 'https://api.example.com')).toEqual({
      id: 'https://api.example.com/iiif/manifests/303/manifest.json',
      nested: ['https://api.example.com/iiif/3/collection/person/303'],
    })
  })

  it('应从 manifest 文本生成 IIIF Search 响应', () => {
    const matches = extractIiifSearchMatches({
      items: [{
        id: 'canvas-1',
        annotations: [{
          items: [{ motivation: 'supplementing', body: { value: '卷十五正文示例' } }],
        }],
      }],
    }, '正文')
    const response = buildIiifSearchResponse({
      query: '正文',
      searchUrl: 'https://api.example.com/iiif/search',
      results: matches,
    })

    expect(response.resources[0].on).toBe('canvas-1')
    expect(response.hits[0].match).toContain('正文')
    expect(response['@id']).toContain('q=%E6%AD%A3%E6%96%87')
  })

  it('应按目录优先、集合回退执行搜索', async () => {
    const mlSearchByDirectory = vi.fn().mockResolvedValue({ results: [] })
    const mlSearchByCollection = vi.fn().mockResolvedValue({
      total: 1,
      results: [{ uri: '/matched' }],
    })
    const search = createSearchWithFallback({ mlSearchByDirectory, mlSearchByCollection })

    await expect(search({
      query: 'dufu',
      pageLength: 10,
      directories: ['/directory'],
      collections: ['/collection'],
    })).resolves.toEqual({ total: 1, results: [{ uri: '/matched' }] })
    expect(mlSearchByDirectory).toHaveBeenCalledWith('/directory', 'dufu', 10)
    expect(mlSearchByCollection).toHaveBeenCalledWith('/collection', 'dufu', 10)
  })
})
