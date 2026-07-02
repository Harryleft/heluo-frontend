/**
 * Gateways 统一入口
 *
 * 导出所有基础设施层 Gateway，提供统一的外部服务访问接口。
 *
 * @module server/src/infra/gateways
 */

export {
  setMarklogicFetchForTest,
  resetMarklogicFetch,
  mlGetJson,
  mlGetDoc,
  mlSearchByDirectory,
  mlSearchByCollection,
  getMarklogicConfig,
} from './marklogicGateway.js'

export {
  getEmbedding,
  getEmbeddings,
  cosineSimilarity,
  getEmbeddingGatewayConfig,
  getCacheStats,
  clearCache,
} from './embeddingGateway.js'

export {
  isEnabled as isLlmEnabled,
  getConfig as getLlmGatewayConfig,
  generateCompletion,
  generateByPrompt,
  generateStream,
  buildPrompt,
  ensurePoemCoverage,
  buildAnswer,
} from './llmGateway.js'
