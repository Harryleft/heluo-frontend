/**
 * 人物详情页右侧栏回归测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OverviewTab } from '@/features/details/OverviewTab'
import type { DetailViewModel, InternalLinkViewModel, SearchResultItemV1 } from '@/types/api'

vi.mock('@/features/details/hooks/useAiServices', () => ({
  usePersonAiIntro: () => ({
    aiIntro: '杜甫是唐代著名诗人。',
    aiIntroState: 'success',
    aiIntroError: '',
    refreshAiIntro: vi.fn(),
  }),
  usePoemAiAnalysis: () => ({
    poemAiAnalysis: '',
    poemAiAnalysisState: 'idle',
    poemAiAnalysisError: '',
    refreshPoemAiAnalysis: vi.fn(),
  }),
}))

vi.mock('@/features/details/hooks/useOverviewTabData', () => ({
  useBookCover: () => '',
  useRelatedResources: () => ({
    relatedResources: [
      { type: 'book', id: '1', title: '杜甫诗今译', snippet: '图书', score: 0.92, uri: '/book/dufu-a.json' },
      { type: 'poem', id: '2', title: '春望', snippet: '诗文', score: 0.9, uri: '/poem/chunwang.json' },
    ] satisfies SearchResultItemV1[],
    relatedState: 'success',
  }),
}))

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

function findAccordionHeader(container: HTMLDivElement, title: string): HTMLDivElement {
  const header = Array.from(container.querySelectorAll('.yale-sidebar-accordion__item-header'))
    .find((node) => node.textContent?.includes(title))
  if (!header) {
    throw new Error(`未找到折叠头部: ${title}`)
  }
  return header as HTMLDivElement
}

function findAccordionBody(container: HTMLDivElement, title: string): HTMLDivElement {
  const header = findAccordionHeader(container, title)
  const item = header.closest('.yale-sidebar-accordion__item')
  const body = item?.querySelector('.yale-sidebar-accordion__item-body')
  if (!body) {
    throw new Error(`未找到折叠内容体: ${title}`)
  }
  return body as HTMLDivElement
}

function buildPersonDetail(overrides: Partial<DetailViewModel> = {}): DetailViewModel {
  return {
    uri: '/person/17270',
    title: '杜甫',
    summary: '诗史人物',
    internalLinks: [
      { label: '相关人物（赠诗、文）：张九龄', uri: '/person/zhangjiuling.json' },
      { label: '相关人物（友）：李白', uri: '/person/libai.json' },
    ] satisfies InternalLinkViewModel[],
    externalUris: [
      'https://example.org/person/dufu',
      'https://data.example.org/person/dufu',
    ],
    doc: {},
    ...overrides,
  }
}

describe('人物详情页右侧栏回归', () => {
  const mountedRoots: Array<{ container: HTMLDivElement; root: Root }> = []

  afterEach(() => {
    while (mountedRoots.length > 0) {
      const mounted = mountedRoots.pop()
      if (mounted) {
        unmount(mounted.root, mounted.container)
      }
    }
  })

  it('应允许人物页多个右侧栏区块同时展开，并为长列表内容挂载高度协调类', () => {
    const data = buildPersonDetail()
    const mounted = mount(
      <MemoryRouter>
        <OverviewTab
          data={data}
          summary={{ title: data.title, snippet: data.summary }}
          resourceType="person"
          externalUris={data.externalUris}
          internalLinks={data.internalLinks}
          entity={{ _label: data.title, type: 'Person' }}
        />
      </MemoryRouter>,
    )
    mountedRoots.push(mounted)

    const aiHeader = findAccordionHeader(mounted.container, 'AI 智能解读')
    const relatedHeader = findAccordionHeader(mounted.container, '相关人物')
    const recommendHeader = findAccordionHeader(mounted.container, '推荐资源')
    const externalHeader = findAccordionHeader(mounted.container, '外部链接')

    act(() => {
      relatedHeader.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    act(() => {
      externalHeader.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(aiHeader.getAttribute('aria-expanded')).toBe('true')
    expect(relatedHeader.getAttribute('aria-expanded')).toBe('true')
    expect(recommendHeader.getAttribute('aria-expanded')).toBe('true')
    expect(externalHeader.getAttribute('aria-expanded')).toBe('true')

    const relatedBody = findAccordionBody(mounted.container, '相关人物')
    expect(relatedBody.classList.contains('yale-sidebar-accordion__item-body--person-balanced')).toBe(true)
    expect(relatedBody.classList.contains('yale-sidebar-accordion__item-body--person-relations')).toBe(true)
  })
})
