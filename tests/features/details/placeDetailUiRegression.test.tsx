/**
 * 地点详情 UI 回归测试
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

vi.mock('@/lib/api/v1Api', () => ({
  searchUnified: vi.fn(),
}))

vi.mock('@/lib/api/services/isbnCoverService', () => ({
  fetchBookCoverByIsbn: vi.fn(),
  normalizeIsbn: vi.fn((value: string) => String(value || '').toUpperCase().replace(/[^0-9X]/g, '').trim()),
}))

function buildPlaceDetail(overrides: Partial<DetailViewModel> = {}): DetailViewModel {
  return {
    uri: '/place/CN510922',
    title: '射洪县',
    summary: '射洪县历史沿革丰富。',
    internalLinks: [],
    externalUris: [
      'https://vocab.getty.edu/tgn/8121321',
      'http://data.library.sh.cn/entity/place/plo54n6wddlrwz2v',
    ],
    doc: {},
    ...overrides,
  }
}

function buildPlaceEntity(): Record<string, unknown> {
  return {
    _label: '射洪县',
    type: 'Place',
    defined_by: 'POINT(105.394871 30.877163)',
    part_of: [
      {
        _label: '四川省',
        id: 'https://api.heluo.site/place/CN510000',
      },
    ],
    attributed_by: [
      { _label: '通泉县', timespan: { _label: '520-553 CE' } },
      { _label: '射洪县', timespan: { _label: '557-1376 CE' } },
      { _label: '射洪县', timespan: { _label: '1380-1911 CE' } },
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

async function flushAsyncTasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('地点详情 UI 回归', () => {
  beforeEach(() => {
    vi.mocked(searchUnified).mockResolvedValue({
      success: true,
      data: {
        query: '射洪县',
        type: 'all',
        mode: 'vector',
        total: 1,
        items: [{ type: 'person', id: '1', title: '杜甫', snippet: '人物', score: 0.9, uri: '/person/dufu.json' }],
      },
    } as never)
    vi.mocked(fetchBookCoverByIsbn).mockResolvedValue('' as never)
  })

  it('应在标题区融合展示上级区域中文链接，隐藏摘要与独立核心信息卡片，外链位于右侧', async () => {
    const data = buildPlaceDetail()
    const entity = buildPlaceEntity()

    const { container, root } = mount(
      <MemoryRouter>
        <OverviewTab
          data={data}
          summary={{ title: data.title, snippet: data.summary }}
          resourceType="place"
          externalUris={data.externalUris}
          internalLinks={data.internalLinks}
          entity={entity}
        />
      </MemoryRouter>,
    )
    await flushAsyncTasks()

    const pageText = container.textContent || ''
    expect(pageText).toContain('射洪县')
    expect(pageText).toContain('上级区域：')
    expect(pageText).toContain('四川省')
    expect(pageText).toContain('历史演变过程')
    expect(pageText).toContain('外部链接')
    expect(pageText).not.toContain('推荐资源')
    expect(pageText).not.toContain('坐标30.877163, 105.394871')
    expect(pageText).not.toContain('射洪县历史沿革丰富。')

    const chart = container.querySelector('.yale-place-history-chart .vis-timeline')
    expect(chart).toBeTruthy()
    const rangeItem = container.querySelector('.yale-place-history-chart .vis-item.vis-range')
    expect(rangeItem).toBeTruthy()

    const parentLink = container.querySelector('.yale-place-detail__entity-parent-link') as HTMLAnchorElement
    expect(parentLink).toBeTruthy()
    expect(parentLink.textContent || '').toContain('四川省')
    expect(parentLink.getAttribute('href') || '').toContain('/details?uri=%2Fplace%2FCN510000')
    expect(container.querySelector('.yale-place-detail__entity-summary')).toBeFalsy()
    expect(pageText).not.toContain('地理核心信息')

    const sidebarExternal = container.querySelector('.yale-overview-tab__sidebar .yale-overview-tab__external-list')
    expect(sidebarExternal).toBeTruthy()

    expect(vi.mocked(searchUnified)).not.toHaveBeenCalled()
    unmount(root, container)
  })
})
