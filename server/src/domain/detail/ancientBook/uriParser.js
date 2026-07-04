/**
 * 古籍 URI 解析模块
 *
 * 负责 URI 类型判断、ID 提取、元数据解析
 *
 * @module server/src/domain/detail/ancientBook/uriParser
 */

// ============================================================================
// URI 类型判断
// ============================================================================

/**
 * 判断是否为古籍条目 URI
 *
 * @param {string} uri - 文档 URI
 * @returns {boolean}
 */
export function isAncientBookEntryUri(uri) {
  const value = String(uri || '')
  if (!value) return false
  if (value.startsWith('/processed/iiif/collections/') || value.startsWith('/heluo/iiif/collections/')) return false
  if (value.includes('/ancient-book/set/department/') || value.includes('/ancient-book/set/root/')) return false
  return value.startsWith('/processed/json-ld/ancient-book/set/book-entry/')
}

/**
 * 判断是否为 IIIF Manifest URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
export function isIiifManifestUri(uri) {
  const text = String(uri || '').trim().toLowerCase()
  if (!text) return false
  return text.includes('/iiif/manifests/') || text.includes('/manifest.json') || text.includes('/manifest/')
}

/**
 * 分类古籍层次级别
 *
 * @param {string} uri - 文档 URI
 * @param {string} docId - 文档 ID
 * @returns {string} 层次级别: 'root' | 'department' | 'entry' | 'unknown'
 */
export function classifyAncientBookHierarchyLevel(uri = '', docId = '') {
  const normalizedUri = String(uri || '')
  if (normalizedUri.includes('/ancient-book/set/root/')) return 'root'
  if (normalizedUri.includes('/ancient-book/set/department/')) return 'department'
  if (normalizedUri.includes('/ancient-book/set/book-entry/')) return 'entry'

  const normalizedDocId = String(docId || '')
  const match = normalizedDocId.match(/\/set\/ancient-book\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/i)
  if (!match) return 'unknown'
  if (match[1] && !match[2]) return 'root'
  if (match[1] && match[2] && !match[3]) return 'department'
  if (match[1] && match[2] && match[3]) return 'entry'
  return 'unknown'
}

// ============================================================================
// 元数据提取
// ============================================================================

/**
 * 从 ancient_book 路径后提取第一个数字段
 *
 * @param {string} value - 路径字符串
 * @returns {string} 数字段
 */
export function extractFirstNumericSegmentAfterAncientBook(value) {
  const text = String(value || '')
  const marker = '/ancient-book/'
  const markerIndex = text.indexOf(marker)
  if (markerIndex < 0) return ''
  const tail = text.slice(markerIndex + marker.length)
  const segments = tail.split('/').filter(Boolean)
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) return segment
  }
  return ''
}

/**
 * 提取古籍 BookId
 *
 * @param {string} uri - 文档 URI
 * @param {object} doc - 文档对象
 * @returns {string} BookId
 */
export function extractAncientBookBookId(uri, doc) {
  const normalizedUri = String(uri || '')
  const entryMatch = normalizedUri.match(/\/ancient-book\/set\/book-entry\/(\d+)_(\d+)(?:\.json)?$/i)
  if (entryMatch?.[2]) {
    return entryMatch[2]
  }

  const uriMatch = normalizedUri.match(/\/ancient-book\/(?:text|object)\/(?:volume|book)\/(\d+)_(\d+)(?:_(\d+))?\.json$/i)
  if (uriMatch?.[2]) {
    return uriMatch[2]
  }

  const docId = String(doc?.id || '')
  const docPathBookId = extractFirstNumericSegmentAfterAncientBook(docId)
  if (docPathBookId) {
    return docPathBookId
  }

  const partOf = Array.isArray(doc?.part_of) ? doc.part_of : [doc?.part_of]
  for (const node of partOf) {
    const nodeId = String(node?.id || '')
    const nodePathBookId = extractFirstNumericSegmentAfterAncientBook(nodeId)
    if (nodePathBookId) {
      return nodePathBookId
    }
  }

  return ''
}

/**
 * 提取古籍卷册元数据
 *
 * @param {string} uri - 文档 URI
 * @returns {object|null} 卷册元数据或 null
 */
export function extractAncientBookVolumeMeta(uri) {
  const normalizedUri = String(uri || '')
  const match = normalizedUri.match(/\/ancient-book\/(text|object)\/volume\/([^/]+?)(?:\.json)?$/i)
  if (match) {
    const source = match[1]
    const rawId = match[2]
    const parts = rawId.split('_').filter(Boolean)
    if (parts.length >= 3) {
      return {
        source,
        rawId,
        personId: parts[0],
        bookId: parts[1],
        volumeNo: parts[2],
      }
    }
  }

  return null
}

/**
 * 提取古籍文本书籍元数据
 *
 * @param {string} uri - 文档 URI
 * @returns {object|null} 书籍元数据或 null
 */
export function extractAncientBookTxtBookMeta(uri) {
  const normalizedUri = String(uri || '')
  const match = normalizedUri.match(/\/ancient-book\/text\/book\/([^/]+)\.json$/i)
  if (!match) return null
  const rawId = match[1]
  const parts = rawId.split('_').filter(Boolean)
  if (parts.length < 2) return null
  return {
    rawId,
    personId: parts[0],
    bookId: parts[1],
  }
}

/**
 * 解析古籍集合 URI
 *
 * @param {string} docId - 文档 ID
 * @returns {string} 集合 URI
 */
export function resolveAncientBookSetUriByDocId(docId) {
  const normalizedDocId = String(docId || '').trim()
  if (!normalizedDocId) return ''
  const match = normalizedDocId.match(/\/set\/ancient-book\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/i)
  if (!match) return ''
  const rootId = String(match[1] || '').trim()
  const departmentId = String(match[2] || '').trim()
  const entryId = String(match[3] || '').trim()
  if (rootId && !departmentId) {
    return `/processed/json-ld/ancient-book/set/root/${rootId}.json`
  }
  if (rootId && departmentId && !entryId) {
    return `/processed/json-ld/ancient-book/set/department/${departmentId}.json`
  }
  return ''
}
