/**
 * useDetailData externalUris 回归测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import { mergeDetailExternalUris, resolveDetailExternalUris } from '@/features/details/hooks/useDetailData'

describe('useDetailData - externalUris 组装', () => {
  it('应优先保留详情层 externalUris（古籍 manifests）', () => {
    const manifests = ['https://api.heluo.site/iiif/manifests/303/manifest.json']

    const result = mergeDetailExternalUris(manifests, {})

    expect(result).toEqual(manifests)
  })

  it('应合并 equivalent 的 HTTP 链接并保持去重', () => {
    const detailUris = ['https://api.heluo.site/iiif/manifests/303/manifest.json']
    const docData = {
      equivalent: [
        { id: 'https://api.heluo.site/iiif/manifests/303/manifest.json' },
        { uri: 'https://example.org/reference/a' },
        'https://example.org/reference/b',
      ],
    }

    const result = mergeDetailExternalUris(detailUris, docData)

    expect(result).toEqual([
      'https://api.heluo.site/iiif/manifests/303/manifest.json',
      'https://example.org/reference/a',
      'https://example.org/reference/b',
    ])
  })

  it('应忽略 equivalent 中的非 HTTP 值与空值', () => {
    const docData = {
      equivalent: [
        '',
        'urn:test:abc',
        { id: '/iiif/manifests/303/manifest.json' },
        { '@id': 'http://localhost:8083/iiif/manifests/303/manifest.json' },
        null,
      ],
    }

    const result = mergeDetailExternalUris([], docData)

    expect(result).toEqual(['http://localhost:8083/iiif/manifests/303/manifest.json'])
  })

  it('person 详情应只展示 equivalent 下的外部链接，忽略详情层 externalUris', () => {
    const detailUris = [
      'https://zh.wikipedia.org/wiki/%E6%9D%9C%E7%94%AB',
      'https://baike.baidu.com/item/%E6%9D%9C%E7%94%AB',
    ]
    const docData = {
      equivalent: [
        { id: 'https://vocab.getty.edu/ulan/500115588' },
        { uri: 'http://data.library.sh.cn/entity/person/f7sz8a6a9l2x8k5x' },
        { '@id': 'https://example.org/person/dufu' },
      ],
    }

    const result = resolveDetailExternalUris('person', detailUris, docData)

    expect(result).toEqual([
      'https://vocab.getty.edu/ulan/500115588',
      'http://data.library.sh.cn/entity/person/f7sz8a6a9l2x8k5x',
      'https://example.org/person/dufu',
    ])
  })

  it('place 详情应只展示 equivalent 下的外部链接，忽略详情层 externalUris', () => {
    const detailUris = ['https://example.org/place/shehong']
    const docData = {
      equivalent: [
        { id: 'https://vocab.getty.edu/tgn/8121321' },
        { uri: 'http://data.library.sh.cn/entity/place/plo54n6wddlrwz2v' },
        { '@id': 'https://example.org/place/other-source' },
      ],
    }

    const result = resolveDetailExternalUris('place', detailUris, docData)

    expect(result).toEqual([
      'https://vocab.getty.edu/tgn/8121321',
      'http://data.library.sh.cn/entity/place/plo54n6wddlrwz2v',
      'https://example.org/place/other-source',
    ])
  })

  it('book 详情不应展示外部链接', () => {
    const detailUris = ['https://example.org/external/a']
    const docData = {
      equivalent: [
        { id: 'https://example.org/external/b' },
      ],
    }

    const result = resolveDetailExternalUris('book', detailUris, docData)

    expect(result).toEqual([])
  })

  it('concept 详情应只展示 equivalent 下的外部链接，忽略详情层 externalUris', () => {
    const result = resolveDetailExternalUris(
      'concept',
      ['https://example.org/concept/a'],
      {
        equivalent: [{ id: 'https://vocab.getty.edu/aat/300026068' }],
      },
    )

    expect(result).toEqual(['https://vocab.getty.edu/aat/300026068'])
  })

  it('ancient_book 详情应保留接口返回的 IIIF manifests', () => {
    const manifests = ['https://api.heluo.site/iiif/3/manifest/ancientBook/2263/17270_2263']

    const result = resolveDetailExternalUris('ancient_book', manifests, {})

    expect(result).toEqual(manifests)
  })

  it('ancient_book 详情合并 equivalent 时只应补充 IIIF manifest 链接', () => {
    const manifests = ['https://api.heluo.site/iiif/manifests/303/manifest.json']
    const docData = {
      equivalent: [
        { id: 'https://api.heluo.site/iiif/3/manifest/ancientBook/2263/17270_2263' },
        { uri: 'https://example.org/reference/303' },
      ],
    }

    const result = resolveDetailExternalUris('ancient_book', manifests, docData)

    expect(result).toEqual([
      'https://api.heluo.site/iiif/manifests/303/manifest.json',
      'https://api.heluo.site/iiif/3/manifest/ancientBook/2263/17270_2263',
    ])
  })
})
