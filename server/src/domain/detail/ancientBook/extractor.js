/**
 * 古籍详情主提取器
 *
 * 从 JSON-LD 文档中提取古籍实体详细信息
 *
 * @module server/src/domain/detail/ancientBook/extractor
 */

import {
  normalizeText,
  extractIdFromUri,
  extractMarkText,
  pickNodeLabel,
  extractDocText,
  pickRowTitle,
} from './utils.js'
import {
  extractAncientBookBookId,
  extractAncientBookVolumeMeta,
  extractAncientBookTxtBookMeta,
} from './uriParser.js'
import { buildAncientBookHierarchy } from './hierarchy.js'
export { buildAncientBookHierarchy }
import { resolveAncientBookVolumeText } from './textExtractor.js'
import { resolveAncientBookManifestUris, extractIiifManifestUris } from './manifestResolver.js'

/**
 * 提取编纂者
 *
 * @param {object} doc - 文档对象
 * @returns {string} 编纂者名称
 */
function extractCompiler(doc) {
  const createdBy = Array.isArray(doc.created_by) ? doc.created_by : [doc.created_by]
  for (const created of createdBy) {
    if (created && typeof created === 'object') {
      const carried = Array.isArray(created.carried_out_by) ? created.carried_out_by : [created.carried_out_by]
      for (const actor of carried) {
        const label = pickNodeLabel(actor)
        if (label) return label
      }
    }
  }
  return ''
}

/**
 * 提取来源/版本
 *
 * @param {object} doc - 文档对象
 * @returns {string} 来源信息
 */
function extractSource(doc) {
  const referredToBy = Array.isArray(doc.referred_to_by) ? doc.referred_to_by : [doc.referred_to_by]
  for (const item of referredToBy) {
    if (item && typeof item === 'object' && item.source) {
      const source = extractDocText(item.source)
      if (source) return source
    }
  }
  return ''
}

/**
 * 排序古籍卷册行
 *
 * @param {Array} items - 卷册项数组
 * @returns {Array} 排序后的数组
 */
function sortAncientBookVolumeRows(items) {
  return items.sort((left, right) => {
    const leftNo = Number(left.volumeNo)
    const rightNo = Number(right.volumeNo)
    const leftSafe = Number.isFinite(leftNo) ? leftNo : Number.MAX_SAFE_INTEGER
    const rightSafe = Number.isFinite(rightNo) ? rightNo : Number.MAX_SAFE_INTEGER
    if (leftSafe !== rightSafe) return leftSafe - rightSafe
    return String(left.id).localeCompare(String(right.id), 'zh-Hans-CN')
  })
}

/**
 * 按目录批量搜索古籍卷册
 *
 * 兼容新旧两套目录结构，优先使用 json-ld，新旧结果合并后统一去重。
 *
 * @param {string[]} directories - 搜索目录列表
 * @param {string} bookId - 书籍 ID
 * @param {object} dependencies - 依赖注入
 * @returns {Promise<Array>} 搜索结果行
 */
async function searchAncientBookVolumeRowsByDirectories(directories, bookId, { mlSearchByDirectory }) {
  const mergedRows = []
  const seenUris = new Set()

  for (const directory of directories) {
    const searchResult = await mlSearchByDirectory(directory, bookId, 260)
    const rows = Array.isArray(searchResult?.results) ? searchResult.results : []
    for (const row of rows) {
      const uri = String(row?.uri || '').trim()
      if (!uri || seenUris.has(uri)) continue
      seenUris.add(uri)
      mergedRows.push(row)
    }
  }

  return mergedRows
}

/**
 * 收集古籍卷册项目
 *
 * @param {string} bookId - 书籍 ID
 * @param {object} dependencies - 依赖注入
 * @returns {Promise<Array>} 卷册项数组
 */
async function collectAncientBookVolumeItems(bookId, { mlSearchByDirectory }) {
  if (!bookId) return []

  const txtRows = await searchAncientBookVolumeRowsByDirectories(
    [
      '/processed/json-ld/ancient-book/text/volume/',
      '/processed/json-ld/ancient-book/text/volume/',
    ],
    bookId,
    { mlSearchByDirectory },
  )
  const objectRows = await searchAncientBookVolumeRowsByDirectories(
    [
      '/processed/json-ld/ancient-book/object/volume/',
      '/processed/json-ld/ancient-book/object/volume/',
    ],
    bookId,
    { mlSearchByDirectory },
  )

  const volumeMap = new Map()

  const upsert = (meta) => {
    const key = String(meta.volumeNo || '')
    if (!key) return
    if (!volumeMap.has(key)) {
      volumeMap.set(key, {
        id: `${bookId}_${meta.volumeNo}`,
        label: `卷${meta.volumeNo}`,
        uri: '',
        textUri: undefined,
        objectUri: undefined,
        iiifUri: undefined,
        volumeNo: Number(meta.volumeNo),
      })
    }
    const current = volumeMap.get(key)
    if (meta.source === 'text') {
      current.textUri = meta.uri
      current.uri = current.uri || meta.uri
    } else {
      current.objectUri = meta.uri
      current.uri = current.uri || meta.uri
    }
  }

  const handleRows = (rows = [], source) => {
    for (const row of rows) {
      const rowUri = String(row?.uri || '')
      const meta = extractAncientBookVolumeMeta(rowUri)
      if (!meta) continue
      if (meta.bookId !== bookId) continue
      upsert({ ...meta, uri: rowUri })
    }
  }

  handleRows(txtRows, 'text')
  handleRows(objectRows, 'object')

  return sortAncientBookVolumeRows(Array.from(volumeMap.values()))
}

async function resolveAncientBookBookLevelManifestUris(uri, doc, dependencies) {
  const { mlGetDoc, mlSearchByDirectory } = dependencies
  const volumeMeta = extractAncientBookVolumeMeta(uri)
  const txtBookMeta = extractAncientBookTxtBookMeta(uri)

  const candidateBookUris = new Set()
  if (volumeMeta?.personId && volumeMeta?.bookId) {
    candidateBookUris.add(`/processed/json-ld/ancient-book/text/book/${volumeMeta.personId}_${volumeMeta.bookId}.json`)
  }
  if (txtBookMeta?.personId && txtBookMeta?.bookId) {
    candidateBookUris.add(`/processed/json-ld/ancient-book/text/book/${txtBookMeta.personId}_${txtBookMeta.bookId}.json`)
  }

  for (const candidateUri of candidateBookUris) {
    const candidateDoc = await mlGetDoc(candidateUri)
    if (!candidateDoc) continue
    const manifests = extractIiifManifestUris(candidateDoc)
    if (manifests.length > 0) return manifests
  }

  const bookId = extractAncientBookBookId(uri, doc)
  if (!bookId) return []

  const bookSearch = await mlSearchByDirectory('/processed/json-ld/ancient-book/text/book/', bookId, 20)
  for (const row of bookSearch?.results || []) {
    const candidateUri = String(row?.uri || '').trim()
    if (!candidateUri) continue
    const candidateDoc = await mlGetDoc(candidateUri)
    if (!candidateDoc) continue
    const manifests = extractIiifManifestUris(candidateDoc)
    if (manifests.length > 0) return manifests
  }

  return []
}

/**
 * 从文档中提取古籍详细信息（API v1 格式）
 *
 * @param {string} uri - 文档 URI
 * @param {object} doc - 文档对象
 * @param {object} dependencies - 依赖注入 { mlGetDoc, mlSearchByDirectory, searchWithFallback }
 * @returns {Promise<object|null>} 古籍详情对象或 null
 */
export async function extractAncientBookDetail(uri, doc, dependencies) {
  if (!doc) return null

  const { mlGetDoc, mlSearchByDirectory, searchWithFallback } = dependencies
  const title = pickRowTitle({ uri }, doc)

  // 提取编纂者
  const compiler = extractCompiler(doc)

  // 提取元数据
  const bookId = extractAncientBookBookId(uri, doc)
  const volumeMeta = extractAncientBookVolumeMeta(uri)
  const isVolume = Boolean(volumeMeta)

  // 解析 IIIF Manifest
  const bookLevelManifestUris = await resolveAncientBookBookLevelManifestUris(uri, doc, dependencies)
  const manifests = resolveAncientBookManifestUris(
    [...extractIiifManifestUris(doc), ...bookLevelManifestUris],
    bookId,
  )

  // 构建层次结构
  const hierarchy = await buildAncientBookHierarchy(uri, doc, title, { mlGetDoc })

  // 提取卷册项目
  const volumeItems = await collectAncientBookVolumeItems(bookId, { mlSearchByDirectory })
  const primaryManifestUri = manifests[0] || undefined
  const enrichedVolumeItems = volumeItems.map((item) => ({
    ...item,
    iiifUri: item.iiifUri || primaryManifestUri,
  }))

  // 解析卷文本
  let volumeText = ''
  let volumeTextSourceUri = ''
  if (isVolume) {
    const resolvedVolumeText = await resolveAncientBookVolumeText(uri, doc, volumeMeta, title, dependencies)
    volumeText = resolvedVolumeText.volumeText
    volumeTextSourceUri = resolvedVolumeText.volumeTextSourceUri
  }

  const volumeTextStatus = isVolume ? (volumeText ? 'available' : 'missing') : undefined
  const volumeTextMessage =
    isVolume && !volumeText
      ? '当前卷暂无可解析文本内容：本地未命中卷文本或 IIIF manifests/OCR 数据。请先同步本地 manifests 数据，或使用 IIIF 查看影像。'
      : undefined

  // 提取摘要
  const summary = extractMarkText(volumeText || extractDocText(doc), 300) || undefined

  // 提取来源/版本
  const source = extractSource(doc)

  return {
    id: extractIdFromUri(uri),
    title: title || '未命名古籍',
    compiler: compiler || undefined,
    source: source || undefined,
    hierarchy: hierarchy.length > 0 ? hierarchy : undefined,
    manifests: manifests.length > 0 ? manifests : undefined,
    texts: enrichedVolumeItems.length > 0 ? enrichedVolumeItems : undefined,
    volumeLabel: isVolume ? title || undefined : undefined,
    volumeText: volumeText || undefined,
    volumeTextStatus,
    volumeTextMessage,
    volumeTextSourceUri: volumeTextSourceUri || undefined,
    summary,
    doc: doc && typeof doc === 'object' ? doc : {},
    uri,
  }
}

// 导出默认对象保持兼容
export default {
  extractAncientBookDetail,
  buildAncientBookHierarchy,
  extractAncientBookBookId,
  extractAncientBookVolumeMeta,
}
