/**
 * 古籍文本提取模块
 *
 * 负责从古籍文档中提取卷册文本内容
 *
 * @module server/src/domain/detail/ancientBook/textExtractor
 */

import { normalizeText, pickNodeLabel } from './utils.js'
import {
  extractIiifManifestUris,
  resolveAncientBookManifestUris,
} from './manifestResolver.js'

/**
 * 收集嵌套文本片段
 *
 * 递归遍历对象结构，提取所有文本内容
 *
 * @param {any} raw - 原始数据
 * @param {string[]} output - 输出数组
 * @param {number} depth - 递归深度
 * @param {WeakSet} visited - 已访问对象集合
 */
export function collectNestedTextFragments(raw, output, depth = 0, visited = new WeakSet()) {
  if (depth > 8 || !raw) return

  if (typeof raw === 'string') {
    const text = normalizeText(raw)
    if (!text) return
    // 跳过 URI 和纯数字
    if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/')) return
    if (/^[\d._/-]+$/.test(text)) return
    output.push(text)
    return
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      collectNestedTextFragments(item, output, depth + 1, visited)
    }
    return
  }

  if (typeof raw === 'object') {
    if (visited.has(raw)) return
    visited.add(raw)

    const preferredKeys = ['text_norm_zh', 'text_norm', 'text', 'content', '@value', 'value', 'description', 'note', '_label', 'label', 'name', 'title']
    const preferredSet = new Set(preferredKeys)

    // 先处理优先键
    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        collectNestedTextFragments(raw[key], output, depth + 1, visited)
      }
    }

    // 再处理其他键
    for (const [key, value] of Object.entries(raw)) {
      if (preferredSet.has(key)) continue
      collectNestedTextFragments(value, output, depth + 1, visited)
    }
  }
}

/**
 * 提取古籍卷文本
 *
 * @param {object} doc - 文档对象
 * @param {string} volumeLabel - 卷标签（用于过滤）
 * @returns {string} 提取的文本
 */
export function extractAncientBookVolumeText(doc, volumeLabel = '') {
  if (!doc || typeof doc !== 'object') return ''

  const fragments = []
  const directKeys = ['text_norm_zh', 'text_norm', 'text', 'content', 'value', 'description']
  for (const key of directKeys) {
    collectNestedTextFragments(doc[key], fragments)
  }

  const nestedKeys = ['referred_to_by', 'subject_of']
  for (const key of nestedKeys) {
    collectNestedTextFragments(doc[key], fragments)
  }

  // 构建阻塞列表（标题等不应出现在正文中）
  const blocked = new Set(
    [volumeLabel, doc._label, pickNodeLabel(doc)]
      .map((item) => normalizeText(item))
      .filter(Boolean),
  )

  // 去重并过滤
  const unique = Array.from(
    new Set(
      fragments
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .filter((item) => !blocked.has(item)),
    ),
  )

  if (!unique.length) return ''

  // 优先返回长文本
  const longTexts = unique.filter((item) => item.length >= 24)
  if (longTexts.length > 0) {
    return longTexts.sort((a, b) => b.length - a.length)[0].slice(0, 20000)
  }

  return unique.join('\n').slice(0, 20000)
}

function extractVolumeToken(volumeLabel = '') {
  const normalizedLabel = normalizeText(volumeLabel)
  if (!normalizedLabel) return ''
  const matched = normalizedLabel.match(/卷[一二三四五六七八九十百千〇零两0-9]+/u)
  return normalizeText(matched?.[0] || '')
}

function extractCanvasLabelText(canvas) {
  const fragments = []
  collectNestedTextFragments(canvas?.label, fragments)
  return normalizeText(fragments[0] || '')
}

function extractSupplementingAnnotationText(canvas) {
  const annotationPages = Array.isArray(canvas?.annotations) ? canvas.annotations : []
  const collected = []

  const walkBody = (body) => {
    if (!body) return
    if (typeof body === 'string') {
      const text = normalizeText(body)
      if (text) collected.push(text)
      return
    }
    if (Array.isArray(body)) {
      for (const item of body) walkBody(item)
      return
    }
    if (typeof body === 'object') {
      for (const key of ['value', 'content', '@value', '_label', 'label']) {
        if (Object.prototype.hasOwnProperty.call(body, key)) walkBody(body[key])
      }
    }
  }

  for (const page of annotationPages) {
    const items = Array.isArray(page?.items) ? page.items : []
    for (const annotation of items) {
      if (normalizeText(annotation?.motivation).toLowerCase() !== 'supplementing') continue
      walkBody(annotation?.body)
    }
  }

  return Array.from(new Set(collected)).join('\n').slice(0, 20000)
}

function pickManifestCanvasText(manifestDoc, volumeMeta, volumeLabel = '') {
  const canvases = Array.isArray(manifestDoc?.items) ? manifestDoc.items : []
  if (!canvases.length) return ''

  const volumeToken = extractVolumeToken(volumeLabel)
  const normalizedLabel = normalizeText(volumeLabel)

  const scoreCanvas = (canvas) => {
    const canvasLabel = extractCanvasLabelText(canvas)
    let score = 0
    if (volumeToken && canvasLabel.includes(volumeToken)) score += 3
    if (normalizedLabel && canvasLabel.includes(normalizedLabel)) score += 2
    if (String(canvasLabel).includes(`卷${String(volumeMeta?.volumeNo || '').trim()}`)) score += 1
    return score
  }

  const rankedCanvases = canvases
    .map((canvas) => ({ canvas, score: scoreCanvas(canvas) }))
    .sort((left, right) => right.score - left.score)

  for (const ranked of rankedCanvases) {
    if (ranked.score <= 0) continue
    const annotationText = extractSupplementingAnnotationText(ranked.canvas)
    if (annotationText) return annotationText
  }

  for (const canvas of canvases) {
    const annotationText = extractSupplementingAnnotationText(canvas)
    if (annotationText) return annotationText
  }

  return ''
}

async function collectAncientBookManifestCandidates(doc, volumeMeta, dependencies) {
  const { mlGetDoc, mlSearchByDirectory } = dependencies
  const bookId = String(volumeMeta?.bookId || '').trim()
  if (!bookId) return []

  const rawCurrentManifests = extractIiifManifestUris(doc)
  const manifests = new Set(
    rawCurrentManifests.length > 0 ? resolveAncientBookManifestUris(rawCurrentManifests, bookId) : [],
  )

  const candidateDirectories = [
    '/processed/json-ld/ancient_book/ancient_book_txt/book/',
    '/processed/entities/ancient_book/ancient_book_txt/book/',
  ]

  for (const directory of candidateDirectories) {
    const searchResult = await mlSearchByDirectory(directory, bookId, 20)
    const rows = Array.isArray(searchResult?.results) ? searchResult.results : []
    for (const row of rows) {
      const targetUri = String(row?.uri || '').trim()
      if (!targetUri) continue
      const targetDoc = await mlGetDoc(targetUri)
      const rawTargetManifests = extractIiifManifestUris(targetDoc)
      const targetManifests =
        rawTargetManifests.length > 0 ? resolveAncientBookManifestUris(rawTargetManifests, bookId) : []
      for (const manifest of targetManifests) manifests.add(manifest)
    }
  }

  return Array.from(manifests).filter(Boolean)
}

async function resolveAncientBookVolumeTextFromManifest(doc, volumeMeta, volumeLabel, dependencies) {
  const { mlGetJson } = dependencies
  if (typeof mlGetJson !== 'function') return null

  const manifestCandidates = await collectAncientBookManifestCandidates(doc, volumeMeta, dependencies)
  for (const manifestUri of manifestCandidates) {
    const manifestDoc = await mlGetJson(manifestUri)
    if (!manifestDoc || typeof manifestDoc !== 'object') continue
    const manifestText = pickManifestCanvasText(manifestDoc, volumeMeta, volumeLabel)
    if (manifestText) {
      return {
        volumeText: manifestText,
        volumeTextSourceUri: manifestUri,
      }
    }
  }

  return null
}

/**
 * 解析古籍卷文本
 *
 * 尝试从当前文档或其他来源获取卷文本
 *
 * @param {string} uri - 文档 URI
 * @param {object} doc - 文档对象
 * @param {object} volumeMeta - 卷册元数据
 * @param {string} volumeLabel - 卷标签
 * @param {object} dependencies - 依赖注入
 * @returns {Promise<{volumeText: string, volumeTextSourceUri: string}>}
 */
export async function resolveAncientBookVolumeText(uri, doc, volumeMeta, volumeLabel, dependencies) {
  const { mlGetDoc, mlSearchByDirectory } = dependencies

  // 首先尝试从当前文档提取
  const primaryText = extractAncientBookVolumeText(doc, volumeLabel)
  if (primaryText) {
    return { volumeText: primaryText, volumeTextSourceUri: uri }
  }

  if (!volumeMeta) {
    return { volumeText: '', volumeTextSourceUri: '' }
  }

  const candidateQueries = Array.from(
    new Set([
      String(volumeMeta.rawId || '').trim(),
      `${String(volumeMeta.bookId || '').trim()}_${String(volumeMeta.volumeNo || '').trim()}`,
      String(volumeLabel || '').trim(),
    ].filter(Boolean)),
  )

  const tryResolveFromUris = async (rows = []) => {
    for (const row of rows) {
      const targetUri = String(row?.uri || '').trim()
      if (!targetUri) continue
      const targetDoc = await mlGetDoc(targetUri)
      const resolvedText = extractAncientBookVolumeText(targetDoc, volumeLabel)
      if (resolvedText) {
        const frontendUri = String(targetDoc?.evidence?.frontend_url || '').trim()
        return {
          volumeText: resolvedText,
          volumeTextSourceUri: frontendUri || targetUri,
        }
      }
    }
    return null
  }

  for (const query of candidateQueries) {
    const txtVolumeSearch = await mlSearchByDirectory(
      '/processed/entities/ancient_book/ancient_book_txt/volume/',
      query,
      20,
    )
    const txtResolved = await tryResolveFromUris(txtVolumeSearch?.results || [])
    if (txtResolved) return txtResolved

    const manifestResolved = await resolveAncientBookVolumeTextFromManifest(doc, volumeMeta, volumeLabel, dependencies)
    if (manifestResolved) return manifestResolved

    const iiifVectorSearch = await mlSearchByDirectory('/heluo/vector/iiif/manifests/', query, 20)
    const vectorResolved = await tryResolveFromUris(iiifVectorSearch?.results || [])
    if (vectorResolved) return vectorResolved
  }

  return { volumeText: '', volumeTextSourceUri: '' }
}
