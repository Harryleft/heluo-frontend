/**
 * conversationUtils 单元测试
 * @vitest-environment node
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  addMessageToSession,
  buildConversationContext,
  buildSessionFromThreadMessages,
  clearSessionFromStorage,
  createConversationSession,
  exportSessionAsText,
  formatConversationHistory,
  getSessionSummary,
  loadSessionFromStorage,
  saveSessionToStorage,
  toThreadMessageLikes,
} from '@/features/fusion/conversationUtils'

// Mock localStorage
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

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

describe('conversationUtils', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('createConversationSession', () => {
    it('应创建新的对话会话', () => {
      const session = createConversationSession()

      expect(session.id).toBeDefined()
      expect(session.messages).toHaveLength(0)
      expect(session.createdAt).toBeLessThanOrEqual(Date.now())
      expect(session.updatedAt).toBeLessThanOrEqual(Date.now())
    })

    it('每次创建的会话 ID 应唯一', () => {
      const session1 = createConversationSession()
      const session2 = createConversationSession()

      expect(session1.id).not.toBe(session2.id)
    })
  })

  describe('addMessageToSession', () => {
    it('应添加用户消息', () => {
      const session = createConversationSession()
      const updated = addMessageToSession(session, 'user', '杜甫是谁？')

      expect(updated.messages).toHaveLength(1)
      expect(updated.messages[0].role).toBe('user')
      expect(updated.messages[0].content).toBe('杜甫是谁？')
    })

    it('应添加助手消息', () => {
      const session = createConversationSession()
      const updated = addMessageToSession(session, 'assistant', '杜甫是唐代诗人。')

      expect(updated.messages).toHaveLength(1)
      expect(updated.messages[0].role).toBe('assistant')
    })

    it('应保留元数据', () => {
      const session = createConversationSession()
      const metadata = { entitiesCount: 5, strategy: 'llm' as const, elapsedMs: 1234 }
      const updated = addMessageToSession(session, 'assistant', '回答', metadata)

      expect(updated.messages[0].metadata).toEqual(metadata)
    })

    it('应更新 updatedAt 时间戳', () => {
      const session = createConversationSession()
      const beforeTime = session.updatedAt
      // 稍微等待以确保时间戳不同
      const updated = addMessageToSession(session, 'user', '测试')

      expect(updated.updatedAt).toBeGreaterThanOrEqual(beforeTime)
    })

    it('消息数超过限制时应裁剪', () => {
      const session = createConversationSession()
      let updated = session

      // 添加 25 条消息（超过 MAX_MESSAGES = 20）
      for (let i = 0; i < 25; i++) {
        updated = addMessageToSession(updated, 'user', `消息 ${i}`)
      }

      expect(updated.messages.length).toBeLessThanOrEqual(20)
      // 保留最新的消息
      expect(updated.messages[updated.messages.length - 1].content).toBe('消息 24')
    })
  })

  describe('buildConversationContext', () => {
    it('应构建对话上下文', () => {
      let session = createConversationSession()
      session = addMessageToSession(session, 'user', '问题1')
      session = addMessageToSession(session, 'assistant', '回答1')
      session = addMessageToSession(session, 'user', '问题2')

      const context = buildConversationContext(session)

      expect(context).toHaveLength(3)
      expect(context[0].role).toBe('user')
      expect(context[1].role).toBe('assistant')
    })

    it('应限制上下文轮数', () => {
      let session = createConversationSession()
      for (let i = 0; i < 10; i++) {
        session = addMessageToSession(session, 'user', `问题${i}`)
        session = addMessageToSession(session, 'assistant', `回答${i}`)
      }

      const context = buildConversationContext(session, 2)

      // 2 轮 = 4 条消息
      expect(context).toHaveLength(4)
    })

    it('空会话应返回空上下文', () => {
      const session = createConversationSession()
      const context = buildConversationContext(session)

      expect(context).toHaveLength(0)
    })
  })

  describe('formatConversationHistory', () => {
    it('应格式化对话历史', () => {
      let session = createConversationSession()
      session = addMessageToSession(session, 'user', '杜甫是谁？')
      session = addMessageToSession(session, 'assistant', '杜甫是唐代著名诗人。')

      const history = formatConversationHistory(session)

      expect(history).toContain('用户')
      expect(history).toContain('河洛')
      expect(history).toContain('杜甫是谁？')
      expect(history).toContain('杜甫是唐代著名诗人。')
    })

    it('空会话应返回空字符串', () => {
      const session = createConversationSession()
      const history = formatConversationHistory(session)

      expect(history).toBe('')
    })

    it('长内容应被截断', () => {
      const longContent = 'a'.repeat(200)
      let session = createConversationSession()
      session = addMessageToSession(session, 'user', longContent)

      const history = formatConversationHistory(session)

      expect(history).toContain('...')
      expect(history.length).toBeLessThan(longContent.length + 100)
    })
  })

  describe('localStorage 操作', () => {
    it('应保存和加载会话', () => {
      let session = createConversationSession()
      session = addMessageToSession(session, 'user', '测试')

      saveSessionToStorage(session)
      const loaded = loadSessionFromStorage()

      expect(loaded).not.toBeNull()
      expect(loaded?.id).toBe(session.id)
      expect(loaded?.messages).toHaveLength(1)
    })

    it('应同时保存和加载来源快照', () => {
      const session = {
        ...createConversationSession(),
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant' as const,
            content: '这是一个带来源的回答。',
            timestamp: 1704067201000,
          },
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
      }

      saveSessionToStorage(session)
      const loaded = loadSessionFromStorage()

      expect(loaded?.sourceSnapshot).toEqual({
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
      })
    })

    it('无数据时应返回 null', () => {
      const loaded = loadSessionFromStorage()
      expect(loaded).toBeNull()
    })

    it('应清除会话', () => {
      let session = createConversationSession()
      session = addMessageToSession(session, 'user', '测试')
      saveSessionToStorage(session)

      clearSessionFromStorage()
      const loaded = loadSessionFromStorage()

      expect(loaded).toBeNull()
    })

    it('无效 JSON 应返回 null', () => {
      localStorageMock.setItem('fusion_conversation_history', 'invalid json')
      const loaded = loadSessionFromStorage()

      expect(loaded).toBeNull()
    })

    it('旧版仅含消息的会话数据应兼容加载', () => {
      localStorageMock.setItem('fusion_conversation_history', JSON.stringify({
        id: 'legacy-session',
        createdAt: 1704067200000,
        updatedAt: 1704067201000,
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: '旧版回答',
            timestamp: 1704067201000,
          },
        ],
      }))

      const loaded = loadSessionFromStorage()

      expect(loaded?.id).toBe('legacy-session')
      expect(loaded?.messages).toHaveLength(1)
      expect(loaded?.sourceSnapshot).toBeUndefined()
    })
  })

  describe('assistant-ui 线程转换', () => {
    it('应从线程消息构建会话并忽略 system 消息', () => {
      const session = buildSessionFromThreadMessages([
        { role: 'system', content: '系统提示' },
        { role: 'user', content: '杜甫写给李白的诗有哪些？', id: 'user-1', createdAt: new Date('2024-01-01T00:00:00.000Z') },
        { role: 'assistant', content: '可先看《赠李白》《春日忆李白》等。', id: 'assistant-1', createdAt: new Date('2024-01-01T00:00:01.000Z') },
      ])

      expect(session.messages).toHaveLength(2)
      expect(session.messages[0]).toMatchObject({
        id: 'user-1',
        role: 'user',
        content: '杜甫写给李白的诗有哪些？',
      })
      expect(session.messages[1]).toMatchObject({
        id: 'assistant-1',
        role: 'assistant',
        content: '可先看《赠李白》《春日忆李白》等。',
      })
    })

    it('从线程消息重建会话时应保留已有来源快照', () => {
      const session = buildSessionFromThreadMessages(
        [
          { role: 'user', content: '几首《望岳》之间有何区别？', id: 'user-1', createdAt: new Date('2024-01-01T00:00:00.000Z') },
          { role: 'assistant', content: '它们在写作阶段与情感上存在差异。', id: 'assistant-1', createdAt: new Date('2024-01-01T00:00:01.000Z') },
        ],
        {
          ...createConversationSession(),
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
        },
      )

      expect(session.sourceSnapshot).toEqual({
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
      })
    })

    it('应将会话转换为 assistant-ui 可恢复的文本消息', () => {
      let session = createConversationSession()
      session = addMessageToSession(session, 'user', '第一问')
      session = addMessageToSession(session, 'assistant', '第一答')

      const messages = toThreadMessageLikes(session)

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('第一问')
      expect(messages[0].createdAt).toBeInstanceOf(Date)
      expect(messages[1].role).toBe('assistant')
      expect(messages[1].content).toBe('第一答')
    })
  })

  describe('getSessionSummary', () => {
    it('应返回正确的会话摘要', () => {
      let session = createConversationSession()
      session = addMessageToSession(session, 'user', '问题1')
      session = addMessageToSession(session, 'assistant', '回答1')
      session = addMessageToSession(session, 'user', '问题2')

      const summary = getSessionSummary(session)

      expect(summary.messageCount).toBe(3)
      expect(summary.userMessageCount).toBe(2)
      expect(summary.assistantMessageCount).toBe(1)
      expect(summary.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('exportSessionAsText', () => {
    it('应导出会话为文本', () => {
      let session = createConversationSession()
      session = addMessageToSession(session, 'user', '杜甫是谁？')
      session = addMessageToSession(session, 'assistant', '杜甫是唐代诗人。')

      const text = exportSessionAsText(session)

      expect(text).toContain('对话导出')
      expect(text).toContain('消息数：2')
      expect(text).toContain('👤 用户')
      expect(text).toContain('🤖 河洛')
      expect(text).toContain('杜甫是谁？')
    })

    it('空会话也应正确导出', () => {
      const session = createConversationSession()
      const text = exportSessionAsText(session)

      expect(text).toContain('对话导出')
      expect(text).toContain('消息数：0')
    })
  })
})
