/**
 * IIIF Manifest 解析模块
 *
 * 负责解析和规范化古籍的 IIIF Manifest URI
 *
 * @module server/src/domain/detail/ancientBook/manifestResolver
 */

import { extractCandidateUris } from './utils.js'
import { isIiifManifestUri } from './uriParser.js'

/**
 * 构建古籍集合 Manifest URI
 *
 * @param {string} bookId - 书籍 ID
 * @param {string} origin - 来源域名
 * @returns {string} Manifest URI
 */
export function buildAncientBookCollectionManifestUri(bookId, origin = '') {
  const safeBookId = String(bookId || '').trim()
  if (!safeBookId) return ''
  const safeOrigin = String(origin || '').trim().replace(/\/+$/g, '')
  const prefix = safeOrigin || ''
  return `${prefix}/iiif/manifests/${safeBookId}/manifest.json`
}

/**
 * 规范化古籍 Manifest ID Token
 *
 * 从 URI 段中提取书籍 ID
 *
 * @param {string} token - URI Token
 * @returns {string} 规范化后的 Token
 */
export function normalizeAncientBookManifestIdToken(token) {
  const text = String(token || '').trim().replace(/\.json$/i, '')
  if (!text) return ''
  // 匹配 personId_bookId 格式
  const pairTokenMatch = text.match(/^\d+_(\d+)(?:_[^_]+)*$/i)
  if (pairTokenMatch?.[1]) return pairTokenMatch[1]
  // 匹配纯数字
  const pureNumberMatch = text.match(/^\d+$/)
  if (pureNumberMatch?.[0]) return pureNumberMatch[0]
  return ''
}

/**
 * 规范化古籍 Manifest URI
 *
 * 将各种格式的 Manifest URI 转换为标准格式
 *
 * @param {string} uri - 原始 URI
 * @param {string} bookId - 书籍 ID
 * @returns {string} 规范化后的 URI
 */
export function normalizeAncientBookManifestUri(uri, bookId = '') {
  const text = String(uri || '').trim()
  if (!text) return ''
  const normalizedBookId = String(bookId || '').trim()
  const originMatch = text.match(/^(https?:\/\/[^/]+)/i)
  const origin = originMatch?.[1] || ''
  const v3ManifestMatch = text.match(/\/iiif\/3\/manifest\/ancientBook\/(\d+)\/([^/?#]+)/i)
  if (v3ManifestMatch?.[1]) {
    const resolvedBookId = normalizedBookId || v3ManifestMatch[1]
    const resolvedTail = String(v3ManifestMatch[2] || '').trim()
    if (resolvedBookId && resolvedTail) {
      const prefix = origin || ''
      return `${prefix}/iiif/3/manifest/ancientBook/${resolvedBookId}/${resolvedTail}`
    }
  }

  // 从 collection 路径提取
  const fromCollection = text.match(/\/iiif\/manifests\/([^/]+)\/manifest\.json(?:[?#].*)?$/i)
  // 从通用路径提取 token
  const normalizedToken = text.replace(/^.*\/iiif\/manifests\//i, '').replace(/[/?#].*$/g, '')
  const fromToken = normalizeAncientBookManifestIdToken(normalizedToken)

  const detectedBookId =
    normalizedBookId ||
    normalizeAncientBookManifestIdToken(fromCollection?.[1]) ||
    normalizeAncientBookManifestIdToken(fromToken) ||
    ''

  if (!detectedBookId) return isIiifManifestUri(text) ? text : ''
  return buildAncientBookCollectionManifestUri(detectedBookId, origin)
}

/**
 * 解析古籍 Manifest URI 列表
 *
 * 去重并规范化 Manifest URI 列表
 *
 * @param {string[]} rawManifests - 原始 Manifest URI 数组
 * @param {string} bookId - 书籍 ID
 * @returns {string[]} 规范化后的 Manifest URI 数组
 */
export function resolveAncientBookManifestUris(rawManifests, bookId = '') {
  const output = []
  const seen = new Set()
  let detectedOrigin = ''

  const addUnique = (value) => {
    const text = String(value || '').trim()
    if (!text || seen.has(text)) return
    seen.add(text)
    output.push(text)
    if (!detectedOrigin) {
      const match = text.match(/^(https?:\/\/[^/]+)/i)
      if (match?.[1]) detectedOrigin = match[1]
    }
  }

  for (const item of Array.isArray(rawManifests) ? rawManifests : []) {
    addUnique(normalizeAncientBookManifestUri(item, bookId))
  }

  // 添加默认 manifest
  const fallback = buildAncientBookCollectionManifestUri(bookId, detectedOrigin)
  addUnique(fallback)

  return output
}

/**
 * 从文档提取 IIIF Manifest URI
 *
 * @param {object} raw - 文档对象
 * @param {number} limit - 最大数量
 * @returns {string[]} Manifest URI 数组
 */
export function extractIiifManifestUris(raw, limit = 120) {
  const uris = extractCandidateUris(raw, limit)
  const normalized = uris.map((uri) => normalizeAncientBookManifestUri(uri)).filter(Boolean)
  return Array.from(new Set(normalized))
}
