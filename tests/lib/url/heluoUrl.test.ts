/**
 * heluoUrl 工具测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import {
  buildDetailsRouteFromUri,
  extractEntityPathFromUri,
  rewriteKnownApiHost,
} from '@/lib/url/heluoUrl'

describe('heluoUrl', () => {
  it('应将 api.heluo.site 改写为本地地址', () => {
    const result = rewriteKnownApiHost('https://api.heluo.site/person/17270')

    expect(result).toContain('127.0.0.1:9011')
    expect(result).toContain('/person/17270')
  })

  it('应从绝对 URL 中提取实体路径', () => {
    const result = extractEntityPathFromUri('https://api.heluo.site/place/CN410181')
    expect(result).toBe('/place/CN410181')
  })

  it('应从相对路径中提取实体路径', () => {
    const result = extractEntityPathFromUri('/processed/json-ld/ancient-book/text/book/17270_2263.json')
    expect(result).toContain('/ancient-book/')
  })

  it('非实体 URL 不应生成详情路由', () => {
    const result = buildDetailsRouteFromUri('https://example.com/wiki/dufu')
    expect(result).toBe('')
  })

  it('应支持从 details 查询参数中继续提取实体路径', () => {
    const result = buildDetailsRouteFromUri('/details?uri=%2Fperson%2F17270')
    expect(result).toBe('/details?uri=%2Fperson%2F17270')
  })

  it('应支持双重编码的 details 查询参数', () => {
    const result = buildDetailsRouteFromUri('/details?uri=%252Fperson%252F17270')
    expect(result).toBe('/details?uri=%2Fperson%2F17270')
  })
})
