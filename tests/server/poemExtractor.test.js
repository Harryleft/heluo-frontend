/**
 * 诗文详情提取测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import { buildPoemSetDetail, extractPoemComments, extractPoemDetail } from '../../server/src/domain/detail/poemExtractor.js'

describe('poemExtractor', () => {
  it('应根据二级分类准确提取体裁与韵目，并保留概念链接', () => {
    const detail = extractPoemDetail('/processed/json-ld/poem/set/poem_001.json', {
      _label: '赠苏四徯',
      classified_as: [
        {
          id: 'https://vocab.getty.edu/ulan/500373092',
          type: 'Type',
          _label: '唐朝',
        },
        {
          id: 'http://localhost:8003/concept/wujue',
          type: 'Type',
          _label: '绝句-五绝',
          classified_as: [
            {
              id: 'https://vocab.getty.edu/aat/300026451',
              type: 'Type',
              _label: 'poems',
            },
          ],
        },
        {
          id: 'http://localhost:8003/concept/rhyme/pingshui/yu2-p',
          type: 'Type',
          _label: '七虞',
          classified_as: [
            {
              id: 'https://vocab.getty.edu/aat/300438590',
              type: 'Type',
              _label: 'Rhyme',
            },
          ],
        },
      ],
    })

    expect(detail?.genre).toBe('绝句-五绝')
    expect(detail?.genreUri).toBe('http://localhost:8003/concept/wujue')
    expect(detail?.rhyme).toBe('七虞')
    expect(detail?.rhymeUri).toBe('http://localhost:8003/concept/rhyme/pingshui/yu2-p')
  })

  it('不应把朝代误识别为体裁', () => {
    const detail = extractPoemDetail('/processed/json-ld/poem/set/poem_002.json', {
      _label: '春望',
      classified_as: [
        {
          id: 'https://vocab.getty.edu/ulan/500373092',
          type: 'Type',
          _label: '唐朝',
        },
      ],
    })

    expect(detail?.genre).toBeUndefined()
    expect(detail?.rhyme).toBeUndefined()
  })

  it('应从 created_by 提取诗文作者', () => {
    const detail = extractPoemDetail('/processed/json-ld/poem/set/poem_30546.json', {
      _label: '入宅三首',
      created_by: {
        type: 'Creation',
        carried_out_by: [{ id: 'http://localhost:8003/person/17270', _label: '杜甫' }],
      },
    })

    expect(detail?.author).toBe('杜甫')
    expect(detail?.authorId).toBe('17270')
  })

  it('构建 set 详情时也应返回体裁与韵目信息', async () => {
    const detail = await buildPoemSetDetail(
      '/processed/json-ld/poem/set/poem_30458.json',
      {
        id: 'http://localhost:8003/poem/30458',
        _label: '同诸公登慈恩寺塔',
        classified_as: [
          {
            id: 'http://localhost:8003/concept/qiyan-gushi',
            type: 'Type',
            _label: '古体诗-七言古诗',
            classified_as: [
              {
                id: 'https://vocab.getty.edu/aat/300026451',
                type: 'Type',
                _label: 'poems',
              },
            ],
          },
          {
            id: 'http://localhost:8003/concept/rhyme/pingshui/xian1-p',
            type: 'Type',
            _label: '十五咸',
            classified_as: [
              {
                id: 'https://vocab.getty.edu/aat/300438590',
                type: 'Type',
                _label: 'Rhyme',
              },
            ],
          },
        ],
        created_by: {
          type: 'Creation',
          carried_out_by: [{ id: 'http://localhost:8003/person/17270', _label: '杜甫' }],
        },
      },
      {
        mlGetDoc: async () => null,
        searchWithFallback: async () => ({ results: [], total: 0 }),
      },
    )

    expect(detail?.genre).toBe('古体诗-七言古诗')
    expect(detail?.genreUri).toBe('http://localhost:8003/concept/qiyan-gushi')
    expect(detail?.rhyme).toBe('十五咸')
    expect(detail?.rhymeUri).toBe('http://localhost:8003/concept/rhyme/pingshui/xian1-p')
    expect(detail?.authorId).toBe('17270')
  })

  it('data 前缀 set 详情应合并 txt 片段并补地点坐标', async () => {
    const textDocs = {
      '/processed/json-ld/poem/text/poem_30546_02.json': {
        text_norm_zh: '云通白帝城，',
        member_of: [{ id: 'http://localhost:8003/set/poems/30546' }],
      },
      '/processed/json-ld/poem/text/poem_30546_01.json': {
        text_norm_zh: '宋玉归州宅，',
        member_of: [{ id: 'http://localhost:8003/set/poems/30546' }],
      },
      '/processed/json-ld/place/CN500236.json': {
        _label: '奉节县',
        defined_by: 'POINT(109.470533 31.024561)',
      },
    }

    const detail = await buildPoemSetDetail(
      '/processed/json-ld/poem/set/poem_30546.json',
      {
        id: 'http://localhost:8003/poem/30546',
        _label: '入宅三首',
        created_by: {
          carried_out_by: [{ id: 'http://localhost:8003/person/17270', _label: '杜甫' }],
          took_place_at: [{ id: 'http://localhost:8003/place/CN500236', _label: '奉节县' }],
        },
      },
      {
        mlGetDoc: async (uri) => textDocs[uri] || null,
        searchWithFallback: async () => ({
          results: [
            { uri: '/processed/json-ld/poem/text/poem_30546_02.json' },
            { uri: '/processed/json-ld/poem/text/poem_30546_01.json' },
          ],
          total: 2,
        }),
      },
    )

    expect(detail?.fullText).toBe('宋玉归州宅，\n云通白帝城，')
    expect(detail?.textUri).toBe('/processed/json-ld/poem/text/poem_30546_01.json')
    expect(detail?.relatedPlaces?.[0]).toMatchObject({
      label: '奉节县',
      lat: 31.024561,
      lng: 109.470533,
    })
  })

  it('应提取 classified_as 为 Comment 的诗文校注', () => {
    const comments = extractPoemComments({
      content: '屏开金孔雀，',
      referred_to_by: [
        {
          type: 'LinguisticObject',
          content: '金孔雀，指屏风上的孔雀纹样。',
          classified_as: [
            {
              type: 'Type',
              _label: 'Comment',
            },
          ],
        },
      ],
    })

    expect(comments).toEqual([
      {
        text: '屏开金孔雀，',
        comment: '金孔雀，指屏风上的孔雀纹样。',
      },
    ])
  })

  it('应兼容 classified_as 为 Biography Statement 的诗文校注', () => {
    const comments = extractPoemComments({
      content: '且食双鱼美，',
      referred_to_by: [
        {
          type: 'LinguisticObject',
          content: '两鱼。可指两尾鱼的美味，也见于相关诗文引述。',
          classified_as: [
            {
              type: 'Type',
              _label: 'Biography Statement',
              classified_as: [
                {
                  type: 'Type',
                  _label: 'Brief Text',
                },
              ],
            },
          ],
        },
      ],
    })

    expect(comments).toEqual([
      {
        text: '且食双鱼美，',
        comment: '两鱼。可指两尾鱼的美味，也见于相关诗文引述。',
      },
    ])
  })

  it('不应把无关 referred_to_by 说明误提取为校注', () => {
    const comments = extractPoemComments({
      content: '门阑多喜色，',
      referred_to_by: [
        {
          type: 'LinguisticObject',
          content: '数据来源：某整理本。',
          classified_as: [
            {
              type: 'Type',
              _label: 'Source Statement',
            },
          ],
        },
      ],
    })

    expect(comments).toEqual([])
  })
})
