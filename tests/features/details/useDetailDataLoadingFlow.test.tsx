/**
 * useDetailData 加载流程回归测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDetailData, type UseDetailDataReturn } from '@/features/details/hooks/useDetailData'
import { fetchDetailByResource } from '@/lib/api/services/detailService'
import { parseJsonLdReadableFields } from '@/lib/parse/data/jsonldParser'
import { parseUriResource } from '@/features/details/utils/uriParser'
import type { DetailViewModel } from '@/types/view/models'

vi.mock('@/lib/api/services/detailService', () => ({
  fetchDetailByResource: vi.fn(),
}))

vi.mock('@/lib/parse/data/jsonldParser', () => ({
  parseJsonLdReadableFields: vi.fn(),
}))

vi.mock('@/features/details/utils/uriParser', () => ({
  parseUriResource: vi.fn(),
}))

interface ProbeProps {
  uri: string
  query?: string
  onUpdate: (state: UseDetailDataReturn) => void
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function Probe({ uri, query = '', onUpdate }: ProbeProps): JSX.Element | null {
  const state = useDetailData(uri, query)

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

async function flushAsyncTasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function buildDetail(): DetailViewModel {
  return {
    uri: '/person/17270',
    title: '杜甫',
    summary: '人物摘要（接口）',
    internalLinks: [],
    externalUris: [],
    doc: {
      _label: '杜甫',
      type: 'Person',
    },
  }
}

describe('useDetailData 加载流程', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(parseUriResource).mockReturnValue({
      type: 'person',
      id: '17270',
    })
  })

  it('应先展示详情基础信息，再异步回填结构化摘要', async () => {
    const detail = buildDetail()
    const deferred = createDeferred<{
      title: string
      snippet: string
      biography?: undefined
    }>()
    vi.mocked(fetchDetailByResource).mockResolvedValue(detail)
    vi.mocked(parseJsonLdReadableFields).mockReturnValueOnce(deferred.promise as never)

    const updates: UseDetailDataReturn[] = []
    const { container, root } = mount(
      <Probe uri="/person/17270" onUpdate={(state) => updates.push(state)} />,
    )

    await flushAsyncTasks()

    const latestBeforeParsed = updates[updates.length - 1]
    expect(latestBeforeParsed?.pageState).toBe('success')
    expect(latestBeforeParsed?.data?.title).toBe('杜甫')
    expect(latestBeforeParsed?.entitySummary.snippet).toBe('人物摘要（接口）')

    deferred.resolve({
      title: '杜甫（结构化）',
      snippet: '人物摘要（结构化）',
    })

    await flushAsyncTasks()

    const latestAfterParsed = updates[updates.length - 1]
    expect(latestAfterParsed?.pageState).toBe('success')
    expect(latestAfterParsed?.entitySummary.title).toBe('杜甫（结构化）')
    expect(latestAfterParsed?.entitySummary.snippet).toBe('人物摘要（结构化）')

    unmount(root, container)
  })

  it('结构化解析失败时不应阻断详情首屏', async () => {
    const detail = buildDetail()
    vi.mocked(fetchDetailByResource).mockResolvedValue(detail)
    vi.mocked(parseJsonLdReadableFields).mockRejectedValueOnce(new Error('解析失败'))

    const updates: UseDetailDataReturn[] = []
    const { container, root } = mount(
      <Probe uri="/person/17270" onUpdate={(state) => updates.push(state)} />,
    )

    await flushAsyncTasks()

    const latest = updates[updates.length - 1]
    expect(latest?.pageState).toBe('success')
    expect(latest?.error).toBeNull()
    expect(latest?.entitySummary.title).toBe('杜甫')
    expect(latest?.entitySummary.snippet).toBe('人物摘要（接口）')

    unmount(root, container)
  })

  it('再次进入同一详情时应先复用上次成功数据，再静默刷新', async () => {
    const detail = buildDetail()
    const firstSummaryDeferred = createDeferred<{
      title: string
      snippet: string
      biography?: undefined
    }>()
    const secondFetchDeferred = createDeferred<DetailViewModel>()

    vi.mocked(fetchDetailByResource)
      .mockResolvedValueOnce(detail)
      .mockReturnValueOnce(secondFetchDeferred.promise)
    vi.mocked(parseJsonLdReadableFields)
      .mockReturnValueOnce(firstSummaryDeferred.promise as never)
      .mockResolvedValueOnce({
        title: '杜甫（结构化-刷新后）',
        snippet: '人物摘要（结构化-刷新后）',
      } as never)

    const firstUpdates: UseDetailDataReturn[] = []
    const firstMounted = mount(
      <Probe uri="/person/17270" onUpdate={(state) => firstUpdates.push(state)} />,
    )

    await flushAsyncTasks()

    firstSummaryDeferred.resolve({
      title: '杜甫（结构化-首屏）',
      snippet: '人物摘要（结构化-首屏）',
    })
    await flushAsyncTasks()

    expect(firstUpdates[firstUpdates.length - 1]?.pageState).toBe('success')
    expect(firstUpdates[firstUpdates.length - 1]?.entitySummary.title).toBe('杜甫（结构化-首屏）')

    unmount(firstMounted.root, firstMounted.container)

    const revisitUpdates: UseDetailDataReturn[] = []
    const secondMounted = mount(
      <Probe uri="/person/17270" onUpdate={(state) => revisitUpdates.push(state)} />,
    )

    await flushAsyncTasks()

    const latestBeforeRefresh = revisitUpdates[revisitUpdates.length - 1]
    expect(latestBeforeRefresh?.pageState).toBe('success')
    expect(latestBeforeRefresh?.entitySummary.title).toBe('杜甫（结构化-首屏）')
    expect(fetchDetailByResource).toHaveBeenCalledTimes(2)

    secondFetchDeferred.resolve(detail)
    await flushAsyncTasks()

    const latestAfterRefresh = revisitUpdates[revisitUpdates.length - 1]
    expect(latestAfterRefresh?.pageState).toBe('success')
    expect(latestAfterRefresh?.entitySummary.title).toBe('杜甫（结构化-刷新后）')

    unmount(secondMounted.root, secondMounted.container)
  })
})
