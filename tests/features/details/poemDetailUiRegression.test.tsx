/**
 * 诗文详情 UI 回归测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OverviewTab } from '@/features/details/OverviewTab'
import { searchUnified } from '@/lib/api/v1Api'
import type { DetailViewModel } from '@/types/view/models'

const SUMMARY_TEXT = '这是用于检测重复展示的摘要文本。'

vi.mock('@/lib/api/v1Api', () => ({
  searchUnified: vi.fn(),
}))

function buildPoemDetail(overrides: Partial<DetailViewModel> = {}): DetailViewModel {
  return {
    uri: '/poem/set/17270_2263.json',
    title: '赠苏四徯',
    summary: SUMMARY_TEXT,
    internalLinks: [],
    externalUris: [],
    doc: {},
    poemDetail: {
      title: '赠苏四徯',
      author: '杜甫',
      authorId: '17270',
      genre: '绝句-五绝',
      genreUri: 'http://localhost:8003/concept/wujue',
      rhyme: '七虞',
      rhymeUri: 'http://localhost:8003/concept/rhyme/pingshui/yu2-p',
      fullText: '异县逢冬至，回头忆故人。',
      relatedPlaces: [
        {
          label: '奉节县',
          uri: 'http://localhost:8003/place/CN500236',
        },
      ],
    },
    ...overrides,
  }
}

function buildPoemEntity(): Record<string, unknown> {
  return {
    _label: '赠苏四徯',
    type: 'Set',
    created_by: {
      type: 'Creation',
      carried_out_by: [
        {
          id: '/details?uri=%2Fperson%2F17270',
          _label: '杜甫',
        },
      ],
    },
    took_place_at: [
      {
        id: 'http://localhost:8003/place/CN500236',
        type: 'Place',
        _label: '奉节县',
      },
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

describe('诗文详情 UI 回归', () => {
  beforeEach(() => {
    vi.mocked(searchUnified).mockResolvedValue({
      success: true,
      data: {
        query: '赠苏四徯',
        type: 'all',
        mode: 'vector',
        total: 0,
        items: [],
      },
    } as never)
  })

  it('应移除重复摘要和 JSON-LD 元信息卡片，并展示诗文基础信息与地理地图容器', async () => {
    const data = buildPoemDetail()
    const entity = buildPoemEntity()

    const { container, root } = mount(
      <MemoryRouter>
        <OverviewTab
          data={data}
          summary={{ title: data.title, snippet: data.summary }}
          resourceType="poem"
          externalUris={data.externalUris}
          internalLinks={data.internalLinks}
          entity={entity}
        />
      </MemoryRouter>,
    )
    await flushAsyncTasks()

    const pageText = container.textContent || ''
    expect(pageText).not.toContain(SUMMARY_TEXT)
    expect(container.querySelector('.poem-detail-card__metadata')).toBeNull()
    expect(container.querySelector('.poem-detail-card__map-canvas')).toBeTruthy()
    expect(pageText).toContain('奉节县')
    expect(pageText).toContain('作者')

    const links = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[]
    const authorLink = links.find((item) => (item.textContent || '').trim() === '杜甫')
    expect(authorLink).toBeTruthy()
    expect(authorLink?.getAttribute('href')).toBe('/details?uri=%2Fperson%2F17270')

    unmount(root, container)
  })

  it('应将体裁和韵目渲染为可点击详情链接', async () => {
    const data = buildPoemDetail()
    const entity = buildPoemEntity()

    const { container, root } = mount(
      <MemoryRouter>
        <OverviewTab
          data={data}
          summary={{ title: data.title, snippet: data.summary }}
          resourceType="poem"
          externalUris={data.externalUris}
          internalLinks={data.internalLinks}
          entity={entity}
        />
      </MemoryRouter>,
    )
    await flushAsyncTasks()

    const links = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[]
    const genreLink = links.find((item) => (item.textContent || '').trim() === '绝句-五绝')
    const rhymeLink = links.find((item) => (item.textContent || '').trim() === '七虞')

    expect(genreLink).toBeTruthy()
    expect(genreLink?.getAttribute('href')).toBe('/details?uri=http%3A%2F%2Flocalhost%3A8003%2Fconcept%2Fwujue')
    expect(rhymeLink).toBeTruthy()
    expect(rhymeLink?.getAttribute('href')).toBe('/details?uri=http%3A%2F%2Flocalhost%3A8003%2Fconcept%2Frhyme%2Fpingshui%2Fyu2-p')

    unmount(root, container)
  })
})
