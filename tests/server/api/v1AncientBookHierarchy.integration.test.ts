import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import fetch from 'node-fetch'
import type { AddressInfo } from 'node:net'
import { app, resetMarklogicFetch, setMarklogicFetchForTest } from '../../../server/src/index.js'

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    headers: new Map<string, string>(),
  }
}

function createAncientBookHierarchyFetchMock() {
  const book303Uri = '/processed/json-ld/ancient_book/ancient_book_set/book_entry/17270_303.json'
  const book304Uri = '/processed/json-ld/ancient_book/ancient_book_set/book_entry/17270_304.json'
  const departmentUri = '/processed/json-ld/ancient_book/ancient_book_set/department/jibu.json'
  const rootUri = '/processed/json-ld/ancient_book/ancient_book_set/root/siku.json'
  const txt303Uri = '/processed/json-ld/ancient_book/ancient_book_txt/book/17270_303.json'
  const txt304Uri = '/processed/json-ld/ancient_book/ancient_book_txt/book/17270_304.json'

  const docs: Record<string, unknown> = {
    [book303Uri]: {
      id: 'http://localhost:8000/set/ancient_book/siku/jibu/303',
      _label: '杜诗捃',
      member_of: [{ id: 'http://localhost:8000/set/ancient_book/siku/jibu', _label: '集部' }],
    },
    [book304Uri]: {
      id: 'http://localhost:8000/set/ancient_book/siku/jibu/304',
      _label: '杜诗详注',
      member_of: [{ id: 'http://localhost:8000/set/ancient_book/siku/jibu', _label: '集部' }],
    },
    [departmentUri]: {
      id: 'http://localhost:8000/set/ancient_book/siku/jibu',
      _label: '集部',
      member_of: [{ id: 'http://localhost:8000/set/ancient_book/siku', _label: '钦定四库荟要' }],
    },
    [rootUri]: {
      id: 'http://localhost:8000/set/ancient_book/siku',
      _label: '钦定四库荟要',
    },
    [txt303Uri]: {
      id: 'http://localhost:8000/txt/ancient_book/303',
      _label: '杜诗捃',
      digitally_carried_by: [
        {
          access_point: [{ id: 'http://localhost:8083/iiif/manifests/303/manifest.json' }],
        },
      ],
    },
    [txt304Uri]: {
      id: 'http://localhost:8000/txt/ancient_book/304',
      _label: '杜诗详注',
      digitally_carried_by: [
        {
          access_point: [{ id: 'http://localhost:8083/iiif/manifests/304/manifest.json' }],
        },
      ],
    },
  }

  return async (url: unknown) => {
    const parsed = new URL(String(url))

    if (parsed.pathname === '/v1/search') {
      const directory = parsed.searchParams.get('directory')
      const query = parsed.searchParams.get('q') || ''
      if (directory === '/processed/json-ld/ancient_book/ancient_book_txt/book/') {
        if (query === '303') {
          return jsonResponse({ total: 1, results: [{ uri: txt303Uri, score: 0.9, confidence: 0.1 }] }, 200)
        }
        if (query === '304') {
          return jsonResponse({ total: 1, results: [{ uri: txt304Uri, score: 0.9, confidence: 0.1 }] }, 200)
        }
        return jsonResponse({ total: 0, results: [] }, 200)
      }
      return jsonResponse({ total: 0, results: [] }, 200)
    }

    if (parsed.pathname === '/v1/documents') {
      const uri = parsed.searchParams.get('uri') || ''
      if (Object.prototype.hasOwnProperty.call(docs, uri)) {
        return jsonResponse(docs[uri], 200)
      }
      return jsonResponse({}, 404)
    }

    return jsonResponse({}, 404)
  }
}

describe('GET /api/v1/ancient-books hierarchy', () => {
  let server: ReturnType<typeof app.listen>
  let baseUrl = ''

  beforeAll(async () => {
    server = app.listen(0)
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  beforeEach(() => {
    setMarklogicFetchForTest(createAncientBookHierarchyFetchMock())
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

  it('303 详情应返回 root > department > entry 层级', async () => {
    const uri = encodeURIComponent('/processed/json-ld/ancient_book/ancient_book_set/book_entry/17270_303.json')
    const response = await fetch(`${baseUrl}/api/v1/ancient-books/17270_303?uri=${uri}`)
    const result = await response.json() as { success: boolean; data: { hierarchy?: Array<{ label: string; level: string }> } }

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.hierarchy?.map((item) => item.label)).toEqual(['钦定四库荟要', '集部', '杜诗捃'])
    expect(result.data.hierarchy?.map((item) => item.level)).toEqual(['root', 'department', 'entry'])
  })

  it('304 详情应返回 root > department > entry 层级', async () => {
    const uri = encodeURIComponent('/processed/json-ld/ancient_book/ancient_book_set/book_entry/17270_304.json')
    const response = await fetch(`${baseUrl}/api/v1/ancient-books/17270_304?uri=${uri}`)
    const result = await response.json() as { success: boolean; data: { hierarchy?: Array<{ label: string; level: string }> } }

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.hierarchy?.map((item) => item.label)).toEqual(['钦定四库荟要', '集部', '杜诗详注'])
    expect(result.data.hierarchy?.map((item) => item.level)).toEqual(['root', 'department', 'entry'])
  })
})
