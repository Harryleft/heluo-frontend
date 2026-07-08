/**
 * fusionShared IIIF 实体链接回填测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

describe('resolvePrimaryEntityUri — IIIF 向量 URI 解析', () => {
  it('应从 entity_iri (http:// 格式) 提取路径', async () => {
    const { resolvePrimaryEntityUri } = await import('../../server/src/usecases/fusionShared.js')

    const doc = {
      entity_iri: 'http://localhost:8083/iiif/manifests/ancientBook/304/17270_304/manifest.json',
    }
    const result = resolvePrimaryEntityUri('ancient_book', '/processed/vector/iiif/manifest/17270_304_766_1.json', doc)
    expect(result).toBe('/iiif/manifests/304/manifest.json')
  })

  it('应忽略指向向量路径的 entity_iri', async () => {
    const { resolvePrimaryEntityUri } = await import('../../server/src/usecases/fusionShared.js')

    const doc = {
      entity_iri: '/processed/vector/iiif/manifest/17270_304_766_1.json',
    }
    const result = resolvePrimaryEntityUri('ancient_book', '/processed/vector/iiif/manifest/17270_304_766_1.json', doc)
    // 向量路径被过滤，无有效候选 → 返回原始 URI
    expect(result).toBe('/processed/vector/iiif/manifest/17270_304_766_1.json')
  })

  it('应保留 / 开头的候选路径', async () => {
    const { resolvePrimaryEntityUri } = await import('../../server/src/usecases/fusionShared.js')

    const doc = {
      id: '/processed/json-ld/ancient-book/set/book-entry/304.json',
    }
    const result = resolvePrimaryEntityUri('ancient_book', '/processed/vector/iiif/manifest/17270_304_766_1.json', doc)
    expect(result).toBe('/processed/json-ld/ancient-book/set/book-entry/304.json')
  })

  it('非 ancient_book scope 不应触发解析', async () => {
    const { resolvePrimaryEntityUri } = await import('../../server/src/usecases/fusionShared.js')

    const doc = {
      entity_iri: 'http://localhost:8083/iiif/manifests/ancientBook/304/17270_304/manifest.json',
    }
    const result = resolvePrimaryEntityUri('poem', '/processed/vector/iiif/manifest/17270_304_766_1.json', doc)
    expect(result).toBe('/processed/vector/iiif/manifest/17270_304_766_1.json')
  })

  it('空文档应返回原始 URI', async () => {
    const { resolvePrimaryEntityUri } = await import('../../server/src/usecases/fusionShared.js')

    const result = resolvePrimaryEntityUri('ancient_book', '/processed/vector/iiif/manifest/17270_304_766_1.json', {})
    expect(result).toBe('/processed/vector/iiif/manifest/17270_304_766_1.json')
  })
})

describe('iiif 回填 entities detailLink', () => {
  it('manifest 存在时 entity detailLink 应被替换为 IIIF 链接', async () => {
    const { resolvePrimaryEntityUri } = await import('../../server/src/usecases/fusionShared.js')

    // 模拟完整回填逻辑的核心匹配
    const entityUri = '/iiif/manifests/304/manifest.json'
    const iiifMatch = {
      uri: entityUri,
      openUrl: '/iiif?manifest=%2Fiiif%2Fmanifests%2F304%2Fmanifest.json&canvas=http%3A%2F%2Flocalhost%3A8083%2Fiiif%2F3%2Fcanvas%2FancientBook%2F304%2F17270_304%2Fp766',
    }

    const entities = [
      { uri: entityUri, detailLink: '/details?uri=%2Fiiif%2Fmanifests%2F304%2Fmanifest.json' },
      { uri: '/processed/json-ld/poem/set/poem_123.json', detailLink: '/details?uri=...' },
    ]

    // 模拟回填逻辑
    const iiifOpenUrlByEntityUri = new Map()
    if (iiifMatch.uri) iiifOpenUrlByEntityUri.set(iiifMatch.uri, iiifMatch.openUrl)

    for (let i = 0; i < entities.length; i++) {
      const iiifUrl = iiifOpenUrlByEntityUri.get(entities[i].uri)
      if (iiifUrl) {
        entities[i] = { ...entities[i], detailLink: iiifUrl }
      }
    }

    expect(entities[0].detailLink).toContain('/iiif?manifest=')
    expect(entities[0].detailLink).toContain('canvas=')
    expect(entities[1].detailLink).toBe('/details?uri=...')
  })

  it('manifest 不存在时 entity detailLink 保持不变', () => {
    const entityUri = '/iiif/manifests/ancientBook/1181/17270_1181/manifest.json'
    const originalLink = '/details?uri=%2Fiiif%2Fmanifests%2FancientBook%2F1181%2F17270_1181%2Fmanifest.json'

    const entities = [
      { uri: entityUri, detailLink: originalLink },
    ]

    // 没有 iiifMatch（manifest 404 被过滤）
    const iiifOpenUrlByEntityUri = new Map()

    for (let i = 0; i < entities.length; i++) {
      const iiifUrl = iiifOpenUrlByEntityUri.get(entities[i].uri)
      if (iiifUrl) {
        entities[i] = { ...entities[i], detailLink: iiifUrl }
      }
    }

    expect(entities[0].detailLink).toBe(originalLink)
  })
})
