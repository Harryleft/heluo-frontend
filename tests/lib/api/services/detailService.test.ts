/**
 * detailService 单元测试
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchDetailByResource } from '@/lib/api/services/detailService'
import { mockPersonDetailResponse, mockPoemDetailResponse } from '../__mocks__/responses'

vi.mock('@/lib/api/repositories/v1Repository', () => ({
  fetchPersonByIdRepo: vi.fn(),
  fetchPoemByIdRepo: vi.fn(),
  fetchBookByIdRepo: vi.fn(),
  fetchPlaceByIdRepo: vi.fn(),
  fetchConceptByIdRepo: vi.fn(),
  fetchAncientBookByIdRepo: vi.fn(),
}))

import {
  fetchPersonByIdRepo,
  fetchPoemByIdRepo,
  fetchBookByIdRepo,
  fetchPlaceByIdRepo,
  fetchConceptByIdRepo,
  fetchAncientBookByIdRepo,
} from '@/lib/api/repositories/v1Repository'

describe('detailService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('person 资源应返回人物详情视图模型', async () => {
    vi.mocked(fetchPersonByIdRepo).mockResolvedValueOnce(mockPersonDetailResponse)

    const result = await fetchDetailByResource({ type: 'person', id: '17270' }, '/processed/json-ld/person/17270.json')

    expect(fetchPersonByIdRepo).toHaveBeenCalledWith('17270')
    expect(result?.title).toBe('杜甫')
    expect(result?.internalLinks.length).toBeGreaterThan(0)
    expect(result?.internalLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '相关作品：春望', uri: '/poem/poem_001' }),
      ]),
    )
  })

  it('person 详情应从 attributed_by 提取相关人物关系', async () => {
    vi.mocked(fetchPersonByIdRepo).mockResolvedValueOnce({
      success: true,
      data: {
        id: '17270',
        name: '杜甫',
        uri: '/processed/json-ld/person/17270.json',
        summary: '人物摘要',
        doc: {
          attributed_by: [
            {
              id: 'http://localhost:8003/attribute/cbdb-person-rel-30851',
              type: 'AttributeAssignment',
              identified_by: {
                type: 'Name',
                content: '[友谊关系 - 朋友关系（笼统） - 友]',
              },
              assigned: [
                {
                  id: 'http://localhost:8003/person/21646',
                  type: 'Person',
                  _label: '高適',
                },
              ],
            },
          ],
        },
      },
    })

    const result = await fetchDetailByResource({ type: 'person', id: '17270' }, '/processed/json-ld/person/17270.json')

    expect(result?.internalLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '相关人物（友）：高適',
          uri: 'http://localhost:8003/person/21646',
        }),
      ]),
    )
  })

  it('person 接口抛错时应返回 null', async () => {
    vi.mocked(fetchPersonByIdRepo).mockRejectedValueOnce({
      response: { status: 404 },
      message: 'Not Found',
    })

    const result = await fetchDetailByResource({ type: 'person', id: '17170' }, '/person/17170')

    expect(fetchPersonByIdRepo).toHaveBeenCalledWith('17170')
    expect(result).toBeNull()
  })

  it('poem text 资源应透传 format 参数', async () => {
    vi.mocked(fetchPoemByIdRepo).mockResolvedValueOnce(mockPoemDetailResponse)

    const result = await fetchDetailByResource(
      { type: 'poem', id: 'poem_001', format: 'txt' },
      '/processed/json-ld/poem/text/poem_001.json',
    )

    expect(fetchPoemByIdRepo).toHaveBeenCalledWith('poem_001', { format: 'txt' })
    expect(result?.poemDetail?.author).toBe('杜甫')
    expect(result?.poemDetail?.dynasty).toBe('唐')
    expect(result?.poemDetail?.genre).toBe('五言律诗')
    expect(result?.poemDetail?.source).toBe('《杜工部集》')
    expect(result?.poemDetail?.relatedPlaces?.[0]?.label).toBe('长安')
    expect(result?.summary).toContain('国破山河在')
    expect(result?.doc).toEqual({})
  })

  it('poem 资源应映射体裁与韵目链接字段', async () => {
    vi.mocked(fetchPoemByIdRepo).mockResolvedValueOnce({
      success: true,
      data: {
        id: 'poem_012',
        title: '赠苏四徯',
        author: '杜甫',
        authorId: '17270',
        genre: '绝句-五绝',
        genreUri: 'http://localhost:8003/concept/wujue',
        rhyme: '七虞',
        rhymeUri: 'http://localhost:8003/concept/rhyme/pingshui/yu2-p',
        fullText: '异县逢冬至，回头忆故人。',
        uri: '/poem/set/poem_012.json',
        doc: {},
      },
    } as never)

    const result = await fetchDetailByResource(
      { type: 'poem', id: 'poem_012', format: 'set' },
      '/poem/set/poem_012.json',
    )

    expect(result?.poemDetail?.genre).toBe('绝句-五绝')
    expect(result?.poemDetail?.genreUri).toBe('http://localhost:8003/concept/wujue')
    expect(result?.poemDetail?.rhyme).toBe('七虞')
    expect(result?.poemDetail?.rhymeUri).toBe('http://localhost:8003/concept/rhyme/pingshui/yu2-p')
    expect(result?.poemDetail?.authorId).toBe('17270')
  })

  it('poem 资源应从 doc.took_place_at 回填地理信息', async () => {
    vi.mocked(fetchPoemByIdRepo).mockResolvedValueOnce({
      success: true,
      data: {
        id: 'poem_009',
        title: '登岳阳楼',
        author: '杜甫',
        fullText: '昔闻洞庭水，今上岳阳楼。',
        uri: '/poem/set/poem_009.json',
        relatedPlaces: [],
        doc: {
          _label: '登岳阳楼',
          type: 'LinguisticObject',
          took_place_at: [
            { id: 'http://localhost:8003/place/CN500236', type: 'Place', _label: '奉节县' },
          ],
        },
      },
    } as never)

    const result = await fetchDetailByResource(
      { type: 'poem', id: 'poem_009', format: 'set' },
      '/poem/set/poem_009.json',
    )

    expect(result?.poemDetail?.relatedPlaces).toEqual([
      {
        label: '奉节县',
        uri: 'http://localhost:8003/place/CN500236',
      },
    ])
  })

  it('poem 资源应从 created_by.took_place_at 提取地理信息', async () => {
    vi.mocked(fetchPoemByIdRepo).mockResolvedValueOnce({
      success: true,
      data: {
        id: 'poem_010',
        title: '夔州歌十绝句',
        author: '杜甫',
        fullText: '中巴之东巴东山，江水开辟流其间。',
        uri: '/poem/set/poem_010.json',
        doc: {
          _label: '夔州歌十绝句',
          created_by: {
            type: 'Creation',
            took_place_at: [
              { id: '/place/CN500236', _label: '奉节县' },
            ],
          },
        },
      },
    } as never)

    const result = await fetchDetailByResource(
      { type: 'poem', id: 'poem_010', format: 'set' },
      '/poem/set/poem_010.json',
    )

    expect(result?.poemDetail?.relatedPlaces).toEqual([
      {
        label: '奉节县',
        uri: '/place/CN500236',
      },
    ])
  })

  it('poem 主文档无地理信息时应回退读取 set 文档地点', async () => {
    vi.mocked(fetchPoemByIdRepo)
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'poem_011',
          title: '咏怀古迹',
          author: '杜甫',
          fullText: '群山万壑赴荆门，生长明妃尚有村。',
          uri: '/poem/text/poem_011.json',
          set: {
            id: 'set_011',
            uri: '/poem/set/poem_011.json',
            label: '咏怀古迹',
          },
          doc: {
            _label: '咏怀古迹（txt）',
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'poem_011',
          title: '咏怀古迹',
          author: '杜甫',
          fullText: '群山万壑赴荆门，生长明妃尚有村。',
          uri: '/poem/set/poem_011.json',
          relatedPlaces: [],
          doc: {
            _label: '咏怀古迹（set）',
            took_place_at: [{ id: '/place/CN420500', _label: '夔州' }],
          },
        },
      })

    const result = await fetchDetailByResource(
      { type: 'poem', id: 'poem_011', format: 'txt' },
      '/poem/text/poem_011.json',
    )

    expect(result?.poemDetail?.relatedPlaces).toEqual([
      {
        label: '夔州',
        uri: '/place/CN420500',
      },
    ])
    expect(fetchPoemByIdRepo).toHaveBeenNthCalledWith(1, 'poem_011', { format: 'txt' })
    expect(fetchPoemByIdRepo).toHaveBeenNthCalledWith(2, 'poem_011', { format: 'set' })
  })

  it('unknown 资源应返回 null', async () => {
    const result = await fetchDetailByResource({ type: 'unknown', id: '' }, '')
    expect(result).toBeNull()
  })

  it('book 资源应透传原始文档用于类型化渲染', async () => {
    vi.mocked(fetchBookByIdRepo).mockResolvedValueOnce({
      success: true,
      data: {
        id: 'b1',
        title: '杜诗别集',
        author: '某编者',
        uri: '/processed/json-ld/book/b1.json',
        doc: { _label: '杜诗别集', type: 'LinguisticObject' },
      },
    })

    const result = await fetchDetailByResource({ type: 'book', id: 'b1' }, '/processed/json-ld/book/b1.json')

    expect(result?.title).toBe('杜诗别集')
    expect(result?.doc).toEqual({ _label: '杜诗别集', type: 'LinguisticObject' })
  })

  it('book/place/concept/ancient_book 失败时返回 null', async () => {
    vi.mocked(fetchBookByIdRepo).mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND', message: 'x' } })
    vi.mocked(fetchPlaceByIdRepo).mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND', message: 'x' } })
    vi.mocked(fetchConceptByIdRepo).mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND', message: 'x' } })
    vi.mocked(fetchAncientBookByIdRepo).mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND', message: 'x' } })

    const book = await fetchDetailByResource({ type: 'book', id: 'b1' }, '/book/b1.json')
    const place = await fetchDetailByResource({ type: 'place', id: 'p1' }, '/place/p1.json')
    const concept = await fetchDetailByResource({ type: 'concept', id: 'c1' }, '/concept/c1.json')
    const ancientBook = await fetchDetailByResource({ type: 'ancient_book', id: 'a1' }, '/ancient-book/a1.json')

    expect(book).toBeNull()
    expect(place).toBeNull()
    expect(concept).toBeNull()
    expect(ancientBook).toBeNull()
  })

  it('ancient_book 详情请求应透传原始 uri 参数', async () => {
    vi.mocked(fetchAncientBookByIdRepo).mockResolvedValueOnce({
      success: true,
      data: {
        id: '17270_2263_15',
        title: '集千家注杜工部诗集·卷十五',
        uri: '/processed/json-ld/ancient-book/object/volume/17270_2263_15.json',
        summary: '古籍摘要',
        volumeLabel: '卷十五',
        volumeText: '卷十五正文示例',
        volumeTextStatus: 'available',
        manifests: ['https://api.heluo.site/iiif/3/manifest/ancientBook/2263/17270_2263'],
        texts: [
          {
            id: '2263_15',
            label: '卷15',
            uri: '/processed/json-ld/ancient-book/text/volume/17270_2263_15.json',
            textUri: '/processed/json-ld/ancient-book/text/volume/17270_2263_15.json',
            objectUri: '/processed/json-ld/ancient-book/object/volume/17270_2263_15.json',
            iiifUri: 'https://api.heluo.site/iiif/3/manifest/ancientBook/2263/17270_2263',
            volumeNo: 15,
          },
        ],
      },
    })

    const uri = '/processed/json-ld/ancient-book/object/volume/17270_2263_15.json'
    const result = await fetchDetailByResource({ type: 'ancient_book', id: '17270_2263_15' }, uri)

    expect(fetchAncientBookByIdRepo).toHaveBeenCalledWith('17270_2263_15', uri)
    expect(result?.title).toContain('卷十五')
    expect(result?.externalUris).toEqual(['https://api.heluo.site/iiif/3/manifest/ancientBook/2263/17270_2263'])
    expect(result?.ancientBookVolumes?.[0]?.iiifUri).toContain('/iiif/3/manifest/')
    expect(result?.ancientBookVolumeLabel).toBe('卷十五')
    expect(result?.ancientBookVolumeText).toContain('正文示例')
    expect(result?.ancientBookVolumeTextStatus).toBe('available')
  })

  it('ancient_book 有 objectUri 时应优先使用 object 文档作为字段数据源', async () => {
    const entryUri = '/processed/json-ld/ancient-book/set/book-entry/17270_303.json'
    const objectUri = '/processed/json-ld/ancient-book/object/volume/17270_303_1.json'
    vi.mocked(fetchAncientBookByIdRepo)
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: '17270_303',
          title: '杜诗捃',
          uri: entryUri,
          summary: '古籍摘要',
          manifests: ['https://api.heluo.site/iiif/manifests/303/manifest.json'],
          texts: [
            {
              id: '17270_303_1',
              label: '卷一',
              uri: '/processed/json-ld/ancient-book/text/volume/17270_303_1.json',
              textUri: '/processed/json-ld/ancient-book/text/volume/17270_303_1.json',
              objectUri,
              iiifUri: 'https://api.heluo.site/iiif/manifests/303/manifest.json',
              volumeNo: 1,
            },
          ],
          doc: { _label: '杜诗捃（书目）', type: 'Set' },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: '17270_303_1',
          title: '杜诗捃·卷一',
          uri: objectUri,
          summary: '卷一摘要',
          doc: { _label: '杜诗捃·卷一', type: 'LinguisticObject' },
        },
      })

    const result = await fetchDetailByResource({ type: 'ancient_book', id: '17270_303' }, entryUri)

    expect(fetchAncientBookByIdRepo).toHaveBeenNthCalledWith(1, '17270_303', entryUri)
    expect(fetchAncientBookByIdRepo).toHaveBeenNthCalledWith(2, '17270_303_1', objectUri)
    expect(result?.title).toBe('杜诗捃')
    expect(result?.doc).toEqual({ _label: '杜诗捃·卷一', type: 'LinguisticObject' })
  })

  it('ancient_book 无 objectUri 时不应触发二次 object 详情请求', async () => {
    const entryUri = '/processed/json-ld/ancient-book/set/book-entry/17270_304.json'
    vi.mocked(fetchAncientBookByIdRepo).mockResolvedValueOnce({
      success: true,
      data: {
        id: '17270_304',
        title: '杜诗详注',
        uri: entryUri,
        summary: '古籍摘要',
        texts: [
          {
            id: '17270_304_1',
            label: '卷一',
            uri: '/processed/json-ld/ancient-book/text/volume/17270_304_1.json',
            textUri: '/processed/json-ld/ancient-book/text/volume/17270_304_1.json',
            volumeNo: 1,
          },
        ],
        doc: { _label: '杜诗详注（书目）', type: 'Set' },
      },
    })

    const result = await fetchDetailByResource({ type: 'ancient_book', id: '17270_304' }, entryUri)

    expect(fetchAncientBookByIdRepo).toHaveBeenCalledTimes(1)
    expect(result?.doc).toEqual({ _label: '杜诗详注（书目）', type: 'Set' })
  })

  it('ancient_book object 二次请求失败时应回退首次文档', async () => {
    const entryUri = '/processed/json-ld/ancient-book/set/book-entry/17270_305.json'
    const objectUri = '/processed/json-ld/ancient-book/object/volume/17270_305_1.json'
    vi.mocked(fetchAncientBookByIdRepo)
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: '17270_305',
          title: '杜诗别本',
          uri: entryUri,
          summary: '古籍摘要',
          texts: [
            {
              id: '17270_305_1',
              label: '卷一',
              uri: '/processed/json-ld/ancient-book/text/volume/17270_305_1.json',
              textUri: '/processed/json-ld/ancient-book/text/volume/17270_305_1.json',
              objectUri,
              volumeNo: 1,
            },
          ],
          doc: { _label: '杜诗别本（书目）', type: 'Set' },
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: { code: 'NOT_FOUND', message: 'x' },
      })

    const result = await fetchDetailByResource({ type: 'ancient_book', id: '17270_305' }, entryUri)

    expect(fetchAncientBookByIdRepo).toHaveBeenNthCalledWith(1, '17270_305', entryUri)
    expect(fetchAncientBookByIdRepo).toHaveBeenNthCalledWith(2, '17270_305_1', objectUri)
    expect(result?.doc).toEqual({ _label: '杜诗别本（书目）', type: 'Set' })
  })

  it('ancient_book object 文档应补充而非覆盖主文档中的创作者与时间线索', async () => {
    const entryUri = '/processed/json-ld/ancient-book/text/book/17270_303.json'
    const objectUri = '/processed/json-ld/ancient-book/object/volume/17270_303_1.json'
    vi.mocked(fetchAncientBookByIdRepo)
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: '17270_303',
          title: '杜诗捃',
          uri: entryUri,
          summary: '古籍摘要',
          texts: [
            {
              id: '17270_303_1',
              label: '卷一',
              uri: '/processed/json-ld/ancient-book/text/volume/17270_303_1.json',
              textUri: '/processed/json-ld/ancient-book/text/volume/17270_303_1.json',
              objectUri,
              volumeNo: 1,
            },
          ],
          doc: {
            _label: '杜诗捃',
            type: 'LinguisticObject',
            created_by: {
              type: 'Creation',
              _label: '唐元竑创作',
              carried_out_by: [{ _label: '唐元竑' }],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: '17270_303_1',
          title: '杜诗捃·卷一',
          uri: objectUri,
          summary: '卷一摘要',
          doc: {
            _label: '杜诗捃·卷一',
            type: 'HumanMadeObject',
            produced_by: {
              type: 'Production',
              _label: '唐元竑（明）创作',
              carried_out_by: [{ _label: '唐元竑' }],
              timespan: [{ _label: '明' }],
            },
          },
        },
      })

    const result = await fetchDetailByResource({ type: 'ancient_book', id: '17270_303' }, entryUri)

    expect(fetchAncientBookByIdRepo).toHaveBeenNthCalledWith(1, '17270_303', entryUri)
    expect(fetchAncientBookByIdRepo).toHaveBeenNthCalledWith(2, '17270_303_1', objectUri)
    expect(result?.doc).toMatchObject({
      _label: '杜诗捃·卷一',
      type: 'HumanMadeObject',
      created_by: {
        _label: '唐元竑创作',
      },
      produced_by: {
        _label: '唐元竑（明）创作',
      },
    })
  })
})
