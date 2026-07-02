/**
 * 诗文 AI 赏析路由
 *
 * 提供诗文 AI 赏析生成端点：
 * - /api/v1/poems/ai-analysis
 *
 * @module server/src/routes/poemRoutes
 */

/**
 * 注册诗文 AI 赏析路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.llmService - LLM 服务
 * @param {Function} deps.apiV1Response - 响应格式化函数
 * @param {Function} deps.apiV1Error - 错误格式化函数
 */
export function registerPoemRoutes(app, deps) {
  const { llmService, apiV1Response, apiV1Error } = deps
  const {
    isLlmEnabled,
    generateLlmTextByPrompt,
    normalizePoemAnalysisInput,
    buildPoemAiAnalysisFallback,
    buildPoemAiAnalysisPrompt,
  } = llmService

  function sanitizePoemAnalysisText(rawText) {
    const normalized = String(rawText || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
    if (!normalized) return ''

    return normalized
      .replace(/\bdisillusion\b/gi, '幻灭感')
      .replace(/\bnostalgia\b/gi, '怀旧情绪')
      .replace(/\bmelancholy\b/gi, '忧郁情绪')
  }

  /**
   * POST /api/v1/poems/ai-analysis
   * 生成诗文 AI 解读赏析
   */
  app.post('/api/v1/poems/ai-analysis', async (req, res) => {
    try {
      const input = normalizePoemAnalysisInput(req.body || {})
      if (!input.fullText) {
        throw apiV1Error('INVALID_PARAMS', 'fullText 不能为空', null, 400)
      }

      const fallbackAnalysis = buildPoemAiAnalysisFallback(input)
      if (!isLlmEnabled()) {
        return res.json(apiV1Response({ analysis: fallbackAnalysis, source: 'fallback', reason: 'LLM_SERVICE_DISABLED' }))
      }

      const { systemPrompt, userPrompt } = buildPoemAiAnalysisPrompt(input)
      const llmResult = await generateLlmTextByPrompt({
        systemPrompt,
        userPrompt,
        temperature: 0.4,
      })

      if (llmResult.success && llmResult.text) {
        const analysisText = sanitizePoemAnalysisText(llmResult.text)
        return res.json(
          apiV1Response({
            analysis: analysisText,
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
          analysis: fallbackAnalysis,
          source: 'fallback',
          reason: llmResult.error || 'LLM_UNKNOWN_ERROR',
        }),
      )
    } catch (error) {
      if (error.response) {
        return res.status(error.statusCode).json(error.response)
      }
      console.error('Error in POST /api/v1/poems/ai-analysis:', error)
      res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
    }
  })
}

export default registerPoemRoutes
