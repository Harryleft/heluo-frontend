/**
 * @vitest-environment node
 */

import { afterEach, describe, expect, it } from 'vitest'
import { getEntityDirectories, isJsonLdDirectory } from '../../server/src/bootstrap/config.js'
import {
  mlGetDoc,
  mlSearchByDirectory,
  resetMarklogicFetch,
  setMarklogicFetchForTest,
} from '../../server/src/infra/gateways/marklogicGateway.js'

function jsonResponse(payload) {
  return {
    ok: true,
    async json() {
      return payload
    },
  }
}

describe('MarkLogic data JSON-LD 路径', () => {
  afterEach(() => {
    resetMarklogicFetch()
  })

  it('默认允许读取和搜索标准 JSON-LD 前缀', async () => {
    const requested = []
    setMarklogicFetchForTest(async (url) => {
      requested.push(String(url))
      return jsonResponse({ _label: '杜甫传', results: [] })
    })

    expect(isJsonLdDirectory('/processed/json-ld/book/')).toBe(true)
    expect(getEntityDirectories('book')).toContain('/processed/json-ld/book/')

    await mlGetDoc('/processed/json-ld/book/978-7-5339-6327-9.json')
    await mlSearchByDirectory('/processed/json-ld/book/', '杜甫', 1)

    expect(requested[0]).toContain('uri=%2Fprocessed%2Fjson-ld%2Fbook%2F978-7-5339-6327-9.json')
    expect(requested[1]).toContain('directory=%2Fprocessed%2Fjson-ld%2Fbook%2F')
  })
})
