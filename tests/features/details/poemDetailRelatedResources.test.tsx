/**
 * 详情页推荐资源回归测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OverviewTab } from '@/features/details/OverviewTab'
import { searchUnified } from '@/lib/api/v1Api'
import type { DetailViewModel, InternalLinkViewModel } from '@/types/view/models'

vi.mock('@/lib/api/v1Api', () => ({
  searchUnified: vi.fn(),
}))

function buildPoemLinks(): InternalLinkViewModel[] {
  return [
    { label: '相关作品：春望', uri: '/poem/set/chunwang.json' },
    { label: '相关诗文：登高', uri: '/poem/set/denggao.json' },
    { label: '相关作品：茅屋为秋风所破歌', uri: '/poem/set/maowu.json' },
    { label: '相关作品：蜀相', uri: '/poem/set/shuxiang.json' },
    { label: '相关人物：杜甫', uri: '/person/dufu.json' },
    { label: '相关作品：春望', uri: '/poem/set/chunwang.json' },
  ]
}

function buildPoemDetail(overrides: Partial<DetailViewModel> = {}): DetailViewModel {
  return {
    uri: '/poem/set/chunwang.json',
    title: '春望',
    summary: '测试摘要',
    internalLinks: buildPoemLinks(),
    externalUris: ['https://example.com/external-resource'],
    doc: {},
    ...overrides,
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

describe('详情页推荐资源回归', () => {
  beforeEach(() => {
    vi.mocked(searchUnified).mockResolvedValue({
      success: true,
      data: {
        query: '春望 测试摘要',
        type: 'all',
        mode: 'vector',
        total: 6,
        items: [
          { type: 'poem', id: '1', title: '春望', snippet: '诗文', score: 0.99, uri: '/poem/set/chunwang.json' },
          { type: 'person', id: '2', title: '杜甫', snippet: '人物', score: 0.96, uri: '/person/dufu.json' },
          { type: 'book', id: '3', title: '杜甫诗选', snippet: '图书', score: 0.93, uri: '/book/dufu-shixuan.json' },
          { type: 'ancient_book', id: '4', title: '白孔六帖', snippet: '古籍', score: 0.91, uri: '/ancient_book/baikong.json' },
          { type: 'place', id: '5', title: '夔州', snippet: '地点', score: 0.88, uri: '/place/kuizhou.json' },
          { type: 'concept', id: '6', title: '忧国', snippet: '概念', score: 0.86, uri: '/concept/youguo.json' },
        ],
      },
    } as never)
  })

  it('应展示“推荐资源”并按向量结果渲染 3-5 条跨类型链接', async () => {
    const data = buildPoemDetail()

    const { container, root } = mount(
      <MemoryRouter>
        <OverviewTab
          data={data}
          summary={{ title: data.title, snippet: data.summary }}
          resourceType="poem"
          externalUris={data.externalUris}
          internalLinks={data.internalLinks}
          entity={{ _label: data.title, type: 'LinguisticObject' }}
        />
      </MemoryRouter>,
    )
    await flushAsyncTasks()

    const links = Array.from(container.querySelectorAll('a.yale-overview-tab__relation-link')) as globalThis.HTMLAnchorElement[]
    expect(links).toHaveLength(5)
    expect(links.map((link) => (link.textContent || '').trim())).toEqual([
      '杜甫',
      '杜甫诗选',
      '白孔六帖',
      '夔州',
      '忧国',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `/details?uri=${encodeURIComponent('/person/dufu.json')}`,
      `/details?uri=${encodeURIComponent('/book/dufu-shixuan.json')}`,
      `/details?uri=${encodeURIComponent('/ancient_book/baikong.json')}`,
      `/details?uri=${encodeURIComponent('/place/kuizhou.json')}`,
      `/details?uri=${encodeURIComponent('/concept/youguo.json')}`,
    ])

    const pageText = container.textContent || ''
    expect(pageText).toContain('推荐资源')
    expect(pageText).not.toContain('外部链接')
    expect(pageText).not.toContain('正在进行向量匹配')
    expect(vi.mocked(searchUnified)).toHaveBeenCalledTimes(1)

    unmount(root, container)
  })
})
