/**
 * 诗文详情提取模块
 *
 * 从 JSON-LD 文档中提取诗文实体详细信息。
 * 支持诗文集合（set）和诗文文本（txt）两种类型。
 *
 * @module server/src/domain/detail/poemExtractor
 */

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
 * 从 URI 提取资源 ID
 *
 * @param {string} uri - 文档 URI
 * @returns {string} 资源 ID
 */
function extractIdFromUri(uri) {
  if (!uri) return ''
  const segments = uri.split('/')
  const lastSegment = segments[segments.length - 1] || ''
  return lastSegment.replace(/\.json$/i, '')
}

/**
 * 从节点中提取标签
 *
 * @param {object|string} node - 节点对象或字符串
 * @returns {string} 标签文本
 */
function pickNodeLabel(node) {
  if (typeof node === 'string') return node.trim()
  if (!node || typeof node !== 'object') return ''
  for (const key of ['_label', 'content', 'label', 'name', 'title', '@value', 'value']) {
    const value = node[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const identified = Array.isArray(node.identified_by) ? node.identified_by : []
  for (const row of identified) {
    if (row && typeof row === 'object' && typeof row.content === 'string' && row.content.trim()) {
      return row.content.trim()
    }
  }
  return ''
}

/**
 * 判断分类节点是否命中指定语义
 *
 * @param {object} node - 分类节点
 * @param {'genre'|'rhyme'} target - 目标语义
 * @returns {boolean}
 */
function matchPoemClassificationTarget(node, target) {
  if (!node || typeof node !== 'object') return false

  const classifiers = Array.isArray(node.classified_as) ? node.classified_as : [node.classified_as]
  return classifiers.some((item) => {
    if (!item || typeof item !== 'object') return false
    const label = pickNodeLabel(item).toLowerCase()
    const id = String(item.id || item.uri || item['@id'] || '').toLowerCase()

    if (target === 'genre') {
      return label === 'poems' || id.includes('300026451')
    }

    if (target === 'rhyme') {
      return label === 'rhyme' || id.includes('300438590')
    }

    return false
  })
}

/**
 * 提取诗文分类元数据
 *
 * @param {object} doc - 文档对象
 * @returns {{genre?: string, genreUri?: string, rhyme?: string, rhymeUri?: string}}
 */
function extractPoemClassificationMetadata(doc) {
  const classifiedAs = Array.isArray(doc?.classified_as) ? doc.classified_as : [doc?.classified_as]
  let genre = ''
  let genreUri = ''
  let rhyme = ''
  let rhymeUri = ''

  for (const item of classifiedAs) {
    if (!item || typeof item !== 'object') continue
    const label = pickNodeLabel(item)
    const uri = normalizeText(item.id || item.uri || item['@id'])

    if (!genre && label && matchPoemClassificationTarget(item, 'genre')) {
      genre = label
      genreUri = uri
      continue
    }

    if (!rhyme && label && matchPoemClassificationTarget(item, 'rhyme')) {
      rhyme = label
      rhymeUri = uri
    }
  }

  return {
    genre: genre || undefined,
    genreUri: genreUri || undefined,
    rhyme: rhyme || undefined,
    rhymeUri: rhymeUri || undefined,
  }
}

/**
 * 从文档中提取文本内容
 *
 * @param {object} doc - 文档对象
 * @returns {string} 提取的文本
 */
function extractDocText(doc) {
  if (!doc || typeof doc !== 'object') return ''
  const pickText = (value) => {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = pickText(item)
        if (text) return text
      }
    }
    if (value && typeof value === 'object') {
      for (const key of ['content', '_label', '@value', 'value', 'label', 'name', 'title']) {
        const text = pickText(value[key])
        if (text) return text
      }
    }
    return ''
  }
  for (const key of ['content', 'text_norm_zh', 'text_norm', 'text', 'description', 'title', 'name']) {
    const text = pickText(doc[key])
    if (text) return text
  }
  for (const key of ['identified_by', 'referred_to_by']) {
    const text = pickText(doc[key])
    if (text) return text
  }
  return ''
}

/**
 * 选取行标题
 *
 * @param {object} row - 搜索结果行
 * @param {object} doc - 文档对象
 * @returns {string} 标题
 */
function pickRowTitle(row, doc = null) {
  const blocked = new Set(['person', 'place', 'type', 'name', 'group', 'event', 'object', 'concept', 'set', 'work'])
  const normalize = (value) => {
    const text = normalizeText(value)
    if (!text) return ''
    if (blocked.has(text.toLowerCase().replace(/\s+/g, ''))) return ''
    return text
  }
  const extract = (value) => {
    if (!value || typeof value !== 'object') return ''
    for (const key of ['content', '_label', '@value', 'value', 'label', 'name', 'title', 'person_name', 'author_name']) {
      const text = normalize(value[key])
      if (text) return text
    }
    return ''
  }
  for (const source of [doc || {}, row || {}]) {
    for (const key of ['_label', 'title', 'name', 'label', 'person_name', 'author_name']) {
      const value = source[key]
      const direct = normalize(value)
      if (direct) return direct
      if (Array.isArray(value) && value.length > 0) {
        const first = typeof value[0] === 'string' ? normalize(value[0]) : extract(value[0])
        if (first) return first
      }
    }
    for (const key of ['identified_by', 'referred_to_by']) {
      const nested = source[key]
      if (Array.isArray(nested)) {
        for (const item of nested) {
          const text = extract(item)
          if (text) return text
        }
      } else {
        const text = extract(nested)
        if (text) return text
      }
    }
  }
  const uri = String(row?.uri || '')
  const stem = uri.split('/').pop()?.replace(/\.json$/i, '') || ''
  return stem || '未命名条目'
}

/**
 * 规范化实体 ID
 *
 * @param {string} value - 输入值
 * @returns {string} 规范化后的 ID
 */
function normalizeEntityId(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/')) {
    return text.split('/').pop()?.replace(/\.json$/i, '') || ''
  }
  return text.replace(/\.json$/i, '')
}

/**
 * 从实体 ID 中提取更宽松的搜索键
 *
 * 例如：
 * - poem_31848 -> 31848
 * - xxx-123 -> 123
 *
 * @param {string} value - 输入值
 * @returns {string[]} 搜索键列表
 */
function buildEntitySearchKeys(value) {
  const text = String(value || '').trim()
  if (!text) return []

  const normalizedId = normalizeEntityId(text)
  const candidates = new Set([text, normalizedId])

  const lastToken = normalizedId.split(/[_-]/).pop()?.trim() || ''
  if (lastToken && /^\d+$/.test(lastToken)) {
    candidates.add(lastToken)
  }

  return Array.from(candidates)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

// ============================================================================
// URI 类型判断
// ============================================================================

/**
 * 判断是否为诗文集合 URI
 *
 * @param {string} uri - 文档 URI
 * @returns {boolean}
 */
export function isPoemSetUri(uri) {
  const value = String(uri || '')
  return value.startsWith('/processed/json-ld/poem/set/') ||
    value.startsWith('/processed/json-ld/poem/set/')
}

/**
 * 判断是否为诗文文本 URI
 *
 * @param {string} uri - 文档 URI
 * @returns {boolean}
 */
export function isPoemTextUri(uri) {
  const value = String(uri || '')
  return value.startsWith('/processed/json-ld/poem/text/') ||
    value.startsWith('/processed/json-ld/poem/text/')
}

// ============================================================================
// 诗文元数据提取
// ============================================================================

/**
 * 提取诗文作者
 *
 * @param {object} doc - 文档对象
 * @returns {string} 作者名称
 */
export function extractPoemAuthor(doc) {
  const createdBy = Array.isArray(doc?.created_by) ? doc.created_by : [doc?.created_by]
  for (const created of createdBy) {
    if (!created || typeof created !== 'object') continue
    const carried = Array.isArray(created.carried_out_by) ? created.carried_out_by : [created.carried_out_by]
    const labels = carried.map((node) => pickNodeLabel(node)).filter(Boolean)
    if (labels.length) return labels.join('、')
  }
  return ''
}

/**
 * 提取诗文作者 ID
 *
 * @param {object} doc - 文档对象
 * @returns {string} 作者 ID
 */
export function extractPoemAuthorId(doc) {
  const createdBy = Array.isArray(doc?.created_by) ? doc.created_by : [doc?.created_by]
  for (const created of createdBy) {
    if (!created || typeof created !== 'object') continue
    const carried = Array.isArray(created.carried_out_by) ? created.carried_out_by : [created.carried_out_by]
    for (const actor of carried) {
      if (actor && typeof actor === 'object' && actor.id) {
        const authorId = String(actor.id).split('/').pop()
        if (authorId) return authorId
      }
    }
  }
  return ''
}

/**
 * 提取诗文全文
 *
 * @param {object} doc - 文档对象
 * @returns {string} 诗文全文
 */
export function extractPoemFullText(doc) {
  if (!doc || typeof doc !== 'object') return ''
  // 优先读取规范化全文字段
  for (const key of ['full_text', 'fullText', 'text_norm_zh', 'text_norm', 'text', 'content']) {
    const value = doc[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value)) {
      const lines = value.map((item) => String(item || '').trim()).filter(Boolean)
      if (lines.length) return lines.join('\n')
    }
  }
  return ''
}

/**
 * 提取 member_of 中的 ID 集合
 *
 * @param {object} doc - 文档对象
 * @returns {Set<string>} ID 集合
 */
function extractMemberOfIds(doc) {
  const output = new Set()
  const memberOf = Array.isArray(doc?.member_of) ? doc.member_of : [doc?.member_of]
  for (const node of memberOf) {
    if (node && typeof node === 'object' && typeof node.id === 'string' && node.id.trim()) {
      output.add(node.id.trim())
    }
  }
  return output
}

/**
 * 规范化地点节点
 *
 * @param {unknown} node - 节点
 * @returns {{label: string, uri: string} | null}
 */
function normalizePlaceLink(node) {
  if (!node) return null

  if (typeof node === 'string') {
    const text = normalizeText(node)
    if (!text) return null
    return { label: text, uri: '' }
  }

  if (typeof node !== 'object') return null
  const record = node
  const label = normalizeText(record._label || record.label || record.name || record.content || record.value)
  const uri = normalizeText(record.id || record.uri || record['@id'])
  if (!label && !uri) return null
  return { label: label || uri, uri }
}

function parseWktPoint(value) {
  const text = normalizeText(value)
  const match = text.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i)
  if (!match) return null
  const lng = Number.parseFloat(match[1])
  const lat = Number.parseFloat(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

async function enrichPoemRelatedPlaces(places, mlGetDoc) {
  const output = []
  for (const place of places || []) {
    const placeId = normalizeEntityId(place?.uri)
    const candidates = placeId
      ? [
          `/processed/json-ld/place/${placeId}.json`,
          `/processed/json-ld/place/${placeId}.json`,
        ]
      : []
    let geo = null
    for (const uri of candidates) {
      const doc = await mlGetDoc(uri)
      geo = parseWktPoint(doc?.defined_by || doc?.['crm:P168_place_is_defined_by'])
      if (geo) break
    }
    output.push(geo ? { ...place, ...geo } : place)
  }
  return output
}

/**
 * 从文档中收集候选节点（支持路径穿透数组）
 *
 * @param {object} root - 根节点
 * @param {string[]} path - 属性路径
 * @returns {unknown[]}
 */
function collectNodesByPath(root, path) {
  let nodes = [root]
  for (const segment of path) {
    const next = []
    nodes.forEach((node) => {
      if (!node || typeof node !== 'object') return
      const value = node[segment]
      if (Array.isArray(value)) {
        next.push(...value)
        return
      }
      if (value != null) next.push(value)
    })
    nodes = next
  }
  return nodes
}

/**
 * 从文档推断诗文相关地点
 *
 * @param {object} doc - 文档对象
 * @returns {Array<{label: string, uri: string}>}
 */
function inferPoemRelatedPlaces(doc) {
  if (!doc || typeof doc !== 'object') return []
  const placeNodes = [
    ...collectNodesByPath(doc, ['took_place_at']),
    ...collectNodesByPath(doc, ['created_by', 'took_place_at']),
  ]

  const seen = new Set()
  const output = []
  placeNodes.forEach((item) => {
    const normalized = normalizePlaceLink(item)
    if (!normalized || !normalized.label) return
    const key = normalized.uri || normalized.label
    if (!key || seen.has(key)) return
    seen.add(key)
    output.push(normalized)
  })
  return output
}

// ============================================================================
// 诗文注释提取
// ============================================================================

const POEM_COMMENT_CLASSIFICATION_LABELS = new Set(['comment', 'biography statement'])

/**
 * 收集分类节点标签
 *
 * @param {object|object[]} value - 分类节点或数组
 * @returns {string[]} 标签列表
 */
function collectClassificationLabels(value) {
  const queue = Array.isArray(value) ? [...value] : [value]
  const labels = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object') continue

    const label = pickNodeLabel(current)
    if (label) labels.push(label.toLowerCase())

    const nested = Array.isArray(current.classified_as) ? current.classified_as : [current.classified_as]
    nested.forEach((item) => {
      if (item && typeof item === 'object') queue.push(item)
    })
  }

  return labels
}

/**
 * 判断条目是否属于诗文校注
 *
 * @param {object} item - 注释条目
 * @returns {boolean}
 */
function isPoemCommentEntry(item) {
  if (!item || typeof item !== 'object') return false

  const labels = collectClassificationLabels(item.classified_as)
  return labels.some((label) => POEM_COMMENT_CLASSIFICATION_LABELS.has(label))
}

/**
 * 从文档中提取校勘注释
 *
 * 遍历 referred_to_by 数组，筛选可识别为校注的条目。
 *
 * @param {object} doc - 文档对象
 * @returns {Array<{text?: string, comment: string}>} 注释列表
 */
export function extractPoemComments(doc) {
  if (!doc || typeof doc !== 'object') return []

  const referredToBy = Array.isArray(doc.referred_to_by) ? doc.referred_to_by : [doc.referred_to_by]
  const output = []

  for (const item of referredToBy) {
    if (!item || typeof item !== 'object') continue

    if (!isPoemCommentEntry(item)) continue

    const comment = extractDocText(item)
    if (!comment) continue

    // 提取对应的原文
    const text = typeof doc.content === 'string' ? doc.content.trim() : extractPoemFullText(doc)

    output.push({ text: text || undefined, comment })
  }

  return output
}

/**
 * 从文本文档列表中收集所有校勘注释
 *
 * @param {Array<{uri: string, doc: object}>} textDocs - 文本文档列表
 * @returns {Array<{text?: string, comment: string}>} 注释列表
 */
function collectCommentsFromTextDocs(textDocs) {
  if (!Array.isArray(textDocs)) return []

  const output = []
  for (const { doc } of textDocs) {
    const comments = extractPoemComments(doc)
    output.push(...comments)
  }
  return output
}

// ============================================================================
// 诗文详情提取
// ============================================================================

/**
 * 从文档中提取诗文详细信息（API v1 格式）
 *
 * @param {string} uri - 文档 URI
 * @param {object} doc - 文档对象
 * @param {object} poemSetDetail - 诗文集合详情（可选）
 * @returns {object|null} 诗文详情对象或 null
 */
export function extractPoemDetail(uri, doc, poemSetDetail) {
  if (!doc) return null

  const title = pickRowTitle({ uri }, doc)

  // 从 poemSetDetail 获取作者
  const author = poemSetDetail?.author || extractPoemAuthor(doc) || '未知作者'

  // 提取作者 ID
  const authorId = extractPoemAuthorId(doc)

  // 提取朝代
  let dynasty = ''
  const timespan = doc.timespan || doc.created_by
  if (timespan && typeof timespan === 'object') {
    const carried = Array.isArray(timespan.carried_out_by) ? timespan.carried_out_by : [timespan.carried_out_by]
    for (const actor of carried) {
      const label = pickNodeLabel(actor)
      if (label) {
        dynasty = label
        break
      }
    }
  }

  const classificationMetadata = extractPoemClassificationMetadata(doc)

  // 提取来源
  let source = ''
  const referredToBy = Array.isArray(doc.referred_to_by) ? doc.referred_to_by : [doc.referred_to_by]
  for (const item of referredToBy) {
    if (item && typeof item === 'object' && item.source) {
      source = extractDocText(item.source)
      if (source) break
    }
  }

  // 提取校勘注释
  const comments = extractPoemComments(doc)

  return {
    id: extractIdFromUri(uri),
    title: title || '未命名诗文',
    author,
    authorId: authorId || undefined,
    dynasty: dynasty || undefined,
    genre: classificationMetadata.genre,
    genreUri: classificationMetadata.genreUri,
    rhyme: classificationMetadata.rhyme,
    rhymeUri: classificationMetadata.rhymeUri,
    source: source || undefined,
    comments: comments.length ? comments : undefined,
    doc: doc && typeof doc === 'object' ? doc : {},
    uri,
  }
}

/**
 * 构建诗文集合详情（用于兼容路径）
 *
 * @param {string} uri - 文档 URI
 * @param {object} doc - 文档对象
 * @returns {Promise<object|null>} 诗文集合详情或 null
 */
export async function buildPoemSetDetail(uri, doc, dependencies) {
  const { mlGetDoc, searchWithFallback } = dependencies
  const poemSetUri = String(uri || '')
  const isSetDocument = isPoemSetUri(poemSetUri)
  if (!isSetDocument || !doc) return null

  const title = pickRowTitle({ uri }, doc)
  const author = extractPoemAuthor(doc)
  const authorId = extractPoemAuthorId(doc)
  const classificationMetadata = extractPoemClassificationMetadata(doc)

  // 解析诗文文本文档
  const { textUri, textDoc } = await resolvePoemTextDocForSet(uri, doc, { mlGetDoc, searchWithFallback })
  const textDocs = await collectPoemTextDocsForSet(doc, { mlGetDoc, searchWithFallback })

  const mergedFullText = textDocs
    .map((item) => extractPoemFullText(item.doc))
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .join('\n')

  const fullText = mergedFullText || extractPoemFullText(textDoc)
  const primaryTextUri = textDocs[0]?.uri || textUri

  // 收集所有文本片段的校勘注释
  const comments = collectCommentsFromTextDocs(textDocs)
  const relatedPlaces = await enrichPoemRelatedPlaces(inferPoemRelatedPlaces(doc), mlGetDoc)

  return {
    id: extractIdFromUri(uri),
    title: title || '未命名诗文',
    author: author || '未知作者',
    authorId: authorId || undefined,
    genre: classificationMetadata.genre,
    genreUri: classificationMetadata.genreUri,
    rhyme: classificationMetadata.rhyme,
    rhymeUri: classificationMetadata.rhymeUri,
    fullText: fullText || '未检索到诗文全文',
    textUri: primaryTextUri,
    relatedPlaces,
    comments: comments.length ? comments : undefined,
    doc: doc && typeof doc === 'object' ? doc : {},
    set: {
      id: extractIdFromUri(uri),
      uri,
      label: title || '未命名诗集',
    },
  }
}

/**
 * 构建兼容诗文详情
 *
 * @param {string} uri - 文档 URI
 * @param {object} doc - 文档对象
 * @param {object} dependencies - 依赖注入
 * @returns {Promise<object|null>} 诗文详情或 null
 */
export async function buildPoemDetailForLegacy(uri, doc, dependencies) {
  if (!doc) return null
  const normalizedUri = String(uri || '')

  // 尝试构建集合详情
  const setDetail = await buildPoemSetDetail(normalizedUri, doc, dependencies)
  if (setDetail) return setDetail

  // 处理文本文档
  const isTextDocument = isPoemTextUri(normalizedUri)
  if (!isTextDocument) return null

  const { mlGetDoc, searchWithFallback } = dependencies
  const setInfo = await resolvePoemSetFromTextDoc(normalizedUri, doc, { mlGetDoc, searchWithFallback })
  const title = setInfo?.setLabel || pickRowTitle({ uri: normalizedUri }, doc)
  const author = setInfo?.setDoc ? extractPoemAuthor(setInfo.setDoc) : ''
  const authorId = setInfo?.setDoc ? extractPoemAuthorId(setInfo.setDoc) : ''
  const relatedPlaces = await enrichPoemRelatedPlaces(inferPoemRelatedPlaces(setInfo?.setDoc || doc), mlGetDoc)

  // 当找到父 Set 时，收集所有文本片段合并全文
  let fullText = extractPoemFullText(doc)
  let allComments = extractPoemComments(doc)
  if (setInfo?.setDoc) {
    const textDocs = await collectPoemTextDocsForSet(setInfo.setDoc, { mlGetDoc, searchWithFallback })
    if (textDocs.length > 1) {
      fullText = textDocs
        .map((item) => extractPoemFullText(item.doc))
        .map((line) => String(line || '').trim())
        .filter(Boolean)
        .join('\n')
      allComments = collectCommentsFromTextDocs(textDocs)
    }
  }

  return {
    id: extractIdFromUri(setInfo?.setUri || normalizedUri),
    title: title || '未命名诗文',
    author: author || '未知作者',
    authorId: authorId || undefined,
    fullText: fullText || '未检索到诗文全文',
    textUri: normalizedUri,
    relatedPlaces,
    comments: allComments.length ? allComments : undefined,
    doc: (setInfo?.setDoc && typeof setInfo.setDoc === 'object') ? setInfo.setDoc : (doc && typeof doc === 'object' ? doc : {}),
    set: setInfo
      ? {
          id: setInfo.setId,
          uri: setInfo.setUri,
          label: setInfo.setLabel,
        }
      : undefined,
  }
}

// ============================================================================
// 内部辅助函数
// ============================================================================

/**
 * 从文本文档解析诗文集合
 */
async function resolvePoemSetFromTextDoc(textUri, textDoc, { mlGetDoc, searchWithFallback }) {
  if (!textDoc || typeof textDoc !== 'object') return null

  const rawSetIds = Array.from(extractMemberOfIds(textDoc))
  const normalizedIds = rawSetIds.map((value) => normalizeEntityId(value)).filter(Boolean)
  const textStem = String(textUri || '').split('/').pop()?.replace(/\.json$/i, '') || ''
  // 当存在纯数字 ID 时，额外添加 poem_ 前缀以匹配实际 Set 文件名
  const prefixedIds = normalizedIds
    .filter((item) => /^\d+$/.test(item))
    .map((item) => `poem_${item}`)
  const idPool = Array.from(new Set([...normalizedIds, ...prefixedIds, textStem]))

  for (let index = 0; index < idPool.length; index += 1) {
    const setId = idPool[index]
    const directUris = [
      `/processed/json-ld/poem/set/${setId}.json`,
      `/processed/json-ld/poem/set/${setId}`,
      `/processed/json-ld/poem/set/${setId}.json`,
      `/processed/json-ld/poem/set/${setId}`,
      `/heluo/poems/sets/${setId}.json`,
      `/heluo/poems/sets/${setId}.json`,
      `/processed/json-ld/poem/set/${setId}.json`,
      `/processed/json-ld/poem/set/${setId}`,
    ]
    for (let i = 0; i < directUris.length; i += 1) {
      const uri = directUris[i]
      const setDoc = await mlGetDoc(uri)
      if (!setDoc) continue
      const setLabel = pickNodeLabel(setDoc) || pickRowTitle({ uri }, setDoc)
      return { setId, setUri: uri, setLabel: setLabel || setId, setDoc }
    }

    const searchData = await searchWithFallback({
      query: setId,
      pageLength: 8,
      directories: ['/processed/json-ld/poem/set/', '/processed/json-ld/poem/set/', '/processed/json-ld/poem/set/'],
      collections: ['/heluo/poems/sets', '/heluo/poems/sets'],
    })
    const match = (searchData.results || []).find((row) => normalizeEntityId(row?.uri) === setId)
    if (match?.uri) {
      const setDoc = await mlGetDoc(match.uri)
      if (setDoc) {
        const setLabel = pickNodeLabel(setDoc) || pickRowTitle({ uri: match.uri }, setDoc)
        return { setId, setUri: match.uri, setLabel: setLabel || setId, setDoc }
      }
    }
  }

  return null
}

/**
 * 从集合文档解析诗文文本文档
 */
async function resolvePoemTextDocForSet(poemSetUri, poemSetDoc, { mlGetDoc, searchWithFallback }) {
  if (!poemSetDoc) return { textUri: '', textDoc: null }

  const setId = normalizeEntityId(poemSetDoc.id)
  const setStem = String(poemSetUri || '').split('/').pop()?.replace(/\.json$/i, '') || ''
  const setStemNormalized = normalizeEntityId(setStem)

  const directTextUris = [
    `/processed/json-ld/poem/text/${setStem}.json`,
    `/processed/json-ld/poem/text/${setStemNormalized}.json`,
    `/processed/json-ld/poem/text/${setStem}.json`,
    `/processed/json-ld/poem/text/${setStemNormalized}.json`,
    `/processed/json-ld/poem/text/${setStem}.json`,
    `/processed/json-ld/poem/text/${setStemNormalized}.json`,
  ]

  for (const uri of directTextUris) {
    const doc = await mlGetDoc(uri)
    if (doc) return { textUri: uri, textDoc: doc }
  }

  return { textUri: '', textDoc: null }
}

/**
 * 收集诗文集合的所有文本文档
 */
async function collectPoemTextDocsForSet(poemSetDoc, { mlGetDoc, searchWithFallback }) {
  if (!poemSetDoc) return []

  const setIdRaw = String(poemSetDoc.id || '').trim()
  const setId = normalizeEntityId(setIdRaw)
  if (!setId) return []

  const setLabel = pickNodeLabel(poemSetDoc)
  const queryCandidates = Array.from(
    new Set([
      ...buildEntitySearchKeys(setIdRaw),
      ...buildEntitySearchKeys(setId),
      String(setLabel || '').trim(),
    ].filter(Boolean)),
  )

  const rowsPool = []
  for (const query of queryCandidates) {
    const searchData = await searchWithFallback({
      query,
      pageLength: 120,
      directories: ['/processed/json-ld/poem/text/', '/processed/json-ld/poem/text/', '/processed/json-ld/poem/text/'],
      collections: ['/heluo/poems/texts', '/heluo/poems/texts'],
    })
    rowsPool.push(...(searchData.results || []))
  }

  const output = []
  const seen = new Set()

  for (const row of rowsPool) {
    const uri = String(row?.uri || '').trim()
    if (!uri || seen.has(uri) || !isPoemTextUri(uri)) continue

    const doc = await mlGetDoc(uri)
    if (!doc) continue

    const memberIds = Array.from(extractMemberOfIds(doc)).map((item) => normalizeEntityId(item))
    if (!memberIds.includes(setId)) continue

    seen.add(uri)
    output.push({ uri, doc })
  }

  // 按片段顺序排序
  output.sort((a, b) => {
    const orderA = parsePoemTextSegmentOrder(a.uri)
    const orderB = parsePoemTextSegmentOrder(b.uri)
    return orderA - orderB
  })

  return output
}

/**
 * 解析诗文文本片段顺序
 */
function parsePoemTextSegmentOrder(uri) {
  const text = String(uri || '')
  const match = text.match(/_(\d+)(?:\.json)?$/i)
  if (!match) return Number.MAX_SAFE_INTEGER
  const num = Number(match[1])
  return Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  isPoemSetUri,
  isPoemTextUri,
  extractPoemAuthor,
  extractPoemAuthorId,
  extractPoemFullText,
  extractPoemComments,
  extractPoemDetail,
  buildPoemSetDetail,
  buildPoemDetailForLegacy,
}
