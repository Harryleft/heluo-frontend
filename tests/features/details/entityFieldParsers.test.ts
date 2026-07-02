/**
 * entity field parsers 单元测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import {
  parseAncientBookFieldGroups,
  parseBookFieldGroups,
  parseConceptFieldGroups,
  parsePlaceFieldGroups,
} from '@/features/details/components/entity-fields/parsers'

describe('entity field parsers', () => {
  it('book 解析器应提取 _label/content/value 关键字段', () => {
    const bookDoc = {
      _label: '杜甫诗选',
      type: 'HumanMadeObject',
      identified_by: [
        { content: '杜甫诗选', classified_as: [{ _label: 'Primary Name' }] },
        { content: '978-7-5442-2987-6', classified_as: [{ _label: 'ISBN' }] },
      ],
      created_by: { carried_out_by: [{ _label: '邓魁英,聂石樵编注' }] },
      produced_by: {
        carried_out_by: [{ _label: '南海出版社' }],
        timespan: { _label: '2010年' },
        took_place_at: [{ _label: '海口' }],
      },
      dimension: [{ value: 287, unit: { _label: 'pages' } }],
      referred_to_by: [{ content: '这是图书摘要' }],
      classified_as: [{ _label: 'books' }],
    }

    const groups = parseBookFieldGroups(bookDoc)
    const allValues = groups.flatMap((group) => group.rows.map((row) => row.value))

    expect(groups.some((group) => group.title === '基本信息')).toBe(true)
    expect(groups.some((group) => group.title === '内容介绍')).toBe(true)
    expect(allValues).toContain('杜甫诗选')
    expect(allValues).toContain('978-7-5442-2987-6')
    expect(allValues).toContain('287 页')
  })

  it('place 解析器应提取坐标与历史名称字段', () => {
    const placeDoc = {
      _label: '奉节县',
      type: 'Place',
      defined_by: 'POINT(109.470533 31.024561)',
      identified_by: [{ content: '奉节县', classified_as: [{ _label: 'Primary Name' }] }],
      part_of: [{ _label: '重庆市' }],
      attributed_by: [
        { _label: '鱼复县', timespan: { _label: 'c. 314 BCE-24 CE' } },
        { _label: '白帝县', timespan: { _label: '25-36 CE' } },
      ],
      classified_as: [{ _label: 'Administrative Division' }],
    }

    const groups = parsePlaceFieldGroups(placeDoc)
    const allValues = groups.flatMap((group) => group.rows.map((row) => row.value))

    expect(groups.some((group) => group.title === '地理核心信息')).toBe(true)
    expect(groups.some((group) => group.title === '历史演变过程')).toBe(true)
    expect(allValues).toContain('31.024561, 109.470533')
    expect(allValues.some((value) => value.includes('鱼复县'))).toBe(true)
  })

  it('concept 解析器应提取关系字段', () => {
    const conceptDoc = {
      _label: '32韵',
      type: 'Type',
      identified_by: [{ content: '32', classified_as: [{ _label: 'Identifier' }] }],
      classified_as: [{ _label: '韵目' }],
      in_scheme: { _label: '平水韵' },
      broader: [{ _label: '上位韵部' }],
      narrower: [{ _label: '下位韵部' }],
    }

    const groups = parseConceptFieldGroups(conceptDoc)
    const allValues = groups.flatMap((group) => group.rows.map((row) => row.value))

    expect(groups.some((group) => group.title === '概念核心字段')).toBe(true)
    expect(groups.some((group) => group.title === '概念关系字段')).toBe(true)
    expect(allValues).toContain('Type')
    expect(allValues).toContain('平水韵')
    expect(allValues).toContain('上位韵部')
    expect(allValues).toContain('下位韵部')
  })

  it('ancient_book 解析器应提取古籍核心字段', () => {
    const ancientDoc = {
      _label: '白孔六帖·卷七十四',
      type: 'LinguisticObject',
      identified_by: [{ content: '18804_1523_74', classified_as: [{ _label: 'Identifier' }] }],
      classified_as: [{ _label: 'Linguistic Object' }],
      created_by: {
        carried_out_by: [{ _label: '白居易' }],
        timespan: { _label: '唐' },
      },
      referred_to_by: [{ source: '四库全书本' }],
    }

    const groups = parseAncientBookFieldGroups(ancientDoc, { digitalResourceCount: 3 })
    const basicGroup = groups.find((group) => group.title === '古籍核心字段')
    const rows = basicGroup?.rows || []
    const labels = rows.map((row) => row.label)
    const allValues = rows.map((row) => row.value)

    expect(groups.some((group) => group.title === '古籍核心字段')).toBe(true)
    expect(allValues).toContain('白居易')
    expect(allValues).toContain('唐')
    expect(allValues).toContain('四库全书本')
    expect(labels).toContain('版本/来源')
    expect(labels).not.toContain('名称')
    expect(labels).not.toContain('实体类型')
    expect(labels).not.toContain('数字资源')
  })

  it('ancient_book 解析器应兼容 object 层 produced_by 的创作者与时间', () => {
    const ancientDoc = {
      _label: '杜诗捃·卷一',
      type: 'HumanMadeObject',
      produced_by: {
        _label: '唐元竑（明）创作',
        carried_out_by: [{ _label: '唐元竑' }],
        timespan: [{ _label: '明' }],
      },
      created_by: {
        _label: '唐元竑创作',
        carried_out_by: [{ _label: '唐元竑' }],
      },
    }

    const groups = parseAncientBookFieldGroups(ancientDoc, { digitalResourceCount: 2 })
    const basicGroup = groups.find((group) => group.title === '古籍核心字段')
    const rows = basicGroup?.rows || []

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '创作者', value: '唐元竑' }),
        expect.objectContaining({ label: '时间', value: '明' }),
      ]),
    )
    expect(rows.map((row) => row.label)).not.toContain('名称')
    expect(rows.map((row) => row.label)).not.toContain('实体类型')
    expect(rows.map((row) => row.label)).not.toContain('数字资源')
    expect(rows.map((row) => row.label)).not.toContain('版本/来源')
  })
})
