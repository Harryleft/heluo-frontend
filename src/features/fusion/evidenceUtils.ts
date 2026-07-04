/**
 * 证据处理工具函数
 * 用于融合问答页面的证据合并、去重和排序
 */

import type {
  FusionCitationV1,
  FusionEntityItemV1,
  FusionIiifMatchV1,
  FusionSidebarItemV1,
  ResourceType,
} from '@/types/contracts/apiContracts'

// ========== 类型定义 ==========

type UnifiedEvidenceKind = 'entity' | 'citation' | 'iiif' | 'sidebar'
type EvidenceColorKey = ResourceType | 'citation' | 'sidebar' | 'other'

export interface UnifiedEvidenceItem {
  itemId: string
  kind: UnifiedEvidenceKind
  colorKey: EvidenceColorKey
  typeLabel: string
  title: string
  snippet: string
  link: string
  uri?: string
  score: number
  sourceKinds: UnifiedEvidenceKind[]
  manifest?: string
  canvasId?: string
  canvasLabel?: string
  thumbnailUrl?: string
}

// ========== 常量 ==========

const DEFAULT_DIMS: ResourceType[] = ['poem', 'place', 'ancient_book', 'concept', 'book', 'iiif']

const EVIDENCE_COLOR_SET = new Set<EvidenceColorKey>([
  'person',
  'poem',
  'book',
  'ancient_book',
  'place',
  'concept',
  'iiif',
  'citation',
  'sidebar',
  'other',
])

const EVIDENCE_SOURCE_LABEL: Record<UnifiedEvidenceKind, string> = {
  entity: '实体',
  citation: '证据',
  iiif: 'IIIF',
  sidebar: '联动',
}

// 类型中文名映射
const EVIDENCE_TYPE_LABEL_CN: Record<string, string> = {
  person: '人物',
  poem: '诗文',
  book: '图书',
  ancient_book: '古籍',
  place: '地理',
  concept: '概念',
  iiif: '影像',
  citation: '引用',
  sidebar: '关联',
  other: '其他',
}

const DETAILS_ROUTE_PREFIX = '/details?'
const IIIF_ROUTE_PATH = '/iiif'

// ========== 工具函数 ==========

/**
 * 归一化查询字符串
 */
export function normalizeQuery(rawQuery: string, defaultQuery = '杜甫'): string {
  const query = rawQuery.trim()
  return query || defaultQuery
}

/**
 * 解析维度参数
 */
export function parseDims(rawDims: string | null): ResourceType[] {
  const source = rawDims || DEFAULT_DIMS.join(',')
  const allowed = new Set<ResourceType>(DEFAULT_DIMS)
  const parsed = source
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is ResourceType => allowed.has(item as ResourceType))
  return parsed.length > 0 ? parsed : DEFAULT_DIMS
}

/**
 * 创建融合查询参数
 */
export function createFusionParams(rawQuery: string, dims: ResourceType[]): globalThis.URLSearchParams {
  const params = new globalThis.URLSearchParams()
  const query = rawQuery.trim()
  if (query) {
    params.set('q', query)
  }
  params.set('dims', dims.join(','))
  return params
}

/**
 * 归一化证据颜色键
 */
export function normalizeEvidenceColorKey(
  rawType: string,
  fallback: EvidenceColorKey = 'other',
): EvidenceColorKey {
  const normalized = String(rawType || '').trim().toLowerCase()
  return EVIDENCE_COLOR_SET.has(normalized as EvidenceColorKey)
    ? (normalized as EvidenceColorKey)
    : fallback
}

/**
 * 归一化分数
 */
export function normalizeScore(rawScore: number): number {
  const value = Number(rawScore)
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(4))
}

/**
 * 归一化证据文本
 */
export function normalizeEvidenceText(rawValue: unknown): string {
  return String(rawValue || '').trim()
}

/**
 * 获取证据类型的权重（用于排序）
 */
export function kindWeight(kind: UnifiedEvidenceKind): number {
  if (kind === 'iiif') return 40
  if (kind === 'citation') return 30
  if (kind === 'entity') return 20
  return 10
}

/**
 * 从链接中解析 URI
 */
export function parseEvidenceUriFromLink(link: string): string {
  const rawLink = normalizeEvidenceText(link)
  if (!rawLink) return ''

  if (rawLink.startsWith('/details')) {
    const queryIndex = rawLink.indexOf('?')
    if (queryIndex < 0) return ''
    const params = new globalThis.URLSearchParams(rawLink.slice(queryIndex + 1))
    return normalizeEvidenceText(params.get('uri'))
  }

  if (rawLink.startsWith('http://') || rawLink.startsWith('https://')) {
    try {
      const parsed = new globalThis.URL(rawLink)
      if (parsed.pathname !== '/details') return ''
      return normalizeEvidenceText(parsed.searchParams.get('uri'))
    } catch {
      return ''
    }
  }

  return ''
}

function parseIiifManifestFromLink(link: string): string {
  const rawLink = normalizeEvidenceText(link)
  if (!rawLink) return ''

  if (rawLink.startsWith(IIIF_ROUTE_PATH)) {
    const queryIndex = rawLink.indexOf('?')
    if (queryIndex < 0) return ''
    const params = new globalThis.URLSearchParams(rawLink.slice(queryIndex + 1))
    return normalizeEvidenceText(params.get('manifest'))
  }

  if (rawLink.startsWith('http://') || rawLink.startsWith('https://')) {
    try {
      const parsed = new globalThis.URL(rawLink)
      if (parsed.pathname !== IIIF_ROUTE_PATH) return ''
      return normalizeEvidenceText(parsed.searchParams.get('manifest'))
    } catch {
      return ''
    }
  }

  return ''
}

function isIiifManifestUri(uri: string): boolean {
  const normalized = normalizeEvidenceText(uri).toLowerCase()
  if (!normalized) return false
  return normalized.includes('/iiif/manifests/') ||
    normalized.includes('/iiif/3/manifest/') ||
    normalized.includes('/processed/vector/iiif/manifest/')
}

function buildDetailsRoute(uri: string): string {
  return `${DETAILS_ROUTE_PREFIX}uri=${encodeURIComponent(uri)}`
}

function buildIiifRoute(manifest: string): string {
  return `${IIIF_ROUTE_PATH}?manifest=${encodeURIComponent(manifest)}`
}

function resolveEvidenceNavigationLink(uri: string, fallbackLink = ''): string {
  const normalizedUri = normalizeEvidenceText(uri)
  const normalizedFallbackLink = normalizeEvidenceText(fallbackLink)

  if (normalizedUri) {
    return isIiifManifestUri(normalizedUri)
      ? buildIiifRoute(normalizedUri)
      : buildDetailsRoute(normalizedUri)
  }

  const manifestFromLink = parseIiifManifestFromLink(normalizedFallbackLink)
  if (manifestFromLink) {
    return buildIiifRoute(manifestFromLink)
  }

  const uriFromLink = parseEvidenceUriFromLink(normalizedFallbackLink)
  if (uriFromLink) {
    return isIiifManifestUri(uriFromLink)
      ? buildIiifRoute(uriFromLink)
      : buildDetailsRoute(uriFromLink)
  }

  return normalizedFallbackLink
}

/**
 * 合并证据来源类型
 */
export function mergeEvidenceSourceKinds(
  currentKinds: UnifiedEvidenceKind[],
  nextKinds: UnifiedEvidenceKind[],
): UnifiedEvidenceKind[] {
  const merged = Array.from(new Set([...currentKinds, ...nextKinds]))
  merged.sort((a, b) => kindWeight(b) - kindWeight(a))
  return merged
}

/**
 * 格式化证据来源类型
 */
export function formatEvidenceSourceKinds(kinds: UnifiedEvidenceKind[]): string {
  return kinds.map((kind) => EVIDENCE_SOURCE_LABEL[kind]).join('、')
}

/**
 * 获取证据类型的中文标签
 */
export function getEvidenceTypeLabelCN(type: string): string {
  return EVIDENCE_TYPE_LABEL_CN[type] || EVIDENCE_TYPE_LABEL_CN['other']
}

/**
 * 生成证据去重键
 */
export function evidenceDedupeKey(item: UnifiedEvidenceItem): string {
  if (item.kind === 'iiif') {
    return `iiif:${item.manifest || ''}:${item.canvasId || ''}`
  }
  if (item.uri) return `uri:${item.uri}`
  if (item.link) return `link:${item.link}`
  return `${item.kind}:${item.title}:${item.snippet}`
}

/**
 * 比较证据优先级
 * @returns 正数表示 next 优先级更高
 */
export function compareEvidencePriority(
  next: UnifiedEvidenceItem,
  current: UnifiedEvidenceItem,
): number {
  if (next.score !== current.score) return next.score - current.score
  return kindWeight(next.kind) - kindWeight(current.kind)
}

/**
 * 构建统一证据列表
 */
export function buildUnifiedEvidenceItems(
  entities: FusionEntityItemV1[],
  citations: FusionCitationV1[],
  iiifMatches: FusionIiifMatchV1[],
  sidebarItems: FusionSidebarItemV1[],
): UnifiedEvidenceItem[] {
  const map = new Map<string, UnifiedEvidenceItem>()

  const upsert = (item: UnifiedEvidenceItem): void => {
    const dedupeKey = evidenceDedupeKey(item)
    const current = map.get(dedupeKey)
    if (!current) {
      map.set(dedupeKey, item)
      return
    }

    const mergedSourceKinds = mergeEvidenceSourceKinds(current.sourceKinds, item.sourceKinds)
    const picked = compareEvidencePriority(item, current) > 0 ? item : current
    map.set(dedupeKey, {
      ...picked,
      uri: picked.uri || current.uri || item.uri,
      sourceKinds: mergedSourceKinds,
    })
  }

  // 处理实体
  entities.forEach((item) => {
    const colorKey = normalizeEvidenceColorKey(item.type, 'other')
    // 后端已验证的 IIIF 链接（含 canvas）优先使用；未验证的 IIIF URI 走详情页安全兜底
    let entityLink: string
    if (item.detailLink?.startsWith('/iiif?')) {
      entityLink = item.detailLink
    } else if (isIiifManifestUri(item.uri || '')) {
      entityLink = item.detailLink || buildDetailsRoute(item.uri)
    } else {
      entityLink = resolveEvidenceNavigationLink(item.uri, item.detailLink)
    }
    upsert({
      itemId: `entity-${item.type}-${item.id}-${item.uri}`,
      kind: 'entity',
      colorKey,
      typeLabel: getEvidenceTypeLabelCN(item.type),
      title: item.title || '未命名条目',
      snippet: item.snippet || '暂无摘要',
      link: entityLink,
      uri: item.uri,
      score: normalizeScore(item.score),
      sourceKinds: ['entity'],
    })
  })

  // 处理引用
  citations.forEach((item) => {
    const colorKey = normalizeEvidenceColorKey(item.sourceType, 'citation')
    upsert({
      itemId: `citation-${item.citationId}`,
      kind: 'citation',
      colorKey,
      typeLabel: getEvidenceTypeLabelCN(item.sourceType || 'citation'),
      title: item.title || '未命名证据',
      snippet: item.snippet || '暂无摘要',
      link: resolveEvidenceNavigationLink(item.uri),
      uri: item.uri,
      score: normalizeScore(item.scoreDetail?.finalScore || 0),
      sourceKinds: ['citation'],
    })
  })

  // 处理 IIIF 匹配
  iiifMatches.forEach((item) => {
    upsert({
      itemId: `iiif-${item.matchId}`,
      kind: 'iiif',
      colorKey: 'iiif',
      typeLabel: '影像',
      title: item.canvasLabel || 'IIIF Canvas 命中',
      snippet: item.segmentText || '命中相关影像片段',
      link: item.openUrl,
      score: normalizeScore(item.score),
      sourceKinds: ['iiif'],
      manifest: item.manifest,
      canvasId: item.canvasId,
      canvasLabel: item.canvasLabel,
      thumbnailUrl: item.thumbnailUrl,
    })
  })

  // 处理侧边栏项
  sidebarItems.forEach((item) => {
    const colorKey = normalizeEvidenceColorKey(item.itemType, 'sidebar')
    upsert({
      itemId: `sidebar-${item.itemId}`,
      kind: 'sidebar',
      colorKey,
      typeLabel: getEvidenceTypeLabelCN(item.itemType || 'sidebar'),
      title: item.title || '未命名联动项',
      snippet: item.snippet || '暂无摘要',
      link: resolveEvidenceNavigationLink(parseEvidenceUriFromLink(item.link), item.link),
      uri: parseEvidenceUriFromLink(item.link),
      score: 0,
      sourceKinds: ['sidebar'],
    })
  })

  // 排序并返回
  return Array.from(map.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (kindWeight(b.kind) !== kindWeight(a.kind)) return kindWeight(b.kind) - kindWeight(a.kind)
    return a.itemId.localeCompare(b.itemId, 'zh-CN')
  })
}
