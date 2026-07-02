/**
 * IIIF Manifest 提取器
 *
 * 从 IIIF Presentation API manifest 中提取结构化信息。
 * 支持 volume-heads 提取、缩略图解析、Canvas 元数据解析等。
 *
 * @module server/src/domain/detail/iiifExtractor
 */

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 古籍卷标签匹配模式
 * 匹配"卷一"、"卷二十三"等格式
 */
const ANCIENT_BOOK_VOLUME_LABEL_PATTERN = /卷[〇零一二三四五六七八九十百千万两壹贰叁肆伍陆柒捌玖拾佰仟0-9]+/u

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 归一化文本（去除多余空白）
 *
 * @param {string} value - 输入文本
 * @returns {string} 归一化后的文本
 */
function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * 从 IIIF label 对象中提取文本
 *
 * 支持 IIIF Presentation API 3.0 的多语言 label 格式：
 * - 字符串直接返回
 * - 数组返回第一个非空项
 * - 对象按优先级查找语言键
 *
 * @param {string|string[]|object} labelNode - IIIF label 节点
 * @returns {string} 提取的文本
 */
export function pickIiifLabelText(labelNode) {
  if (!labelNode) return ''
  if (typeof labelNode === 'string') return normalizeText(labelNode)
  if (Array.isArray(labelNode)) {
    for (const item of labelNode) {
      if (typeof item === 'string' && normalizeText(item)) return normalizeText(item)
    }
    return ''
  }
  if (typeof labelNode !== 'object') return ''

  // 按语言优先级查找
  const preferredKeys = ['zh-Hans', 'zh', 'none', 'en']
  for (const key of preferredKeys) {
    const values = labelNode[key]
    if (!Array.isArray(values)) continue
    for (const value of values) {
      if (typeof value === 'string' && normalizeText(value)) return normalizeText(value)
    }
  }

  // 遍历所有键作为后备
  for (const values of Object.values(labelNode)) {
    if (!Array.isArray(values)) continue
    for (const value of values) {
      if (typeof value === 'string' && normalizeText(value)) return normalizeText(value)
    }
  }

  return ''
}

/**
 * 从 Canvas body 中提取缩略图 URL
 *
 * @param {object} body - IIIF Canvas body 对象
 * @returns {string} 缩略图 URL 或空字符串
 */
function pickIiifThumbnailUrlFromBody(body) {
  if (!body) return ''
  const items = Array.isArray(body?.items) ? body.items : []
  for (const item of items) {
    const innerItems = Array.isArray(item?.items) ? item.items : []
    for (const inner of innerItems) {
      const type = String(inner?.type || '').toLowerCase()
      if (type !== 'image') continue
      const id = normalizeText(inner?.id)
      if (id) return id
    }
  }
  return ''
}

/**
 * 从 Canvas 中提取缩略图 URL
 *
 * @param {object} canvas - IIIF Canvas 对象
 * @returns {string} 缩略图 URL 或空字符串
 */
function pickIiifThumbnailUrlFromCanvas(canvas) {
  // 优先使用 thumbnail 字段
  const thumbnails = Array.isArray(canvas?.thumbnail) ? canvas.thumbnail : []
  for (const thumb of thumbnails) {
    const id = normalizeText(thumb?.id)
    if (id) return id
  }

  // 回退到 body 解析
  return pickIiifThumbnailUrlFromBody(canvas?.body)
}

/**
 * 规范化 manifest URL（处理 canvas 与 manifest 指向不同分册的情况）
 *
 * @param {string} manifest - 原始 manifest URL
 * @param {string} canvasId - Canvas ID
 * @returns {string} 规范化后的 manifest URL
 */
export function normalizeManifestLikeWithCanvas(manifest, canvasId = '') {
  const normalizedManifest = normalizeText(manifest)
  if (!normalizedManifest) return ''

  // 没有 canvas 信息时直接返回 manifest
  if (!canvasId) return normalizedManifest

  // 尝试从 canvas 反推 manifest
  const canvasManifest = extractManifestFromCanvasId(canvasId)
  if (!canvasManifest) return normalizedManifest

  // 检查是否为数字书籍 manifest
  const hasNumericBookManifest = /\/iiif\/manifests\/\d+\/manifest\.json(?:[?#].*)?$/i.test(normalizedManifest)
  if (!hasNumericBookManifest) {
    return normalizedManifest
  }

  // 当 manifest 与 canvas 指向不同分册时，以 canvas 反推结果为准
  const prefersRelative = normalizedManifest.startsWith('/')
  if (prefersRelative && /^https?:\/\//i.test(canvasManifest)) {
    try {
      const parsed = new URL(canvasManifest)
      return `${parsed.pathname}${parsed.search}`
    } catch {
      return canvasManifest
    }
  }
  return canvasManifest
}

/**
 * 从 Canvas ID 中提取 manifest URL
 *
 * @param {string} canvasId - Canvas ID
 * @returns {string} manifest URL 或空字符串
 */
function extractManifestFromCanvasId(canvasId) {
  const normalized = normalizeText(canvasId)
  if (!normalized) return ''

  // 匹配 /iiif/canvases/{bookId}/{canvasId} 格式
  const match = normalized.match(/^(\/iiif\/canvases\/\d+\/\d+)/i)
  if (match) {
    return `${match[1]}/manifest.json`
  }

  // 匹配完整 URL 格式
  try {
    const url = new URL(normalized)
    const pathMatch = url.pathname.match(/^(\/iiif\/canvases\/\d+\/\d+)/i)
    if (pathMatch) {
      return `${url.origin}${pathMatch[1]}/manifest.json`
    }
  } catch {
    // 忽略无效 URL
  }

  return ''
}

// ============================================================================
// 主要导出函数
// ============================================================================

/**
 * 从 IIIF manifest 中提取卷首 Canvas 列表
 *
 * 遍历 manifest 中的所有 canvas，识别包含卷标签的 canvas，
 * 返回每个卷的第一个 canvas 作为"卷首"。
 *
 * @param {object} manifestDoc - IIIF Presentation API 3.0 manifest 文档
 * @returns {Array<{volumeLabel: string, canvasId: string, canvasLabel: string, pageIndex: number}>}
 *          卷首列表
 *
 * @example
 * const volumeHeads = extractVolumeHeadsFromIiifManifest(manifestDoc)
 * // [
 * //   { volumeLabel: '卷一', canvasId: '...', canvasLabel: '卷一 序', pageIndex: 1 },
 * //   { volumeLabel: '卷二', canvasId: '...', canvasLabel: '卷二 诗', pageIndex: 15 },
 * // ]
 */
export function extractVolumeHeadsFromIiifManifest(manifestDoc) {
  const items = Array.isArray(manifestDoc?.items) ? manifestDoc.items : []
  const volumeHeads = []
  const seenVolumeLabels = new Set()

  for (let index = 0; index < items.length; index += 1) {
    const canvas = items[index]
    const canvasId = normalizeText(canvas?.id)
    if (!canvasId) continue

    const canvasLabel = pickIiifLabelText(canvas?.label)
    const match = canvasLabel.match(ANCIENT_BOOK_VOLUME_LABEL_PATTERN)
    const volumeLabel = normalizeText(match?.[0] || '')
    if (!volumeLabel || seenVolumeLabels.has(volumeLabel)) continue

    seenVolumeLabels.add(volumeLabel)
    volumeHeads.push({
      volumeLabel,
      canvasId,
      canvasLabel: canvasLabel || undefined,
      pageIndex: index + 1,
    })
  }

  return volumeHeads
}

/**
 * 从 Canvas 中解析元数据
 *
 * @param {object} canvas - IIIF Canvas 对象
 * @returns {{thumbnail: string, label: string}} Canvas 元数据
 */
export function resolveCanvasMeta(canvas) {
  if (!canvas) return { thumbnail: '', label: '' }

  return {
    thumbnail: pickIiifThumbnailUrlFromCanvas(canvas),
    label: pickIiifLabelText(canvas?.label),
  }
}

/**
 * 批量获取 manifest 中的 canvas 缩略图
 *
 * @param {object} manifestDoc - IIIF manifest 文档
 * @param {number} limit - 最大返回数量
 * @returns {Array<{canvasId: string, thumbnail: string, label: string}>}
 */
export function extractCanvasThumbnails(manifestDoc, limit = 20) {
  const items = Array.isArray(manifestDoc?.items) ? manifestDoc.items : []
  const results = []

  for (const canvas of items.slice(0, limit)) {
    const canvasId = normalizeText(canvas?.id)
    if (!canvasId) continue

    results.push({
      canvasId,
      thumbnail: pickIiifThumbnailUrlFromCanvas(canvas),
      label: pickIiifLabelText(canvas?.label),
    })
  }

  return results
}

// ============================================================================
// 导出
// ============================================================================

export default {
  extractVolumeHeadsFromIiifManifest,
  resolveCanvasMeta,
  extractCanvasThumbnails,
  normalizeManifestLikeWithCanvas,
  pickIiifLabelText,
  pickIiifThumbnailUrlFromCanvas,
  ANCIENT_BOOK_VOLUME_LABEL_PATTERN,
}
