/**
 * uriParser 单元测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import { parseUriResource } from '@/features/details/utils/uriParser'

describe('uriParser', () => {
  it('ancient_book_txt book 路径应识别为 ancient_book', () => {
    const result = parseUriResource('/processed/entities/ancient_book/ancient_book_txt/book/18804_1523.json')

    expect(result.type).toBe('ancient_book')
    expect(result.id).toBe('18804_1523')
  })

  it('ancient_book_object volume 路径应识别为 ancient_book', () => {
    const result = parseUriResource('/processed/entities/ancient_book/ancient_book_object/volume/23461_2302_28.json')

    expect(result.type).toBe('ancient_book')
    expect(result.id).toBe('23461_2302_28')
  })

  it('marc 路径应识别为 book', () => {
    const result = parseUriResource('/processed/entities/marc/978-7-118-09182-3.json')

    expect(result.type).toBe('book')
    expect(result.id).toBe('978-7-118-09182-3')
  })

  it('ancient-book-sets 路径应识别为 ancient_book 且 format=set', () => {
    const result = parseUriResource('/heluo/ancient-book-sets/18804_1523.json')

    expect(result.type).toBe('ancient_book')
    expect(result.format).toBe('set')
    expect(result.id).toBe('18804_1523')
  })
})
