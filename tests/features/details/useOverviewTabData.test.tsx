/**
 * OverviewTab 数据 Hook 回归测试
 * @vitest-environment jsdom
 */

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRelatedResources } from '@/features/details/hooks/useOverviewTabData'
import { searchUnified } from '@/lib/api/v1Api'
import type { SearchResultItemV1, UnifiedSearchApiResponse } from '@/types/contracts/apiContracts'

vi.mock('@/lib/api/v1Api', () => ({
  searchUnified: vi.fn(),
}))

interface ProbeState {
  relatedResources: SearchResultItemV1[]
  relatedState: 'idle' | 'loading' | 'success' | 'error'
}

const EMPTY_INTERNAL_LINKS: [] = []

function buildSearchResponse(items: SearchResultItemV1[]): UnifiedSearchApiResponse {
  return {
    success: true,
    data: {
      query: '当前图书',
      type: 'all',
      mode: 'keyword',
      total: items.length,
      items,
      counts: {},
    },
  }
}

function Probe({ onUpdate }: { onUpdate: (state: ProbeState) => void }): JSX.Element | null {
  const state = useRelatedResources({
    dataUri: '/processed/json-ld/book/current.json',
    dataTitle: '当前图书',
    dataSummary: '当前图书摘要',
    summaryTitle: '当前图书',
    summarySnippet: '当前图书摘要',
    relatedQuery: '当前图书',
    resourceType: 'book',
    isBookResource: true,
    isPlaceResource: false,
    isConceptResource: false,
    bookIsbn: '',
    internalLinks: EMPTY_INTERNAL_LINKS,
  })

  useEffect(() => {
    onUpdate(state)
  }, [onUpdate, state])

  return null
}

function mount(node: JSX.Element): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(node)
  })
  return { container, root }
}

function unmount(root: Root, container: HTMLDivElement): void {
  act(() => {
    root.unmount()
  })
  container.remove()
}

describe('useRelatedResources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  })

  it('主检索为空时应保留补充检索命中的推荐资源', async () => {
    const supplementalItem: SearchResultItemV1 = {
      type: 'person',
      id: '17270',
      title: '杜甫',
      snippet: '唐代诗人',
      score: 1,
      uri: '/processed/json-ld/person/17270.json',
    }
    vi.mocked(searchUnified)
      .mockResolvedValueOnce(buildSearchResponse([]))
      .mockResolvedValueOnce(buildSearchResponse([supplementalItem]))

    const updates: ProbeState[] = []
    const mounted = mount(<Probe onUpdate={(state) => updates.push(state)} />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(searchUnified).toHaveBeenCalledTimes(2)
    expect(updates[updates.length - 1]?.relatedState).toBe('success')
    expect(updates[updates.length - 1]?.relatedResources).toEqual([supplementalItem])

    unmount(mounted.root, mounted.container)
  })
})
