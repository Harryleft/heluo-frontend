/**
 * 图书详情 UI 回归测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OverviewTab } from '@/features/details/OverviewTab'
import { fetchBookCoverByIsbn } from '@/lib/api/services/isbnCoverService'
import { searchUnified } from '@/lib/api/v1Api'
import type { DetailViewModel } from '@/types/view/models'

const SUMMARY_TEXT = '这是重复摘要文本。'

vi.mock('@/lib/api/v1Api', () => ({
  searchUnified: vi.fn(),
}))

vi.mock('@/lib/api/services/isbnCoverService', () => ({
  fetchBookCoverByIsbn: vi.fn(),
  normalizeIsbn: vi.fn((value: string) => String(value || '').toUpperCase().replace(/[^0-9X]/g, '').trim()),
}))

function buildBookDetail(overrides: Partial<DetailViewModel> = {}): DetailViewModel {
  return {
    uri: '/processed/json-ld/book/978-7-5470-5738-4.json',
    title: '杜甫诗选',
    summary: SUMMARY_TEXT,
    internalLinks: [],
    externalUris: ['https://example.org/external/a'],
    doc: {},
    ...overrides,
  }
}

function buildBookEntity(): Record<string, unknown> {
  return {
    _label: '杜甫诗选',
    type: 'HumanMadeObject',
    identified_by: [
      { content: '杜甫诗选', classified_as: [{ _label: 'Primary Name' }] },
      { content: '978-7-5470-5738-4', classified_as: [{ _label: 'ISBN' }] },
      { content: 'K825.6', classified_as: [{ _label: '索书号' }] },
    ],
    created_by: { carried_out_by: [{ _label: '邓魁英' }] },
    produced_by: {
      carried_out_by: [{ _label: '南海出版社' }],
      timespan: { _label: '2010年' },
      took_place_at: [{ _label: '海口' }],
    },
    current_location: [
      {
        _label: '上海图书馆',
        defined_by: 'POINT(121.4737 31.2304)',
      },
    ],
    dimension: [
      { classified_as: [{ _label: '页数' }], value: 287, unit: { _label: 'pages' } },
      {
        type: 'MonetaryAmount',
        value: 38.0,
        currency: { _label: 'Chinese Yuan' },
      },
    ],
    referred_to_by: [
      { content: SUMMARY_TEXT },
      { content: '这是补充介绍文本，用于展示图书背景。' },
    ],
  }
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

function countOccurrences(source: string, target: string): number {
  if (!target) return 0
  return source.split(target).length - 1
}

async function flushAsyncTasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('图书详情 UI 回归', () => {
  beforeEach(() => {
    vi.mocked(searchUnified).mockResolvedValue({
      success: true,
      data: {
        query: '杜甫诗选',
        type: 'all',
        mode: 'vector',
        total: 4,
        items: [
          { type: 'person', id: '1', title: '杜甫', snippet: '人物', score: 0.95, uri: '/person/dufu.json' },
          { type: 'book', id: '2', title: '杜甫年谱', snippet: '图书', score: 0.93, uri: '/book/nianpu.json' },
          { type: 'poem', id: '3', title: '登高', snippet: '诗文', score: 0.91, uri: '/poem/set/denggao.json' },
          { type: 'ancient_book', id: '4', title: '全唐诗', snippet: '古籍', score: 0.89, uri: '/ancient_book/quantangshi.json' },
        ],
      },
    } as never)
    vi.mocked(fetchBookCoverByIsbn).mockResolvedValue('https://books.google.com/mock-cover.jpg' as never)
  })

  it('应隐藏外部链接并按新结构展示图书字段，避免摘要重复', async () => {
    const data = buildBookDetail()
    const entity = buildBookEntity()

    const { container, root } = mount(
      <MemoryRouter>
        <OverviewTab
          data={data}
          summary={{ title: data.title, snippet: data.summary }}
          resourceType="book"
          externalUris={data.externalUris}
          internalLinks={data.internalLinks}
          entity={entity}
        />
      </MemoryRouter>,
    )
    await flushAsyncTasks()

    const pageText = container.textContent || ''
    expect(pageText).toContain('基本信息')
    expect(pageText).not.toContain('内容尺寸')
    expect(pageText).toContain('内容介绍')
    expect(pageText).toContain('馆藏地址')
    expect(pageText).toContain('287 页')
    expect(pageText).toContain('金额')
    expect(pageText).toContain('38 元')
    expect(pageText).toContain('这是补充介绍文本，用于展示图书背景。')
    expect(countOccurrences(pageText, SUMMARY_TEXT)).toBe(1)
    expect(pageText).not.toContain('外部链接')
    expect(pageText).toContain('图书封面')
    expect(pageText).toContain('推荐资源')
    expect(pageText).not.toContain('馆藏位置')
    expect(container.querySelector('.entity-metadata__table')).toBeNull()

    const fieldItems = Array.from(container.querySelectorAll('.yale-overview-tab__type-item'))
    const isbnItem = fieldItems.find((item) => {
      const label = item.querySelector('.yale-overview-tab__type-label')?.textContent || ''
      return label.trim() === 'ISBN'
    })
    const isbnText = isbnItem?.querySelector('.yale-overview-tab__type-value')?.textContent || ''
    expect(isbnText).toBe('978-7-5470-5738-4')

    const callNumberItem = fieldItems.find((item) => {
      const label = item.querySelector('.yale-overview-tab__type-label')?.textContent || ''
      return label.trim() === '馆藏检索号'
    })
    const callNumberText = callNumberItem?.querySelector('.yale-overview-tab__type-value')?.textContent || ''
    expect(callNumberText).toBe('K825.6')
    expect(pageText).not.toContain('编号978-7-5470-5738-4；K825.6')
    expect(pageText).not.toContain('杜甫诗选；978-7-5470-5738-4；K825.6')

    const mapCanvas = container.querySelector('.yale-overview-tab__map-canvas') as HTMLDivElement
    expect(mapCanvas).toBeTruthy()
    const mapStatus = container.querySelector('.yale-overview-tab__map-status') as globalThis.HTMLParagraphElement
    expect(mapStatus).toBeTruthy()
    expect(mapStatus.textContent || '').toMatch(/正在加载地图|地图加载失败/)
    expect(pageText).not.toContain('上海图书馆（31.2304, 121.4737）')
    expect(vi.mocked(searchUnified)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetchBookCoverByIsbn)).toHaveBeenCalledWith('9787547057384', '杜甫诗选')

    const coverImage = container.querySelector('.yale-overview-tab__book-cover-image') as HTMLImageElement
    expect(coverImage).toBeTruthy()
    expect(coverImage.src).toContain('https://books.google.com/mock-cover.jpg')

    unmount(root, container)
  })
})
