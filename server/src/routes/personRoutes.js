/**
 * AI 介绍路由
 *
 * 提供人物 AI 介绍生成端点：
 * - /api/v1/persons/ai-intro
 *
 * 注意：这个路由需要 LLM 服务依赖。
 *
 * @module server/src/routes/personRoutes
 */

/**
 * 注册 AI 介绍路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.llmService - LLM 服务
 * @param {Function} deps.apiV1Response - 响应格式化函数
 * @param {Function} deps.apiV1Error - 错误格式化函数
 */
export function registerPersonRoutes(app, deps) {
  const { llmService, apiV1Response, apiV1Error } = deps
  const {
    isLlmEnabled,
    generateLlmTextByPrompt,
    normalizePlainText,
    extractPersonReferredContents,
    buildPersonAiIntroFallback,
  } = llmService

  /**
   * POST /api/v1/persons/ai-intro
   * 生成人物 AI 介绍
   */
  app.post('/api/v1/persons/ai-intro', async (req, res) => {
    try {
      const name = normalizePlainText(req.body?.name, 80)
      const referredContents = extractPersonReferredContents(req.body?.referredContents, 24)

      if (!referredContents.length) {
        throw apiV1Error('INVALID_PARAMS', 'referredContents 不能为空', null, 400)
      }

      const fallbackIntro = buildPersonAiIntroFallback(name, referredContents)
      if (!isLlmEnabled()) {
        return res.json(apiV1Response({ intro: fallbackIntro, source: 'fallback', reason: 'LLM_SERVICE_DISABLED' }))
      }

      const systemPrompt = `【角色】
你是一个中文历史人物讲解助手，负责把资料改写成普通用户易懂的人物介绍。

【规则】
1) 严格基于输入资料，不允许编造；
2) 资料冲突或不完整时，必须明确指出不确定性；
3) 输出纯文本，不输出项目符号，不输出模板标签；
4) 不要出现“根据资料”“检索结果显示”等流程套话。

【输入】
你将收到人物姓名和若干资料片段。

【风格】
简洁、自然、口语化，面向普通用户，控制在 1 到 2 段。

【输出】
直接输出最终介绍正文。`
      const userPrompt = `【角色】
你是中文历史人物讲解助手。

【规则】
仅使用给定资料进行介绍，禁止编造，发现冲突时要说明。

【输入】
人物姓名：${name || '未知'}
资料片段：
${referredContents.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}

【风格】
简洁自然，通俗易懂，控制在 220 字以内。

【输出】
请直接输出最终介绍文本。`

      const llmResult = await generateLlmTextByPrompt({
        systemPrompt,
        userPrompt,
        temperature: 0.4,
      })

      if (llmResult.success && llmResult.text) {
        return res.json(
          apiV1Response({
            intro: normalizePlainText(llmResult.text, 500),
            source: 'llm',
            trace: {
              elapsedMs: llmResult.elapsedMs,
              usage: llmResult.usage,
            },
          }),
        )
      }

      return res.json(
        apiV1Response({
          intro: fallbackIntro,
          source: 'fallback',
          reason: llmResult.error || 'LLM_UNKNOWN_ERROR',
        }),
      )
    } catch (error) {
      if (error.response) {
        return res.status(error.statusCode).json(error.response)
      }
      console.error('Error in POST /api/v1/persons/ai-intro:', error)
      res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
    }
  })
}

export default registerPersonRoutes
