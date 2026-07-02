/**
 * Controllers 层统一入口
 *
 * 负责处理 HTTP 请求解析、参数校验、响应包装。
 * 通过依赖注入解耦 UseCases 层，不包含业务逻辑。
 *
 * ## 架构原则
 *
 * 1. Controllers 层依赖 UseCases 层（业务用例）
 * 2. Controllers 层不依赖 Express 以外的库
 * 3. Controllers 层只处理 HTTP 协议相关逻辑
 * 4. 通过构造函数注入依赖
 *
 * ## 模块结构
 *
 * - healthController: 健康检查控制器
 * - statsController: 统计接口控制器
 * - searchController: 搜索接口控制器
 * - fusionController: 融合问答控制器
 * - detailController: 详情接口控制器
 *
 * @module server/src/controllers
 */

// ============================================================================
// 控制器导出
// ============================================================================

export {
  createHealthController,
  apiV1Response,
  apiV1Error,
} from './healthController.js'

export { createStatsController } from './statsController.js'

export {
  createSearchController,
  parsePaginationParams,
  parseTypeFilter,
  parseSearchMode,
} from './searchController.js'

export {
  createFusionController,
  normalizeFusionMode,
  parseFusionDims,
  parseFusionTopK,
  parseFusionBoolean,
  parseFusionConversationHistory,
} from './fusionController.js'

export {
  createDetailController,
  extractIdFromUri,
} from './detailController.js'

// ============================================================================
// 控制器工厂
// ============================================================================

import { createHealthController, apiV1Response, apiV1Error } from './healthController.js'
import { createStatsController } from './statsController.js'
import { createSearchController } from './searchController.js'
import { createFusionController } from './fusionController.js'
import { createDetailController } from './detailController.js'

/**
 * 创建所有控制器实例
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.useCases - 用例依赖
 * @param {object} dependencies.gateways - 网关依赖
 * @param {object} dependencies.config - 配置依赖
 * @param {Function} dependencies.marklogicFetch - MarkLogic fetch 函数
 * @returns {object} 所有控制器实例
 *
 * @example
 * const controllers = createControllers({
 *   useCases: {
 *     searchUnified,
 *     fusionQuery,
 *     fusionStream,
 *     getDetail,
 *   },
 *   gateways: {
 *     mlGetDoc,
 *     mlSearchByDirectory,
 *     mlSearchByCollection,
 *   },
 *   config: {
 *     marklogicBaseUrl: 'http://localhost:8003',
 *     searchMode: 'keyword',
 *     scopeTimeoutMs: 15000,
 *   },
 *   marklogicFetch: mlClient.fetch,
 * })
 *
 * // 使用健康检查控制器
 * app.get('/health', controllers.health.health)
 *
 * // 使用搜索控制器
 * app.get('/api/v1/search', controllers.search.search)
 */
export function createControllers(dependencies) {
  const { useCases, gateways, config, marklogicFetch } = dependencies
  const { marklogicBaseUrl, searchMode, scopeTimeoutMs, vectorTimeoutMs } = config

  return {
    // 健康检查控制器
    health: createHealthController({
      marklogicBaseUrl,
    }),

    // 统计控制器
    stats: createStatsController({
      gateways,
    }),

    // 搜索控制器
    search: createSearchController({
      useCases,
      config: {
        searchMode,
        scopeTimeoutMs,
      },
      marklogicFetch,
      marklogicBaseUrl,
    }),

    // 融合问答控制器
    fusion: createFusionController({
      useCases,
      config: {
        scopeTimeoutMs,
        marklogicBaseUrl,
        vectorTimeoutMs,
      },
      marklogicFetch,
    }),

    // 详情控制器
    detail: createDetailController({
      useCases,
      gateways,
    }),
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createHealthController,
  createStatsController,
  createSearchController,
  createFusionController,
  createDetailController,
  createControllers,
  apiV1Response,
  apiV1Error,
}
