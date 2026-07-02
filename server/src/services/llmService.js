/**
 * LLM 服务模块（重导出入口）
 *
 * 保持向后兼容，从模块化子目录重新导出所有 API
 *
 * @module server/src/services/llmService
 */

// 从子模块重新导出所有公共 API
export {
  // 配置管理
  isLlmEnabled,
  getLlmConfig,
  resolveLlmConfig,
  buildLlmRequestHeaders,
  buildLlmRequestBody,

  // 提示词构建
  buildRagPrompt,
  buildPoemAiAnalysisPrompt,
  buildPoemAiAnalysisFallback,
  normalizePoemAnalysisInput,

  // 降级策略
  ensurePoemListCoverage,
  buildPersonAiIntroFallback,

  // 工具函数
  normalizePlainText,
  extractPersonReferredContents,
  clipEvidenceText,

  // 核心生成函数
  generateLlmAnswer,
  generateLlmAnswerStream,
  generateLlmTextByPrompt,
  buildFusionAnswer,
} from './llm/index.js'

// 客户端类
export { LlmClient } from './llm/client.js'
