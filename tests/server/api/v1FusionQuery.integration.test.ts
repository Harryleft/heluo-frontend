/**
 * /api/v1/fusion/query 集成测试
 * @vitest-environment node
 */

import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app, resetMarklogicFetch, setMarklogicFetchForTest } from '../../../server/src/index.js'

const DUFU_HIT_QUESTIONS = Object.freeze([
  '杜甫有哪些代表诗文？',
  '请给出杜甫相关古籍线索',
  '杜甫相关古籍是否有 IIIF 画布可查看？',
  '请基于诗文与古籍总结杜甫关联证据',
  '从古籍影像中定位杜甫相关卷次片段',
])

const DUFU_TARGET_QUESTIONS = Object.freeze({
  poem: Object.freeze([
    '杜甫诗文中可作为代表作的有哪些？',
    '请列出杜甫相关诗文并给出一句摘要',
  ]),
  ancientBook: Object.freeze([
    '杜甫在古籍资料中有哪些可追溯线索？',
    '请给出杜甫相关古籍条目与关联说明',
  ]),
  iiif: Object.freeze([
    '请定位杜甫古籍影像对应的 IIIF 画布片段',
    '杜甫相关古籍能否直接打开对应 Canvas？',
  ]),
  detailLink: Object.freeze([
    '请给出杜甫相关实体并附可点击详情入口',
    '我想查看杜甫关联图书与古籍详情，请返回可跳转结果',
  ]),
})

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload
    },
  }
}

function createFusionMarklogicFetchMock() {
  const personRows = [{ uri: '/processed/json-ld/person/17270.json', score: 0.42, confidence: 0.08 }]
  const poemRows = [{ uri: '/processed/json-ld/poem/set/poem_31190.json', score: 0.44, confidence: 0.09 }]
  const ancientRows = [{ uri: '/processed/json-ld/ancient-book/set/book-entry/17270_303.json', score: 0.36, confidence: 0.05 }]

  const docs = {
    '/processed/json-ld/person/17270.json': {
      title: '杜甫',
      description: '唐代诗人',
    },
    '/processed/json-ld/poem/set/poem_31190.json': {
      title: '登高',
      description: '风急天高猿啸哀，渚清沙白鸟飞回',
      full_text: '风急天高猿啸哀，渚清沙白鸟飞回。无边落木萧萧下，不尽长江滚滚来。',
      author_name: '杜甫',
      dynasty: '唐',
    },
    '/processed/json-ld/ancient-book/set/book-entry/17270_303.json': {
      title: '杜诗编年',
      description: '相关古籍条目',
      access_point: [{ id: 'http://localhost:8083/iiif/manifests/303/manifest.json' }],
    },
  }

  const iiifManifest = {
    id: 'http://localhost:8083/iiif/manifests/303/manifest.json',
    items: [
      {
        id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p1',
        label: { none: ['卷一-1a'] },
      },
    ],
  }

  return async (url) => {
    const parsed = new URL(String(url))

    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      const q = String(parsed.searchParams.get('q') || '').trim()
      if (directory === '/processed/json-ld/person/') {
        return jsonResponse({ total: 1, results: personRows })
      }
      if (directory === '/processed/json-ld/poem/set/') {
        if (q.includes('登高') && !q.includes('诗文')) {
          return jsonResponse({ total: 1, results: poemRows })
        }
        return jsonResponse({ total: 0, results: [] })
      }
      if (directory === '/processed/json-ld/ancient-book/set/book-entry/') {
        return jsonResponse({ total: 1, results: ancientRows })
      }
      return jsonResponse({ total: 0, results: [] })
    }

    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      return jsonResponse(docs[uri] || {})
    }

    if (parsed.pathname === '/iiif/manifests/303/manifest.json') {
      return jsonResponse(iiifManifest)
    }

    return jsonResponse({}, 404)
  }
}

function createFusionMarklogicFetchMockForIiifPrimaryScope() {
  const personRows = [{ uri: '/processed/json-ld/person/17270.json', score: 0.42, confidence: 0.08 }]
  const poemRows = [{ uri: '/processed/json-ld/poem/set/poem_31190.json', score: 0.44, confidence: 0.09 }]
  const ancientRows = [{ uri: '/processed/json-ld/ancient-book/set/book-entry/17270_303.json', score: 0.36, confidence: 0.05 }]
  const iiifRows = [{ uri: '/processed/vector/iiif/manifest/17270_303_1_1.json', score: 0.48, confidence: 0.09 }]

  const docs = {
    '/processed/json-ld/person/17270.json': {
      title: '杜甫',
      description: '唐代诗人',
    },
    '/processed/json-ld/poem/set/poem_31190.json': {
      title: '登高',
      description: '风急天高猿啸哀，渚清沙白鸟飞回',
    },
    '/processed/json-ld/ancient-book/set/book-entry/17270_303.json': {
      title: '杜诗编年',
      description: '相关古籍条目',
    },
    '/processed/vector/iiif/manifest/17270_303_1_1.json': {
      title: '杜诗编年 卷一',
      description: '卷一相关影像片段',
      text_norm_zh: '杜诗编年 卷一相关影像片段',
      evidence: {
        manifest_id: '17270_303',
        canvas_id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p9',
        uri: '/processed/iiif/manifests/303/manifest.json',
      },
    },
    '/processed/iiif/manifests/303/manifest.json': {
      id: 'http://localhost:8083/iiif/manifests/303/manifest.json',
      items: [
        {
          id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p1',
          label: { none: ['卷一-1a'] },
        },
        {
          id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p9',
          label: { none: ['卷一-5a'] },
        },
      ],
    },
  }

  const iiifManifest = {
    id: 'http://localhost:8083/iiif/manifests/303/manifest.json',
    items: [
      {
        id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p1',
        label: { none: ['卷一-1a'] },
      },
      {
        id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p9',
        label: { none: ['卷一-5a'] },
      },
    ],
  }

  return async (url) => {
    const parsed = new URL(String(url))

    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/json-ld/person/') {
        return jsonResponse({ total: 1, results: personRows })
      }
      if (directory === '/processed/json-ld/poem/set/') {
        return jsonResponse({ total: 1, results: poemRows })
      }
      if (directory === '/processed/json-ld/ancient-book/set/book-entry/') {
        return jsonResponse({ total: 1, results: ancientRows })
      }
      if (directory === '/processed/vector/iiif/') {
        return jsonResponse({ total: 1, results: iiifRows })
      }

      return jsonResponse({ total: 0, results: [] })
    }

    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      return jsonResponse(docs[uri] || {})
    }

    if (parsed.pathname === '/iiif/manifests/303/manifest.json') {
      return jsonResponse(iiifManifest)
    }

    if (parsed.pathname === '/processed/iiif/manifests/303/manifest.json') {
      return jsonResponse(iiifManifest)
    }

    return jsonResponse({}, 404)
  }
}

function createFusionMarklogicFetchMockForIiifCanonicalManifest() {
  const iiifRows = [
    { uri: '/processed/vector/iiif/manifest/17270_304_1_1.json', score: 0.51, confidence: 0.08 },
    { uri: '/processed/vector/iiif/manifest/17270_304_2_1.json', score: 0.49, confidence: 0.07 },
  ]

  const docs = {
    '/processed/vector/iiif/manifest/17270_304_1_1.json': {
      title: '304 卷一',
      text_norm_zh: '304 古籍卷一注释文本',
      evidence: {
        canvas_id: 'http://localhost:8083/iiif/3/canvas/ancientBook/304/17270_304/p15',
        manifest: '/processed/vector/iiif/manifest/17270_304_1_1.json',
      },
    },
    '/processed/vector/iiif/manifest/17270_304_2_1.json': {
      title: '304 卷二',
      text_norm_zh: '304 古籍卷二注释文本',
      evidence: {
        canvas_id: 'http://localhost:8083/iiif/3/canvas/ancientBook/304/17270_304/p15',
        uri: '/iiif/manifests/17270_304?page=550',
      },
    },
    '/processed/iiif/manifests/304/manifest.json': {
      id: 'http://localhost:8083/iiif/manifests/304/manifest.json',
      items: [
        {
          id: 'http://localhost:8083/iiif/3/canvas/ancientBook/304/17270_304/p15',
          label: { none: ['第15页 (卷一-8a)'] },
          items: [
            {
              items: [
                {
                  body: {
                    id: 'http://localhost:8182/iiif/3/ancientBook%2F304%2F17270_304%2Fp15.jpg/full/max/0/default.jpg',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  }
  const manifest304 = {
    id: 'http://localhost:8083/iiif/manifests/304/manifest.json',
    items: [
      {
        id: 'http://localhost:8083/iiif/3/canvas/ancientBook/304/17270_304/p15',
        label: { none: ['第15页 (卷一-8a)'] },
        items: [
          {
            items: [
              {
                body: {
                  id: 'http://localhost:8182/iiif/3/ancientBook%2F304%2F17270_304%2Fp15.jpg/full/max/0/default.jpg',
                },
              },
            ],
          },
        ],
      },
    ],
  }

  const stats = { manifestFetchCount: 0 }
  const mock = async (url) => {
    const parsed = new URL(String(url))

    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/vector/iiif/') {
        return jsonResponse({ total: iiifRows.length, results: iiifRows })
      }
      return jsonResponse({ total: 0, results: [] })
    }

    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      return jsonResponse(docs[uri] || {})
    }

    if (parsed.pathname === '/iiif/manifests/304/manifest.json') {
      stats.manifestFetchCount += 1
      return jsonResponse(manifest304)
    }

    if (parsed.pathname.startsWith('/iiif/manifests/')) {
      stats.manifestFetchCount += 1
      return jsonResponse({}, 404)
    }

    return jsonResponse({}, 404)
  }

  return { mock, stats }
}

function createFusionMarklogicFetchMockForIiifManifestLiteral() {
  const iiifRows = [{ uri: '/processed/vector/iiif/manifest/literal_manifest.json', score: 0.45, confidence: 0.08 }]
  const docs = {
    '/processed/vector/iiif/manifest/literal_manifest.json': {
      title: 'literal manifest',
      text_norm_zh: 'manifest 字面量路径测试',
      evidence: {
        canvas_id: 'http://localhost:8083/iiif/3/canvas/ancientBook/304/17270_304/p1',
        manifest: '/iiif/manifests/manifest.json',
      },
    },
  }
  const literalManifest = {
    id: 'http://localhost:8083/iiif/manifests/manifest.json',
    items: [
      {
        id: 'http://localhost:8083/iiif/3/canvas/ancientBook/304/17270_304/p1',
        label: { none: ['第1页'] },
        items: [
          {
            items: [
              {
                body: {
                  id: 'http://localhost:8182/iiif/3/ancientBook%2F304%2F17270_304%2Fp1.jpg/full/max/0/default.jpg',
                },
              },
            ],
          },
        ],
      },
    ],
  }

  return async (url) => {
    const parsed = new URL(String(url))
    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/vector/iiif/') {
        return jsonResponse({ total: iiifRows.length, results: iiifRows })
      }
      return jsonResponse({ total: 0, results: [] })
    }
    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      return jsonResponse(docs[uri] || {})
    }
    if (parsed.pathname === '/iiif/manifests/manifest.json') {
      return jsonResponse(literalManifest)
    }
    return jsonResponse({}, 404)
  }
}

function createFusionMarklogicFetchMockForIiifManifestCanvasConflict() {
  const iiifRows = [{ uri: '/processed/vector/iiif/manifest/17270_303_345_1.json', score: 0.52, confidence: 0.08 }]
  const docs = {
    '/processed/vector/iiif/manifest/17270_303_345_1.json': {
      title: '杜诗攟巻四',
      text_norm_zh: '杜诗攟巻四相关注释片段',
      evidence: {
        // 模拟上游 manifest 写成全集 ID，但 canvas 明确指向 303 分册
        manifest: '/iiif/manifests/17270/manifest.json',
        canvas_id: 'http://localhost:8083/iiif/3/canvas/ancientBook/17270/303/p347',
      },
    },
  }
  const manifest303 = {
    id: 'http://localhost:8083/iiif/manifests/303/manifest.json',
    items: [
      {
        id: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p347',
        label: { none: ['第347页'] },
        items: [
          {
            items: [
              {
                body: {
                  id: 'http://localhost:8182/iiif/3/ancientBook%2F303%2F17270_303%2Fp347.jpg/full/max/0/default.jpg',
                },
              },
            ],
          },
        ],
      },
    ],
  }

  return async (url) => {
    const parsed = new URL(String(url))
    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/vector/iiif/') {
        return jsonResponse({ total: iiifRows.length, results: iiifRows })
      }
      return jsonResponse({ total: 0, results: [] })
    }
    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      return jsonResponse(docs[uri] || {})
    }
    if (parsed.pathname === '/iiif/manifests/303/manifest.json') {
      return jsonResponse(manifest303)
    }
    return jsonResponse({}, 404)
  }
}

function createFusionMarklogicFetchMockForIiifTitleFallback() {
  const iiifRows = [{ uri: '/processed/vector/iiif/manifest/17270_1181_1397_1.json', score: 0.52, confidence: 0.08 }]
  const docs = {
    '/processed/vector/iiif/manifest/17270_1181_1397_1.json': {
      title: '17270_1181_1397_1',
      text_norm_zh: '卷十五相关影像片段',
      evidence: {
        manifest_id: '17270_1181',
        canvas_id: 'http://localhost:8083/iiif/3/canvas/ancientBook/1181/17270_1181/p1397',
        uri: '/processed/iiif/manifests/1181/manifest.json',
      },
    },
    '/processed/iiif/manifests/1181/manifest.json': {
      id: 'http://localhost:8083/iiif/manifests/1181/manifest.json',
      label: { none: ['集千家注杜工部诗集'] },
      items: [
        {
          id: 'http://localhost:8083/iiif/3/canvas/ancientBook/1181/17270_1181/p1397',
          label: { none: ['卷十五-1a'] },
        },
      ],
    },
  }

  return async (url) => {
    const parsed = new URL(String(url))
    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      if (directory === '/processed/vector/iiif/') {
        return jsonResponse({
          total: iiifRows.length,
          results: [
        {
          ...iiifRows[0],
          title: '17270_1181_1397_1',
        },
      ],
        })
      }
      return jsonResponse({ total: 0, results: [] })
    }
    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      return jsonResponse(docs[uri] || {})
    }
    return jsonResponse({}, 404)
  }
}

describe('POST /api/v1/fusion/query', () => {
  let server
  let baseUrl = ''

  beforeAll(async () => {
    server = app.listen(0)
    const address = server.address()
    const port = (address as AddressInfo).port
    baseUrl = `http://127.0.0.1:${port}`
  })

  beforeEach(() => {
    setMarklogicFetchForTest(createFusionMarklogicFetchMock())
  })

  afterAll(async () => {
    resetMarklogicFetch()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  })

  it('应返回回答、实体、证据、IIIF 与侧栏联动数据', async () => {
    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '杜甫有哪些代表诗文和古籍线索？',
        mode: 'hybrid',
        dims: ['person', 'poem', 'book', 'ancient_book'],
        topK: 10,
        includeIiif: true,
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.answer.text.length).toBeGreaterThan(0)
    expect(result.data.entities.length).toBeGreaterThanOrEqual(1)
    expect(result.data.citations.length).toBeGreaterThanOrEqual(1)
    expect(result.data.sidebar.items.length).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(result.data.iiifMatches)).toBe(true)
    if (result.data.iiifMatches.length > 0) {
      expect(result.data.iiifMatches[0].segmentText.length).toBeGreaterThan(0)
      expect(result.data.iiifMatches[0].canvasId).toContain('/iiif/3/canvas/')
      expect(result.data.iiifMatches[0].canvasLabel.length).toBeGreaterThan(0)
      expect(result.data.iiifMatches[0].manifest).toContain('/iiif/manifests/')
      expect(result.data.iiifMatches[0].openUrl).toContain('/iiif?')
    }
    expect(result.data.queryPlan.normalizedQuery.length).toBeGreaterThan(0)
    expect(result.data.queryPlan.ragQueries.length).toBeGreaterThan(0)
    expect(result.data.entities[0].detailLink).toContain('/details?uri=')
    expect(result.data.trace.requestId).toContain('fusion-')
  })

  it('应接收对话历史并返回稳定问答结果', async () => {
    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '杜甫有哪些登高的诗文？',
        mode: 'hybrid',
        dims: ['person', 'poem', 'book', 'ancient_book'],
        topK: 10,
        includeIiif: false,
        conversationHistory: [
          { role: 'user', content: '先给我杜甫的代表诗文。' },
          { role: 'assistant', content: '可以先看《登高》《春望》等。' },
        ],
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(typeof result.data.answer.text).toBe('string')
    expect(result.data.answer.text.length).toBeGreaterThan(0)
    expect(Array.isArray(result.data.entities)).toBe(true)
    expect(result.data.entities.length).toBeGreaterThan(0)
  })

  it('杜甫问题集应稳定命中诗文/古籍并可返回 IIIF 线索', async () => {
    for (const question of DUFU_HIT_QUESTIONS) {
      const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: question,
          mode: 'hybrid',
          dims: ['person', 'poem', 'book', 'ancient_book'],
          topK: 12,
          includeIiif: true,
        }),
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.answer.text.length).toBeGreaterThan(0)
      expect(result.data.entities.length).toBeGreaterThan(0)
      expect(result.data.citations.length).toBeGreaterThan(0)
      expect(Array.isArray(result.data.iiifMatches)).toBe(true)
    }
  })

  it('杜甫分类型问题集应命中对应融合字段', async () => {
    for (const question of DUFU_TARGET_QUESTIONS.poem) {
      const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: question,
          mode: 'hybrid',
          dims: ['person', 'poem', 'book', 'ancient_book'],
          topK: 12,
          includeIiif: true,
        }),
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.answer.text.length).toBeGreaterThan(0)
      expect(result.data.queryPlan.ragQueries.length).toBeGreaterThan(0)
    }

    for (const question of DUFU_TARGET_QUESTIONS.ancientBook) {
      const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: question,
          mode: 'hybrid',
          dims: ['person', 'poem', 'book', 'ancient_book'],
          topK: 12,
          includeIiif: true,
        }),
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.entities.length).toBeGreaterThan(0)
      expect(result.data.sidebar.items.length).toBeGreaterThan(0)
    }

    for (const question of DUFU_TARGET_QUESTIONS.iiif) {
      const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: question,
          mode: 'hybrid',
          dims: ['person', 'poem', 'book', 'ancient_book'],
          topK: 12,
          includeIiif: true,
        }),
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data.iiifMatches)).toBe(true)
      if (result.data.iiifMatches.length > 0) {
        expect(result.data.iiifMatches[0].manifest.length).toBeGreaterThan(0)
        expect(result.data.iiifMatches[0].openUrl.length).toBeGreaterThan(0)
        expect(result.data.iiifMatches[0].segmentText.length).toBeGreaterThan(0)
        expect(result.data.iiifMatches[0].canvasId.length).toBeGreaterThan(0)
      }
    }

    for (const question of DUFU_TARGET_QUESTIONS.detailLink) {
      const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: question,
          mode: 'hybrid',
          dims: ['person', 'poem', 'book', 'ancient_book'],
          topK: 12,
          includeIiif: true,
        }),
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.entities.length).toBeGreaterThan(0)
      expect(result.data.entities[0].detailLink).toContain('/details?uri=')
    }
  })

  it('自然问句应提取关键词并命中登高诗文', async () => {
    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '杜甫有哪些登高的诗文？',
        mode: 'hybrid',
        dims: ['poem'],
        topK: 10,
        includeIiif: false,
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.queryPlan.keywords).toContain('杜甫')
    expect(result.data.queryPlan.keywords).toContain('登高')
    expect(result.data.queryPlan.ragQueries.some((item) => item.includes('杜甫 登高'))).toBe(true)
    expect(result.data.entities.length).toBeGreaterThan(0)
    expect(result.data.entities[0].title).toContain('登高')
    expect(typeof result.data.entities[0].snippet).toBe('string')
    expect(result.data.entities[0].snippet.length).toBeGreaterThan(0)
    expect(result.data.entities[0].poemAuthor).toBe('杜甫')
    expect(typeof result.data.citations[0].snippet).toBe('string')
    expect(result.data.citations[0].snippet.length).toBeGreaterThan(0)
  })

  it('IIIF 专维度查询应产出结构化 iiifMatches', async () => {
    setMarklogicFetchForTest(createFusionMarklogicFetchMockForIiifPrimaryScope())

    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '杜诗编年 卷一相关影像片段',
        mode: 'hybrid',
        dims: ['iiif'],
        topK: 6,
        includeIiif: true,
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.iiifMatches.length).toBeGreaterThan(0)
    expect(result.data.iiifMatches[0].segmentText).toContain('杜诗编年 卷一相关影像片段')
    expect(result.data.iiifMatches[0].canvasId).toBe('http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p9')
    expect(result.data.iiifMatches[0].canvasLabel).toBe('卷一-5a')
    expect(result.data.iiifMatches[0].manifest).toContain('/iiif/manifests/303/manifest.json')
    expect(result.data.iiifMatches[0].openUrl).toContain('/iiif?')
  })

  it('query 为空时应返回参数错误', async () => {
    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '   ' }),
    })
    const result = await response.json()

    expect(response.status).toBe(400)
    expect(result.success).toBe(false)
    expect(result.error.code).toBe('INVALID_PARAMS')
  })

  it('关闭 IIIF 时应返回空的 iiifMatches', async () => {
    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '杜甫诗文线索',
        mode: 'rag',
        dims: ['person', 'poem', 'ancient_book'],
        includeIiif: false,
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.iiifMatches).toEqual([])
  })

  it('json-ld only 模式下 iiif 维度应返回结构化 IIIF 命中', async () => {
    setMarklogicFetchForTest(createFusionMarklogicFetchMockForIiifPrimaryScope())

    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '杜甫相关古籍是否有 IIIF 画布可查看？',
        mode: 'hybrid',
        dims: ['person', 'poem', 'book', 'ancient_book', 'iiif'],
        topK: 10,
        includeIiif: true,
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.iiifMatches.length).toBeGreaterThan(0)
    expect(result.data.iiifMatches[0].canvasLabel).toBe('卷一-5a')
    expect(result.data.sidebar.items.some((item: { itemType: string }) => item.itemType === 'iiif')).toBe(true)
  })

  it('json-ld only 模式下 iiif 专维度查询应返回结构化命中且优先走 MarkLogic manifest 文档', async () => {
    const { mock, stats } = createFusionMarklogicFetchMockForIiifCanonicalManifest()
    setMarklogicFetchForTest(mock)

    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '请给出304古籍注释文本对应影像',
        mode: 'hybrid',
        dims: ['iiif'],
        topK: 8,
        includeIiif: true,
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.iiifMatches.length).toBeGreaterThan(0)
    expect(result.data.iiifMatches[0].canvasLabel).toContain('卷一-8a')
    expect(result.data.iiifMatches[0].segmentText).toContain('304 古籍卷一注释文本')
    expect(stats.manifestFetchCount).toBe(0)
  })

  it('json-ld only 模式下无法提取 bookId 场景也应返回空 iiif 命中', async () => {
    setMarklogicFetchForTest(createFusionMarklogicFetchMockForIiifManifestLiteral())

    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '验证 manifest 字面量路径',
        mode: 'hybrid',
        dims: ['iiif'],
        topK: 8,
        includeIiif: true,
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.iiifMatches).toEqual([])
  })

  it('json-ld only 模式下 manifest/canvas 冲突场景应返回空 iiif 命中', async () => {
    setMarklogicFetchForTest(createFusionMarklogicFetchMockForIiifManifestCanvasConflict())

    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '请返回303古籍注释对应影像',
        mode: 'hybrid',
        dims: ['iiif'],
        topK: 8,
        includeIiif: true,
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.iiifMatches).toEqual([])
  })

  it('IIIF 检索标题为分片 ID 时应回退到可读古籍名称', async () => {
    setMarklogicFetchForTest(createFusionMarklogicFetchMockForIiifTitleFallback())

    const response = await fetch(`${baseUrl}/api/v1/fusion/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '请返回卷十五影像来源',
        mode: 'hybrid',
        dims: ['iiif'],
        topK: 8,
        includeIiif: true,
      }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.iiifMatches.length).toBeGreaterThan(0)
    expect(result.data.entities.length).toBeGreaterThan(0)
    expect(result.data.citations.length).toBeGreaterThan(0)
    expect(result.data.entities[0].title).toBe('集千家注杜工部诗集·卷十五')
    expect(result.data.citations[0].title).toBe('集千家注杜工部诗集·卷十五')
    expect(result.data.iiifMatches[0].title).toBe('集千家注杜工部诗集·卷十五')
    expect(result.data.entities[0].title).not.toBe('17270_1181_1397_1')
    expect(result.data.citations[0].title).not.toBe('17270_1181_1397_1')
    expect(result.data.iiifMatches[0].title).not.toBe('17270_1181_1397_1')
  })
})
