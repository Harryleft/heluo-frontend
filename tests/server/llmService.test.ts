/**
 * llmService 单元测试
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

// 模拟环境变量
const originalEnv = process.env

describe('llmService', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('isLlmEnabled', () => {
    it('当 LLM_ENABLED=false 时返回 false', async () => {
      process.env.LLM_ENABLED = 'false'
      const { isLlmEnabled } = await import('../../server/src/services/llmService.js')
      expect(isLlmEnabled()).toBe(false)
    })

    it('当 LLM_ENABLED=true 但无 LLM_BASE_URL 时返回 false', async () => {
      process.env.LLM_ENABLED = 'true'
      process.env.LLM_BASE_URL = ''
      const { isLlmEnabled } = await import('../../server/src/services/llmService.js')
      expect(isLlmEnabled()).toBe(false)
    })

    it('当 LLM_ENABLED=true 且有 LLM_BASE_URL 时返回 true', async () => {
      process.env.LLM_ENABLED = 'true'
      process.env.LLM_BASE_URL = 'http://localhost:8000'
      const { isLlmEnabled } = await import('../../server/src/services/llmService.js')
      expect(isLlmEnabled()).toBe(true)
    })
  })

  describe('buildRagPrompt', () => {
    it('应生成包含系统和用户消息的数组', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '杜甫是谁？',
        entities: [
          { title: '杜甫', type: 'person', snippet: '唐代诗人' },
        ],
        citations: [],
      })

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
      expect(messages[0].content).toContain('中国古典文学')
      expect(messages[1].content).toContain('杜甫是谁？')
    })

    it('应正确包含实体信息', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '李白的诗',
        entities: [
          { title: '李白', type: 'person', snippet: '唐代诗人，字太白' },
          { title: '将进酒', type: 'poem', snippet: '君不见黄河之水天上来' },
        ],
        citations: [],
      })

      expect(messages[1].content).toContain('李白')
      expect(messages[1].content).toContain('将进酒')
      expect(messages[1].content).toContain('唐代诗人')
    })

    it('应正确包含证据信息', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '杜甫的代表作',
        entities: [],
        citations: [
          { title: '春望', sourceType: 'poem', snippet: '国破山河在' },
        ],
      })

      expect(messages[1].content).toContain('春望')
      expect(messages[1].content).toContain('国破山河在')
    })

    it('无证据时应显示提示信息', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '测试问题',
        entities: [],
        citations: [],
      })

      expect(messages[1].content).toContain('未检索到相关证据')
    })

    it('应要求使用纯文本直述且不展示证据编号标签', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '杜甫的诗中有哪些诗文体现现实关怀？',
        entities: [
          { title: '《石壕吏》', type: 'poem', snippet: '通过差役搜捕，揭示战乱下民生之苦。' },
        ],
        citations: [
          { title: '《新安吏》', sourceType: 'poem', snippet: '描写征兵与离散，反映社会现实。' },
        ],
      })

      expect(messages[0].content).toContain('输出纯文本')
      expect(messages[0].content).toContain('不要使用 Markdown')
      expect(messages[0].content).toContain('不要输出“[实体资料x][文献证据x]”')
      expect(messages[1].content).not.toMatch(/\[\d+\]/)
      expect(messages[1].content).not.toContain('【实体资料】')
      expect(messages[1].content).not.toContain('【文献证据】')
    })

    it('诗文正文存在时应传入 prompt 并引导多维度分析', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '杜甫写给李白的诗有哪些？',
        entities: [
          {
            title: '赠李白',
            type: 'poem',
            snippet: '秋来相顾尚飘蓬，未就丹砂愧葛洪。',
            poemText: '秋来相顾尚飘蓬，未就丹砂愧葛洪。痛饮狂歌空度日，飞扬跋扈为谁雄。',
            poemAuthor: '杜甫',
            poemDynasty: '唐',
          },
        ],
        citations: [],
      })

      expect(messages[0].content).toContain('多维度')
      expect(messages[1].content).toContain('诗文原文')
      expect(messages[1].content).toContain('秋来相顾尚飘蓬')
      expect(messages[1].content).toContain('作者：杜甫')
      expect(messages[1].content).toContain('朝代：唐')
    })

    it('应要求逐首诗句细读并覆盖四维分析', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '杜甫写给李白的诗有哪些？',
        entities: [
          {
            title: '赠李白',
            type: 'poem',
            snippet: '秋来相顾尚飘蓬，未就丹砂愧葛洪。',
            poemText: '秋来相顾尚飘蓬，未就丹砂愧葛洪。痛饮狂歌空度日，飞扬跋扈为谁雄。',
          },
          {
            title: '天末忆李白',
            type: 'poem',
            snippet: '凉风起天末，君子意如何。',
            poemText: '凉风起天末，君子意如何。鸿雁几时到，江湖秋水多。',
          },
        ],
        citations: [],
      })

      expect(messages[0].content).toContain('逐首')
      expect(messages[0].content).toContain('全量列出')
      expect(messages[0].content).toContain('不得遗漏')
      expect(messages[0].content).toContain('诗句细读')
      expect(messages[0].content).toContain('写作对象关系')
      expect(messages[0].content).toContain('主题情感')
      expect(messages[0].content).toContain('时代语境')
      expect(messages[0].content).toContain('艺术手法')
      expect(messages[1].content).toContain('赠李白')
      expect(messages[1].content).toContain('天末忆李白')
    })

    it('IIIF 命中时应注入注释文本并要求解释文本内容', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '请结合影像线索说明这段记载的含义',
        entities: [],
        citations: [],
        iiifMatches: [
          {
            manifest: '/iiif/manifests/303/manifest.json',
            canvasId: 'http://localhost:8083/iiif/3/canvas/ancientBook/303/17270_303/p9',
            canvasLabel: '卷一-5a',
            segmentText: '杜甫与李白交游，见于某卷注释，记其赠答诗文。',
          },
        ],
      })

      expect(messages[0].content).toContain('IIIF')
      expect(messages[0].content).toContain('解释文本信息')
      expect(messages[1].content).toContain('IIIF注释文本')
      expect(messages[1].content).toContain('杜甫与李白交游')
      expect(messages[1].content).toContain('卷一-5a')
    })

    it('多轮对话中应将历史放在当前问题之前', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '《春望》和《望岳》表达的情感有什么不同？',
        entities: [
          { title: '春望', type: 'poem', snippet: '国破山河在，城春草木深。' },
          { title: '望岳', type: 'poem', snippet: '会当凌绝顶，一览众山小。' },
        ],
        citations: [],
        conversationHistory: [
          { role: 'user', content: '杜甫写给李白的诗有哪些？' },
          { role: 'assistant', content: '《赠李白》《春日忆李白》《天末怀李白》等较为著名。' },
        ],
      })

      expect(messages).toHaveLength(4)
      expect(messages[0].role).toBe('system')
      expect(messages[1]).toEqual({ role: 'user', content: '杜甫写给李白的诗有哪些？' })
      expect(messages[2]).toEqual({ role: 'assistant', content: '《赠李白》《春日忆李白》《天末怀李白》等较为著名。' })
      expect(messages[3].role).toBe('user')
      expect(messages[3].content).toContain('《春望》和《望岳》表达的情感有什么不同？')
      expect(messages[3].content).toContain('春望')
      expect(messages[3].content).toContain('望岳')
    })

    it('多轮规则应明确当前问题优先且禁止回到上一轮重答', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '《春望》和《望岳》表达的情感有什么不同？',
        entities: [],
        citations: [],
        conversationHistory: [
          { role: 'user', content: '杜甫写给李白的诗有哪些？' },
          { role: 'assistant', content: '可以从《赠李白》《梦李白二首》等作品入手。' },
        ],
      })

      expect(messages[0].content).toContain('必须优先回答当前轮问题')
      expect(messages[0].content).toContain('不得回到上一轮重新作答')
      expect(messages[0].content).toContain('历史对话只作为理解上下文的辅助信息')
      expect(messages[1].content).toBe('杜甫写给李白的诗有哪些？')
      expect(messages[messages.length - 1].content).toContain('最后一个用户问题就是当前轮问题')
      expect(messages[messages.length - 1].content).toContain('《春望》和《望岳》表达的情感有什么不同？')
      expect(messages[messages.length - 1].content).not.toContain('无法直接回答“杜甫写给李白的诗有哪些”')
    })

    it('同名诗作比较题应注入比较对象清单与逐首比较约束', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '几首《望岳》之间有何区别？',
        entities: [],
        citations: [],
        compareIntent: {
          intent: 'poem_compare_by_title',
          title: '望岳',
        },
        comparePoemEvidence: [
          {
            title: '望岳',
            uri: '/processed/json-ld/poem/set/wangyue-1.json',
            poemAuthor: '杜甫',
            poemDynasty: '唐',
            poemIntro: '青年时期登临东岳所作。',
            poemText: '岱宗夫如何，齐鲁青未了。造化钟神秀，阴阳割昏晓。',
          },
          {
            title: '望岳',
            uri: '/processed/json-ld/poem/set/wangyue-2.json',
            poemAuthor: '杜甫',
            poemDynasty: '唐',
            poemIntro: '晚年咏西岳华山所作。',
            poemText: '西岳崚嶒竦处尊，诸峰罗立似儿孙。',
          },
        ],
      })

      expect(messages[0].content).toContain('不得把同题不同诗合并为一首')
      expect(messages[messages.length - 1].content).toContain('比较对象清单')
      expect(messages[messages.length - 1].content).toContain('/processed/json-ld/poem/set/wangyue-1.json')
      expect(messages[messages.length - 1].content).toContain('/processed/json-ld/poem/set/wangyue-2.json')
      expect(messages[messages.length - 1].content).toContain('岱宗夫如何')
      expect(messages[messages.length - 1].content).toContain('西岳崚嶒竦处尊')
    })

    it('比较题在主证据不足两首时应明确提示材料不足', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildRagPrompt } = await import('../../server/src/services/llmService.js')

      const messages = buildRagPrompt({
        query: '几首《望岳》之间有何区别？',
        entities: [],
        citations: [],
        compareIntent: {
          intent: 'poem_compare_by_title',
          title: '望岳',
        },
        comparePoemEvidence: [
          {
            title: '望岳',
            uri: '/processed/json-ld/poem/set/wangyue-1.json',
            poemText: '岱宗夫如何，齐鲁青未了。',
          },
        ],
      })

      expect(messages[messages.length - 1].content).toContain('当前材料不足以完成同题比较')
      expect(messages[messages.length - 1].content).toContain('望岳')
    })
  })

  describe('buildFusionAnswer', () => {
    it('无实体时返回默认消息', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildFusionAnswer } = await import('../../server/src/services/llmService.js')

      const result = await buildFusionAnswer({
        query: '测试问题',
        entities: [],
        citations: [],
        dims: ['poem'],
      })

      expect(result.text).toBe('当前未命中稳定证据，请尝试更具体的问题。')
      expect(result.source).toBe('template')
      expect(result.confidence).toBe(0)
    })

    it('LLM 未启用时返回模板回答', async () => {
      process.env.LLM_ENABLED = 'false'
      const { buildFusionAnswer } = await import('../../server/src/services/llmService.js')

      const result = await buildFusionAnswer({
        query: '杜甫是谁',
        entities: [
          { title: '杜甫', type: 'person', snippet: '唐代诗人' },
        ],
        citations: [],
        dims: ['poem', 'person'],
      })

      expect(result.text).toContain('杜甫是谁')
      expect(result.text).toContain('杜甫')
      expect(result.source).toBe('template')
      expect(result.confidence).toBe(0.5)
    })

    it('LLM 启用但请求失败时应降级到模板', async () => {
      process.env.LLM_ENABLED = 'true'
      process.env.LLM_BASE_URL = 'http://localhost:8000'
      process.env.LLM_MODEL = 'test-model'

      // 模拟 fetch 失败
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const { buildFusionAnswer } = await import('../../server/src/services/llmService.js')

      const result = await buildFusionAnswer({
        query: '杜甫是谁',
        entities: [
          { title: '杜甫', type: 'person', snippet: '唐代诗人' },
        ],
        citations: [],
        dims: ['person'],
      })

      expect(result.source).toBe('template')
      expect(result.text).toContain('杜甫')
    })

    it('LLM 成功时应返回生成的回答', async () => {
      process.env.LLM_ENABLED = 'true'
      process.env.LLM_BASE_URL = 'http://localhost:8000'
      process.env.LLM_MODEL = 'test-model'

      // 模拟成功的 LLM 响应
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [
            {
              message: {
                content: '杜甫是唐代著名诗人，被誉为"诗圣"。',
              },
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        }),
      })

      const { buildFusionAnswer } = await import('../../server/src/services/llmService.js')

      const result = await buildFusionAnswer({
        query: '杜甫是谁',
        entities: [
          { title: '杜甫', type: 'person', snippet: '唐代诗人' },
        ],
        citations: [],
        dims: ['person'],
      })

      expect(result.source).toBe('llm')
      expect(result.text).toBe('杜甫是唐代著名诗人，被誉为"诗圣"。')
      expect(result.confidence).toBe(0.85)
      expect(result.llmElapsedMs).toBeGreaterThanOrEqual(0)
    })

    it('诗作清单问题中默认不应追加“为避免遗漏”补充文案', async () => {
      process.env.LLM_ENABLED = 'true'
      process.env.LLM_BASE_URL = 'http://localhost:8000'
      process.env.LLM_MODEL = 'test-model'

      // 模拟 LLM 仅回答了第一首，遗漏其余命中诗作
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [
            {
              message: {
                content: '根据现有材料，杜甫写给李白的诗作是《梦李白二首》。',
              },
            },
          ],
          usage: { prompt_tokens: 120, completion_tokens: 30 },
        }),
      })

      const { buildFusionAnswer } = await import('../../server/src/services/llmService.js')

      const result = await buildFusionAnswer({
        query: '杜甫给李白写的诗有哪些？',
        entities: [
          { title: '梦李白二首', type: 'poem', snippet: '死别已吞声，生别常恻恻。', score: 0.95 },
          { title: '赠李白', type: 'poem', snippet: '秋来相顾尚飘蓬。', score: 0.93 },
          { title: '天末忆李白', type: 'poem', snippet: '凉风起天末，君子意如何。', score: 0.82 },
        ],
        citations: [],
        dims: ['poem'],
      })

      expect(result.source).toBe('llm')
      expect(result.text).toContain('梦李白二首')
      expect(result.text).not.toContain('为避免遗漏')
    })
  })

  describe('generateLlmAnswer', () => {
    it('LLM 未启用时应返回错误', async () => {
      process.env.LLM_ENABLED = 'false'
      const { generateLlmAnswer } = await import('../../server/src/services/llmService.js')

      const result = await generateLlmAnswer({
        query: '测试',
        entities: [],
        citations: [],
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('LLM_SERVICE_DISABLED')
    })

    it('请求超时时应返回超时错误', async () => {
      process.env.LLM_ENABLED = 'true'
      process.env.LLM_BASE_URL = 'http://localhost:8000'
      process.env.LLM_TIMEOUT = '100'

      // 模拟 AbortController
      global.fetch = vi.fn().mockImplementation((_, options) => {
        return new Promise((_, reject) => {
          const signal = options?.signal
          if (signal) {
            signal.addEventListener('abort', () => {
              const error = new Error('Aborted')
              error.name = 'AbortError'
              reject(error)
            })
          }
          // 永不 resolve，等待 abort
        })
      })

      const { generateLlmAnswer } = await import('../../server/src/services/llmService.js')

      const result = await generateLlmAnswer({
        query: '测试',
        entities: [{ title: '测试实体', type: 'person', snippet: '描述' }],
        citations: [],
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('LLM_TIMEOUT')
    }, 10000)

    it('API 返回非 200 时应返回错误', async () => {
      process.env.LLM_ENABLED = 'true'
      process.env.LLM_BASE_URL = 'http://localhost:8000'

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      const { generateLlmAnswer } = await import('../../server/src/services/llmService.js')

      const result = await generateLlmAnswer({
        query: '测试',
        entities: [{ title: '测试实体', type: 'person', snippet: '描述' }],
        citations: [],
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('LLM_API_ERROR')
    })
  })

  describe('getLlmConfig', () => {
    it('应返回当前 LLM 配置', async () => {
      process.env.LLM_ENABLED = 'true'
      process.env.LLM_BASE_URL = 'http://localhost:8000'
      process.env.LLM_MODEL = 'Xunzi-Qwen1.5-4B'
      process.env.LLM_TIMEOUT = '60000'
      process.env.LLM_MAX_TOKENS = '1024'
      process.env.LLM_TEMPERATURE = '0.5'

      const { getLlmConfig } = await import('../../server/src/services/llmService.js')

      const config = getLlmConfig()

      expect(config.enabled).toBe(true)
      expect(config.baseUrl).toBe('http://localhost:8000')
      expect(config.model).toBe('Xunzi-Qwen1.5-4B')
      expect(config.timeout).toBe(60000)
      expect(config.maxTokens).toBe(1024)
      expect(config.temperature).toBe(0.5)
    })
  })
})
