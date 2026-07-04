/**
 * API Mock 响应数据
 * 用于单元测试
 */

import type {
  PersonDetailV1,
  PersonCardV1,
  PoemDetailV1,
  PoemCardV1,
  SearchResultItemV1,
  UnifiedSearchResponseV1,
  PlaceInfo,
} from '@/types/api'

// ========== 人物相关 Mock ==========

/** 人物详情 Mock */
export const mockPersonDetail: PersonDetailV1 = {
  id: '17270',
  name: '杜甫',
  aliases: ['子美', '杜陵野老', '少陵野老'],
  dynasty: '唐',
  lifespan: '712-770',
  birthplace: '河南巩县',
  summary: '唐代伟大的现实主义诗人，被后人尊称为"诗圣"，与李白并称"李杜"。',
  uri: '/processed/json-ld/person/17270.json',
  relatedPlaces: [
    { label: '洛阳', uri: '/processed/json-ld/place/luoyang.json' },
    { label: '长安', uri: '/processed/json-ld/place/changan.json' },
  ] as PlaceInfo[],
  relatedPoems: [
    { id: 'poem_001', title: '春望', author: '杜甫' },
    { id: 'poem_002', title: '登高', author: '杜甫' },
  ] as PoemCardV1[],
  externalUris: [
    'https://zh.wikipedia.org/wiki/杜甫',
    'https://baike.baidu.com/item/杜甫',
  ],
}

/** 人物卡片 Mock */
export const mockPersonCard: PersonCardV1 = {
  id: '17270',
  name: '杜甫',
  subtitle: '唐 · 712-770',
  score: 0.95,
}

/** 人物列表 Mock */
export const mockPersonList = {
  success: true as const,
  data: {
    items: [
      mockPersonCard,
      { id: '17271', name: '李白', subtitle: '唐 · 701-762', score: 0.92 },
      { id: '17272', name: '王维', subtitle: '唐 · 701-761', score: 0.88 },
    ],
    total: 3,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  },
}

/** 人物详情响应 Mock */
export const mockPersonDetailResponse = {
  success: true as const,
  data: mockPersonDetail,
}

// ========== 诗文相关 Mock ==========

/** 诗文详情 Mock */
export const mockPoemDetail: PoemDetailV1 = {
  id: 'poem_001',
  title: '春望',
  author: '杜甫',
  authorId: '17270',
  dynasty: '唐',
  genre: '五言律诗',
  rhyme: '侵韵',
  fullText: '国破山河在，城春草木深。\n感时花溅泪，恨别鸟惊心。\n烽火连三月，家书抵万金。\n白头搔更短，浑欲不胜簪。',
  source: '《杜工部集》',
  uri: '/processed/json-ld/poem/set/poem_001.json',
  textUri: '/processed/json-ld/poem/text/poem_001.json',
  set: {
    id: 'set_001',
    uri: '/processed/json-ld/poem/set/set_001.json',
    label: '杜工部集',
  },
  relatedPlaces: [{ label: '长安', uri: '/processed/json-ld/place/changan.json' }] as PlaceInfo[],
}

/** 诗文卡片 Mock */
export const mockPoemCard: PoemCardV1 = {
  id: 'poem_001',
  title: '春望',
  author: '杜甫',
  snippet: '国破山河在，城春草木深...',
  score: 0.95,
}

/** 诗文列表 Mock */
export const mockPoemList = {
  success: true as const,
  data: {
    items: [
      mockPoemCard,
      { id: 'poem_002', title: '登高', author: '杜甫', snippet: '风急天高猿啸哀...', score: 0.92 },
      { id: 'poem_003', title: '茅屋为秋风所破歌', author: '杜甫', snippet: '八月秋高风怒号...', score: 0.88 },
    ],
    total: 3,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  },
}

/** 诗文详情响应 Mock */
export const mockPoemDetailResponse = {
  success: true as const,
  data: mockPoemDetail,
}

// ========== 搜索相关 Mock ==========

/** 搜索结果项 Mock */
export const mockSearchItemPerson: SearchResultItemV1 = {
  type: 'person',
  id: '17270',
  title: '杜甫',
  snippet: '唐代伟大的现实主义诗人，被后人尊称为"诗圣"...',
  score: 0.95,
  uri: '/processed/json-ld/person/17270.json',
}

export const mockSearchItemPoem: SearchResultItemV1 = {
  type: 'poem',
  id: 'poem_001',
  title: '春望',
  snippet: '国破山河在，城春草木深...',
  score: 0.92,
  uri: '/processed/json-ld/poem/set/poem_001.json',
}

/** 统一搜索响应 Mock */
export const mockSearchResponse: UnifiedSearchResponseV1 = {
  query: '杜甫',
  type: 'all',
  total: 2,
  items: [mockSearchItemPerson, mockSearchItemPoem],
  counts: {
    person: 1,
    poem: 1,
  },
}

/** 统一搜索 API 响应 Mock */
export const mockSearchApiResponse = {
  success: true as const,
  data: mockSearchResponse,
}

// ========== 错误响应 Mock ==========

/** 404 错误响应 */
export const mockNotFoundResponse = {
  success: false as const,
  error: {
    code: 'NOT_FOUND' as const,
    message: '资源不存在',
  },
}

/** 500 错误响应 */
export const mockInternalErrorResponse = {
  success: false as const,
  error: {
    code: 'INTERNAL_ERROR' as const,
    message: '服务器内部错误',
  },
}

/** 参数错误响应 */
export const mockInvalidParamsResponse = {
  success: false as const,
  error: {
    code: 'INVALID_PARAMS' as const,
    message: '参数无效',
    details: { field: 'page', reason: '必须大于 0' },
  },
}
