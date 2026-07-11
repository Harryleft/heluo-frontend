/**
 * 结果页检索模式回归测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResultsPage } from '@/features/results/ResultsPage'
import { searchUnified } from '@/lib/api/v1Api'
import type { UnifiedSearchApiResponse } from '@/types/contracts/apiContracts'

vi.mock('@/lib/api/v1Api', () => ({
  searchUnified: vi.fn(),
}))

function buildSearchSuccessResponse(): UnifiedSearchApiResponse {
  return {
    success: true,
    data: {
      query: '杜甫',
      type: 'poem',
      mode: 'keyword',
      total: 0,
      items: [],
      counts: { poem: 0 },
    },
  }
}

interface MockObserverInstance {
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  unobserve: ReturnType<typeof vi.fn>
  trigger: (target: Element, isIntersecting?: boolean) => void
}

const mockObserverInstances: MockObserverInstance[] = []

function installMockIntersectionObserver(): void {
  class MockIntersectionObserver implements MockObserverInstance {
    observe = vi.fn()
    disconnect = vi.fn()
    unobserve = vi.fn()

    constructor(
      private readonly callback: globalThis.IntersectionObserverCallback,
    ) {
      mockObserverInstances.push(this)
    }

    trigger(target: Element, isIntersecting = true): void {
      const entry = { isIntersecting, target } as globalThis.IntersectionObserverEntry
      this.callback([entry], this as unknown as globalThis.IntersectionObserver)
    }
  }

  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof globalThis.IntersectionObserver
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

function ResultsNavigationHarness(): JSX.Element {
  const navigate = useNavigate()
  return (
    <>
      <button
        type="button"
        data-testid="navigate-results"
        onClick={() => navigate('/results?q=李白&scope=person')}
      >
        切换查询
      </button>
      <ResultsPage />
    </>
  )
}

describe('ResultsPage 检索模式', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockObserverInstances.length = 0
    installMockIntersectionObserver()
    // 显式开启 React act 环境，避免 jsdom 下出现 act 警告噪音
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  })

  it('应固定以 mode=keyword 发起检索', async () => {
    vi.mocked(searchUnified).mockResolvedValueOnce(buildSearchSuccessResponse())

    const { container, root } = mount(
      <MemoryRouter initialEntries={['/results?q=杜甫&scope=poem']}>
        <Routes>
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(searchUnified).toHaveBeenCalledWith('杜甫', 'poem', 'keyword', { page: 1, pageSize: 12 })
    unmount(root, container)
  })

  it('应在触底后自动请求下一页', async () => {
    vi.mocked(searchUnified)
      .mockResolvedValueOnce({
        success: true,
        data: {
          query: '杜甫',
          type: 'poem',
          mode: 'keyword',
          total: 3,
          items: [
            { type: 'poem', id: 'poem_1', title: '诗文一', snippet: '一', score: 1, uri: '/poem/set/poem_1' },
            { type: 'poem', id: 'poem_2', title: '诗文二', snippet: '二', score: 0.9, uri: '/poem/set/poem_2' },
          ],
          counts: { poem: 3 },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          query: '杜甫',
          type: 'poem',
          mode: 'keyword',
          total: 3,
          items: [
            { type: 'poem', id: 'poem_3', title: '诗文三', snippet: '三', score: 0.8, uri: '/poem/set/poem_3' },
          ],
          counts: { poem: 3 },
        },
      })

    const { container, root } = mount(
      <MemoryRouter initialEntries={['/results?q=杜甫&scope=poem']}>
        <Routes>
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await act(async () => {
      await Promise.resolve()
    })

    const sentinel = container.querySelector('[data-testid="results-infinite-sentinel"]')
    expect(sentinel).toBeTruthy()
    expect(mockObserverInstances.length).toBeGreaterThan(0)

    await act(async () => {
      mockObserverInstances[0].trigger(sentinel as Element, true)
      await Promise.resolve()
    })

    expect(searchUnified).toHaveBeenNthCalledWith(2, '杜甫', 'poem', 'keyword', { page: 2, pageSize: 12 })
    expect(container.textContent || '').toContain('诗文三')
    unmount(root, container)
  })

  it('URL 查询条件变化后应同步搜索框与范围选择', async () => {
    vi.mocked(searchUnified).mockResolvedValue(buildSearchSuccessResponse())

    const { container, root } = mount(
      <MemoryRouter initialEntries={['/results?q=杜甫&scope=poem']}>
        <Routes>
          <Route path="/results" element={<ResultsNavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    )

    await act(async () => {
      await Promise.resolve()
    })

    const input = container.querySelector('input[name="q"]') as HTMLInputElement
    const select = container.querySelector('select[name="scope"]') as HTMLSelectElement
    expect(input.value).toBe('杜甫')
    expect(select.value).toBe('poem')

    await act(async () => {
      const button = container.querySelector('[data-testid="navigate-results"]') as HTMLButtonElement
      button.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(searchUnified).toHaveBeenLastCalledWith('李白', 'person', 'keyword', { page: 1, pageSize: 12 })
    const updatedInput = container.querySelector('input[name="q"]') as HTMLInputElement
    const updatedSelect = container.querySelector('select[name="scope"]') as HTMLSelectElement
    expect(updatedInput.value).toBe('李白')
    expect(updatedSelect.value).toBe('person')
    unmount(root, container)
  })
})
