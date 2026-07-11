/**
 * uriParser 单元测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import { parseUriResource } from '@/features/details/utils/uriParser'

describe('uriParser', () => {
  it('ancient-book text book 路径应识别为 ancient_book', () => {
    const result = parseUriResource('/processed/json-ld/ancient-book/text/book/18804_1523.json')

    expect(result.type).toBe('ancient_book')
    expect(result.id).toBe('18804_1523')
  })

  it('ancient-book object volume 路径应识别为 ancient_book', () => {
    const result = parseUriResource('/processed/json-ld/ancient-book/object/volume/23461_2302_28.json')

    expect(result.type).toBe('ancient_book')
    expect(result.id).toBe('23461_2302_28')
  })

  it('marc 路径应识别为 book', () => {
    const result = parseUriResource('/processed/json-ld/book/978-7-118-09182-3.json')

    expect(result.type).toBe('book')
    expect(result.id).toBe('978-7-118-09182-3')
  })

  it('ancient-book-sets 路径应识别为 ancient_book 且 format=set', () => {
    const result = parseUriResource('/heluo/ancient-books/sets/18804_1523.json')

    expect(result.type).toBe('ancient_book')
    expect(result.format).toBe('set')
    expect(result.id).toBe('18804_1523')
  })

  it('查询参数和锚点不应污染资源 ID', () => {
    expect(parseUriResource('https://api.heluo.site/person/17270.json?source=test#bio')).toEqual({
      type: 'person',
      id: '17270',
    })
    expect(parseUriResource('/processed/json-ld/book/978-7.json?foo=1#bar')).toEqual({
      type: 'book',
      id: '978-7',
    })
  })
})
