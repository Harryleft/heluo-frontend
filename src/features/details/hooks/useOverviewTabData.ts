/**
 * OverviewTab 数据 Hook
 *
 * 负责加载推荐资源与图书封面，减少 OverviewTab 主组件副作用复杂度。
 */

import { useEffect, useState } from 'react'
import { fetchBookCoverByIsbn, normalizeIsbn } from '@/lib/api/services/isbnCoverService'
import { searchUnified } from '@/lib/api/v1Api'
import { FRONTEND_CACHE_CONFIG, FRONTEND_CACHE_VERSION } from '@/lib/cache/cacheConfig'
import { createUnifiedCache } from '@/lib/cache/unifiedCache'
import type { DetailResourceType } from '@/features/details/utils/uriParser'
import type { InternalLinkViewModel, SearchResultItemV1 } from '@/types/api'
import type { RelatedPickContext } from '@/features/details/types/overviewTab'
import {
  BOOK_DIVERSITY_RESOURCE_TYPES,
  RELATED_RESOURCE_FETCH_SIZE,
  RELATED_RESOURCE_TYPES,
  RELATED_SEARCH_MODE,
} from '@/features/details/constants/overviewConstants'
import {
  buildBookDiversityQuery,
  buildRelatedFromInternalLinks,
  extractBookResourceKey,
  mergeRelatedCandidates,
  normalizeComparableUri,
  pickTopRelatedResources,
  shouldSupplementBookRelated,
} from '@/features/details/utils/relatedResources'

const relatedResourceCache = createUnifiedCache<SearchResultItemV1[]>(
  FRONTEND_CACHE_CONFIG.relatedResources.namespace,
  {
    ttlMs: FRONTEND_CACHE_CONFIG.relatedResources.ttlMs,
    maxEntries: FRONTEND_CACHE_CONFIG.relatedResources.maxEntries,
    version: FRONTEND_CACHE_VERSION,
  },
)

function cacheRelatedResourcesIfValid(cacheKey: string, items: SearchResultItemV1[]): void {
  if (!Array.isArray(items) || items.length === 0) return
  relatedResourceCache.set(cacheKey, items)
}

interface UseRelatedResourcesParams {
  dataUri: string
  dataTitle: string
  dataSummary: string
  summaryTitle: string
  summarySnippet: string
  relatedQuery: string
  resourceType: DetailResourceType
  isBookResource: boolean
  isPlaceResource: boolean
  isConceptResource: boolean
  bookIsbn: string
  internalLinks: InternalLinkViewModel[]
}

interface UseRelatedResourcesResult {
  relatedResources: SearchResultItemV1[]
  relatedState: 'idle' | 'loading' | 'success' | 'error'
}

export function useRelatedResources(params: UseRelatedResourcesParams): UseRelatedResourcesResult {
  const {
    dataUri,
    dataTitle,
    dataSummary,
    summaryTitle,
    summarySnippet,
    relatedQuery,
    resourceType,
    isBookResource,
    isPlaceResource,
    isConceptResource,
    bookIsbn,
    internalLinks,
  } = params

  const [relatedResources, setRelatedResources] = useState<SearchResultItemV1[]>([])
  const [relatedState, setRelatedState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  useEffect(() => {
    if (isPlaceResource || isConceptResource) {
      setRelatedResources([])
      setRelatedState('idle')
      return
    }

    if (!relatedQuery) {
      setRelatedResources([])
      setRelatedState('idle')
      return
    }

    const cacheKey = `${normalizeComparableUri(dataUri)}::${relatedQuery}`
    const cached = relatedResourceCache.get(cacheKey)
    if (cached) {
      setRelatedResources(cached)
      setRelatedState('success')
      return
    }

    let active = true
    setRelatedState('loading')

    searchUnified(relatedQuery, RELATED_RESOURCE_TYPES, RELATED_SEARCH_MODE, {
      page: 1,
      pageSize: RELATED_RESOURCE_FETCH_SIZE,
    })
      .then(async (response) => {
        if (!active) return

        const normalizedCurrentUri = normalizeComparableUri(dataUri)
        const relatedContext: RelatedPickContext = {
          normalizedCurrentUri,
          resourceType,
          currentTitle: summaryTitle || dataTitle || '',
          currentIsbn: normalizeIsbn(bookIsbn),
          currentResourceKey: extractBookResourceKey(dataUri),
        }

        if (!response.success) {
          const finalItems = buildRelatedFromInternalLinks(internalLinks, relatedContext)
          cacheRelatedResourcesIfValid(cacheKey, finalItems)
          setRelatedResources(finalItems)
          setRelatedState('success')
          return
        }

        let recommended = pickTopRelatedResources(response.data.items || [], relatedContext)

        const needSupplement = isBookResource
          && shouldSupplementBookRelated(recommended, relatedContext.currentTitle)
        if (needSupplement) {
          const diversityQuery = buildBookDiversityQuery(
            relatedContext.currentTitle,
            summarySnippet || dataSummary,
          )
          if (diversityQuery) {
            const supplemental = await searchUnified(
              diversityQuery,
              BOOK_DIVERSITY_RESOURCE_TYPES,
              'keyword',
              { page: 1, pageSize: RELATED_RESOURCE_FETCH_SIZE },
            )
            if (supplemental.success) {
              recommended = pickTopRelatedResources(
                mergeRelatedCandidates(response.data.items || [], supplemental.data.items || []),
                relatedContext,
              )
            }
          }
        }

        if (recommended.length === 0) {
          recommended = buildRelatedFromInternalLinks(internalLinks, relatedContext)
        }

        cacheRelatedResourcesIfValid(cacheKey, recommended)
        setRelatedResources(recommended)
        setRelatedState('success')
      })
      .catch(async () => {
        if (!active) return
        try {
          const normalizedCurrentUri = normalizeComparableUri(dataUri)
          const relatedContext: RelatedPickContext = {
            normalizedCurrentUri,
            resourceType,
            currentTitle: summaryTitle || dataTitle || '',
            currentIsbn: normalizeIsbn(bookIsbn),
            currentResourceKey: extractBookResourceKey(dataUri),
          }
          const finalItems = buildRelatedFromInternalLinks(internalLinks, relatedContext)
          cacheRelatedResourcesIfValid(cacheKey, finalItems)
          setRelatedResources(finalItems)
          setRelatedState('success')
        } catch {
          const internalFallbackItems = buildRelatedFromInternalLinks(internalLinks, {
            normalizedCurrentUri: normalizeComparableUri(dataUri),
            resourceType,
            currentTitle: summaryTitle || dataTitle || '',
            currentIsbn: normalizeIsbn(bookIsbn),
            currentResourceKey: extractBookResourceKey(dataUri),
          })
          if (internalFallbackItems.length > 0) {
            cacheRelatedResourcesIfValid(cacheKey, internalFallbackItems)
            setRelatedResources(internalFallbackItems)
            setRelatedState('success')
          } else {
            setRelatedResources([])
            setRelatedState('error')
          }
        }
      })

    return () => { active = false }
  }, [
    bookIsbn,
    dataSummary,
    dataTitle,
    dataUri,
    internalLinks,
    isBookResource,
    isConceptResource,
    isPlaceResource,
    relatedQuery,
    resourceType,
    summarySnippet,
    summaryTitle,
  ])

  return { relatedResources, relatedState }
}

interface UseBookCoverParams {
  isBookResource: boolean
  title: string
  isbn: string
}

export function useBookCover(params: UseBookCoverParams): string {
  const { isBookResource, title, isbn } = params
  const [coverUrl, setCoverUrl] = useState('')
  const normalizedIsbn = normalizeIsbn(isbn)

  useEffect(() => {
    if (!isBookResource || !normalizedIsbn) {
      setCoverUrl('')
      return
    }

    let active = true
    fetchBookCoverByIsbn(normalizedIsbn, title)
      .then((url) => {
        if (!active) return
        setCoverUrl(String(url || '').trim())
      })
      .catch(() => {
        if (!active) return
        setCoverUrl('')
      })

    return () => {
      active = false
    }
  }, [isBookResource, normalizedIsbn, title])

  return coverUrl
}
