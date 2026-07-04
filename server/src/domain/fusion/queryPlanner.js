/**
 * 融合查询规划模块
 *
 * 负责分析用户查询，规划检索维度，生成查询计划。
 * 支持关键词提取、实体识别、意图推断。
 *
 * @module server/src/domain/fusion/queryPlanner
 */

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 融合查询支持的文本维度
 */
export const FUSION_ALL_TEXT_DIMS = Object.freeze(['person', 'poem', 'book', 'ancient_book', 'place', 'concept', 'iiif'])

/**
 * 旧版默认维度（缺少 person）
 */
const FUSION_LEGACY_DEFAULT_DIMS = Object.freeze(['poem', 'place', 'ancient_book', 'concept', 'book'])

/**
 * 查询停用词
 */
const FUSION_QUERY_STOP_PHRASES = Object.freeze([
  '请问',
  '请',
  '一下',
  '有哪些',
  '有哪',
  '如何',
  '怎样',
  '怎么',
  '为什么',
  '是否',
  '能否',
  '可以',
  '一下子',
  '相关的',
  '相关',
  '中的',
  '中对',
  '中',
  '对',
  '其',
  '的',
  '吗',
  '呢',
])

/**
 * 通用术语集合
 */
const FUSION_GENERIC_TERMS = new Set([
  '诗文',
  '诗歌',
  '诗词',
  '诗',
  '词',
  '作品',
  '古籍',
  '图书',
  '资料',
  '内容',
  '问题',
  '描写',
  '相关',
])

/**
 * 人物名称提示词
 */
const FUSION_PERSON_HINTS = new Set(['杜甫', '李白', '白居易', '王维', '苏轼', '陆游'])

/**
 * 地点提示词
 */
const FUSION_PLACE_HINTS = new Set(['洛阳', '长安', '成都', '夔州', '开封', '汴梁'])

/**
 * 主题同义词映射
 */
const FUSION_TOPIC_SYNONYM_MAP = Object.freeze({
  现实关怀: ['忧国忧民', '民生疾苦', '社会动荡', '战乱'],
  现实: ['民生', '时局', '战乱'],
  关怀: ['忧国忧民', '同情百姓', '民瘼'],
  战争: ['战乱', '兵戈', '征战'],
  民生: ['百姓', '疾苦', '生计'],
})

/**
 * 时间线索提示词
 */
const FUSION_TIME_HINTS = Object.freeze([
  '早年', '中年', '晚年', '青年', '壮年',
  '开元', '天宝', '至德', '乾元', '上元', '大历',
  '唐代', '宋代', '元代', '明代', '清代',
])

/**
 * 分析视角提示词
 */
const FUSION_PERSPECTIVE_HINTS = Object.freeze([
  '心境', '情感', '风格', '主题', '影响', '思想', '变化', '演变', '特点',
])

/**
 * 多查询上限
 */
const FUSION_MULTI_QUERY_LIMIT = 8

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 规范化文本
 *
 * @param {any} value - 输入值
 * @returns {string} 规范化后的文本
 */
function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * 提取融合查询槽位（轻量版本）
 *
 * @param {string} rawQuery - 原始查询
 * @param {Array<{text: string, type: string}>} entities - 已识别实体
 * @returns {{who: string[], when: string[], where: string[], what: string[], how: string[], confidence: number}}
 */
export function extractFusionSlots(rawQuery = '', entities = []) {
  const text = normalizeFusionQuestion(rawQuery)
  if (!text) {
    return { who: [], when: [], where: [], what: [], how: [], title: [], confidence: 0 }
  }

  const who = new Set()
  const where = new Set()
  const when = new Set()
  const what = new Set()
  const how = new Set()
  const title = new Set()

  entities.forEach((item) => {
    const token = normalizeText(item?.text)
    if (!token) return
    if (item?.type === 'person') who.add(token)
    if (item?.type === 'place') where.add(token)
  })

  FUSION_PERSON_HINTS.forEach((name) => {
    if (text.includes(name)) who.add(name)
  })
  FUSION_PLACE_HINTS.forEach((place) => {
    if (text.includes(place)) where.add(place)
  })
  FUSION_TIME_HINTS.forEach((timeHint) => {
    if (text.includes(timeHint)) when.add(timeHint)
  })
  FUSION_PERSPECTIVE_HINTS.forEach((perspective) => {
    if (text.includes(perspective)) how.add(perspective)
  })

  const yearMatches = text.match(/\d{2,4}年/g) || []
  yearMatches.forEach((item) => when.add(item))

  const whatHints = ['诗', '诗文', '诗词', '作品', '人物', '地点', '古籍', '图书']
  whatHints.forEach((hint) => {
    if (text.includes(hint)) what.add(hint)
  })

  // 轻量诗题提取：匹配“望岳这首诗讲了什么”等句式
  const titlePatterns = [
    /([\u4e00-\u9fa5]{2,16})(?:这首诗|这首词|这篇诗|这篇词|一诗|一词)/,
    /(?:解释|解读|赏析|分析|讲解|介绍|说说)([\u4e00-\u9fa5]{2,16})(?:这首诗|这首词|这篇诗|这篇词)?/,
    /([\u4e00-\u9fa5]{2,16})(?:讲了什么|表达了什么|写了什么|是什么意思)/,
  ]
  for (const pattern of titlePatterns) {
    const match = text.match(pattern)
    const maybeTitle = normalizeText(match?.[1] || '')
    if (maybeTitle && !FUSION_GENERIC_TERMS.has(maybeTitle)) {
      title.add(maybeTitle)
      break
    }
  }

  const nonEmptySlotCount = [who, when, where, what, how, title].filter((slot) => slot.size > 0).length
  const confidence = Number((nonEmptySlotCount / 6).toFixed(2))

  return {
    who: Array.from(who),
    when: Array.from(when),
    where: Array.from(where),
    what: Array.from(what),
    how: Array.from(how),
    title: Array.from(title),
    confidence,
  }
}

/**
 * 规范化融合问题（移除标点）
 *
 * @param {string} rawQuery - 原始查询
 * @returns {string} 规范化后的查询
 */
export function normalizeFusionQuestion(rawQuery) {
  const normalized = normalizeText(rawQuery)
    .replace(/[，。！？；：、,.!?;:]/g, ' ')
    .replace(/[“""''「」『』《》【】（）()]/g, ' ')
    .replace(/\[/g, ' ')
    .replace(/\]/g, ' ')
  return normalizeText(normalized)
}

// ============================================================================
// 解析函数
// ============================================================================

/**
 * 解析融合维度参数
 *
 * @param {Array} rawDims - 原始维度数组
 * @returns {string[]} 解析后的维度数组
 */
export function parseFusionDims(rawDims) {
  if (!Array.isArray(rawDims) || rawDims.length === 0) {
    return [...FUSION_ALL_TEXT_DIMS]
  }

  const joined = rawDims
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(',')

  // 简单解析：按逗号分割
  const parsed = joined
    .split(',')
    .map((item) => item.trim())
    .filter((item) => FUSION_ALL_TEXT_DIMS.includes(item))

  if (!parsed.length) {
    return [...FUSION_ALL_TEXT_DIMS]
  }

  // 兼容旧前端默认维度（缺少 person）：自动升级到全库文本维度
  const isLegacyDefault =
    parsed.length === FUSION_LEGACY_DEFAULT_DIMS.length &&
    FUSION_LEGACY_DEFAULT_DIMS.every((scope) => parsed.includes(scope))

  if (isLegacyDefault) {
    return [...FUSION_ALL_TEXT_DIMS]
  }

  return parsed
}

/**
 * 解析融合 TopK 参数
 *
 * @param {any} rawTopK - 原始 TopK 值
 * @returns {number} 解析后的 TopK 值
 */
export function parseFusionTopK(rawTopK) {
  const num = Number(rawTopK)
  if (!Number.isFinite(num)) return 12
  return Math.min(30, Math.max(5, Math.floor(num)))
}

/**
 * 解析融合模式
 *
 * @param {string} rawMode - 原始模式值
 * @returns {string} 规范化后的模式
 */
export function normalizeFusionMode(rawMode) {
  const mode = String(rawMode || '').trim().toLowerCase()
  if (['rag', 'hybrid'].includes(mode)) return mode
  return 'hybrid'
}

/**
 * 解析融合布尔参数
 *
 * @param {any} rawValue - 原始值
 * @param {boolean} defaultValue - 默认值
 * @returns {boolean}
 */
export function parseFusionBoolean(rawValue, defaultValue = true) {
  if (rawValue === undefined || rawValue === null) return defaultValue
  if (typeof rawValue === 'boolean') return rawValue
  const text = String(rawValue).trim().toLowerCase()
  if (!text) return defaultValue
  return ['1', 'true', 'yes', 'y'].includes(text)
}

/**
 * 解析对话历史
 *
 * @param {Array} rawHistory - 原始对话历史
 * @returns {Array} 规范化后的对话历史
 */
export function parseFusionConversationHistory(rawHistory) {
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) return []
  const maxMessages = 12
  const maxContentLength = 500
  const normalizedMessages = []

  for (const item of rawHistory) {
    if (!item || typeof item !== 'object') continue
    const role = String(item.role || '').trim().toLowerCase()
    if (role !== 'user' && role !== 'assistant') continue
    const content = normalizeText(item.content)
    if (!content) continue
    normalizedMessages.push({
      role,
      content: content.slice(0, maxContentLength),
    })
  }

  if (normalizedMessages.length <= maxMessages) return normalizedMessages
  return normalizedMessages.slice(-maxMessages)
}

// ============================================================================
// 关键词提取
// ============================================================================

/**
 * 提取引号中的锚点词
 *
 * @param {string} rawQuery - 原始查询
 * @returns {string[]} 锚点词数组
 */
export function extractFusionQuotedAnchors(rawQuery) {
  const source = String(rawQuery || '')
  if (!source.trim()) return []

  const quoted = []
  const patterns = [/["\u201c]([^\u201d"]+)[\u201d"]/g, /"([^"]+)"/g, /「([^」]+)」/g, /『([^』]+)』/g, /《([^》]+)》/g]

  for (const pattern of patterns) {
    let match = pattern.exec(source)
    while (match) {
      const fragment = normalizeText(match[1])
        .replace(/[，。！？；：、,.!?;:]/g, ' ')
        .replace(/[“""''「」『』《》【】（）()]/g, ' ')
        .replace(/\[/g, ' ')
        .replace(/\]/g, ' ')
        .replace(/[/]/g, ' OR ')
      const normalizedFragment = normalizeText(fragment)
      if (normalizedFragment.length > 1) {
        quoted.push(normalizedFragment)
      }
      match = pattern.exec(source)
    }
  }

  return Array.from(new Set(quoted)).slice(0, 4)
}

/**
 * 从查询中提取关键词
 *
 * @param {string} rawQuery - 原始查询
 * @returns {string[]} 关键词数组
 */
export function extractFusionKeywords(rawQuery) {
  const normalized = normalizeFusionQuestion(rawQuery)
  if (!normalized) return []

  let stripped = normalized
  for (const phrase of FUSION_QUERY_STOP_PHRASES) {
    stripped = stripped.split(phrase).join(' ')
  }

  const source = normalizeText(stripped) || normalized
  const tokens = source
    .split(' ')
    .map((item) => normalizeText(item))
    .filter((item) => item && item.length > 1)

  const expandedTokens = []
  for (const token of tokens) {
    expandedTokens.push(token)
    for (const personName of FUSION_PERSON_HINTS) {
      if (token === personName || !token.includes(personName)) continue
      expandedTokens.push(personName)
      const rest = normalizeText(token.replace(personName, ' '))
      if (rest && rest.length > 1) expandedTokens.push(rest)
    }
  }

  const output = []
  const seen = new Set()
  for (const token of expandedTokens) {
    if (seen.has(token)) continue
    seen.add(token)
    output.push(token)
    if (output.length >= 8) break
  }

  return output
}

/**
 * 扩展主题关键词
 *
 * @param {string[]} topicKeywords - 主题关键词数组
 * @returns {string[]} 扩展后的关键词数组
 */
export function expandFusionTopicKeywords(topicKeywords = []) {
  const output = []
  const seen = new Set()

  const pushToken = (token) => {
    const text = normalizeText(token)
    if (!text || seen.has(text)) return
    seen.add(text)
    output.push(text)
  }

  for (const keyword of topicKeywords) {
    pushToken(keyword)
    const matchedSynonyms = []
    for (const [topic, synonyms] of Object.entries(FUSION_TOPIC_SYNONYM_MAP)) {
      if (keyword === topic || keyword.includes(topic) || topic.includes(keyword)) {
        matchedSynonyms.push(...synonyms)
      }
    }
    for (const synonym of matchedSynonyms) {
      pushToken(synonym)
      if (output.length >= 10) break
    }
    if (output.length >= 10) break
  }

  return output
}

// ============================================================================
// 类型推断
// ============================================================================

/**
 * 推断关键词类型
 *
 * @param {string} keyword - 关键词
 * @returns {string} 类型标识
 */
export function inferFusionKeywordType(keyword) {
  if (FUSION_PERSON_HINTS.has(keyword)) return 'person'
  if (FUSION_PLACE_HINTS.has(keyword)) return 'place'
  if (/古籍|卷|版本|书/.test(keyword)) return 'ancient_book_topic'
  if (/诗|词|登高|三吏|三别/.test(keyword)) return 'poem_or_topic'
  return 'keyword'
}

/**
 * 推断融合查询的首选作用域
 *
 * @param {string} rawQuery - 原始查询
 * @returns {string} 首选作用域
 */
export function inferFusionPreferredScope(rawQuery = '') {
  const text = normalizeFusionQuestion(rawQuery)
  if (!text) return ''
  if (/诗|诗歌|诗词|诗句|诗风|格律|意象|现实关怀|沉郁|诗史|杜诗/.test(text)) return 'poem'
  if (/谁|生平|人物|关系|传记|年谱/.test(text)) return 'person'
  if (/图书|著作|版本|文献|研究|专著/.test(text)) return 'book'
  if (/古籍|卷|册|部|条目/.test(text)) return 'ancient_book'
  if (/地点|地理|在哪里|何处|行迹|迁徙/.test(text)) return 'place'
  if (/概念|术语|主题|范畴/.test(text)) return 'concept'
  return ''
}

/**
 * 判断是否为诗文列表问题
 *
 * @param {string} rawQuery - 原始查询
 * @returns {boolean}
 */
export function isFusionPoemListQuestion(rawQuery = '') {
  const text = normalizeFusionQuestion(rawQuery)
  if (!text) return false
  return /(诗|诗作|诗文).*(有哪些|有哪几|哪几首|哪几篇)|给.+写.+诗|写给.+诗|赠.+诗/.test(text)
}

/**
 * 提取同名诗作比较题中的目标诗题
 *
 * @param {string} rawQuery - 原始查询
 * @returns {string} 目标诗题
 */
export function extractFusionPoemCompareTitle(rawQuery = '') {
  const normalizedQuery = normalizeFusionQuestion(rawQuery)
  if (!normalizedQuery) return ''

  const quotedAnchors = extractFusionQuotedAnchors(rawQuery)
  if (quotedAnchors.length === 1) {
    return normalizeText(quotedAnchors[0])
  }

  const titlePatterns = [
    /几首\s*([\u4e00-\u9fa5]{2,16})\s*之间(?:有何|有什么)?(?:区别|不同|差别|异同)/,
    /不同\s*([\u4e00-\u9fa5]{2,16})\s*(?:之间)?(?:怎么|如何)?(?:比较|区分)/,
    /([\u4e00-\u9fa5]{2,16})\s*这几首(?:诗|诗文|作品)?(?:之间)?(?:有何|有什么)?(?:区别|不同|差别|异同)/,
  ]

  for (const pattern of titlePatterns) {
    const matched = normalizeText(normalizedQuery.match(pattern)?.[1] || '')
    if (matched && !FUSION_GENERIC_TERMS.has(matched)) {
      return matched
    }
  }

  const slots = extractFusionSlots(rawQuery, [])
  if (slots.title?.length === 1) {
    return normalizeText(slots.title[0])
  }

  return ''
}

/**
 * 判断是否为同名诗作比较题
 *
 * @param {string} rawQuery - 原始查询
 * @returns {boolean}
 */
export function isFusionPoemCompareQuestion(rawQuery = '') {
  const normalizedQuery = normalizeFusionQuestion(rawQuery)
  if (!normalizedQuery) return false

  const targetTitle = extractFusionPoemCompareTitle(rawQuery)
  if (!targetTitle) return false

  const hasCompareSignal = /(区别|不同|差别|异同|比较|区分)/.test(normalizedQuery)
  const hasMultiPoemSignal = /(几首|多首|这几首|同题)/.test(normalizedQuery)
  return hasCompareSignal && (hasMultiPoemSignal || normalizedQuery.includes('之间'))
}

/**
 * 应用融合维度策略
 *
 * @param {string} rawQuery - 原始查询
 * @param {string[]} dims - 维度数组
 * @returns {string[]} 调整后的维度数组
 */
export function applyFusionDimsPolicy(rawQuery = '', dims = []) {
  const normalizedDims = Array.isArray(dims) ? dims.filter(Boolean) : []
  if (!normalizedDims.length) return normalizedDims
  if (isFusionPoemCompareQuestion(rawQuery) && normalizedDims.includes('poem')) {
    return ['poem']
  }
  if (!isFusionPoemListQuestion(rawQuery)) return normalizedDims
  if (!normalizedDims.includes('poem')) return normalizedDims
  return ['poem']
}

/**
 * 计算融合作用域的加权映射
 *
 * @param {string} rawQuery - 原始查询
 * @returns {object} 作用域权重映射
 */
export function computeFusionScopeBoostMap(rawQuery = '') {
  const preferredScope = inferFusionPreferredScope(rawQuery)
  const boosts = {
    person: 1,
    poem: 1,
    book: 1,
    ancient_book: 1,
    place: 1,
    concept: 1,
    iiif: 1,
  }

  if (!preferredScope) return boosts

  if (preferredScope === 'poem') {
    boosts.poem = 2.2
    boosts.person = 1.15
    boosts.book = 0.9
    boosts.ancient_book = 0.95
    return boosts
  }
  if (preferredScope === 'person') {
    boosts.person = 1.8
    boosts.poem = 1.1
    return boosts
  }
  if (preferredScope === 'book') {
    boosts.book = 1.8
    boosts.ancient_book = 1.3
    return boosts
  }
  if (preferredScope === 'ancient_book') {
    boosts.ancient_book = 1.8
    boosts.book = 1.2
    return boosts
  }
  if (preferredScope === 'place') {
    boosts.place = 1.7
    return boosts
  }
  if (preferredScope === 'concept') {
    boosts.concept = 1.7
    return boosts
  }

  return boosts
}

/**
 * 构建融合 RAG 多查询（借鉴 Multi-Query 思路）
 *
 * @param {object} params - 参数
 * @returns {string[]} 多查询数组
 */
export function buildFusionRagQueries(params = {}) {
  const {
    rawQuery = '',
    normalizedQuery = '',
    quotedAnchors = [],
    personKeywords = [],
    coreKeywords = [],
    expandedTopicKeywords = [],
    keywords = [],
    topicKeywords = [],
    slots = {},
    preferredScope = '',
  } = params

  const ragQueries = []
  const pushQuery = (value) => {
    const text = normalizeText(value)
    if (!text) return
    ragQueries.push(text)
  }

  for (const anchor of quotedAnchors) pushQuery(anchor)
  if (quotedAnchors.length > 1) pushQuery(quotedAnchors.join(' OR '))

  if (slots?.title?.length > 0) {
    pushQuery(slots.title[0])
    if (preferredScope === 'poem') {
      pushQuery(`${slots.title[0]} 诗意 主旨`)
    }
  }

  if (personKeywords.length > 0 && expandedTopicKeywords.length > 0) {
    pushQuery(`${personKeywords[0]} ${expandedTopicKeywords[0]}`)
  }
  if (slots?.who?.length > 0 && slots?.how?.length > 0) {
    pushQuery(`${slots.who[0]} ${slots.how[0]}`)
  }
  if (slots?.who?.length > 0 && slots?.when?.length > 0) {
    pushQuery(`${slots.who[0]} ${slots.when[0]}`)
  }
  if (slots?.where?.length > 0 && slots?.what?.length > 0) {
    pushQuery(`${slots.where[0]} ${slots.what[0]}`)
  }

  if (coreKeywords.length > 0) pushQuery(coreKeywords.join(' '))
  if (expandedTopicKeywords.length > 0) pushQuery(expandedTopicKeywords.join(' '))
  if (keywords.length > 0) pushQuery(keywords.join(' '))
  if (normalizedQuery) pushQuery(normalizedQuery)
  if (personKeywords.length > 0) pushQuery(personKeywords[0])
  if (expandedTopicKeywords.length > 0) pushQuery(expandedTopicKeywords[0])
  if (topicKeywords.length > 0) pushQuery(topicKeywords[0])
  if (!ragQueries.length) pushQuery(rawQuery)

  const dedupedQueries = []
  const seen = new Set()
  for (const query of ragQueries) {
    const text = normalizeText(query)
    if (!text || seen.has(text)) continue
    seen.add(text)
    dedupedQueries.push(text)
    if (dedupedQueries.length >= FUSION_MULTI_QUERY_LIMIT) break
  }
  return dedupedQueries
}

// ============================================================================
// 查询计划构建
// ============================================================================

/**
 * 构建融合查询计划
 *
 * @param {string} rawQuery - 原始查询
 * @param {string} mode - 融合模式
 * @param {string[]} dims - 维度数组
 * @returns {object} 查询计划
 */
export function buildFusionQueryPlan(rawQuery, mode, dims = []) {
  const normalizedQuery = normalizeFusionQuestion(rawQuery)
  const preferredScope = inferFusionPreferredScope(rawQuery)
  const quotedAnchors = extractFusionQuotedAnchors(rawQuery)
  const keywords = extractFusionKeywords(rawQuery)
  const entities = keywords.map((keyword) => ({
    text: keyword,
    type: inferFusionKeywordType(keyword),
  }))
  const slots = extractFusionSlots(rawQuery, entities)

  const personKeywords = entities.filter((item) => item.type === 'person').map((item) => item.text)
  const coreKeywords = keywords.filter((item) => !FUSION_GENERIC_TERMS.has(item))
  const topicKeywords = coreKeywords.filter((item) => !personKeywords.includes(item))
  const expandedTopicKeywords = expandFusionTopicKeywords(topicKeywords)
  const compareTitle = extractFusionPoemCompareTitle(rawQuery)
  const compareSpec = isFusionPoemCompareQuestion(rawQuery) && compareTitle
    ? {
      intent: 'poem_compare_by_title',
      title: compareTitle,
    }
    : null

  const dedupedQueries = buildFusionRagQueries({
    rawQuery,
    normalizedQuery,
    quotedAnchors,
    personKeywords,
    coreKeywords,
    expandedTopicKeywords,
    keywords,
    topicKeywords,
    slots,
    preferredScope,
  })

  return {
    originalQuery: rawQuery,
    normalizedQuery,
    keywords,
    entities,
    slots,
    ragQueries: dedupedQueries,
    preferredScope,
    compareSpec,
    fallbackUsed: false,
    mode,
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  FUSION_ALL_TEXT_DIMS,
  normalizeFusionQuestion,
  parseFusionDims,
  parseFusionTopK,
  normalizeFusionMode,
  parseFusionBoolean,
  parseFusionConversationHistory,
  extractFusionQuotedAnchors,
  extractFusionKeywords,
  extractFusionSlots,
  expandFusionTopicKeywords,
  inferFusionKeywordType,
  inferFusionPreferredScope,
  isFusionPoemListQuestion,
  extractFusionPoemCompareTitle,
  isFusionPoemCompareQuestion,
  applyFusionDimsPolicy,
  computeFusionScopeBoostMap,
  buildFusionRagQueries,
  buildFusionQueryPlan,
}
