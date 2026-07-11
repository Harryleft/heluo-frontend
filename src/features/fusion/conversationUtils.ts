/**
 * Fusion 对话会话工具
 *
 * 提供会话创建、消息追加、上下文裁剪和本地存储能力。
 */

import type { FusionSidebarItemV1 } from '@/types/contracts/apiContracts'

const STORAGE_KEY = 'fusion_conversation_history'
export const MAX_MESSAGES = 20
const MAX_HISTORY_CONTENT_LENGTH = 120

export type ConversationRole = 'user' | 'assistant'

export interface ConversationMessageMetadata {
  entitiesCount?: number
  strategy?: 'llm' | 'template' | 'fallback'
  elapsedMs?: number
  [key: string]: unknown
}

export interface ConversationMessage {
  id: string
  role: ConversationRole
  content: string
  timestamp: number
  metadata?: ConversationMessageMetadata
}

export interface ConversationSourceSnapshot {
  hasSourceSnapshot: boolean
  status: 'ready'
  sidebarItems: FusionSidebarItemV1[]
}

export interface ConversationSession {
  id: string
  messages: ConversationMessage[]
  createdAt: number
  updatedAt: number
  sourceSnapshot?: ConversationSourceSnapshot
}

export interface ThreadTextMessageLike {
  id?: string
  role: ConversationRole | 'system'
  content: string
  createdAt?: Date
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeContent(content: string): string {
  return String(content || '').trim()
}

function trimMessageContent(content: string, maxLength = MAX_HISTORY_CONTENT_LENGTH): string {
  const normalized = normalizeContent(content)
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 3)}...`
}

export function createConversationSession(): ConversationSession {
  const now = Date.now()
  return {
    id: createId('fusion-session'),
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function buildSessionFromThreadMessages(
  messages: ThreadTextMessageLike[],
  existingSession?: ConversationSession | null,
): ConversationSession {
  const safeMessages = Array.isArray(messages) ? messages : []
  const normalizedMessages = safeMessages
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .map((message, index) => {
      const createdAt = message.createdAt instanceof Date ? message.createdAt.getTime() : Date.now() + index
      return {
        id: String(message.id || createId('fusion-message')),
        role: message.role as ConversationRole,
        content: normalizeContent(message.content),
        timestamp: createdAt,
      }
    })
    .filter((message) => Boolean(message.content))
    .slice(-MAX_MESSAGES)

  if (normalizedMessages.length === 0) {
    return existingSession || createConversationSession()
  }

  const firstTimestamp = normalizedMessages[0]?.timestamp || Date.now()
  const lastTimestamp = normalizedMessages[normalizedMessages.length - 1]?.timestamp || firstTimestamp

  return {
    id: String(existingSession?.id || createId('fusion-session')),
    messages: normalizedMessages,
    createdAt: Number(existingSession?.createdAt || firstTimestamp),
    updatedAt: Math.max(Number(existingSession?.updatedAt || 0), lastTimestamp),
    sourceSnapshot: existingSession?.sourceSnapshot,
  }
}

export function toThreadMessageLikes(session: ConversationSession): ThreadTextMessageLike[] {
  const messages = Array.isArray(session?.messages) ? session.messages : []
  return messages
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: normalizeContent(message.content),
      createdAt: new Date(Number(message.timestamp || Date.now())),
    }))
    .filter((message) => Boolean(message.content))
}

export function addMessageToSession(
  session: ConversationSession,
  role: ConversationRole,
  content: string,
  metadata?: ConversationMessageMetadata,
): ConversationSession {
  const now = Date.now()
  const nextMessage: ConversationMessage = {
    id: createId('fusion-message'),
    role,
    content: normalizeContent(content),
    timestamp: now,
    metadata,
  }

  const nextMessages = [...(session?.messages || []), nextMessage].slice(-MAX_MESSAGES)

  return {
    ...(session || createConversationSession()),
    messages: nextMessages,
    updatedAt: now,
  }
}

export function buildConversationContext(
  session: ConversationSession,
  rounds = 4,
): Array<{ role: ConversationRole; content: string }> {
  const safeRounds = Math.max(0, Number(rounds) || 0)
  const maxMessages = safeRounds * 2
  const messages = Array.isArray(session?.messages) ? session.messages : []
  const selected = maxMessages > 0 ? messages.slice(-maxMessages) : messages
  return selected.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

export function formatConversationHistory(session: ConversationSession): string {
  const messages = Array.isArray(session?.messages) ? session.messages : []
  if (messages.length === 0) return ''

  return messages
    .map((message) => {
      const speaker = message.role === 'user' ? '用户' : '河洛'
      return `${speaker}：${trimMessageContent(message.content)}`
    })
    .join('\n')
}

function getLocalStorage(): Storage | null {
  if (typeof window !== 'undefined') return window.localStorage
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  return descriptor && 'value' in descriptor ? descriptor.value as Storage : null
}

export function saveSessionToStorage(session: ConversationSession): boolean {
  try {
    getLocalStorage()?.setItem(STORAGE_KEY, JSON.stringify(session))
    return true
  } catch {
    return false
  }
}

function normalizeSourceSnapshot(rawSnapshot: unknown): ConversationSourceSnapshot | undefined {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') return undefined

  const snapshot = rawSnapshot as Record<string, unknown>
  const rawItems = Array.isArray(snapshot.sidebarItems) ? snapshot.sidebarItems : []
  const sidebarItems = rawItems
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      itemId: String(item.itemId || '').trim(),
      itemType: String(item.itemType || '').trim(),
      title: String(item.title || '').trim(),
      snippet: String(item.snippet || '').trim(),
      link: String(item.link || '').trim(),
    }))
    .filter((item) => Boolean(item.itemId) && Boolean(item.title) && Boolean(item.link))

  const hasSourceSnapshot = Boolean(snapshot.hasSourceSnapshot)
  if (!hasSourceSnapshot || sidebarItems.length === 0) return undefined

  return {
    hasSourceSnapshot: true,
    status: 'ready',
    sidebarItems,
  }
}

export function loadSessionFromStorage(): ConversationSession | null {
  try {
    const raw = getLocalStorage()?.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.messages)) return null
    const session = parsed as ConversationSession & { sourceSnapshot?: unknown }
    return {
      ...session,
      sourceSnapshot: normalizeSourceSnapshot(session.sourceSnapshot),
    }
  } catch {
    return null
  }
}

export function clearSessionFromStorage(): void {
  getLocalStorage()?.removeItem(STORAGE_KEY)
}

export function getSessionSummary(session: ConversationSession): {
  messageCount: number
  userMessageCount: number
  assistantMessageCount: number
  duration: number
} {
  const messages = Array.isArray(session?.messages) ? session.messages : []
  const userMessageCount = messages.filter((item) => item.role === 'user').length
  const assistantMessageCount = messages.filter((item) => item.role === 'assistant').length
  const createdAt = Number(session?.createdAt || 0)
  const updatedAt = Number(session?.updatedAt || createdAt)

  return {
    messageCount: messages.length,
    userMessageCount,
    assistantMessageCount,
    duration: Math.max(0, updatedAt - createdAt),
  }
}

export function exportSessionAsText(session: ConversationSession): string {
  const summary = getSessionSummary(session)
  const messages = Array.isArray(session?.messages) ? session.messages : []
  const lines = [
    '对话导出',
    `会话 ID：${String(session?.id || '')}`,
    `消息数：${summary.messageCount}`,
    '',
  ]

  messages.forEach((message) => {
    const speaker = message.role === 'user' ? '\u{1F464} 用户' : '\u{1F916} 河洛'
    lines.push(`${speaker}：${message.content}`)
  })

  return lines.join('\n')
}

export default {
  addMessageToSession,
  buildConversationContext,
  clearSessionFromStorage,
  createConversationSession,
  exportSessionAsText,
  formatConversationHistory,
  getSessionSummary,
  loadSessionFromStorage,
  saveSessionToStorage,
}
