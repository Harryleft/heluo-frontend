/**
 * 详情数据 Hook
 *
 * 根据资源 URI 获取详情数据，提供：
 * - 页面状态管理（loading/success/error）
 * - 实体摘要提取
 * - 外部链接提取
 */

import { useEffect, useState } from 'react'
import { isAxiosError } from '@/providers/apiClient'
import type { BiographyData } from '@/lib/parse/data/biographyParser'
import { parseJsonLdReadableFields } from '@/lib/parse/data/jsonldParser'
import { fetchDetailByResource } from '@/lib/api/services/detailService'
import type { DetailViewModel } from '@/types/view/models'
import { parseUriResource } from '@/features/details/utils/uriParser'
import { TEXT } from '@/lib/config/constants'

// ============================================================================
// 常量定义
// ============================================================================

const MISSING_URI_ERROR = '缺少 uri 参数。'
const INITIAL_ENTITY_SUMMARY: EntitySummary = {
  title: '',
  snippet: '',
  biography: undefined,
}
const detailCache = new Map<string, CachedDetailState>()

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 页面状态类型
 */
export type PageState = 'loading' | 'success' | 'error'

/**
 * 实体摘要信息
 */
export interface EntitySummary {
  /** 实体标题 */
  title: string
  /** 实体摘要/描述 */
  snippet: string
  /** 结构化的人物介绍数据 */
  biography?: BiographyData
}

/**
 * 详情数据 Hook 返回类型
 */
export interface UseDetailDataReturn {
  /** 页面状态 */
  pageState: PageState
  /** 详情数据 */
  data: DetailViewModel | null
  /** 错误信息 */
  error: string | null
  /** 实体摘要 */
  entitySummary: EntitySummary
  /** 原始实体数据（用于 EntityMetadata 组件） */
  entity: Record<string, unknown>
  /** 外部链接 */
  externalUris: string[]
}

interface ParsedDocSummary {
  title: string
  snippet: string
  biography?: BiographyData
}

interface CachedDetailState {
  data: DetailViewModel
  entitySummary: EntitySummary
  entity: Record<string, unknown>
  externalUris: string[]
}

// ============================================================================
// 私有实现 - URI 提取
// ============================================================================

function isHttpUri(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

function isIiifManifestUri(uri: string): boolean {
  const normalized = String(uri || '').trim().toLowerCase()
  if (!normalized) return false
  return normalized.includes('/iiif/') || normalized.includes('manifest')
}

function appendHttpUrisFromEquivalentNode(
  node: unknown,
  output: Set<string>,
  predicate: (uri: string) => boolean = isHttpUri,
): void {
  if (!node) return

  if (typeof node === 'string') {
    const uri = node.trim()
    if (predicate(uri)) output.add(uri)
    return
  }

  if (Array.isArray(node)) {
    node.forEach((item) => appendHttpUrisFromEquivalentNode(item, output, predicate))
    return
  }

  if (typeof node === 'object') {
    const record = node as Record<string, unknown>
    const uriCandidates = [record.id, record.uri, record['@id'], record._id]
    uriCandidates.forEach((item) => {
      const uri = String(item || '').trim()
      if (predicate(uri)) output.add(uri)
    })
  }
}

function extractEquivalentExternalUris(
  docData: Record<string, unknown>,
  predicate: (uri: string) => boolean = isHttpUri,
): string[] {
  const uris = new Set<string>()
  appendHttpUrisFromEquivalentNode(docData.equivalent, uris, predicate)
  return Array.from(uris)
}

function normalizeDetailExternalUris(raw: unknown): string[] {
  const items = Array.isArray(raw) ? raw : []
  const uris = new Set<string>()

  for (const item of items) {
    const uri = String(item || '').trim()
    if (uri) uris.add(uri)
  }

  return Array.from(uris)
}

/** 合并详情外部链接与文档等效链接 */
export function mergeDetailExternalUris(detailExternalUris: unknown, docData: Record<string, unknown>): string[] {
  const merged = new Set<string>()

  for (const uri of normalizeDetailExternalUris(detailExternalUris)) {
    merged.add(uri)
  }
  for (const uri of extractEquivalentExternalUris(docData)) {
    merged.add(uri)
  }

  return Array.from(merged)
}

function mergeUrisWithEquivalentFilter(
  detailExternalUris: unknown,
  docData: Record<string, unknown>,
  predicate: (uri: string) => boolean,
  options: {
    includeDetailExternalUris: boolean
  },
): string[] {
  const merged = new Set<string>()

  if (options.includeDetailExternalUris) {
    for (const uri of normalizeDetailExternalUris(detailExternalUris)) {
      if (predicate(uri)) merged.add(uri)
    }
  }

  for (const uri of extractEquivalentExternalUris(docData, predicate)) {
    merged.add(uri)
  }

  return Array.from(merged)
}

/** 根据资源类型解析外部链接（图书类型返回空） */
export function resolveDetailExternalUris(
  resourceType: string,
  detailExternalUris: unknown,
  docData: Record<string, unknown>,
): string[] {
  switch (resourceType) {
    case 'person':
      return mergeUrisWithEquivalentFilter(detailExternalUris, docData, isHttpUri, {
        includeDetailExternalUris: false,
      })
    case 'place':
      return mergeUrisWithEquivalentFilter(detailExternalUris, docData, isHttpUri, {
        includeDetailExternalUris: false,
      })
    case 'concept':
      return mergeUrisWithEquivalentFilter(detailExternalUris, docData, isHttpUri, {
        includeDetailExternalUris: false,
      })
    case 'ancient_book':
      return mergeUrisWithEquivalentFilter(detailExternalUris, docData, isIiifManifestUri, {
        includeDetailExternalUris: true,
      })
    case 'book':
    case 'poem':
      return []
    default:
      return mergeDetailExternalUris(detailExternalUris, docData)
  }
}

// ============================================================================
// 私有实现 - 错误处理
// ============================================================================

function formatDetailError(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.code === 'ERR_NETWORK') {
      return '加载失败：无法连接后端服务（Network Error）。请确认后端已启动，并可访问 http://127.0.0.1:9011/health'
    }

    const status = err.response?.status
    if (status === 404) {
      return '加载失败：未找到该详情数据（404）。'
    }
    if (status === 500) {
      return '加载失败：后端服务内部错误（500）。'
    }

    const message = String(err.message || '').trim()
    if (message) {
      return `加载失败：${message}`
    }
  }

  return `加载失败：${String(err)}`
}

// ============================================================================
// 私有实现 - 数据处理
// ============================================================================

async function parseDocSummary(docData: Record<string, unknown>): Promise<ParsedDocSummary> {
  if (Object.keys(docData).length === 0) {
    return { title: '', snippet: '', biography: undefined }
  }

  const parsed = await parseJsonLdReadableFields(docData)
  return {
    title: parsed.title || '',
    snippet: parsed.snippet || '',
    biography: parsed.biography,
  }
}

function normalizeDetailDoc(detail: DetailViewModel): Record<string, unknown> {
  return detail.doc && typeof detail.doc === 'object' ? detail.doc : {}
}

function buildEntitySummary(detail: DetailViewModel, parsed: ParsedDocSummary): EntitySummary {
  return {
    title: parsed.title || detail.title || TEXT.UNTITLED_ENTRY,
    snippet: parsed.snippet || detail.summary || TEXT.DEFAULT_SUMMARY,
    biography: parsed.biography,
  }
}

function buildFallbackEntitySummary(detail: DetailViewModel): EntitySummary {
  return {
    title: detail.title || TEXT.UNTITLED_ENTRY,
    snippet: detail.summary || TEXT.DEFAULT_SUMMARY,
    biography: undefined,
  }
}

function buildDetailCacheKey(uri: string, query: string): string {
  return JSON.stringify({
    uri: String(uri || '').trim(),
    query: String(query || '').trim(),
  })
}

function buildCachedDetailState(
  detail: DetailViewModel,
  summary: EntitySummary,
  externalUris: string[],
): CachedDetailState {
  return {
    data: detail,
    entitySummary: summary,
    entity: normalizeDetailDoc(detail),
    externalUris,
  }
}

function applyCachedDetailState(
  cached: CachedDetailState,
  actions: {
    setData: (value: DetailViewModel | null) => void
    setEntitySummary: (value: EntitySummary) => void
    setEntity: (value: Record<string, unknown>) => void
    setExternalUris: (value: string[]) => void
    setPageState: (value: PageState) => void
    setError: (value: string | null) => void
  },
): void {
  actions.setData(cached.data)
  actions.setEntitySummary(cached.entitySummary)
  actions.setEntity(cached.entity)
  actions.setExternalUris(cached.externalUris)
  actions.setPageState('success')
  actions.setError(null)
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 根据资源类型获取详情数据
 */
export function useDetailData(uri: string, query: string): UseDetailDataReturn {
  const [pageState, setPageState] = useState<PageState>('loading')
  const [data, setData] = useState<DetailViewModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [entitySummary, setEntitySummary] = useState<EntitySummary>(INITIAL_ENTITY_SUMMARY)
  const [entity, setEntity] = useState<Record<string, unknown>>({})
  const [externalUris, setExternalUris] = useState<string[]>([])

  useEffect(() => {
    let active = true

    async function loadDetailData(): Promise<void> {
      if (!uri) {
        if (!active) return
        setPageState('error')
        setError(MISSING_URI_ERROR)
        setData(null)
        setEntitySummary(INITIAL_ENTITY_SUMMARY)
        setEntity({})
        setExternalUris([])
        return
      }

      const cacheKey = buildDetailCacheKey(uri, query)
      const cached = detailCache.get(cacheKey)

      if (!active) return
      if (cached) {
        applyCachedDetailState(cached, {
          setData,
          setEntitySummary,
          setEntity,
          setExternalUris,
          setPageState,
          setError,
        })
      } else {
        setPageState('loading')
        setError(null)
      }

      try {
        const resource = parseUriResource(uri)
        const detail = await fetchDetailByResource(resource, uri)

        if (!detail) {
          throw new Error(`v1 暂不支持该资源详情：${resource.type}`)
        }

        if (!active) return

        const docData = normalizeDetailDoc(detail)
        const fallbackSummary = buildFallbackEntitySummary(detail)
        const resolvedExternalUris = resolveDetailExternalUris(resource.type, detail.externalUris, docData)

        setData(detail)
        setEntitySummary(fallbackSummary)
        setEntity(docData)
        setExternalUris(resolvedExternalUris)
        setPageState('success')
        setError(null)

        detailCache.set(
          cacheKey,
          buildCachedDetailState(detail, fallbackSummary, resolvedExternalUris),
        )

        void parseDocSummary(docData)
          .then((parsedSummary) => {
            if (!active) return
            const nextSummary = buildEntitySummary(detail, parsedSummary)
            setEntitySummary(nextSummary)
            detailCache.set(
              cacheKey,
              buildCachedDetailState(detail, nextSummary, resolvedExternalUris),
            )
          })
          .catch(() => {
            // 结构化解析失败时保留兜底摘要，不影响详情首屏展示。
          })
      } catch (err: unknown) {
        if (!active) return
        if (cached) {
          setError(null)
          return
        }
        setData(null)
        setPageState('error')
        setError(formatDetailError(err))
      }
    }

    void loadDetailData()

    return () => {
      active = false
    }
  }, [uri, query])

  return {
    pageState,
    data,
    error,
    entitySummary,
    entity,
    externalUris,
  }
}
