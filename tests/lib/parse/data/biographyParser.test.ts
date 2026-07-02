import { describe, expect, it } from 'vitest'
import { parseBiographyContent, parseBiographyFromReferredToBy } from '@/lib/parse/data/biographyParser'

describe('biographyParser 多来源解析', () => {
  it('应当在单段文本中拆分多个来源块', () => {
    const content =
      '来源：《中國歷代人名大辭典》【生卒】：712-770【介紹】：唐代诗人。来源：《辞海》【介绍】：字子美，号少陵野老。'

    const result = parseBiographyContent(content)

    expect(result.hasStructuredData).toBe(true)
    expect(result.sources.length).toBe(2)
    expect(result.sources[0].source).toContain('中國歷代人名大辭典')
    expect(result.sources[0].birthDeath).toBe('712-770')
    expect(result.sources[1].source).toContain('辞海')
    expect(result.sources[1].introduction).toContain('字子美')
  })

  it('应当自动适配 referred_to_by 下多个来源条目', () => {
    const referredToBy = [
      { content: '来源：《中國歷代人名大辭典》【介紹】：唐河南巩县人。' },
      { content: '来源：《唐诗鉴赏辞典》【介绍】：与李白并称李杜。' },
      { content: 'https://example.com/ignored-url' },
    ]

    const result = parseBiographyFromReferredToBy(referredToBy)

    expect(result.hasStructuredData).toBe(true)
    expect(result.sources.length).toBe(2)
    expect(result.sources.map((item) => item.source)).toEqual(
      expect.arrayContaining(['中國歷代人名大辭典', '唐诗鉴赏辞典']),
    )
  })

  it('当缺少【介绍】字段时应提取剩余正文为介绍内容', () => {
    const content =
      '来源：《唐詩大辭典 修訂本》【生卒】：712—770 字子美，排行二，河南鞏縣人。其一生经历与创作与时代兴衰密切相关。'

    const result = parseBiographyContent(content)

    expect(result.hasStructuredData).toBe(true)
    expect(result.sources.length).toBe(1)
    expect(result.sources[0].source).toContain('唐詩大辭典 修訂本')
    expect(result.sources[0].birthDeath).toContain('712')
    expect(result.sources[0].introduction).toContain('字子美')
  })
})
