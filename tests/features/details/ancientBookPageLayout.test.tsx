/**
 * AncientBookDetailsPage 页面布局测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AncientBookDetailsPage } from '@/features/details/pages/AncientBookDetailsPage'
import type { DetailPageViewModel } from '@/features/details/hooks/useDetailPageViewModel'

vi.mock('@/features/details/hooks/useDetailPageViewModel', () => ({
  useDetailPageViewModel: vi.fn(),
}))

vi.mock('@/features/details/components/DetailPageContainer', () => ({
  DetailPageContainer: ({ topContent }: { topContent?: JSX.Element }) => (
    <div data-testid="detail-page-container">{topContent}</div>
  ),
}))

vi.mock('@/features/common/IIIFSection', () => ({
  IIIFSection: () => <div>IIIF 区块</div>,
}))

vi.mock('@/features/details/components/AncientBookVolumeTextSection', () => ({
  AncientBookVolumeTextSection: () => <div>正文区块</div>,
}))

vi.mock('@/features/details/components/AncientBookVolumesSection', () => ({
  AncientBookVolumesSection: () => <div>卷册区块</div>,
}))

import { useDetailPageViewModel } from '@/features/details/hooks/useDetailPageViewModel'

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

function buildViewModel(overrides: Partial<DetailPageViewModel> = {}): DetailPageViewModel {
  return {
    uri: '/processed/json-ld/ancient_book/ancient_book_object/volume/17270_303_1.json',
    query: '',
    enrichedLinks: [],
    pageState: 'success',
    data: {
      uri: '/processed/json-ld/ancient_book/ancient_book_object/volume/17270_303_1.json',
      title: '杜诗捃·卷一',
      summary: '',
      internalLinks: [],
      externalUris: ['http://localhost:8083/iiif/manifests/303/manifest.json'],
      doc: {},
      ancientBookHierarchy: [
        { level: 'entry', id: '17270_303', label: '杜诗捃' },
        { level: 'unknown', id: '17270_303_1', label: '杜诗捃·卷一' },
      ],
      ancientBookVolumes: [],
    },
    error: '',
    entitySummary: { title: '杜诗捃·卷一', snippet: '', biography: undefined },
    entity: {},
    externalUris: ['http://localhost:8083/iiif/manifests/303/manifest.json'],
    entityId: '17270_303_1',
    entityType: 'ancient_book',
    enrichedSummary: '',
    internalLinks: [],
    ...overrides,
  } as DetailPageViewModel
}

describe('AncientBookDetailsPage 页面布局', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('所属层级仅重复书名与当前卷名时不应单独展示', () => {
    vi.mocked(useDetailPageViewModel).mockReturnValue(buildViewModel())

    const { container, root } = mount(<AncientBookDetailsPage />)

    expect(container.textContent || '').not.toContain('所属层级')
    unmount(root, container)
  })
})
