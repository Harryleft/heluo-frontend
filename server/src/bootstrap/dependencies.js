/**
 * 依赖注入容器与应用装配
 *
 * 提供统一的依赖管理机制：
 * - 初始化所有服务、网关、仓储
 * - 支持依赖注入和测试替换
 * - 解耦组件间的直接依赖
 * - 收敛 app.js 的依赖拼装细节
 *
 * @module server/src/bootstrap/dependencies
 */

import { config, marklogicConfig, searchConfig, vectorConfig } from './config.js'
import { createUseCases } from '../usecases/index.js'
import { createControllers, apiV1Response, apiV1Error } from '../controllers/index.js'
import {
  buildFusionAnswer,
  ensurePoemListCoverage,
  generateLlmAnswerStream,
  generateLlmTextByPrompt,
  isLlmEnabled,
  normalizePlainText,
  extractPersonReferredContents,
  buildPersonAiIntroFallback,
  normalizePoemAnalysisInput,
  buildPoemAiAnalysisFallback,
  buildPoemAiAnalysisPrompt,
} from '../services/llmService.js'
import { getEmbedding } from '../services/embeddingService.js'
import {
  mlVectorSearch,
  isVectorSearchEnabled,
  VECTOR_CONFIG,
} from '../services/vectorSearchService.js'
import {
  mlGetJson,
  mlGetDoc,
  mlSearchByDirectory,
  mlSearchByCollection,
} from '../infra/gateways/marklogicGateway.js'

// ============================================================================
// 依赖注入容器类型定义
// ============================================================================

/**
 * @typedef {object} DependencyContainer
 * @property {object} gateways - 外部服务网关
 * @property {object} services - 业务服务
 * @property {object} repositories - 数据仓储
 * @property {object} caches - 缓存实例
 * @property {object} utils - 工具函数
 */

// ============================================================================
// 依赖注入容器初始化
// ============================================================================

/**
 * 初始化依赖注入容器
 *
 * @param {object} [appConfig] - 应用配置（默认使用 config 模块）
 * @returns {DependencyContainer} 依赖注入容器
 *
 * @example
 * // 标准初始化
 * const container = initDependencies()
 * const mlGateway = container.gateways.marklogic
 *
 * @example
 * // 使用自定义配置初始化
 * const customConfig = { ...config, server: { port: 9000 } }
 * const container = initDependencies(customConfig)
 */
export function initDependencies(appConfig = config) {
  // 依赖容器骨架
  const container = {
    /** 外部服务网关（MarkLogic、LLM 等） */
    gateways: {},
    /** 业务服务（搜索、融合、详情等） */
    services: {},
    /** 数据仓储（实体、文档等） */
    repositories: {},
    /** 缓存实例（详情缓存、向量缓存等） */
    caches: {},
    /** 工具函数和辅助方法 */
    utils: {},
    /** 配置引用 */
    config: appConfig,
  }

  // TODO: 逐步迁移以下组件到容器中
  //
  // Gateways（网关层）:
  // - marklogic: MarkLogic 数据库访问
  // - llm: 大语言模型调用
  // - embedding: 向量嵌入服务
  //
  // Services（服务层）:
  // - search: 统一搜索服务
  // - fusion: 融合问答服务
  // - detail: 详情页服务
  //
  // Repositories（仓储层）:
  // - entity: 实体数据仓储
  // - document: 文档数据仓储
  //
  // Caches（缓存层）:
  // - detail: 详情页缓存
  // - vector: 向量文档缓存
  // - poem: 诗词信息缓存

  return container
}

// ============================================================================
// 应用装配辅助函数
// ============================================================================

/**
 * 构建网关依赖
 *
 * @returns {object} 网关依赖
 */
export function buildGateways() {
  return {
    mlGetJson,
    mlGetDoc,
    mlSearchByDirectory,
    mlSearchByCollection,
    getEmbedding,
    llmGateway: {
      buildFusionAnswer,
      ensurePoemCoverage: ensurePoemListCoverage,
      generateStream: generateLlmAnswerStream,
      generateLlmTextByPrompt,
      isLlmEnabled,
    },
  }
}

/**
 * 构建检索器依赖
 *
 * @returns {object} 检索器依赖
 */
export function buildRetrievers() {
  return {
    getEmbedding,
    mlVectorSearch,
    isVectorSearchEnabled,
  }
}

/**
 * 构建路由层专属依赖
 *
 * @param {Function} marklogicFetch - MarkLogic fetch 函数
 * @returns {object} 路由依赖
 */
export function buildRouteDeps(marklogicFetch) {
  return {
    vectorService: {
      isVectorSearchEnabled,
      getEmbedding,
      mlVectorSearch,
    },
    config: {
      searchMode: searchConfig.mode,
      vectorConfig: VECTOR_CONFIG,
      marklogicFetch,
      marklogicBaseUrl: marklogicConfig.baseUrl,
    },
    marklogicFetch,
    marklogicBaseUrl: marklogicConfig.baseUrl,
    llmService: {
      buildFusionAnswer,
      ensurePoemListCoverage,
      generateLlmAnswerStream,
      generateLlmTextByPrompt,
      isLlmEnabled,
      normalizePlainText,
      extractPersonReferredContents,
      buildPersonAiIntroFallback,
      normalizePoemAnalysisInput,
      buildPoemAiAnalysisFallback,
      buildPoemAiAnalysisPrompt,
    },
    apiV1Response,
    apiV1Error,
  }
}

/**
 * 构建完整应用依赖
 *
 * @param {Function} marklogicFetch - MarkLogic fetch 函数
 * @returns {{gateways: object, retrievers: object, useCases: object, controllers: object, routeDeps: object}}
 */
export function buildAppDependencies(marklogicFetch) {
  const gateways = buildGateways()
  const retrievers = buildRetrievers()
  const useCases = createUseCases({
    gateways,
    retrievers,
  })

  const controllers = createControllers({
    useCases,
    gateways,
    config: {
      marklogicBaseUrl: marklogicConfig.baseUrl,
      searchMode: searchConfig.mode,
      scopeTimeoutMs: searchConfig.scopeTimeoutMs,
      vectorTimeoutMs: vectorConfig.searchTimeoutMs,
    },
    marklogicFetch,
  })

  const routeDeps = buildRouteDeps(marklogicFetch)

  return {
    gateways,
    retrievers,
    useCases,
    controllers,
    routeDeps,
  }
}

// ============================================================================
// 全局容器实例（可选）
// ============================================================================

/**
 * 全局依赖容器实例
 *
 * 注意：推荐在应用启动时显式调用 initDependencies() 创建容器，
 * 并通过参数传递给需要的模块，以保持更好的可测试性。
 *
 * 此全局实例仅用于向后兼容和简单场景。
 */
let globalContainer = null

/**
 * 获取全局依赖容器
 *
 * @param {object} [appConfig] - 应用配置（首次调用时使用）
 * @returns {DependencyContainer} 全局依赖容器
 */
export function getContainer(appConfig = config) {
  if (!globalContainer) {
    globalContainer = initDependencies(appConfig)
  }
  return globalContainer
}

/**
 * 重置全局容器（主要用于测试）
 */
export function resetContainer() {
  globalContainer = null
}

// ============================================================================
// 依赖注入辅助函数
// ============================================================================

/**
 * 创建 TTL 缓存实例
 *
 * @param {number} [maxSize=1000] - 最大条目数
 * @param {number} [ttlMs=60000] - 过期时间（毫秒）
 * @returns {{ get: Function, set: Function, clear: Function }} 缓存实例
 */
export function createTtlCache(maxSize = 1000, ttlMs = 60 * 1000) {
  const storage = new Map()
  const safeMaxSize = Math.max(100, Number(maxSize) || 1000)
  const safeTtlMs = Math.max(1000, Number(ttlMs) || 60 * 1000)

  const get = (key) => {
    const entry = storage.get(key)
    if (!entry) return undefined
    if (entry.expiredAt <= Date.now()) {
      storage.delete(key)
      return undefined
    }
    return entry.value
  }

  const set = (key, value) => {
    if (storage.size >= safeMaxSize) {
      const oldestKey = storage.keys().next().value
      if (oldestKey) storage.delete(oldestKey)
    }
    storage.set(key, {
      value,
      expiredAt: Date.now() + safeTtlMs,
    })
  }

  const clear = () => {
    storage.clear()
  }

  return { get, set, clear }
}

export default {
  initDependencies,
  getContainer,
  resetContainer,
  createTtlCache,
  buildGateways,
  buildRetrievers,
  buildRouteDeps,
  buildAppDependencies,
}
