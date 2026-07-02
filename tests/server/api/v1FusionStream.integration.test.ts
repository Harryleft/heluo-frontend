/**
 * /api/v1/fusion/stream 集成测试
 * @vitest-environment node
 */

import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app, resetMarklogicFetch, setMarklogicFetchForTest } from '../../../server/src/index.js'

function createMarklogicFetchMockWithFailure() {
  return async () => {
    throw new Error('fetch failed')
  }
}

function createMarklogicFetchMockWithFirstCallFailureThenEmpty() {
  let callCount = 0
  return async () => {
    callCount += 1
    if (callCount === 1) {
      throw new Error('fetch failed')
    }
    return {
      ok: true,
      async json() {
        return { total: 0, results: [] }
      },
    }
  }
}

describe('POST /api/v1/fusion/stream', () => {
  let server: ReturnType<typeof app.listen>
  let baseUrl = ''

  beforeAll(async () => {
    server = app.listen(0)
    const address = server.address()
    const port = (address as AddressInfo).port
    baseUrl = `http://127.0.0.1:${port}`
  })

  beforeEach(() => {
    setMarklogicFetchForTest(createMarklogicFetchMockWithFailure())
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

  it('上游检索不可用时应返回可完成的 SSE 响应', async () => {
    const response = await fetch(`${baseUrl}/api/v1/fusion/stream`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        query: '请定位303古籍注释对应影像',
        mode: 'hybrid',
        dims: ['iiif'],
        topK: 8,
        includeIiif: true,
      }),
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('event: status')
    expect(body).toContain('event: done')
    expect(body).not.toContain('event: error')
    if (body.includes('"stage":"degraded"')) {
      expect(body).toContain('"strategy":"degraded"')
      expect(body).toContain('当前检索服务暂不可用，请稍后重试。')
    }
  })

  it('上游检索异常时应返回降级提示并建议稍后重试', async () => {
    setMarklogicFetchForTest(createMarklogicFetchMockWithFailure())
    const response = await fetch(`${baseUrl}/api/v1/fusion/stream`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        query: '请分析洛阳相关古籍记载',
        mode: 'hybrid',
        dims: ['person'],
        topK: 8,
        includeIiif: false,
      }),
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('event: status')
    expect(body).toContain('"stage":"degraded"')
    expect(body).toContain('event: done')
    expect(body).toContain('"strategy":"degraded"')
    expect(body).toContain('当前检索服务暂不可用，请稍后重试。')
    expect(body).not.toContain('event: error')
  })

  it('单个检索变体失败时也应给出稍后重试提示', async () => {
    setMarklogicFetchForTest(createMarklogicFetchMockWithFirstCallFailureThenEmpty())
    const response = await fetch(`${baseUrl}/api/v1/fusion/stream`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        query: '杜甫的诗中有哪些诗文是体现现实关怀的？',
        mode: 'hybrid',
        dims: ['person', 'poem', 'book'],
        topK: 8,
        includeIiif: false,
      }),
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('event: status')
    expect(body).toContain('"stage":"degraded"')
    expect(body).toContain('event: done')
    expect(body).toContain('"strategy":"degraded"')
    expect(body).toContain('当前检索服务暂不可用，请稍后重试。')
    expect(body).not.toContain('event: error')
  }, 30000)
})
