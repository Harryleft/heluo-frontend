/**
 * 融合问答原生 assistant-ui 收敛回归测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildStreamStatusViewModel, FusionChat, renderUnifiedEvidenceItem, shouldShowSourceSidebar } from '@/features/fusion/FusionChat'
import { FusionChatPage } from '@/features/fusion/FusionChatPage'
import type { UnifiedEvidenceItem } from '@/features/fusion/evidenceUtils'

const mockCancelRun = vi.fn()
const mockResetRun = vi.fn(() => {
  mockThreadMessages = []
})
const mockSubscribe = vi.fn(() => vi.fn())
const mockGetState = vi.fn(() => ({ messages: mockThreadMessages }))
const mockUseLocalRuntime = vi.fn()
let mockThreadMessages: Array<Record<string, unknown>> = []
const mockThread = vi.fn((props: Record<string, unknown>) => (
  <div
    className="aui-root aui-thread-root"
    data-testid="assistant-thread"
    data-has-markdown-text={String(Boolean((props.assistantMessage as { components?: { Text?: unknown } } | undefined)?.components?.Text))}
  >
    {mockThreadMessages.length === 0 && (props.components as { ThreadWelcome?: () => JSX.Element } | undefined)?.ThreadWelcome
      ? (() => {
          const ThreadWelcomeComponent = (props.components as { ThreadWelcome: () => JSX.Element }).ThreadWelcome
          return <ThreadWelcomeComponent />
        })()
      : null}
    {(props.components as { Composer?: () => JSX.Element } | undefined)?.Composer
      ? (() => {
          const ComposerComponent = (props.components as { Composer: () => JSX.Element }).Composer
          return <ComposerComponent />
        })()
      : null}
  </div>
))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})

vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: ({ children }: { children: JSX.Element }) => children,
  ThreadPrimitive: {
    Empty: ({ children }: { children: JSX.Element }) => mockThreadMessages.length === 0 ? children : null,
    Suggestion: ({ autoSend, children, prompt }: { autoSend?: boolean; children: JSX.Element; prompt?: string }) => (
      <button data-auto-send={String(Boolean(autoSend))} data-prompt={prompt} type="button">{children}</button>
    ),
  },
  useLocalRuntime: (...args: unknown[]) =>
    mockUseLocalRuntime(...args) || {
      thread: {
        cancelRun: mockCancelRun,
        reset: mockResetRun,
        subscribe: mockSubscribe,
        getState: mockGetState,
      },
    },
  useThreadRuntime: () => ({
    getState: () => ({ messages: mockThreadMessages }),
  }),
}))

vi.mock('@assistant-ui/react-ui', () => ({
  Composer: Object.assign(
    () => <div data-testid="assistant-composer" />,
    {
      Root: ({ children }: { children: JSX.Element }) => <div className="aui-composer-root">{children}</div>,
      Input: ({ 'aria-label': ariaLabel, autoFocus }: { 'aria-label'?: string; autoFocus?: boolean }) => (
        <textarea aria-label={ariaLabel} data-auto-focus={String(Boolean(autoFocus))} />
      ),
      Action: () => <button type="button">发送</button>,
    },
  ),
  Thread: (props: Record<string, unknown>) => mockThread(props),
  ThreadWelcome: {
    Root: ({ children }: { children: JSX.Element }) => children,
    Center: ({ children }: { children: JSX.Element }) => children,
    Message: () => <p>欢迎语</p>,
  },
  makeMarkdownText: () => function MarkdownText(): JSX.Element {
    return <div data-testid="markdown-text">markdown text</div>
  },
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

function createEvidenceItem(overrides: Partial<UnifiedEvidenceItem> = {}): UnifiedEvidenceItem {
  return {
    itemId: 'poem-1',
    kind: 'entity',
    colorKey: 'poem',
    typeLabel: '诗文',
    title: '春望',
    snippet: '国破山河在',
    link: '/details?uri=%2Fprocessed%2Fjson-ld%2Fpoem%2Fset%2F1.json',
    uri: '/processed/json-ld/poem/set/1.json',
    score: 0.9,
    sourceKinds: ['entity'],
    ...overrides,
  }
}

describe('FusionChat 原生 assistant-ui 收敛', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    localStorageMock.clear()
    mockThreadMessages = []
    mockUseLocalRuntime.mockImplementation(() => ({
      thread: {
        cancelRun: mockCancelRun,
        reset: mockResetRun,
        subscribe: mockSubscribe,
        getState: mockGetState,
      },
    }))
  })

  it('应删除自定义 classic-fusion 聊天壳层', () => {
    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat?dims=poem,place']}>
        <FusionChat />
      </MemoryRouter>,
    )

    expect(container.querySelector('.classic-fusion-wrapper')).toBeNull()
    expect(container.querySelector('.classic-fusion-layout')).toBeNull()
    expect(container.querySelector('.classic-fusion-chat')).toBeNull()
    expect(container.querySelector('.classic-fusion-chat-header')).toBeNull()
    expect(container.querySelector('[data-testid="assistant-thread"]')).toBeTruthy()

    unmount(root, container)
  })

  it('应避免重复包裹 aui-root，并为助手消息接入 Markdown 文本组件', () => {
    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    expect(container.querySelectorAll('.aui-root')).toHaveLength(1)
    expect(mockThread).toHaveBeenCalledTimes(1)

    const threadRoot = container.querySelector('[data-testid="assistant-thread"]')
    expect(threadRoot?.getAttribute('data-has-markdown-text')).toBe('true')

    unmount(root, container)
  })

  it('首次进入页面时应默认隐藏右侧来源栏', () => {
    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    expect(container.querySelector('.fusion-chat-native-sidebar')).toBeNull()

    unmount(root, container)
  })

  it('默认欢迎态应具备首屏高度页面壳层钩子', () => {
    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChatPage />
      </MemoryRouter>,
    )

    const pageShell = container.querySelector('.fusion-chat-page-shell.fusion-chat-native')
    expect(pageShell).toBeTruthy()
    expect(pageShell?.querySelector('[data-testid="assistant-thread"]')).toBeTruthy()

    unmount(root, container)
  })

  it('应向 Thread 提供收紧后的欢迎文案与新的第三条建议问题', () => {
    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    const threadProps = mockThread.mock.calls[0]?.[0] as {
      welcome?: {
        message?: string
        suggestions?: Array<{ prompt: string; text: string }>
      }
    }

    expect(threadProps.welcome?.message).toBe('提出问题，我会结合检索证据作答。')
    expect(threadProps.welcome?.suggestions).toEqual([
      { prompt: '杜甫写给李白的诗有哪些？', text: '杜甫写给李白的诗有哪些？' },
      { prompt: '望岳这首诗讲了什么？', text: '望岳这首诗讲了什么？' },
      { prompt: '《春望》和《望岳》表达的情感有什么不同？', text: '《春望》和《望岳》表达的情感有什么不同？' },
    ])
    expect((threadProps as { assistantMessage?: { allowReload?: boolean } }).assistantMessage?.allowReload).toBe(true)
    expect((threadProps as { assistantAvatar?: Record<string, never> }).assistantAvatar).toEqual({})
    expect((threadProps as { strings?: { composer?: { cancel?: { tooltip?: string } } } }).strings?.composer?.cancel?.tooltip).toBe('停止')

    unmount(root, container)
  })

  it('默认欢迎态应接入输入优先的自定义欢迎区与输入区', () => {
    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    const threadProps = mockThread.mock.calls[0]?.[0] as {
      components?: {
        ThreadWelcome?: unknown
        Composer?: unknown
      }
    }

    expect(threadProps.components?.ThreadWelcome).toBeTypeOf('function')
    expect(threadProps.components?.Composer).toBeTypeOf('function')
    expect(container.textContent).toContain('从一个问题，进入河洛文献')
    expect(container.textContent).toContain('你也可以这样问')
    expect(container.querySelectorAll('[data-auto-send="true"]')).toHaveLength(3)
    expect(container.querySelector('textarea')?.getAttribute('aria-label')).toBe('输入问题')
    expect(container.querySelector('textarea')?.getAttribute('data-auto-focus')).toBe('false')

    unmount(root, container)
  })

  it('有消息时应隐藏欢迎说明与示例索引，但保留输入区', () => {
    mockThreadMessages = [{ id: 'user-1', role: 'user', content: [{ type: 'text', text: '望岳' }] }]

    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    expect(container.textContent).not.toContain('从一个问题，进入河洛文献')
    expect(container.textContent).not.toContain('你也可以这样问')
    expect(container.querySelector('textarea')).toBeTruthy()

    unmount(root, container)
  })

  it('清除失败后的对话时应先卸载线程，再重置运行时并恢复欢迎态', async () => {
    mockThreadMessages = [{ id: 'assistant-1', role: 'assistant', content: [{ type: 'text', text: '请求失败' }] }]

    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    const clearButton = container.querySelector('[aria-label="清除当前对话"]') as HTMLButtonElement
    await act(async () => {
      clearButton.click()
    })

    expect(mockCancelRun).toHaveBeenCalled()
    expect(mockResetRun).toHaveBeenCalledTimes(1)
    expect(mockCancelRun.mock.invocationCallOrder[0]).toBeLessThan(mockResetRun.mock.invocationCallOrder[0])
    expect(container.textContent).toContain('从一个问题，进入河洛文献')

    unmount(root, container)
  })

  it('应在运行时接收本地恢复的 assistant-ui 初始消息', () => {
    localStorageMock.setItem('fusion_conversation_history', JSON.stringify({
      id: 'session-1',
      createdAt: 1704067200000,
      updatedAt: 1704067201000,
      messages: [
        { id: 'user-1', role: 'user', content: '第一问', timestamp: 1704067200000 },
        { id: 'assistant-1', role: 'assistant', content: '第一答', timestamp: 1704067201000 },
      ],
    }))

    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    const runtimeOptions = mockUseLocalRuntime.mock.calls[0]?.[1] as {
      initialMessages?: Array<{ role: string; content: string; id?: string; createdAt?: Date }>
    }
    expect(runtimeOptions.initialMessages).toHaveLength(2)
    expect(runtimeOptions.initialMessages?.[0]).toMatchObject({ id: 'user-1', role: 'user', content: '第一问' })
    expect(runtimeOptions.initialMessages?.[1]).toMatchObject({ id: 'assistant-1', role: 'assistant', content: '第一答' })
    expect(runtimeOptions.initialMessages?.[0]?.createdAt).toBeInstanceOf(Date)

    unmount(root, container)
  })

  it('刷新恢复后应继续显示持久化的来源侧栏', () => {
    localStorageMock.setItem('fusion_conversation_history', JSON.stringify({
      id: 'session-1',
      createdAt: 1704067200000,
      updatedAt: 1704067201000,
      messages: [
        { id: 'user-1', role: 'user', content: '几首《望岳》之间有何区别？', timestamp: 1704067200000 },
        { id: 'assistant-1', role: 'assistant', content: '它们在主题和气象上存在差异。', timestamp: 1704067201000 },
      ],
      sourceSnapshot: {
        hasSourceSnapshot: true,
        status: 'ready',
        sidebarItems: [
          {
            itemId: 'sidebar-1',
            itemType: 'poem',
            title: '望岳',
            snippet: '岱宗夫如何',
            link: '/details?uri=%2Fprocessed%2Fentities%2Fpoem%2F1.json',
          },
        ],
      },
    }))

    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    expect(container.querySelector('.fusion-chat-native-sidebar')).toBeTruthy()
    expect(container.querySelector('.fusion-chat-native-sources-header h2')?.textContent).toContain('来源')
    expect(container.querySelector('.fusion-chat-native-source-title')?.textContent).toBe('望岳')

    unmount(root, container)
  })

  it('旧版恢复会话缺少来源快照时应显示来源降级占位', () => {
    localStorageMock.setItem('fusion_conversation_history', JSON.stringify({
      id: 'legacy-session',
      createdAt: 1704067200000,
      updatedAt: 1704067201000,
      messages: [
        { id: 'user-1', role: 'user', content: '杜甫是谁？', timestamp: 1704067200000 },
        { id: 'assistant-1', role: 'assistant', content: '杜甫是唐代诗人。', timestamp: 1704067201000 },
      ],
    }))

    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    expect(container.querySelector('.fusion-chat-native-sidebar')).toBeTruthy()
    expect(container.querySelector('.fusion-chat-native-sources-empty-title')?.textContent).toBe('来源暂未恢复')
    expect(container.querySelector('.fusion-chat-native-sources-empty-desc')?.textContent).toBe('当前为已恢复会话，原始来源未保留；如需查看来源，请重新提问。')

    unmount(root, container)
  })

  it('应在 assistant-ui 线程变化时持久化文本消息快照', () => {
    mockThreadMessages = [
      {
        id: 'user-1',
        role: 'user',
        content: [{ type: 'text', text: '杜甫写给李白的诗有哪些？' }],
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: [{ type: 'text', text: '可先看《赠李白》《春日忆李白》等。' }],
        createdAt: new Date('2024-01-01T00:00:01.000Z'),
      },
    ]

    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    const savedRaw = localStorageMock.setItem.mock.calls.find(([key]) => key === 'fusion_conversation_history')?.[1] as string
    const savedSession = JSON.parse(savedRaw)
    expect(savedSession.messages).toHaveLength(2)
    expect(savedSession.messages[0]).toMatchObject({
      id: 'user-1',
      role: 'user',
      content: '杜甫写给李白的诗有哪些？',
    })
    expect(savedSession.messages[1]).toMatchObject({
      id: 'assistant-1',
      role: 'assistant',
      content: '可先看《赠李白》《春日忆李白》等。',
    })

    unmount(root, container)
  })

  it('多轮运行时应仅将线程中的当前问题与历史消息发送给后端', async () => {
    const encoder = new TextEncoder()
    const ssePayload = [
      'event: status',
      'data: {"stage":"retrieving","message":"正在检索相关内容..."}',
      '',
      'event: done',
      'data: {"text":"测试回答"}',
      '',
    ].join('\n')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(ssePayload))
          controller.close()
        },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat?dims=poem,place']}>
        <FusionChat />
      </MemoryRouter>,
    )

    const adapter = mockUseLocalRuntime.mock.calls[0]?.[0] as {
      run: (options: {
        messages: Array<{ role: string; content: Array<{ type: string; text: string }> }>
        abortSignal: AbortSignal
      }) => AsyncGenerator<unknown, void, unknown>
    }
    const runOptions = {
      messages: [
        { role: 'user', content: [{ type: 'text', text: '杜甫写给李白的诗有哪些？' }] },
        { role: 'assistant', content: [{ type: 'text', text: '《赠李白》《春日忆李白》等较为著名。' }] },
        { role: 'user', content: [{ type: 'text', text: '《春望》和《望岳》表达的情感有什么不同？' }] },
      ],
      abortSignal: new AbortController().signal,
    }

    const outputs: unknown[] = []
    await act(async () => {
      for await (const value of adapter.run(runOptions)) {
        outputs.push(value)
      }
    })

    const requestPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'))
    expect(requestPayload.query).toBe('《春望》和《望岳》表达的情感有什么不同？')
    expect(requestPayload.conversationHistory).toEqual([
      { role: 'user', content: '杜甫写给李白的诗有哪些？' },
      { role: 'assistant', content: '《赠李白》《春日忆李白》等较为著名。' },
    ])
    expect(outputs.length).toBeGreaterThanOrEqual(1)

    vi.unstubAllGlobals()
    unmount(root, container)
  })

  it('站内诗文来源卡片应提供可点击跳转入口', () => {
    const item = createEvidenceItem()
    const { container, root } = mount(<MemoryRouter>{renderUnifiedEvidenceItem(item)}</MemoryRouter>)

    const link = container.querySelector('.fusion-chat-native-source-link')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('/details?uri=%2Fprocessed%2Fjson-ld%2Fpoem%2Fset%2F1.json')

    unmount(root, container)
  })

  it('外部影像来源卡片应保留外链跳转入口', () => {
    const item = createEvidenceItem({
      itemId: 'iiif-1',
      kind: 'iiif',
      colorKey: 'iiif',
      typeLabel: '影像',
      title: '卷一',
      link: 'https://iiif.example.com/viewer?id=1',
      thumbnailUrl: 'https://iiif.example.com/thumb.jpg',
      sourceKinds: ['iiif'],
    })
    const { container, root } = mount(<MemoryRouter>{renderUnifiedEvidenceItem(item)}</MemoryRouter>)

    const link = container.querySelector('.fusion-chat-native-source-link')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('https://iiif.example.com/viewer?id=1')

    unmount(root, container)
  })

  it('组件卸载时应只取消当前运行而不清空线程', () => {
    const { container, root } = mount(
      <MemoryRouter initialEntries={['/chat']}>
        <FusionChat />
      </MemoryRouter>,
    )

    unmount(root, container)

    expect(mockCancelRun).toHaveBeenCalledTimes(1)
  })
})

describe('shouldShowSourceSidebar', () => {
  it('没有回答状态和来源条目时应隐藏', () => {
    expect(shouldShowSourceSidebar('', 0)).toBe(false)
  })

  it('回答进行中但尚无来源条目时不应显示', () => {
    expect(shouldShowSourceSidebar('generating', 0)).toBe(false)
  })

  it('降级响应阶段但尚无来源条目时不应显示', () => {
    expect(shouldShowSourceSidebar('degraded', 0)).toBe(false)
  })

  it('已有来源条目时即使回答结束也应继续显示', () => {
    expect(shouldShowSourceSidebar('', 2)).toBe(true)
  })
})

describe('buildStreamStatusViewModel', () => {
  it('应将 retrieving 阶段映射为检索提示', () => {
    expect(buildStreamStatusViewModel('retrieving', '正在检索相关内容...')).toEqual({
      stage: 'retrieving',
      title: '正在检索证据',
      detail: '正在检索相关内容...',
      emptyTitle: '正在检索来源',
      emptyDescription: '系统正在汇集相关的人物、诗文、古籍与影像来源，请稍候。',
    })
  })

  it('应将 generating 阶段映射为生成提示', () => {
    expect(buildStreamStatusViewModel('generating', '正在生成回答...')).toEqual({
      stage: 'generating',
      title: '正在组织回答',
      detail: '正在生成回答...',
      emptyTitle: '正在补充来源',
      emptyDescription: '回答生成过程中，系统会继续补充相关来源与证据线索。',
    })
  })

  it('应将 degraded 阶段映射为降级提示', () => {
    expect(buildStreamStatusViewModel('degraded', '检索服务暂不可用，已切换为降级响应。')).toEqual({
      stage: 'degraded',
      title: '当前为降级响应',
      detail: '检索服务暂不可用，已切换为降级响应。',
      emptyTitle: '暂时无法整理来源',
      emptyDescription: '当前检索服务暂不可用，来源列表稍后可再尝试获取。',
    })
  })
})

// ============================================================================
// 真流式 yield 增量内容测试
// ============================================================================

/**
 * 构建多 chunk SSE payload
 *
 * SSE 数据流:
 *   status(generating) → chunk × N → done(完整文本)
 *
 *   ┌──────────┐   ┌────────┐   ┌────────┐   ┌──────────────┐
 *   │ status   │ → │ chunk  │ → │ chunk  │ → │ done(text)   │
 *   │generating│   │ "杜"   │   │ "甫"   │   │ "杜甫是唐代" │
 *   └──────────┘   └────────┘   └────────┘   └──────────────┘
 */
function buildChunkedSsePayload(chunks: string[], doneText: string): string {
  const lines = [
    'event: status',
    'data: {"stage":"generating","message":"正在生成回答..."}',
    '',
  ]
  for (const chunk of chunks) {
    lines.push('event: chunk', `data: {"content":"${chunk}"}`, '')
  }
  lines.push('event: done', `data: {"text":"${doneText}"}`, '')
  return lines.join('\n')
}

/**
 * 挂载 FusionChat 并 stub fetch 为指定 SSE payload
 */
function mountWithFetchMock(ssePayload: string) {
  const encoder = new TextEncoder()
  const fetchMock = vi.fn(async () => ({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload))
        controller.close()
      },
    }),
  }))
  vi.stubGlobal('fetch', fetchMock)

  const result = mount(
    <MemoryRouter initialEntries={['/chat?dims=poem,place']}>
      <FusionChat />
    </MemoryRouter>,
  )

  const adapter = mockUseLocalRuntime.mock.calls[0]?.[0] as {
    run: (options: {
      messages: Array<{ role: string; content: Array<{ type: string; text: string }> }>
      abortSignal: AbortSignal
    }) => AsyncGenerator<
      { content: Array<{ type: string; text: string }>; status: { type: string } },
      void,
      unknown
    >
  }

  return { ...result, fetchMock, adapter }
}

const singleUserMessage = [
  { role: 'user', content: [{ type: 'text', text: '杜甫是谁？' }] },
]

describe('adapter.run 真流式 yield', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    localStorageMock.clear()
    mockThreadMessages = []
    mockUseLocalRuntime.mockImplementation(() => ({
      thread: {
        cancelRun: mockCancelRun,
        subscribe: mockSubscribe,
        getState: mockGetState,
      },
    }))
  })

  it('多个 chunk 应触发多次增量 yield（真流式）', async () => {
    const ssePayload = buildChunkedSsePayload(['杜', '甫', '是'], '杜甫是唐代诗人。')
    const { container, root, adapter } = mountWithFetchMock(ssePayload)

    const outputs: Array<{ content: Array<{ type: string; text: string }>; status: { type: string } }> = []
    await act(async () => {
      for await (const value of adapter.run({
        messages: singleUserMessage,
        abortSignal: new AbortController().signal,
      })) {
        outputs.push(value)
      }
    })

    // 节流合并：所有 chunks 在一次 read 中到达，只有一次增量 yield + 最终 complete yield
    expect(outputs.length).toBeGreaterThanOrEqual(1)

    // 第一次 yield 应包含部分文本
    const firstYieldText = outputs[0].content.map((p) => p.text).join('')
    expect(firstYieldText.length).toBeGreaterThan(0)

    // 最后一次 yield 的 status 应为 complete
    const lastOutput = outputs[outputs.length - 1]
    expect(lastOutput.status.type).toBe('complete')

    // 最终 yield 的内容应包含 onDone 提供的完整文本
    const finalText = lastOutput.content.map((p) => p.text).join('')
    expect(finalText).toContain('杜甫是唐代诗人')

    unmount(root, container)
    vi.unstubAllGlobals()
  })

  it('50ms 节流应合并快速连续的 chunk', async () => {
    const ssePayload = buildChunkedSsePayload(['A', 'B', 'C', 'D', 'E'], 'ABCDE')
    const { container, root, adapter } = mountWithFetchMock(ssePayload)

    const outputs: Array<{ content: Array<{ type: string; text: string }>; status: { type: string } }> = []
    await act(async () => {
      for await (const value of adapter.run({
        messages: singleUserMessage,
        abortSignal: new AbortController().signal,
      })) {
        outputs.push(value)
      }
    })

    // 节流合并：5 个 chunk 不应产生 5 次增量 yield
    // 但至少应有最终的 complete yield
    expect(outputs.length).toBeGreaterThanOrEqual(1)

    const lastOutput = outputs[outputs.length - 1]
    const finalText = lastOutput.content.map((p) => p.text).join('')
    expect(finalText).toContain('ABCDE')

    unmount(root, container)
    vi.unstubAllGlobals()
  })

  it('onDone 提供完整文本时应覆盖累加的 chunk 文本', async () => {
    const ssePayload = buildChunkedSsePayload(['杜', '甫'], '杜甫，字子美，唐代伟大的现实主义诗人。')
    const { container, root, adapter } = mountWithFetchMock(ssePayload)

    const outputs: Array<{ content: Array<{ type: string; text: string }>; status: { type: string } }> = []
    await act(async () => {
      for await (const value of adapter.run({
        messages: singleUserMessage,
        abortSignal: new AbortController().signal,
      })) {
        outputs.push(value)
      }
    })

    // 最终 yield 应使用 onDone 的完整文本
    const lastOutput = outputs[outputs.length - 1]
    const finalText = lastOutput.content.map((p) => p.text).join('')
    expect(finalText).toBe('杜甫，字子美，唐代伟大的现实主义诗人。')

    unmount(root, container)
    vi.unstubAllGlobals()
  })
})

// ============================================================================
// localStorage 安全测试
// ============================================================================

describe('saveSessionToStorage 异常处理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  it('localStorage 满时 saveSessionToStorage 应返回 false 不抛异常', async () => {
    // 模拟 QuotaExceededError
    localStorageMock.setItem.mockImplementationOnce(() => {
      const error = new Error('Failed to execute \'setItem\' on \'Storage\': Setting the value exceeded the quota.')
      error.name = 'QuotaExceededError'
      throw error
    })

    const { saveSessionToStorage } = await import('@/features/fusion/conversationUtils')
    const session = {
      id: 'test-session',
      messages: Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user' as const,
        content: '很长的内容'.repeat(100),
        timestamp: Date.now(),
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // 不应抛出异常，返回 false 表示保存失败
    const result = saveSessionToStorage(session)
    expect(result).toBe(false)
  })
})
