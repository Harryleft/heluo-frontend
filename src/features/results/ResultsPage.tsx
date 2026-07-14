/**
 * ResultsPage.tsx
 * 检索结果页 - 经典学术风格
 *
 * 设计理念：
 * - 与首页视觉风格保持一致
 * - 深蓝主色 + 金色装饰
 * - 暖米色背景营造学术氛围
 * - 结果卡片采用深蓝左边框 + 金色装饰角
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchUnified } from '@/lib/api/v1Api'
import { createUnifiedCache } from '@/lib/cache/unifiedCache'
import { FRONTEND_CACHE_CONFIG, FRONTEND_CACHE_TEST_MODE_ENABLED, FRONTEND_CACHE_VERSION } from '@/lib/cache/cacheConfig'
import type { ResourceType, SearchResultItemV1 } from '@/types/api'

const LOADING_TEXT = '加载中...'
const EMPTY_QUERY_SYMBOL = '*'
// 使用关键词模式进行精确匹配
const RESULTS_SEARCH_MODE = 'keyword'
const SEARCH_PAGE_SIZE = 12
const LOAD_MORE_TEXT = '正在加载更多...'
const LOAD_MORE_BUTTON_TEXT = '加载更多'
const LOAD_END_TEXT = '已显示全部结果'
const INFINITE_SENTINEL_TEST_ID = 'results-infinite-sentinel'
const DEFAULT_SCOPE: 'all' | ResourceType = 'all'
const RESULTS_CACHE_ENABLED = FRONTEND_CACHE_TEST_MODE_ENABLED
const SCOPE_OPTIONS: Array<'all' | ResourceType> = [
  DEFAULT_SCOPE,
  'person',
  'poem',
  'book',
  'ancient_book',
  'place',
  'concept',
  'iiif',
]

const SCOPE_LABELS: Record<string, string> = {
  all: '全部',
  person: '人物',
  poem: '诗文',
  book: '著作',
  ancient_book: '古籍',
  place: '地点',
  concept: '概念',
  iiif: '图像',
}

const TYPE_BADGE_CLASSES: Record<string, string> = {
  person: 'classic-result-item__type-badge--person',
  poem: 'classic-result-item__type-badge--poem',
  book: 'classic-result-item__type-badge--book',
  ancient_book: 'classic-result-item__type-badge--ancient',
  place: 'classic-result-item__type-badge--place',
  concept: 'classic-result-item__type-badge--concept',
  iiif: 'classic-result-item__type-badge--iiif',
}

interface CachedSearchPageValue {
  items: SearchResultItemV1[]
  total: number
}

const resultsPageCache = createUnifiedCache<CachedSearchPageValue>(FRONTEND_CACHE_CONFIG.searchResults.namespace, {
  ttlMs: FRONTEND_CACHE_CONFIG.searchResults.ttlMs,
  maxEntries: FRONTEND_CACHE_CONFIG.searchResults.maxEntries,
  version: FRONTEND_CACHE_VERSION,
})

function isValidScope(scope: string): scope is 'all' | ResourceType {
  return SCOPE_OPTIONS.includes(scope as 'all' | ResourceType)
}

function normalizeQuery(rawQuery: string): string {
  const query = rawQuery.trim()
  return query || EMPTY_QUERY_SYMBOL
}

function createResultParams(rawQuery: string, rawScope: string) {
  const params = new globalThis.URLSearchParams()
  const query = rawQuery.trim()
  const scope = rawScope.trim() || DEFAULT_SCOPE
  params.set('scope', scope)
  if (query) {
    params.set('q', query)
  }
  return params
}

function createDetailsLink(uri: string, rawQuery: string): string {
  const query = rawQuery.trim()
  const params = new globalThis.URLSearchParams({ uri })
  if (query) {
    params.set('q', query)
  }
  return `/details?${params.toString()}`
}

function buildSummaryText(total: number): string {
  return `命中 ${total} 条结果`
}

function buildResultItemKey(item: SearchResultItemV1): string {
  return `${item.type}-${item.id}-${item.uri}`
}

function mergeSearchItems(
  previous: SearchResultItemV1[],
  incoming: SearchResultItemV1[],
): SearchResultItemV1[] {
  const merged = new Map<string, SearchResultItemV1>()
  previous.forEach((item) => merged.set(buildResultItemKey(item), item))
  incoming.forEach((item) => merged.set(buildResultItemKey(item), item))
  return Array.from(merged.values())
}

function buildResultsCacheKey(
  query: string,
  type: string,
  mode: string,
  page: number,
  pageSize: number,
): string {
  return JSON.stringify({
    query: String(query || '').trim(),
    type: String(type || '').trim(),
    mode: String(mode || '').trim(),
    page,
    pageSize,
  })
}

/**
 * 获取类型徽章颜色类
 */
function getTypeBadgeClass(type: string): string {
  return TYPE_BADGE_CLASSES[type] || ''
}

function renderResultItem(item: SearchResultItemV1, rawQuery: string): JSX.Element {
  return (
    <article className="classic-result-item" key={`${item.type}-${item.id}-${item.uri}`}>
      {/* 顶部信息栏 */}
      <div className="classic-result-item__header">
        <span className={`classic-result-item__type-badge ${getTypeBadgeClass(item.type)}`}>
          {SCOPE_LABELS[item.type] || item.type}
        </span>
      </div>

      {/* 标题 */}
      <h3 className="classic-result-item__title">{item.title}</h3>

      {/* 链接区 */}
      <div className="classic-result-item__links">
        <Link to={createDetailsLink(item.uri, rawQuery)} className="classic-result-item__link">
          查看详情
        </Link>
      </div>
    </article>
  )
}

export function ResultsPage(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<SearchResultItemV1[]>([])
  const [summary, setSummary] = useState(LOADING_TEXT)
  const [total, setTotal] = useState(0)
  const [nextPage, setNextPage] = useState(2)
  const [hasMore, setHasMore] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasLoadError, setHasLoadError] = useState(false)
  const query = params.get('q') || ''
  const scope = params.get('scope') || DEFAULT_SCOPE
  const effectiveQuery = normalizeQuery(query)
  const sentinelRef = useRef<globalThis.HTMLDivElement | null>(null)
  const itemsRef = useRef<SearchResultItemV1[]>([])
  const sessionRef = useRef(0)

  const safeScope = useMemo(() => (isValidScope(scope) ? scope : DEFAULT_SCOPE), [scope])
  const safeType = safeScope === DEFAULT_SCOPE ? DEFAULT_SCOPE : safeScope

  const requestPage = useCallback(async (page: number, append: boolean, session: number): Promise<void> => {
    try {
      const cacheKey = buildResultsCacheKey(
        effectiveQuery,
        safeType,
        RESULTS_SEARCH_MODE,
        page,
        SEARCH_PAGE_SIZE,
      )
      const cached = RESULTS_CACHE_ENABLED ? resultsPageCache.get(cacheKey) : undefined
      if (cached) {
        if (session !== sessionRef.current) return

        const incomingItems = cached.items || []
        const totalCount = Number(cached.total || 0)
        const mergedItems = append ? mergeSearchItems(itemsRef.current, incomingItems) : incomingItems
        itemsRef.current = mergedItems

        setItems(mergedItems)
        setTotal(totalCount)
        setSummary(buildSummaryText(totalCount))
        setHasLoadError(false)
        setHasMore(mergedItems.length < totalCount && incomingItems.length > 0)
        setNextPage(page + 1)
        return
      }

      const data = await searchUnified(effectiveQuery, safeType, RESULTS_SEARCH_MODE, {
        page,
        pageSize: SEARCH_PAGE_SIZE,
      })

      if (session !== sessionRef.current) return

      if (!data.success) {
        if (!append) {
          itemsRef.current = []
          setItems([])
        }
        setHasMore(false)
        setSummary(`加载失败：${data.error.message}`)
        setHasLoadError(true)
        return
      }

      const incomingItems = data.data.items || []
      const totalCount = Number(data.data.total || 0)
      if (RESULTS_CACHE_ENABLED) {
        resultsPageCache.set(cacheKey, {
          items: incomingItems,
          total: totalCount,
        })
      }
      const mergedItems = append ? mergeSearchItems(itemsRef.current, incomingItems) : incomingItems
      itemsRef.current = mergedItems

      setItems(mergedItems)
      setTotal(totalCount)
      setSummary(buildSummaryText(totalCount))
      setHasLoadError(false)
      setHasMore(mergedItems.length < totalCount && incomingItems.length > 0)
      setNextPage(page + 1)
    } catch (error: unknown) {
      if (session !== sessionRef.current) return

      if (!append) {
        itemsRef.current = []
        setItems([])
      }
      setHasMore(false)
      setSummary(`加载失败：${String(error)}`)
      setHasLoadError(true)
    }
  }, [effectiveQuery, safeType])

  const loadNextPage = useCallback(() => {
    if (isInitialLoading || isLoadingMore || !hasMore) return

    const session = sessionRef.current
    setIsLoadingMore(true)
    void requestPage(nextPage, true, session).finally(() => {
      if (session === sessionRef.current) {
        setIsLoadingMore(false)
      }
    })
  }, [hasMore, isInitialLoading, isLoadingMore, nextPage, requestPage])

  useEffect(() => {
    sessionRef.current += 1
    const session = sessionRef.current

    setIsInitialLoading(true)
    setIsLoadingMore(false)
    setItems([])
    itemsRef.current = []
    setTotal(0)
    setNextPage(2)
    setHasMore(false)
    setSummary(LOADING_TEXT)
    setHasLoadError(false)

    void requestPage(1, false, session).finally(() => {
      if (session === sessionRef.current) {
        setIsInitialLoading(false)
      }
    })
  }, [requestPage])

  useEffect(() => {
    if (!hasMore) return
    if (typeof globalThis.IntersectionObserver === 'undefined') return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new globalThis.IntersectionObserver((entries) => {
      const shouldLoadNext = entries.some((entry) => entry.isIntersecting)
      if (shouldLoadNext) {
        loadNextPage()
      }
    })
    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, loadNextPage, items.length])

  return (
    <main className="classic-results-page">
      {/* 标题区域 */}
      <header className="classic-results-header">
        <h1 className="classic-results-title">检索结果</h1>
      </header>

      {/* 搜索面板 */}
      <section className="classic-search-panel">
        <form
          key={`${query}:${safeScope}`}
          className="classic-search-panel__form"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            const q = String(formData.get('q') || '')
            const s = String(formData.get('scope') || 'all')
            setParams(createResultParams(q, s))
          }}
        >
          <div className="classic-search-panel__inputs">
            <input
              name="q"
              defaultValue={query}
              className="classic-search-panel__input"
              placeholder="输入关键词..."
            />
            <select name="scope" defaultValue={safeScope} className="classic-search-panel__select">
              {SCOPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {SCOPE_LABELS[option] || option}
                </option>
              ))}
            </select>
            <button type="submit" className="classic-search-panel__button">
              检索
            </button>
          </div>
        </form>
        <p className="classic-search-panel__summary">{summary}</p>
      </section>

      {/* 结果列表 */}
      <section className="classic-results-list">
        {items.length ? (
          <>
            {items.map((item) => renderResultItem(item, query))}
            {hasMore ? (
              <div className="classic-results-load-more">
                <button
                  type="button"
                  className="classic-search-panel__button"
                  onClick={loadNextPage}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? LOAD_MORE_TEXT : LOAD_MORE_BUTTON_TEXT}
                </button>
                <div ref={sentinelRef} data-testid={INFINITE_SENTINEL_TEST_ID} aria-hidden="true" />
              </div>
            ) : total > 0 ? (
              <p className="classic-results-end">{LOAD_END_TEXT}</p>
            ) : null}
          </>
        ) : !isInitialLoading && !hasLoadError ? (
          <div className="classic-results-empty">
            <div className="classic-results-empty__icon">.</div>
            <p className="classic-results-empty__text">暂无匹配结果</p>
            <p className="classic-results-empty__hint">请尝试调整检索条件</p>
          </div>
        ) : (
          <div className="classic-results-loading">
            <div className="classic-results-loading__spinner" />
            <p className="classic-results-loading__text">正在检索...</p>
          </div>
        )}
      </section>

      {/* 页脚 */}
      <footer className="classic-footer">
        <div className="classic-footer-text">
          <span>河洛文化</span>
          <span className="classic-footer-separator">·</span>
          <span>源远流长</span>
        </div>
      </footer>
    </main>
  )
}
