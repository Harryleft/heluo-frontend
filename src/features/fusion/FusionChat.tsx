/**
 * FusionChat.tsx
 * 融合问答组件 - assistant-ui 版本
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { AssistantRuntimeProvider, ThreadPrimitive, useLocalRuntime, useThreadRuntime, type ChatModelAdapter, type ChatModelRunOptions, type MessageStatus, type ThreadAssistantMessagePart, type ThreadMessage } from '@assistant-ui/react'

// ============================================================================
// 清除聊天按钮组件（需要在 AssistantRuntimeProvider 内部使用）
// ============================================================================

interface ClearChatButtonProps {
  onClear: () => void
}

function ClearChatButton({ onClear }: ClearChatButtonProps): JSX.Element | null {
  const threadRuntime = useThreadRuntime()
  const messageCount = threadRuntime.getState().messages.length

  // 只有当有消息时才显示按钮
  if (messageCount === 0) return null

  return (
    <button
      type="button"
      className="fusion-chat-native-clear-button"
      onClick={onClear}
      title="清除对话"
      aria-label="清除当前对话"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  )
}
import { Composer, Thread, ThreadWelcome, makeMarkdownText } from '@assistant-ui/react-ui'
import '@assistant-ui/react-ui/styles/index.css'
import {
  buildSessionFromThreadMessages,
  clearSessionFromStorage,
  loadSessionFromStorage,
  MAX_MESSAGES,
  saveSessionToStorage,
  toThreadMessageLikes,
  type ConversationSession,
  type ConversationSourceSnapshot,
  type ThreadTextMessageLike,
} from '@/features/fusion/conversationUtils'
import {
  buildUnifiedEvidenceItems,
  createFusionParams,
  evidenceDedupeKey,
  parseDims,
  type UnifiedEvidenceItem,
} from '@/features/fusion/evidenceUtils'
import type {
  FusionCitationV1,
  FusionConversationMessageV1,
  FusionEntityItemV1,
  FusionIiifMatchV1,
  FusionQueryParamsV1,
  FusionSidebarItemV1,
} from '@/types/contracts/apiContracts'

// ============================================================================
// 常量定义
// ============================================================================

const DEFAULT_MODE = 'hybrid' as const
const STREAM_YIELD_INTERVAL_MS = 50
const TOP_K = 12
const MAX_SOURCE_ITEMS = 10

const QUICK_QUESTIONS = [
  { category: '人物', prompt: '杜甫写给李白的诗有哪些？' },
  { category: '诗意', prompt: '望岳这首诗讲了什么？' },
  { category: '比较', prompt: '《春望》和《望岳》表达的情感有什么不同？' },
]

const MarkdownText = makeMarkdownText()
const DEFAULT_WELCOME_MESSAGE = '提出问题，我会结合检索证据作答。'
const DEFAULT_INPUT_PLACEHOLDER = '输入你的问题，例如：杜甫诗中如何体现现实关怀？'
const RESTORED_SOURCE_EMPTY_TITLE = '来源暂未恢复'
const RESTORED_SOURCE_EMPTY_DESCRIPTION = '当前为已恢复会话，原始来源未保留；如需查看来源，请重新提问。'

function FusionChatWelcome(): JSX.Element {
  return (
    <ThreadWelcome.Root>
      <ThreadWelcome.Center>
        <p className="fusion-chat-native-welcome-eyebrow">智能问答</p>
        <h1 className="fusion-chat-native-welcome-title">从一个问题，进入河洛文献</h1>
        <ThreadWelcome.Message />
      </ThreadWelcome.Center>
    </ThreadWelcome.Root>
  )
}

function FusionChatComposer(): JSX.Element {
  return (
    <>
      <Composer.Root>
        <Composer.Input aria-label="输入问题" autoFocus={false} />
        <Composer.Action />
      </Composer.Root>
      <ThreadPrimitive.Empty>
        <div className="fusion-chat-native-welcome-details">
          <p className="fusion-chat-native-composer-trust">回答将附检索证据</p>
          <section className="fusion-chat-native-welcome-index" aria-labelledby="fusion-chat-welcome-index-title">
            <h2 id="fusion-chat-welcome-index-title">你也可以这样问</h2>
            <div className="fusion-chat-native-welcome-index-list">
              {QUICK_QUESTIONS.map(({ category, prompt }) => (
                <ThreadPrimitive.Suggestion
                  autoSend
                  className="fusion-chat-native-welcome-index-item"
                  key={prompt}
                  method="replace"
                  prompt={prompt}
                >
                  <span className="fusion-chat-native-welcome-index-category">
                    {category}
                  </span>
                  <span className="fusion-chat-native-welcome-index-text">{prompt}</span>
                  <ChevronRightRoundedIcon aria-hidden="true" className="fusion-chat-native-welcome-index-icon" />
                </ThreadPrimitive.Suggestion>
              ))}
            </div>
          </section>
        </div>
      </ThreadPrimitive.Empty>
    </>
  )
}

// ============================================================================
// 检索状态上下文 —— 用于在 assistant-ui Empty 插槽中展示检索进度
// ============================================================================

const StreamStatusContext = createContext<StreamStatusViewModel | null>(null)

type StreamStatusStage = 'retrieving' | 'generating' | 'degraded'

interface StreamStatusViewModel {
  stage: StreamStatusStage
  title: string
  detail: string
  emptyTitle: string
  emptyDescription: string
}

// ============================================================================
// AI 消息空态组件 —— 检索/生成阶段显示状态指示器
// ============================================================================

function AssistantEmptyStatus(): JSX.Element {
  const vm = useContext(StreamStatusContext)
  if (vm) {
    return (
      <div className="fusion-chat-native-status" data-stage={vm.stage} aria-live="polite">
        <div className="fusion-chat-native-status-label">{vm.title}</div>
        <div className="fusion-chat-native-status-detail">{vm.detail}</div>
      </div>
    )
  }
  return (
    <div className="fusion-chat-native-status" data-stage="idle" aria-live="polite">
      <div className="fusion-chat-native-status-label">思考中...</div>
    </div>
  )
}

// ============================================================================
// 类型定义
// ============================================================================

interface FusionStreamEvidencePayload {
  entities?: FusionEntityItemV1[]
  citations?: FusionCitationV1[]
  iiifMatches?: FusionIiifMatchV1[]
  sidebar?: {
    items?: FusionSidebarItemV1[]
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 用于 adapter.run 内的类型断言
interface FusionStreamDonePayload {
  text?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 用于 adapter.run 内的类型断言
interface FusionStreamStatusPayload {
  stage?: string
  message?: string
}

interface FusionStreamErrorPayload {
  message?: string
  detail?: string
}

interface ParsedSseEvent {
  event: string
  data: unknown
}

// FusionStreamHandlers 已移除：streamFusionQuery 改为 async generator，不再使用回调接口

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

// ============================================================================
// 私有实现
// ============================================================================

function trimConversationHistory(messages: FusionConversationMessageV1[]): FusionConversationMessageV1[] {
  if (messages.length <= MAX_MESSAGES) return messages
  return messages.slice(-MAX_MESSAGES)
}

function parseSseEvent(rawBlock: string): ParsedSseEvent | null {
  const lines = rawBlock.replace(/\r/g, '').split('\n')
  let event = 'message'
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message'
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return null
  const rawData = dataLines.join('\n')

  try {
    return { event, data: JSON.parse(rawData) }
  } catch {
    return { event, data: rawData }
  }
}

function toObjectRecord(rawData: unknown): Record<string, unknown> {
  if (rawData && typeof rawData === 'object') {
    return rawData as Record<string, unknown>
  }
  return {}
}

/**
 * 流式融合查询（async generator 版本）
 *
 * 逐个 yield SSE 事件，让调用方（adapter.run）可以在 generator 上下文中 yield 增量内容
 *
 *   ┌──────────┐   ┌──────────────┐   ┌──────────────┐
 *   │ fetch SSE│ → │ parseSseEvent│ → │ yield Parsed │
 *   │ stream   │   │ block        │   │ event        │
 *   └──────────┘   └──────────────┘   └──────────────┘
 */
async function* streamFusionQuery(
  params: FusionQueryParamsV1,
  signal: globalThis.AbortSignal,
): AsyncGenerator<ParsedSseEvent> {
  const response = await globalThis.fetch('/api/v1/fusion/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(params),
    signal,
  })

  if (!response.ok) {
    throw new Error(`请求失败：HTTP ${response.status}`)
  }
  if (!response.body) {
    throw new Error('流式响应不可用')
  }

  const reader = response.body.getReader()
  const decoder = new globalThis.TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let splitIndex = buffer.indexOf('\n\n')
    while (splitIndex >= 0) {
      const block = buffer.slice(0, splitIndex).trim()
      buffer = buffer.slice(splitIndex + 2)
      const parsed = parseSseEvent(block)
      if (parsed) yield parsed
      splitIndex = buffer.indexOf('\n\n')
    }
  }

  const tail = buffer.trim()
  if (tail) {
    const parsed = parseSseEvent(tail)
    if (parsed) yield parsed
  }
}

function extractConversation(messages: readonly ThreadMessage[]): ConversationMessage[] {
  return extractThreadTextMessages(messages).map((message) => ({
    role: message.role as 'user' | 'assistant',
    content: message.content,
  }))
}

function extractThreadTextMessages(messages: readonly ThreadMessage[]): ThreadTextMessageLike[] {
  const result: ThreadTextMessageLike[] = []

  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue

    const parts = message.content || []
    const text = parts
      .map((part) => (part.type === 'text' ? String(part.text || '') : ''))
      .join('')
      .trim()

    if (!text) continue
    result.push({
      id: message.id,
      role: message.role,
      content: text,
      createdAt: message.createdAt,
    })
  }

  return result
}

function dedupeSourceItems(items: UnifiedEvidenceItem[]): UnifiedEvidenceItem[] {
  const map = new Map<string, UnifiedEvidenceItem>()
  for (const item of items) {
    const key = evidenceDedupeKey(item)
    const current = map.get(key)
    if (!current) {
      map.set(key, item)
      continue
    }
    const mergedSourceKinds = Array.from(new Set([...current.sourceKinds, ...item.sourceKinds]))
    const picked = item.score > current.score ? item : current
    map.set(key, {
      ...picked,
      sourceKinds: mergedSourceKinds,
      uri: picked.uri || current.uri || item.uri,
    })
  }
  return Array.from(map.values())
}

function buildSourceSnapshot(items: UnifiedEvidenceItem[]): ConversationSourceSnapshot | undefined {
  if (items.length === 0) return undefined

  return {
    hasSourceSnapshot: true,
    status: 'ready',
    sidebarItems: items.map((item) => ({
      itemId: item.itemId,
      itemType: item.colorKey,
      title: item.title,
      snippet: item.snippet,
      link: item.link,
    })),
  }
}

function shouldShowSnippet(title: string, snippet: string): boolean {
  const normalizedTitle = String(title || '').replace(/\s+/g, '').trim()
  const normalizedSnippet = String(snippet || '').replace(/\s+/g, '').trim()
  if (!normalizedSnippet) return false
  return normalizedSnippet !== normalizedTitle
}

function toStreamingTextPart(text: string): ThreadAssistantMessagePart {
  return { type: 'text', text }
}

function buildRunningStatus(): MessageStatus {
  return { type: 'running' }
}

function buildCompleteStatus(): MessageStatus {
  return { type: 'complete', reason: 'stop' }
}

export function shouldShowSourceSidebar(streamStage: string, sourceItemCount: number): boolean {
  // 仅当有实际来源数据时才展开侧边栏
  // 不再在 generating/degraded 阶段提前展开空白侧边栏
  return sourceItemCount > 0
}

export function buildStreamStatusViewModel(stage: string, detail: string): StreamStatusViewModel {
  const normalizedStage = String(stage || '').trim()
  const normalizedDetail = String(detail || '').trim()

  if (normalizedStage === 'generating') {
    return {
      stage: 'generating',
      title: '正在组织回答',
      detail: normalizedDetail || '正在生成回答...',
      emptyTitle: '正在补充来源',
      emptyDescription: '回答生成过程中，系统会继续补充相关来源与证据线索。',
    }
  }

  if (normalizedStage === 'degraded') {
    return {
      stage: 'degraded',
      title: '当前为降级响应',
      detail: normalizedDetail || '检索服务暂不可用，已切换为降级响应。',
      emptyTitle: '暂时无法整理来源',
      emptyDescription: '当前检索服务暂不可用，来源列表稍后可再尝试获取。',
    }
  }

  return {
    stage: 'retrieving',
    title: '正在检索证据',
    detail: normalizedDetail || '正在检索相关内容...',
    emptyTitle: '正在检索来源',
    emptyDescription: '系统正在汇集相关的人物、诗文、古籍与影像来源，请稍候。',
  }
}

function isExternalSourceLink(link: string): boolean {
  return /^https?:\/\//i.test(String(link || '').trim())
}

function renderSourceCardContent(item: UnifiedEvidenceItem, previewImageUrl: string): JSX.Element {
  return (
    <>
      <article className={`fusion-chat-native-source-card fusion-source-type-${item.colorKey}`}>
        <span className="fusion-chat-native-source-corner fusion-chat-native-source-corner-tl" />
        <span className="fusion-chat-native-source-corner fusion-chat-native-source-corner-br" />
        <div className="fusion-chat-native-source-meta">
          <span className={`fusion-chat-native-source-badge fusion-source-type-${item.colorKey}`}>{item.typeLabel}</span>
        </div>
        <div className="fusion-chat-native-source-title">{item.title}</div>
        {previewImageUrl ? (
          <div className="fusion-chat-native-source-preview">
            <img src={previewImageUrl} alt={item.canvasLabel || item.title || 'IIIF 画布缩略图'} loading="lazy" />
          </div>
        ) : null}
        {shouldShowSnippet(item.title, item.snippet) ? <div className="fusion-chat-native-source-snippet">{item.snippet}</div> : null}
      </article>
    </>
  )
}

export function renderUnifiedEvidenceItem(item: UnifiedEvidenceItem): JSX.Element {
  const previewImageUrl = item.kind === 'iiif' ? String(item.thumbnailUrl || '').trim() : ''
  const sourceLink = String(item.link || '').trim()
  const cardContent = renderSourceCardContent(item, previewImageUrl)

  if (!sourceLink) return <div key={item.itemId}>{cardContent}</div>
  if (isExternalSourceLink(sourceLink)) {
    return (
      <a className="fusion-chat-native-source-link" href={sourceLink} key={item.itemId}>
        {cardContent}
      </a>
    )
  }

  return (
    <Link className="fusion-chat-native-source-link" to={sourceLink} key={item.itemId}>
      {cardContent}
    </Link>
  )
}

// ============================================================================
// 公共 API
// ============================================================================

export function FusionChat(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const [streamStage, setStreamStage] = useState<StreamStatusStage>('retrieving')
  const [streamStatus, setStreamStatus] = useState('')
  const [entities, setEntities] = useState<FusionEntityItemV1[]>([])
  const [citations, setCitations] = useState<FusionCitationV1[]>([])
  const [iiifMatches, setIiifMatches] = useState<FusionIiifMatchV1[]>([])
  const restoredSession = useMemo(() => loadSessionFromStorage(), [])
  const restoredSourceSnapshot = restoredSession?.sourceSnapshot
  const [sidebarItems, setSidebarItems] = useState<FusionSidebarItemV1[]>(() => restoredSourceSnapshot?.sidebarItems || [])
  const [showRestoredSourceFallback, setShowRestoredSourceFallback] = useState(
    () => Boolean(restoredSession?.messages?.length) && !restoredSourceSnapshot,
  )
  const [isResettingConversation, setIsResettingConversation] = useState(false)
  const sessionRef = useRef<ConversationSession | null>(restoredSession)

  const dims = useMemo(() => parseDims(params.get('dims')), [params])
  const initialMessages = useMemo(() => {
    if (!restoredSession) return undefined
    const messages = toThreadMessageLikes(restoredSession)
    return messages.length > 0 ? messages : undefined
  }, [restoredSession])
  const unifiedEvidenceItems = useMemo(
    () => buildUnifiedEvidenceItems(entities, citations, iiifMatches, sidebarItems),
    [entities, citations, iiifMatches, sidebarItems],
  )
  const sourceItems = useMemo(
    () => dedupeSourceItems(unifiedEvidenceItems).slice(0, MAX_SOURCE_ITEMS),
    [unifiedEvidenceItems],
  )
  const showSourceSidebar = shouldShowSourceSidebar(streamStage, sourceItems.length) || showRestoredSourceFallback
  const statusViewModel = streamStatus ? buildStreamStatusViewModel(streamStage, streamStatus) : null

  // 清除会话处理函数（清除来源相关状态）
  const handleClearConversation = useCallback(() => {
    setIsResettingConversation(true)
    clearSessionFromStorage()
    sessionRef.current = null
    setEntities([])
    setCitations([])
    setIiifMatches([])
    setSidebarItems([])
    setStreamStatus('')
    setStreamStage('retrieving')
    setShowRestoredSourceFallback(false)
  }, [])

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      run: async function* (options: ChatModelRunOptions) {
        const allMessages = extractConversation(options.messages)
        if (allMessages.length === 0) {
          yield {
            content: [toStreamingTextPart('请输入问题。')],
            status: buildCompleteStatus(),
          }
          return
        }

        const latestUserIndex = [...allMessages]
          .map((item, index) => ({ ...item, index }))
          .reverse()
          .find((item) => item.role === 'user')?.index

        if (latestUserIndex === undefined) {
          yield {
            content: [toStreamingTextPart('未检测到有效问题。')],
            status: buildCompleteStatus(),
          }
          return
        }

        const question = allMessages[latestUserIndex].content.trim()
        const history = trimConversationHistory(
          allMessages.slice(0, latestUserIndex).map((item) => ({
            role: item.role,
            content: item.content,
          })),
        )

        setParams(createFusionParams(question, dims))
        setStreamStage('retrieving')
        setStreamStatus('正在检索相关内容...')
        setShowRestoredSourceFallback(false)
        setEntities([])
        setCitations([])
        setIiifMatches([])
        setSidebarItems([])

        let assistantText = ''
        let lastYieldTime = 0

        // 真流式 yield：SSE chunk 累加到 assistantText，50ms 节流 yield 增量
        //
        //   ┌──────────┐   ┌────────┐   ┌────────┐        ┌──────────────┐
        //   │ onChunk  │ → │ 累加   │ → │ ≥50ms? │ ──Y──→ │ yield 增量   │
        //   │ "杜"     │   │ text   │   │        │ ──N──→ │ 继续累加     │
        //   └──────────┘   └────────┘   └────────┘        └──────────────┘
        //                                                    ↓ 最终
        //                                              ┌──────────────┐
        //                                              │ onDone 覆盖  │
        //                                              │ yield complete│
        //                                              └──────────────┘
        const eventStream = streamFusionQuery(
          {
            query: question,
            mode: DEFAULT_MODE,
            dims,
            topK: TOP_K,
            includeIiif: true,
            skipCache: true,
            conversationHistory: history,
          },
          options.abortSignal,
        )

        for await (const event of eventStream) {
          const payload = toObjectRecord(event.data)

          if (event.event === 'status') {
            const nextStage = String(payload.stage || '').trim()
            const nextStatus = String(payload.message || '').trim()
            if (nextStage === 'retrieving' || nextStage === 'generating' || nextStage === 'degraded') {
              setStreamStage(nextStage)
            }
            if (nextStatus) setStreamStatus(nextStatus)
            continue
          }

          if (event.event === 'evidence') {
            const evidence = payload as unknown as FusionStreamEvidencePayload
            setShowRestoredSourceFallback(false)
            setEntities(evidence.entities || [])
            setCitations(evidence.citations || [])
            setIiifMatches(evidence.iiifMatches || [])
            setSidebarItems(evidence.sidebar?.items || [])
            continue
          }

          if (event.event === 'chunk') {
            const chunk = String(payload.content || '')
            if (!chunk) continue
            assistantText += chunk
            const now = Date.now()
            if (now - lastYieldTime >= STREAM_YIELD_INTERVAL_MS) {
              lastYieldTime = now
              yield {
                content: [toStreamingTextPart(assistantText)],
                status: buildRunningStatus(),
              }
            }
            continue
          }

          if (event.event === 'done') {
            const doneText = String(payload.text || '').trim()
            if (doneText) {
              assistantText = doneText
            }
            continue
          }

          if (event.event === 'error') {
            const errorPayload = payload as FusionStreamErrorPayload
            const message = String(errorPayload.message || errorPayload.detail || '流式请求失败').trim()
            throw new Error(message || '流式请求失败')
          }
        }

        const finalText = assistantText.trim() || '暂无回答。'
        yield {
          content: [toStreamingTextPart(finalText)],
          status: buildCompleteStatus(),
        }
        setStreamStage('retrieving')
        setStreamStatus('')
      },
    }),
    [dims, setParams],
  )

  const runtime = useLocalRuntime(adapter, { initialMessages })

  useEffect(() => {
    if (!isResettingConversation) return

    runtime.thread.cancelRun()
    runtime.thread.reset()
    setIsResettingConversation(false)
  }, [isResettingConversation, runtime])

  useEffect(() => {
    return () => {
      runtime.thread.cancelRun()
    }
  }, [runtime])

  useEffect(() => {
    const persistThreadSession = () => {
      const threadMessages = extractThreadTextMessages(runtime.thread.getState().messages)
      if (threadMessages.length === 0) {
        clearSessionFromStorage()
        sessionRef.current = null
        return
      }

      const nextSession = buildSessionFromThreadMessages(threadMessages, sessionRef.current)
      const nextSourceSnapshot = buildSourceSnapshot(sourceItems)
      const persistedSession = nextSourceSnapshot
        ? {
            ...nextSession,
            sourceSnapshot: nextSourceSnapshot,
          }
        : nextSession

      saveSessionToStorage(persistedSession)
      sessionRef.current = persistedSession
    }

    persistThreadSession()
    return runtime.thread.subscribe(persistThreadSession)
  }, [runtime, sourceItems])

  const emptyStateTitle = showRestoredSourceFallback
    ? RESTORED_SOURCE_EMPTY_TITLE
    : (statusViewModel?.emptyTitle || '正在整理来源')
  const emptyStateDescription = showRestoredSourceFallback
    ? RESTORED_SOURCE_EMPTY_DESCRIPTION
    : (statusViewModel?.emptyDescription || '回答生成过程中，系统会在这里持续补充相关的人物、诗文、古籍与影像条目。')

  return (
    <StreamStatusContext.Provider value={statusViewModel}>
      <AssistantRuntimeProvider runtime={runtime}>
        {!isResettingConversation ? (
        <section className={`fusion-chat-native-shell ${showSourceSidebar ? 'has-source-sidebar' : 'without-source-sidebar'}`}>
          <section className="fusion-chat-native-main">
            <header className="fusion-chat-native-toolbar">
              <ClearChatButton onClear={handleClearConversation} />
            </header>
            <Thread
              welcome={{
                message: DEFAULT_WELCOME_MESSAGE,
                suggestions: QUICK_QUESTIONS.map(({ prompt }) => ({ prompt, text: prompt })),
              }}
              composer={{ allowAttachments: false }}
              components={{
                Composer: FusionChatComposer,
                ThreadWelcome: FusionChatWelcome,
              }}
              assistantAvatar={{}}
              assistantMessage={{
                allowCopy: true,
                allowReload: true,
                allowSpeak: false,
                allowFeedbackNegative: false,
                allowFeedbackPositive: false,
                components: {
                  Text: MarkdownText,
                  Empty: AssistantEmptyStatus,
                },
              }}
              strings={{
                composer: {
                  input: { placeholder: DEFAULT_INPUT_PLACEHOLDER },
                  send: { tooltip: '发送' },
                  cancel: { tooltip: '停止' },
                },
              }}
            />
          </section>

        {showSourceSidebar ? (
          <aside className="fusion-chat-native-sidebar" aria-label="来源信息">
            <section className="fusion-chat-native-sources">
              <header className="fusion-chat-native-sources-header">
                <h2>来源{sourceItems.length > 0 ? ` (${sourceItems.length})` : ''}</h2>
              </header>
              <div className="fusion-chat-native-sources-body">
                {sourceItems.length > 0 ? (
                  sourceItems.map((item) => renderUnifiedEvidenceItem(item))
                ) : (
                  <div className="fusion-chat-native-sources-empty">
                    <div className="fusion-chat-native-sources-empty-title">{emptyStateTitle}</div>
                    <div className="fusion-chat-native-sources-empty-desc">{emptyStateDescription}</div>
                  </div>
                )}
              </div>
            </section>
          </aside>
        ) : null}
      </section>
        ) : null}
      </AssistantRuntimeProvider>
    </StreamStatusContext.Provider>
  )
}
