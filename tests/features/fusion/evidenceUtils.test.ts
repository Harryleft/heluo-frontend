/**
 * evidenceUtils 单元测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import {
  buildUnifiedEvidenceItems,
  compareEvidencePriority,
  createFusionParams,
  evidenceDedupeKey,
  formatEvidenceSourceKinds,
  kindWeight,
  mergeEvidenceSourceKinds,
  normalizeEvidenceColorKey,
  normalizeEvidenceText,
  normalizeQuery,
  normalizeScore,
  parseDims,
  parseEvidenceUriFromLink,
  type UnifiedEvidenceItem,
} from '@/features/fusion/evidenceUtils'

describe('evidenceUtils', () => {
  describe('normalizeQuery', () => {
    it('应去除首尾空格', () => {
      expect(normalizeQuery('  杜甫  ')).toBe('杜甫')
    })

    it('空字符串应返回默认值', () => {
      expect(normalizeQuery('')).toBe('杜甫')
      expect(normalizeQuery('   ')).toBe('杜甫')
    })

    it('应支持自定义默认值', () => {
      expect(normalizeQuery('', '李白')).toBe('李白')
    })
  })

  describe('parseDims', () => {
    it('应正确解析逗号分隔的维度', () => {
      expect(parseDims('poem,place,book')).toEqual(['poem', 'place', 'book'])
    })

    it('应过滤非法维度', () => {
      expect(parseDims('poem,invalid,place')).toEqual(['poem', 'place'])
    })

    it('null 应返回默认维度', () => {
      const result = parseDims(null)
      expect(result).toContain('poem')
      expect(result).toContain('place')
    })

    it('空字符串应返回默认维度', () => {
      expect(parseDims('')).toEqual(parseDims(null))
    })

    it('全部非法时应返回默认维度', () => {
      expect(parseDims('invalid,unknown')).toEqual(parseDims(null))
    })

    it('应支持 iiif 维度', () => {
      expect(parseDims('iiif')).toEqual(['iiif'])
    })
  })

  describe('createFusionParams', () => {
    it('应正确创建查询参数', () => {
      const params = createFusionParams('杜甫', ['poem', 'place'])
      expect(params.get('q')).toBe('杜甫')
      expect(params.get('dims')).toBe('poem,place')
    })

    it('空查询不应设置 q 参数', () => {
      const params = createFusionParams('', ['poem'])
      expect(params.get('q')).toBeNull()
      expect(params.get('dims')).toBe('poem')
    })
  })

  describe('normalizeEvidenceColorKey', () => {
    it('应返回有效的颜色键', () => {
      expect(normalizeEvidenceColorKey('person')).toBe('person')
      expect(normalizeEvidenceColorKey('POEM')).toBe('poem')
    })

    it('无效值应返回 fallback', () => {
      expect(normalizeEvidenceColorKey('invalid')).toBe('other')
      expect(normalizeEvidenceColorKey('invalid', 'citation')).toBe('citation')
    })

    it('空值应返回 fallback', () => {
      expect(normalizeEvidenceColorKey('')).toBe('other')
    })
  })

  describe('normalizeScore', () => {
    it('应保留 4 位小数', () => {
      expect(normalizeScore(0.123456)).toBe(0.1235)
      expect(normalizeScore(0.99999)).toBe(1)
    })

    it('非有限值应返回 0', () => {
      expect(normalizeScore(NaN)).toBe(0)
      expect(normalizeScore(Infinity)).toBe(0)
      expect(normalizeScore(-Infinity)).toBe(0)
    })
  })

  describe('normalizeEvidenceText', () => {
    it('应去除首尾空格', () => {
      expect(normalizeEvidenceText('  文本  ')).toBe('文本')
    })

    it('null/undefined 应返回空字符串', () => {
      expect(normalizeEvidenceText(null)).toBe('')
      expect(normalizeEvidenceText(undefined)).toBe('')
    })
  })

  describe('kindWeight', () => {
    it('iiif 应有最高权重', () => {
      expect(kindWeight('iiif')).toBe(40)
    })

    it('citation 应有第二高权重', () => {
      expect(kindWeight('citation')).toBe(30)
    })

    it('entity 应有第三高权重', () => {
      expect(kindWeight('entity')).toBe(20)
    })

    it('sidebar 应有最低权重', () => {
      expect(kindWeight('sidebar')).toBe(10)
    })
  })

  describe('parseEvidenceUriFromLink', () => {
    it('应从相对链接中解析 URI', () => {
      const link = '/details?uri=%2Fprocessed%2Fjson-ld%2Fperson%2F17270.json'
      expect(parseEvidenceUriFromLink(link)).toBe('/processed/json-ld/person/17270.json')
    })

    it('应从绝对链接中解析 URI', () => {
      const link = 'http://example.com/details?uri=%2Ftest.json'
      expect(parseEvidenceUriFromLink(link)).toBe('/test.json')
    })

    it('非 details 路径应返回空字符串', () => {
      expect(parseEvidenceUriFromLink('http://example.com/other?uri=test')).toBe('')
    })

    it('空链接应返回空字符串', () => {
      expect(parseEvidenceUriFromLink('')).toBe('')
      expect(parseEvidenceUriFromLink('  ')).toBe('')
    })

    it('无效 URL 应返回空字符串', () => {
      expect(parseEvidenceUriFromLink('http://[invalid')).toBe('')
    })
  })

  describe('mergeEvidenceSourceKinds', () => {
    it('应合并并去重', () => {
      const result = mergeEvidenceSourceKinds(['entity'], ['citation', 'entity'])
      expect(result).toEqual(['citation', 'entity'])
    })

    it('应按权重排序', () => {
      const result = mergeEvidenceSourceKinds(['sidebar'], ['iiif', 'entity'])
      expect(result).toEqual(['iiif', 'entity', 'sidebar'])
    })
  })

  describe('formatEvidenceSourceKinds', () => {
    it('应格式化为中文标签', () => {
      expect(formatEvidenceSourceKinds(['entity', 'citation'])).toBe('实体、证据')
    })

    it('单个类型应正确格式化', () => {
      expect(formatEvidenceSourceKinds(['iiif'])).toBe('IIIF')
    })
  })

  describe('evidenceDedupeKey', () => {
    it('IIIF 类型应使用 manifest + canvasId', () => {
      const item: UnifiedEvidenceItem = {
        itemId: 'test',
        kind: 'iiif',
        colorKey: 'iiif',
        typeLabel: 'IIIF',
        title: 'test',
        snippet: 'test',
        link: '/test',
        score: 0,
        sourceKinds: ['iiif'],
        manifest: 'manifest-123',
        canvasId: 'canvas-456',
      }
      expect(evidenceDedupeKey(item)).toBe('iiif:manifest-123:canvas-456')
    })

    it('有 URI 应使用 URI', () => {
      const item: UnifiedEvidenceItem = {
        itemId: 'test',
        kind: 'entity',
        colorKey: 'person',
        typeLabel: 'test',
        title: 'test',
        snippet: 'test',
        link: '/test',
        uri: '/entities/123.json',
        score: 0,
        sourceKinds: ['entity'],
      }
      expect(evidenceDedupeKey(item)).toBe('uri:/entities/123.json')
    })

    it('无 URI 有 link 应使用 link', () => {
      const item: UnifiedEvidenceItem = {
        itemId: 'test',
        kind: 'citation',
        colorKey: 'citation',
        typeLabel: 'test',
        title: 'test',
        snippet: 'test',
        link: '/details?uri=test',
        score: 0,
        sourceKinds: ['citation'],
      }
      expect(evidenceDedupeKey(item)).toBe('link:/details?uri=test')
    })

    it('fallback 应使用 kind + title + snippet', () => {
      const item: UnifiedEvidenceItem = {
        itemId: 'test',
        kind: 'sidebar',
        colorKey: 'sidebar',
        typeLabel: 'test',
        title: '测试标题',
        snippet: '测试摘要',
        link: '',
        score: 0,
        sourceKinds: ['sidebar'],
      }
      expect(evidenceDedupeKey(item)).toBe('sidebar:测试标题:测试摘要')
    })
  })

  describe('compareEvidencePriority', () => {
    const createItem = (score: number, kind: UnifiedEvidenceKind): UnifiedEvidenceItem => ({
      itemId: `test-${score}-${kind}`,
      kind,
      colorKey: 'other',
      typeLabel: 'test',
      title: 'test',
      snippet: 'test',
      link: '/test',
      score,
      sourceKinds: [kind],
    })

    it('高分应有更高优先级', () => {
      const high = createItem(0.9, 'entity')
      const low = createItem(0.5, 'entity')
      expect(compareEvidencePriority(high, low)).toBeGreaterThan(0)
    })

    it('分数相同应按类型权重排序', () => {
      const iiif = createItem(0.5, 'iiif')
      const entity = createItem(0.5, 'entity')
      expect(compareEvidencePriority(iiif, entity)).toBeGreaterThan(0)
    })

    it('相同分数和类型应返回 0', () => {
      const item1 = createItem(0.5, 'entity')
      const item2 = createItem(0.5, 'entity')
      expect(compareEvidencePriority(item1, item2)).toBe(0)
    })
  })

  describe('buildUnifiedEvidenceItems', () => {
    it('应正确构建证据列表', () => {
      const entities = [
        { id: '1', type: 'person', title: '杜甫', uri: '/test.json', score: 0.9, snippet: '诗人', detailLink: '/details' },
      ]
      const result = buildUnifiedEvidenceItems(entities, [], [], [])

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('杜甫')
      expect(result[0].kind).toBe('entity')
      expect(result[0].score).toBe(0.9)
    })

    it('应按分数降序排序', () => {
      const entities = [
        { id: '1', type: 'person', title: '低分', uri: '/1.json', score: 0.3, snippet: '', detailLink: '/1' },
        { id: '2', type: 'person', title: '高分', uri: '/2.json', score: 0.9, snippet: '', detailLink: '/2' },
      ]
      const result = buildUnifiedEvidenceItems(entities, [], [], [])

      expect(result[0].title).toBe('高分')
      expect(result[1].title).toBe('低分')
    })

    it('应合并相同 URI 的证据', () => {
      const entities = [
        { id: '1', type: 'person', title: '杜甫', uri: '/same.json', score: 0.9, snippet: '实体', detailLink: '/1' },
      ]
      const citations = [
        { citationId: 'c1', sourceType: 'poem', uri: '/same.json', title: '杜甫诗句', snippet: '引用', scoreDetail: { finalScore: 0.8 } },
      ]
      const result = buildUnifiedEvidenceItems(entities, citations, [], [])

      expect(result).toHaveLength(1)
      expect(result[0].sourceKinds).toContain('entity')
      expect(result[0].sourceKinds).toContain('citation')
    })

    it('应处理空输入', () => {
      const result = buildUnifiedEvidenceItems([], [], [], [])
      expect(result).toHaveLength(0)
    })

    it('应正确处理 citations', () => {
      const citations = [
        { citationId: 'c1', sourceType: 'poem', uri: '/poem.json', title: '春望', snippet: '国破山河在', scoreDetail: { finalScore: 0.85 } },
      ]
      const result = buildUnifiedEvidenceItems([], citations, [], [])

      expect(result).toHaveLength(1)
      expect(result[0].kind).toBe('citation')
      expect(result[0].score).toBe(0.85)
    })

    it('IIIF manifest 引用应改写为 iiif 查看器链接', () => {
      const manifestUri = '/processed/vector/iiif/manifest/17270_1181_1397_1.json'
      const citations = [
        { citationId: 'c1', sourceType: 'iiif', uri: manifestUri, title: '卷十五', snippet: '命中影像文本', scoreDetail: { finalScore: 0.85 } },
      ]
      const result = buildUnifiedEvidenceItems([], citations, [], [])

      expect(result).toHaveLength(1)
      expect(result[0].link).toBe(`/iiif?manifest=${encodeURIComponent(manifestUri)}`)
    })

    it('应正确处理 iiifMatches', () => {
      const iiifMatches = [
        {
          matchId: 'i1',
          manifest: 'manifest-1',
          canvasId: 'canvas-1',
          canvasLabel: '卷一',
          thumbnailUrl: 'http://localhost:8182/iiif/3/demo.jpg/full/!320,320/0/default.jpg',
          segmentText: '文本',
          score: 0.7,
          openUrl: '/iiif?m=1',
        },
      ]
      const result = buildUnifiedEvidenceItems([], [], iiifMatches, [])

      expect(result).toHaveLength(1)
      expect(result[0].kind).toBe('iiif')
      expect(result[0].manifest).toBe('manifest-1')
      expect(result[0].thumbnailUrl).toContain('/iiif/3/demo.jpg/')
    })

    it('应正确处理 sidebarItems', () => {
      const sidebarItems = [
        { itemId: 's1', itemType: 'related', title: '相关内容', snippet: '描述', link: '/details?uri=%2Ftest.json' },
      ]
      const result = buildUnifiedEvidenceItems([], [], [], sidebarItems)

      expect(result).toHaveLength(1)
      expect(result[0].kind).toBe('sidebar')
      expect(result[0].uri).toBe('/test.json')
    })

    it('侧边栏中的 IIIF manifest 包装链接应重定向到 iiif 查看器', () => {
      const manifestUri = '/processed/vector/iiif/manifest/17270_1181_1397_1.json'
      const sidebarItems = [
        {
          itemId: 's1',
          itemType: 'iiif',
          title: '卷十五影像',
          snippet: '古籍影像来源',
          link: `/details?uri=${encodeURIComponent(manifestUri)}`,
        },
      ]
      const result = buildUnifiedEvidenceItems([], [], [], sidebarItems)

      expect(result).toHaveLength(1)
      expect(result[0].link).toBe(`/iiif?manifest=${encodeURIComponent(manifestUri)}`)
    })
  })
})
