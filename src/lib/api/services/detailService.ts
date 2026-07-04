/**
 * 详情服务层
 *
 * 负责获取和处理各类实体的详情数据，包括：
 * - 诗文详情
 * - 人物详情
 * - 图书详情
 * - 地点详情
 * - 概念详情
 * - 古籍详情
 *
 * 仅使用标准 API 获取详情数据
 */

import type { DetailViewModel } from '@/types/view/models'
import type { AncientBookDetailV1, ConceptDetailV1 } from '@/types/contracts/apiContracts'
import { TEXT } from '@/lib/config/constants'
import { normalizeText } from '@/lib/utils/text'
import {
  fetchAncientBookByIdRepo,
  fetchBookByIdRepo,
  fetchConceptByIdRepo,
  fetchPersonByIdRepo,
  fetchPlaceByIdRepo,
  fetchPoemByIdRepo,
} from '@/lib/api/repositories/v1Repository'

// ============================================================================
// 类型定义
// ============================================================================

// ============================================================================
// 类型定义
// ============================================================================

export interface DetailResourceInput {
  type: 'poem' | 'person' | 'book' | 'ancient_book' | 'place' | 'concept' | 'unknown'
  id: string
  format?: 'set' | 'txt' | 'object'
}

// ============================================================================
// 私有实现 - 工具函数
// ============================================================================

function deduplicateByUri<T extends { uri: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.uri)) {
      return false
    }
    seen.add(item.uri)
    return true
  })
}

function deduplicatePlaces(
  items: Array<{ label: string; uri: string; lat?: number; lng?: number }>,
): Array<{ label: string; uri: string; lat?: number; lng?: number }> {
  const seen = new Set<string>()
  return items.filter((item) => {
    const label = normalizeText(item.label)
    const uri = normalizeText(item.uri)
    const key = uri || label
    if (!label || !key) return false
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function normalizeDoc(doc: unknown): Record<string, unknown> {
  return doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : {}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function mergeAncientBookDocs(
  primaryDoc: Record<string, unknown>,
  objectDoc: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...primaryDoc }

  for (const [key, value] of Object.entries(objectDoc)) {
    const current = output[key]
    if (isPlainObject(current) && isPlainObject(value)) {
      output[key] = mergeAncientBookDocs(current, value)
      continue
    }
    output[key] = value
  }

  return output
}

function createPoemDetailUriById(id: string): string {
  const trimmedId = normalizeText(id)
  return trimmedId ? `/poem/${trimmedId}` : ''
}

// ============================================================================
// 私有实现 - 链接处理
// ============================================================================

function normalizeRelationLabel(content: string): string {
  const cleaned = normalizeText(content).replace(/^\[|\]$/g, '')
  if (!cleaned) return ''
  const segments = cleaned
    .split('-')
    .map((segment) => normalizeText(segment))
    .filter(Boolean)
  return segments[segments.length - 1] || cleaned
}

function normalizeExternalUris(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  return Array.from(
    new Set(
      items
        .map((item) => normalizeText(item))
        .filter((item) => item.startsWith('http://') || item.startsWith('https://')),
    ),
  )
}

function buildPersonAttributedLinksFromDoc(doc: Record<string, unknown>): Array<{ label: string; uri: string }> {
  const attributedList = normalizeArray(doc.attributed_by as unknown[])
  const relationLinks: Array<{ label: string; uri: string }> = []

  attributedList.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const assignment = item as Record<string, unknown>
    const identifiedList = normalizeArray(assignment.identified_by as unknown[])
    const relationRaw = identifiedList
      .map((identified) => {
        if (!identified || typeof identified !== 'object') return ''
        return normalizeText((identified as Record<string, unknown>).content)
      })
      .find(Boolean)
    const relation = relationRaw ? normalizeRelationLabel(relationRaw) : '相关'

    const assignedList = normalizeArray(assignment.assigned as unknown[])
    assignedList.forEach((assigned) => {
      if (!assigned || typeof assigned !== 'object') return
      const target = assigned as Record<string, unknown>
      const uri = normalizeText(target.id || target.uri)
      const type = normalizeText(target.type).toLowerCase()
      const name = normalizeText(target._label || target.label)
      if (!uri || !name) return
      if (!(uri.toLowerCase().includes('/person/') || type === 'person')) return
      relationLinks.push({ label: `相关人物（${relation}）：${name}`, uri })
    })
  })

  return deduplicateByUri(relationLinks)
}

function buildPersonRelationLinks(person: {
  doc?: Record<string, unknown>
  relatedPoems?: Array<{ id: string; title: string }>
}): Array<{ label: string; uri: string }> {
  const personRelationLinks = buildPersonAttributedLinksFromDoc(normalizeDoc(person.doc))
  const poemLinks = (person.relatedPoems || [])
    .map((item) => ({
      label: normalizeText(item?.title) ? `相关作品：${normalizeText(item.title)}` : '',
      uri: createPoemDetailUriById(item?.id),
    }))
    .filter((item) => item.label && item.uri)

  return deduplicateByUri([...personRelationLinks, ...poemLinks])
}

function collectNodesByPath(root: Record<string, unknown>, path: string[]): unknown[] {
  let nodes: unknown[] = [root]
  for (const segment of path) {
    const next: unknown[] = []
    nodes.forEach((node) => {
      if (!node || typeof node !== 'object') return
      const value = (node as Record<string, unknown>)[segment]
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

function normalizePlaceLink(node: unknown): { label: string; uri: string; lat?: number; lng?: number } | null {
  if (!node) return null

  if (typeof node === 'string') {
    const text = normalizeText(node)
    if (!text) return null
    return { label: text, uri: '' }
  }

  if (typeof node !== 'object') return null
  const record = node as Record<string, unknown>
  const label = normalizeText(record._label || record.label || record.name || record.content || record.value)
  const uri = normalizeText(record.id || record.uri || record['@id'])
  const lat = Number(record.lat)
  const lng = Number(record.lng)
  if (!label && !uri) return null
  return {
    label: label || uri,
    uri,
    ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
  }
}

function inferPlaceLinksFromDoc(doc: Record<string, unknown>): Array<{ label: string; uri: string; lat?: number; lng?: number }> {
  const placeNodes = [
    ...collectNodesByPath(doc, ['took_place_at']),
    ...collectNodesByPath(doc, ['created_by', 'took_place_at']),
  ]
  const places = placeNodes
    .map((item) => normalizePlaceLink(item))
    .filter(Boolean)
    .map((item) => item as { label: string; uri: string })
    .filter((item) => item.label)

  return deduplicatePlaces(places)
}

function buildConceptInternalLinks(concept: Pick<ConceptDetailV1, 'broader' | 'narrower'>): Array<{ label: string; uri: string }> {
  const internalLinks: Array<{ label: string; uri: string }> = []
  const broader = Array.isArray(concept.broader) ? concept.broader : []
  const narrower = Array.isArray(concept.narrower) ? concept.narrower : []

  for (const item of broader) {
    internalLinks.push({ label: `上位概念：${item.label}`, uri: item.uri })
  }

  for (const item of narrower) {
    internalLinks.push({ label: `下位概念：${item.label}`, uri: item.uri })
  }

  return internalLinks
}

// ============================================================================
// 私有实现 - 实体详情获取
// ============================================================================

function toAncientBookVolumes(ancientBook: Pick<AncientBookDetailV1, 'texts'>) {
  const texts = Array.isArray(ancientBook.texts) ? ancientBook.texts : []
  return texts.map((item) => ({
    id: item.id,
    label: item.label,
    uri: item.uri,
    textUri: item.textUri,
    objectUri: item.objectUri,
    iiifUri: item.iiifUri,
    volumeNo: item.volumeNo,
  }))
}

function toAncientBookHierarchy(ancientBook: Pick<AncientBookDetailV1, 'hierarchy'>) {
  const hierarchy = Array.isArray(ancientBook.hierarchy) ? ancientBook.hierarchy : []
  return hierarchy.map((item) => ({
    level: item.level,
    id: item.id,
    label: item.label,
    uri: item.uri,
    docId: item.docId,
  }))
}

function extractAncientBookObjectIdFromUri(uri: string): string {
  const normalizedUri = normalizeText(uri)
  if (!normalizedUri) return ''
  const match = normalizedUri.match(/\/ancient-book\/object\/(?:volume|book)\/([^/?#]+?)(?:\.json)?$/i)
  if (match?.[1]) return normalizeText(match[1])
  const lastSegment = normalizedUri.split('/').pop() || ''
  return normalizeText(lastSegment.replace(/\.json$/i, ''))
}

function pickAncientBookObjectUri(ancientBook: Pick<AncientBookDetailV1, 'texts'>): string {
  const texts = Array.isArray(ancientBook.texts) ? ancientBook.texts : []
  for (const item of texts) {
    const objectUri = normalizeText(item?.objectUri)
    if (objectUri) return objectUri
  }
  return ''
}

async function resolveAncientBookPreferredDoc(
  ancientBook: Pick<AncientBookDetailV1, 'texts' | 'uri' | 'doc'>,
  fallbackDoc: Record<string, unknown>,
  sourceUri: string,
): Promise<Record<string, unknown>> {
  const objectUri = pickAncientBookObjectUri(ancientBook)
  if (!objectUri) return fallbackDoc

  const currentUri = normalizeText(ancientBook.uri || sourceUri)
  if (currentUri && currentUri === objectUri) return fallbackDoc

  const objectId = extractAncientBookObjectIdFromUri(objectUri)
  if (!objectId) return fallbackDoc

  try {
    const objectResp = await fetchAncientBookByIdRepo(objectId, objectUri)
    if (!objectResp.success) return fallbackDoc
    const objectDoc = normalizeDoc(objectResp.data?.doc)
    return Object.keys(objectDoc).length > 0 ? mergeAncientBookDocs(fallbackDoc, objectDoc) : fallbackDoc
  } catch {
    return fallbackDoc
  }
}

/**
 * 从 txt 格式诗文 ID 中提取基础 Set ID
 *
 * 例如 poem_30710_03 → poem_30710
 */
function extractBasePoemSetId(id: string): string | null {
  const match = id.match(/^(poem_\d+)_\d+$/)
  return match ? match[1] : null
}

async function fetchPoemDetailData(
  id: string,
  format?: 'set' | 'txt',
  uri?: string,
): Promise<DetailViewModel | null> {
  if (!id) return null

  // txt 格式时，优先请求基础 Set ID 以获取完整诗文
  let poemResp: Awaited<ReturnType<typeof fetchPoemByIdRepo>> | null = null
  if (format === 'txt') {
    const baseSetId = extractBasePoemSetId(id)
    if (baseSetId) {
      try {
        const setResp = await fetchPoemByIdRepo(baseSetId, { format: 'set' })
        if (setResp.success) poemResp = setResp
      } catch {
        // Set 请求失败，退回 txt 格式
      }
    }
  }
  if (!poemResp) {
    poemResp = await fetchPoemByIdRepo(id, format ? { format } : undefined)
  }
  if (!poemResp.success) return null

  const poem = poemResp.data
  const poemUri = poem.uri || uri || ''
  const doc = normalizeDoc((poem as { doc?: unknown }).doc)
  const docRelatedPlaces = inferPlaceLinksFromDoc(doc)
  let relatedPlaces = deduplicatePlaces([...(poem.relatedPlaces || []), ...docRelatedPlaces])

  if (!relatedPlaces.length) {
    try {
      const setPoemResp = await fetchPoemByIdRepo(id, { format: 'set' })
      if (setPoemResp.success) {
        const setPoem = setPoemResp.data
        const setDoc = normalizeDoc((setPoem as { doc?: unknown }).doc)
        const setDocRelatedPlaces = inferPlaceLinksFromDoc(setDoc)
        relatedPlaces = deduplicatePlaces([...(setPoem.relatedPlaces || []), ...setDocRelatedPlaces])
      }
    } catch {
      // 标准详情回退失败时忽略，继续使用当前可得数据
    }
  }

  const externalUris = normalizeExternalUris((poem as { externalUris?: unknown }).externalUris)
  const summary = poem.fullText ? poem.fullText.slice(0, 260) : TEXT.DEFAULT_SUMMARY

  return {
    uri: poemUri,
    title: poem.title || '未命名诗文',
    summary,
    poemDetail: {
      title: poem.title || '未命名诗文',
      author: poem.author || '未知作者',
      authorId: poem.authorId,
      dynasty: poem.dynasty,
      genre: poem.genre,
      genreUri: poem.genreUri,
      rhyme: poem.rhyme,
      rhymeUri: poem.rhymeUri,
      source: poem.source,
      fullText: poem.fullText || TEXT.NO_POEM_TEXT,
      textUri: poem.textUri,
      comments: poem.comments,
      set: poem.set,
      relatedPlaces,
    },
    internalLinks: [],
    externalUris,
    doc,
  }
}

async function fetchPersonDetailData(id: string, uri: string): Promise<DetailViewModel | null> {
  if (!id) return null

  let personResp: Awaited<ReturnType<typeof fetchPersonByIdRepo>> | null = null
  try {
    personResp = await fetchPersonByIdRepo(id)
  } catch {
    return null
  }
  if (!personResp.success) return null

  const person = personResp.data
  const personUri = person.uri || uri || ''
  const personDoc = normalizeDoc(person.doc)
  const enrichedPersonDoc: Record<string, unknown> = {
    ...personDoc,
    _label: person.name || personDoc._label || personDoc.name || '',
    aliases: Array.isArray(person.aliases) ? person.aliases : (personDoc.aliases as unknown[] || []),
    dynasty: person.dynasty || personDoc.dynasty || '',
    lifespan: person.lifespan || personDoc.lifespan || '',
    birthplace: person.birthplace || personDoc.birthplace || '',
  }
  const relationLinks = buildPersonRelationLinks({ doc: personDoc, relatedPoems: person.relatedPoems })
  const uniquePlaces = deduplicateByUri(person.relatedPlaces || [])
  const placeLinks = uniquePlaces.map((item) => ({
    label: `相关地点：${item.label}`,
    uri: item.uri,
  }))

  return {
    uri: personUri,
    title: person.name || '未命名人物',
    summary: person.summary || TEXT.DEFAULT_SUMMARY,
    internalLinks: deduplicateByUri([...relationLinks, ...placeLinks]),
    externalUris: normalizeExternalUris(person.externalUris || []),
    doc: enrichedPersonDoc,
  }
}

async function fetchBookDetailData(id: string, uri: string): Promise<DetailViewModel | null> {
  if (!id) return null

  const bookResp = await fetchBookByIdRepo(id)
  if (!bookResp.success) return null

  const book = bookResp.data
  return {
    uri: book.uri || uri || '',
    title: book.title || '未命名图书',
    summary: book.abstract || TEXT.DEFAULT_SUMMARY,
    internalLinks: [],
    externalUris: book.externalUris || [],
    doc: normalizeDoc(book.doc),
  }
}

async function fetchPlaceDetailData(id: string, uri: string): Promise<DetailViewModel | null> {
  if (!id) return null

  const placeResp = await fetchPlaceByIdRepo(id)
  if (!placeResp.success) return null

  const place = placeResp.data
  return {
    uri: place.uri || uri || '',
    title: place.name || '未命名地点',
    summary: place.description || '暂无描述',
    internalLinks: [],
    externalUris: [],
    doc: normalizeDoc(place.doc),
  }
}

async function fetchConceptDetailData(id: string, uri: string): Promise<DetailViewModel | null> {
  if (!id) return null

  const conceptResp = await fetchConceptByIdRepo(id)
  if (!conceptResp.success) return null

  const concept = conceptResp.data
  const internalLinks = buildConceptInternalLinks(concept)

  return {
    uri: concept.uri || uri || '',
    title: concept.label || '未命名概念',
    summary: concept.definition?.slice(0, 260) || '暂无定义',
    internalLinks,
    externalUris: [],
    doc: normalizeDoc(concept.doc),
  }
}

async function fetchAncientBookDetailData(id: string, uri: string): Promise<DetailViewModel | null> {
  if (!id) return null

  const ancientBookResp = await fetchAncientBookByIdRepo(id, uri)
  if (!ancientBookResp.success) return null

  const ancientBook = ancientBookResp.data
  const ancientBookVolumes = toAncientBookVolumes(ancientBook)
  const ancientBookHierarchy = toAncientBookHierarchy(ancientBook)
  const primaryDoc = normalizeDoc(ancientBook.doc)
  const preferredDoc = await resolveAncientBookPreferredDoc(ancientBook, primaryDoc, uri)

  return {
    uri: ancientBook.uri || uri || '',
    title: ancientBook.title || '未命名古籍',
    summary: ancientBook.summary || TEXT.DEFAULT_SUMMARY,
    ancientBookHierarchy: ancientBookHierarchy.length ? ancientBookHierarchy : undefined,
    ancientBookVolumes: ancientBookVolumes.length ? ancientBookVolumes : undefined,
    ancientBookVolumeLabel: ancientBook.volumeLabel,
    ancientBookVolumeText: ancientBook.volumeText,
    ancientBookVolumeTextStatus: ancientBook.volumeTextStatus,
    ancientBookVolumeTextMessage: ancientBook.volumeTextMessage,
    ancientBookVolumeTextSourceUri: ancientBook.volumeTextSourceUri,
    internalLinks: [],
    externalUris: ancientBook.manifests || [],
    doc: preferredDoc,
  }
}

// ============================================================================
// 公共 API
// ============================================================================

export async function fetchDetailByResource(
  resource: DetailResourceInput,
  uri: string,
): Promise<DetailViewModel | null> {
  if (!resource.id) return null

  switch (resource.type) {
    case 'poem': {
      const poemFormat = resource.format === 'txt' ? 'txt' : 'set'
      return fetchPoemDetailData(resource.id, poemFormat, uri)
    }
    case 'person':
      return fetchPersonDetailData(resource.id, uri)
    case 'book':
      return fetchBookDetailData(resource.id, uri)
    case 'place':
      return fetchPlaceDetailData(resource.id, uri)
    case 'concept':
      return fetchConceptDetailData(resource.id, uri)
    case 'ancient_book':
      return fetchAncientBookDetailData(resource.id, uri)
    default:
      return null
  }
}
