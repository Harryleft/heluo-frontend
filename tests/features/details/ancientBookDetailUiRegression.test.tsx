/**
 * 古籍详情 UI 回归测试
 * @vitest-environment jsdom
 */

import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IIIFSection } from '@/features/common/IIIFSection'
import { AncientBookFieldPanel } from '@/features/details/components/entity-fields/AncientBookFieldPanel'
import { AncientBookVolumeTextSection } from '@/features/details/components/AncientBookVolumeTextSection'
import { OverviewTab } from '@/features/details/OverviewTab'
import { IiifPage } from '@/features/iiif/IiifPage'
import { searchUnified } from '@/lib/api/v1Api'
import type { DetailViewModel } from '@/types/view/models'
import * as overviewTabDataHooks from '@/features/details/hooks/useOverviewTabData'

const SAMPLE_MANIFEST = 'http://localhost:8083/iiif/manifests/303/manifest.json'
const SAMPLE_VOLUME_HEADS = [
  {
    volumeLabel: '卷一',
    canvasId: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p2',
    canvasLabel: '第2页 (卷一-1a)',
    pageIndex: 2,
  },
  {
    volumeLabel: '卷二',
    canvasId: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p4',
    canvasLabel: '第4页 (卷二-1a)',
    pageIndex: 4,
  },
]

vi.mock('@/lib/api/v1Api', () => ({
  searchUnified: vi.fn(),
}))

vi.mock('@/features/details/hooks/useOverviewTabData', async () => {
  const actual = await vi.importActual<typeof overviewTabDataHooks>('@/features/details/hooks/useOverviewTabData')
  return {
    ...actual,
    useBookCover: vi.fn(() => ''),
  }
})

function buildAncientBookDetail(overrides: Partial<DetailViewModel> = {}): DetailViewModel {
  return {
    uri: '/processed/entities/ancient_book/ancient_book_object/volume/17270_303_1.json',
    title: '古籍测试条目',
    summary: '测试摘要',
    internalLinks: [],
    externalUris: [SAMPLE_MANIFEST],
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

describe('古籍详情 UI 回归', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const href = String(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url || '')
        if (href.includes('/api/v1/iiif/volume-heads')) {
          return {
            ok: true,
            async json() {
              return {
                success: true,
                data: {
                  manifest: SAMPLE_MANIFEST,
                  volumeHeads: SAMPLE_VOLUME_HEADS,
                },
              }
            },
          }
        }
        throw new Error(`unexpected fetch: ${href}`)
      }),
    )
    vi.mocked(searchUnified).mockResolvedValue({
      success: true,
      data: {
        query: '古籍测试条目',
        type: 'all',
        mode: 'vector',
        total: 3,
        items: [
          { type: 'book', id: '1', title: '四库全书总目', snippet: '图书', score: 0.9, uri: '/book/siku.json' },
          { type: 'person', id: '2', title: '纪昀', snippet: '人物', score: 0.87, uri: '/person/jiyun.json' },
          { type: 'poem', id: '3', title: '咏史', snippet: '诗文', score: 0.84, uri: '/poem/set/yongshi.json' },
        ],
      },
    } as never)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('古籍外部链接应显示 IIIF manifest 业务标注，且展示推荐资源', async () => {
    const data = buildAncientBookDetail()

    const { container, root } = mount(
      <MemoryRouter>
        <OverviewTab
          data={data}
          summary={{ title: data.title, snippet: data.summary }}
          resourceType="ancient_book"
          externalUris={data.externalUris}
          internalLinks={data.internalLinks}
          entity={{ _label: data.title, type: 'Set' }}
        />
      </MemoryRouter>,
    )
    await flushAsyncTasks()

    expect(container.textContent || '').toContain('IIIF Manifest（古籍影像）')
    expect(container.textContent || '').toContain('推荐资源')
    expect(container.textContent || '').not.toContain('暂无推荐资源')
    unmount(root, container)
  })

  it('古籍概览应隐藏摘要与类型，仅保留创作者和时间等核心信息', async () => {
    const data = buildAncientBookDetail({
      title: '杜诗捃·卷一',
      summary: '这段摘要不应该继续显示在古籍详情中。',
    })

    const { container, root } = mount(
      <MemoryRouter>
        <OverviewTab
          data={data}
          summary={{ title: data.title, snippet: data.summary }}
          resourceType="ancient_book"
          externalUris={data.externalUris}
          internalLinks={data.internalLinks}
          entity={{
            _label: data.title,
            type: 'HumanMadeObject',
            created_by: {
              carried_out_by: [{ _label: '唐元竑' }],
              timespan: { _label: '明' },
            },
          }}
          mainContent={(
            <AncientBookFieldPanel
              entity={{
                _label: data.title,
                type: 'HumanMadeObject',
                created_by: {
                  carried_out_by: [{ _label: '唐元竑' }],
                  timespan: { _label: '明' },
                },
              }}
              digitalResourceCount={data.externalUris.length}
            />
          )}
        />
      </MemoryRouter>,
    )
    await flushAsyncTasks()

    expect(container.textContent || '').toContain('创作者')
    expect(container.textContent || '').toContain('唐元竑')
    expect(container.textContent || '').toContain('时间')
    expect(container.textContent || '').toContain('明')
    expect(container.textContent || '').not.toContain('这段摘要不应该继续显示在古籍详情中。')
    expect(container.textContent || '').not.toContain('古籍核心字段')
    expect(container.textContent || '').not.toContain('实体类型')
    expect(container.textContent || '').not.toContain('HumanMadeObject')
    unmount(root, container)
  })

  it('古籍详情内嵌 Mirador iframe 应声明全屏权限', () => {
    const { container, root } = mount(<IIIFSection manifests={[SAMPLE_MANIFEST]} embedded autoLoadEmbedded />)

    const iframe = container.querySelector('iframe[title="Mirador 图像查看器"]') as globalThis.HTMLIFrameElement
    expect(iframe).toBeTruthy()
    expect(iframe.hasAttribute('allowfullscreen')).toBe(true)
    expect(String(iframe.getAttribute('allow') || '')).toContain('fullscreen')
    unmount(root, container)
  })

  it('古籍详情内嵌 Mirador iframe 默认高度应接近占满视窗', () => {
    const { container, root } = mount(<IIIFSection manifests={[SAMPLE_MANIFEST]} embedded autoLoadEmbedded />)

    const iframe = container.querySelector('iframe[title="Mirador 图像查看器"]') as globalThis.HTMLIFrameElement
    expect(iframe).toBeTruthy()
    expect(String(iframe.style.height || '')).toBe('calc(100vh - 96px)')
    unmount(root, container)
  })

  it('按卷定位应渲染卷次按钮并在点击后跳转到对应 canvas', async () => {
    const { container, root } = mount(
      <IIIFSection manifests={[SAMPLE_MANIFEST]} embedded autoLoadEmbedded showVolumeHeadNavigator />,
    )
    await flushAsyncTasks()

    const navLabel = Array.from(container.querySelectorAll('div')).find((node) => node.textContent === '按卷定位')
    const iframe = container.querySelector('iframe[title="Mirador 图像查看器"]') as globalThis.HTMLIFrameElement
    const volumeOneButton = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes('卷一'))
    const volumeTwoButton = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes('卷二'))

    expect(navLabel).toBeTruthy()
    expect(volumeOneButton).toBeTruthy()
    expect(volumeTwoButton).toBeTruthy()
    expect(iframe).toBeTruthy()
    expect(iframe.compareDocumentPosition(navLabel as Node) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()

    act(() => {
      volumeTwoButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const parsed = new URL(String(iframe.getAttribute('src') || ''))
    expect(parsed.searchParams.get('canvas')).toBe(SAMPLE_VOLUME_HEADS[1].canvasId)
    unmount(root, container)
  })

  it('IIIF 独立页面 iframe 应声明全屏权限', () => {
    const { container, root } = mount(
      <MemoryRouter initialEntries={[`/iiif?manifest=${encodeURIComponent(SAMPLE_MANIFEST)}`]}>
        <IiifPage />
      </MemoryRouter>,
    )

    const iframe = container.querySelector('iframe[title="Mirador IIIF Viewer"]') as globalThis.HTMLIFrameElement
    expect(iframe).toBeTruthy()
    expect(iframe.hasAttribute('allowfullscreen')).toBe(true)
    expect(String(iframe.getAttribute('allow') || '')).toContain('fullscreen')
    expect(container.textContent || '').not.toContain('Mirador 查看器')
    expect(container.textContent || '').not.toContain('当前页面直接加载项目内 Mirador')
    expect(container.textContent || '').not.toContain('新窗口打开 Mirador')
    unmount(root, container)
  })

  it('Mirador 内嵌路由应裸载查看器，不再套详情页容器', () => {
    const { container, root } = mount(
      <MemoryRouter initialEntries={[`/mirador?manifest=${encodeURIComponent(SAMPLE_MANIFEST)}`]}>
        <IiifPage />
      </MemoryRouter>,
    )

    const main = container.querySelector('main') as globalThis.HTMLElement
    expect(main).toBeTruthy()
    expect(main.style.height).toBe('100vh')
    expect(main.style.background).toBe('rgb(255, 255, 255)')
    expect(container.querySelector('.container')).toBeFalsy()
    expect(container.querySelector('.panel')).toBeFalsy()
    expect(container.querySelector('iframe[title="Mirador IIIF Viewer"]')).toBeFalsy()
    unmount(root, container)
  })

  it('古籍缺少卷文本时不应显示缺省提示文案', () => {
    const { container, root } = mount(
      <AncientBookVolumeTextSection
        label="卷一"
        status="missing"
        message="当前卷暂无可解析文本内容：本地未命中卷文本或 IIIF manifests/OCR 数据。请先同步本地 manifests 数据，或使用 IIIF 查看影像。"
      />,
    )

    expect(container.textContent || '').not.toContain('当前卷暂无可解析文本内容')
    expect(container.textContent || '').not.toContain('请先同步本地 manifests 数据')
    unmount(root, container)
  })

})
